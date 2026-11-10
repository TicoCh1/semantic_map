"""Build full OSM ``highway=*`` road layers for every city study project.

The extraction scope is the *largest existing study-boundary polygon* for each
city.  OSM must be queried with rectangular tiles, but every line is precisely
clipped back to that selected polygon before it is written.  No highway values
are filtered: the output retains every OSM way tagged ``highway=*`` so the
researcher can decide the final inclusion criteria in QGIS.

Run with QGIS' bundled Python, for example:
  & 'C:\\Program Files\\QGIS 3.40.11\\bin\\python-qgis-ltr.bat' scripts\\build_all_osm_highways.py

Set URBANFABRIC_HIGHWAY_CITIES to a comma-separated list of project stems to
run a small subset while testing (for example ``Rome_Vatican_study_extent``).
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import shutil
import time
import xml.etree.ElementTree as ElementTree
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import requests
from qgis.PyQt.QtCore import QVariant
from qgis.PyQt.QtGui import QColor
from qgis.core import (
    QgsApplication,
    QgsCategorizedSymbolRenderer,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsFields,
    QgsGeometry,
    QgsLineSymbol,
    QgsPointXY,
    QgsProject,
    QgsRendererCategory,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "outputs" / "qgis_city_study_extents"
CACHE_DIR = OUTPUT_DIR / "osm_highway_cache"
PBF_CACHE_DIR = OUTPUT_DIR / "osm_highway_pbf_cache"
USER_AGENT = "urbanfabric-osm-highway-extractor/1.0 (research use)"
OVERPASS_ENDPOINTS = (
    # Both endpoints were verified against a New York query during this build.
    # Do not use regional extracts here: they can return a valid but incomplete
    # zero-result response outside their geographic coverage.
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
)
OSM_MAP_API = "https://api.openstreetmap.org/api/0.6/map"

# Each 0.10° tile is small enough to keep dense-city responses practical.  The
# one kilometre query margin lets ways that cross the study boundary arrive with
# complete geometry before their final exact clip.
TILE_SIZE_DEGREES = 0.10
QUERY_MARGIN_DEGREES = 0.01


@dataclass(frozen=True)
class CitySpec:
    stem: str
    display_name: str

    @property
    def project_path(self) -> Path:
        return OUTPUT_DIR / f"{self.stem}.qgz"

    @property
    def primary_boundary_path(self) -> Path:
        return OUTPUT_DIR / f"{self.stem}.gpkg"

    @property
    def output_path(self) -> Path:
        return OUTPUT_DIR / f"{self.stem}_osm_highways_all.gpkg"


CITIES = (
    CitySpec("Rome_Vatican_study_extent", "Rome + Vatican City"),
    CitySpec("New_York_study_extent", "New York"),
    CitySpec("Paris_study_extent", "Paris"),
    CitySpec("Tokyo_study_extent", "Tokyo"),
    CitySpec("Boston_study_extent", "Boston"),
    CitySpec("Kyoto_study_extent", "Kyoto"),
    CitySpec("Beijing_study_extent", "Beijing"),
    CitySpec("Berlin_study_extent", "Berlin"),
    CitySpec("Vienna_study_extent", "Vienna"),
    CitySpec("Hong_Kong_study_extent", "Hong Kong"),
    CitySpec("Shenzhen_study_extent", "Shenzhen"),
)

# BBBike's New York city PBF is a compact OSM extract whose published envelope
# was checked to contain the largest New York study polygon.  It avoids a large
# number of public API requests in the densest city in this set.  Every PBF
# candidate is checked again against the selected study-boundary extent before
# it can be used.
PBF_SOURCES = {
    "New_York_study_extent": OUTPUT_DIR / "NewYork.osm.pbf",
    "Paris_study_extent": OUTPUT_DIR / "Paris.osm.pbf",
    "Beijing_study_extent": OUTPUT_DIR / "Beijing.osm.pbf",
    "Berlin_study_extent": OUTPUT_DIR / "Berlin.osm.pbf",
    "Vienna_study_extent": OUTPUT_DIR / "Wien.osm.pbf",
    "Hong_Kong_study_extent": OUTPUT_DIR / "HongKong.osm.pbf",
    "Shenzhen_study_extent": OUTPUT_DIR / "Guangdong.osm.pbf",
    "Boston_study_extent": OUTPUT_DIR / "Massachusetts.osm.pbf",
    "Tokyo_study_extent": OUTPUT_DIR / "Kanto.osm.pbf",
    "Kyoto_study_extent": OUTPUT_DIR / "Japan_verified.osm.pbf",
}
PBF_SOURCE_LABELS = {
    "Hong_Kong_study_extent": "OpenStreetMap via Geofabrik Hong Kong PBF",
    "Shenzhen_study_extent": "OpenStreetMap via Geofabrik Guangdong PBF",
    "Boston_study_extent": "OpenStreetMap via Geofabrik Massachusetts PBF",
    "Tokyo_study_extent": "OpenStreetMap via Geofabrik Kanto PBF",
    "Kyoto_study_extent": "OpenStreetMap via Geofabrik Japan PBF",
}


def selected_cities() -> tuple[CitySpec, ...]:
    selected = {item.strip() for item in os.environ.get("URBANFABRIC_HIGHWAY_CITIES", "").split(",") if item.strip()}
    return tuple(city for city in CITIES if not selected or city.stem in selected)


def boundary_candidates(city: CitySpec) -> list[Path]:
    """Return every local vector option that is a candidate city boundary."""
    candidates = [city.primary_boundary_path]
    city_prefix = city.stem.removesuffix("_study_extent")
    candidates.extend(sorted(OUTPUT_DIR.glob(f"{city_prefix}_Option_*.gpkg")))
    return [path for path in candidates if path.exists()]


def largest_study_boundary(city: CitySpec) -> tuple[QgsGeometry, QgsCoordinateReferenceSystem, Path, float]:
    """Load the largest polygon option in local metre units.

    This makes the 'maximum permitted extent' explicit.  At present the base
    study extent is the largest option for New York, Berlin and Shenzhen; the
    comparison remains data-driven if a later option is added.
    """
    selected: tuple[QgsGeometry, QgsCoordinateReferenceSystem, Path, float] | None = None
    for path in boundary_candidates(city):
        layer = QgsVectorLayer(str(path), path.stem, "ogr")
        if not layer.isValid() or layer.featureCount() != 1:
            raise RuntimeError(f"Could not read the boundary candidate {path.name}")
        feature = next(layer.getFeatures())
        geometry = QgsGeometry(feature.geometry())
        if geometry.isEmpty() or QgsWkbTypes.geometryType(geometry.wkbType()) != QgsWkbTypes.PolygonGeometry:
            raise RuntimeError(f"Boundary candidate {path.name} is not a polygon")
        area_km2 = geometry.area() / 1_000_000
        if selected is None or area_km2 > selected[3]:
            selected = (geometry, layer.crs(), path, area_km2)
    if selected is None:
        raise RuntimeError(f"No local boundary GeoPackage was found for {city.display_name}")
    return selected


def make_tiles(boundary: QgsGeometry, boundary_crs: QgsCoordinateReferenceSystem) -> list[tuple[float, float, float, float]]:
    """Return WGS84 query tiles that intersect the selected boundary."""
    wgs84 = QgsCoordinateReferenceSystem("EPSG:4326")
    boundary_wgs84 = QgsGeometry(boundary)
    to_wgs84 = QgsCoordinateTransform(boundary_crs, wgs84, QgsProject.instance().transformContext())
    if boundary_wgs84.transform(to_wgs84) != 0:
        raise RuntimeError("Could not transform the study boundary to EPSG:4326")
    extent = boundary_wgs84.boundingBox()
    tiles: list[tuple[float, float, float, float]] = []
    rows = max(1, math.ceil(extent.height() / TILE_SIZE_DEGREES))
    cols = max(1, math.ceil(extent.width() / TILE_SIZE_DEGREES))
    for row in range(rows):
        south = extent.yMinimum() + row * extent.height() / rows
        north = extent.yMinimum() + (row + 1) * extent.height() / rows
        for col in range(cols):
            west = extent.xMinimum() + col * extent.width() / cols
            east = extent.xMinimum() + (col + 1) * extent.width() / cols
            tile = QgsGeometry.fromRect(type(extent)(west, south, east, north))
            if tile.intersects(boundary_wgs84):
                tiles.append((south, west, north, east))
    return tiles


def tile_cache_path(city: CitySpec, tile: tuple[float, float, float, float]) -> Path:
    encoded = "_".join(f"{coordinate:.5f}" for coordinate in tile)
    return CACHE_DIR / city.stem / f"{encoded}.json.gz"


def overpass_query(tile: tuple[float, float, float, float]) -> str:
    south, west, north, east = tile
    return f'''[out:json][timeout:360][maxsize:536870912];
way["highway"]({south - QUERY_MARGIN_DEGREES:.6f},{west - QUERY_MARGIN_DEGREES:.6f},{north + QUERY_MARGIN_DEGREES:.6f},{east + QUERY_MARGIN_DEGREES:.6f});
out tags geom;'''


def cache_elements(cache_path: Path, endpoint: str, elements: list[dict[str, object]]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_cache = cache_path.with_suffix(".tmp")
    with gzip.open(temporary_cache, "wt", encoding="utf-8") as stream:
        json.dump({"endpoint": endpoint, "fetched_utc": datetime.now(UTC).isoformat(), "elements": elements}, stream)
    temporary_cache.replace(cache_path)


def fetch_from_osm_map_api(session: requests.Session, tile: tuple[float, float, float, float]) -> list[dict[str, object]]:
    """Use the main OSM map endpoint only for a failed tiny tile.

    This endpoint is intentionally not a normal download route.  Its maximum
    request area is small; using it only after one round of spatial splitting
    provides a reliable, standards-based escape hatch for isolated Overpass
    504s without broad or wasteful downloads.
    """
    south, west, north, east = tile
    response = session.get(
        OSM_MAP_API,
        params={"bbox": f"{west:.8f},{south:.8f},{east:.8f},{north:.8f}"},
        timeout=120,
    )
    response.raise_for_status()
    root = ElementTree.fromstring(response.content)
    nodes: dict[str, tuple[float, float]] = {}
    for node in root.findall("node"):
        node_id = node.get("id")
        latitude = node.get("lat")
        longitude = node.get("lon")
        if node_id and latitude and longitude:
            nodes[node_id] = (float(longitude), float(latitude))
    elements: list[dict[str, object]] = []
    for way in root.findall("way"):
        tags = {tag.get("k", ""): tag.get("v", "") for tag in way.findall("tag")}
        if "highway" not in tags:
            continue
        geometry = [
            {"lon": nodes[reference][0], "lat": nodes[reference][1]}
            for nd in way.findall("nd")
            if (reference := nd.get("ref")) in nodes
        ]
        if len(geometry) >= 2 and way.get("id"):
            elements.append({"type": "way", "id": int(way.get("id")), "tags": tags, "geometry": geometry})
    return elements


def split_tile(tile: tuple[float, float, float, float]) -> tuple[tuple[float, float, float, float], ...]:
    south, west, north, east = tile
    middle_lat = (south + north) / 2
    middle_lon = (west + east) / 2
    return (
        (south, west, middle_lat, middle_lon), (south, middle_lon, middle_lat, east),
        (middle_lat, west, north, middle_lon), (middle_lat, middle_lon, north, east),
    )


def fetch_tile(
    session: requests.Session,
    city: CitySpec,
    tile: tuple[float, float, float, float],
    depth: int = 0,
    main_api_only: bool = False,
) -> list[dict[str, object]]:
    """Fetch and cache one Overpass tile, using a public endpoint fallback."""
    cache_path = tile_cache_path(city, tile)
    if cache_path.exists() and cache_path.stat().st_size > 0:
        try:
            with gzip.open(cache_path, "rt", encoding="utf-8") as stream:
                return json.load(stream).get("elements", [])
        except (OSError, json.JSONDecodeError):
            # A process interrupted mid-write leaves no usable cache.  It is a
            # derived file, so safely discard it and re-request only this tile.
            cache_path.unlink()
    if main_api_only:
        try:
            elements = fetch_from_osm_map_api(session, tile)
            cache_elements(cache_path, OSM_MAP_API, elements)
            time.sleep(1)
            return elements
        except requests.HTTPError:
            # The main API returns HTTP 400 when a tiny but exceptionally dense
            # tile exceeds its element limit.  Keep splitting only that tile;
            # a depth of four makes a worst-case request roughly 500 metres.
            if depth < 4:
                print(json.dumps({"city": city.display_name, "retry": "split OSM main API element-limit tile", "depth": depth + 1, "tile": tile}, ensure_ascii=False), flush=True)
                elements: list[dict[str, object]] = []
                for child in split_tile(tile):
                    elements.extend(fetch_tile(session, city, child, depth + 1, main_api_only=True))
                return elements
            raise
    query = overpass_query(tile)
    last_error: Exception | None = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            # An overloaded mirror should fall through to the next independent
            # endpoint instead of holding the city build indefinitely.
            response = session.post(endpoint, data={"data": query}, timeout=40)
            response.raise_for_status()
            payload = response.json()
            if "remark" in payload and not payload.get("elements"):
                raise RuntimeError(str(payload["remark"]))
            elements = payload.get("elements")
            if not isinstance(elements, list):
                raise RuntimeError("Overpass response does not contain an elements array")
            cache_elements(cache_path, endpoint, elements)
            return elements
        except Exception as error:  # retry against the next independent endpoint
            last_error = error
            time.sleep(2)
    # Congested Overpass tiles are retried as smaller spatial pieces.  The
    # parent tile is never recorded as cached unless its own response was
    # complete, and OSM IDs are de-duplicated before output.
    if depth < 1:
        print(json.dumps({"city": city.display_name, "retry": "split tile", "depth": depth + 1, "tile": tile}, ensure_ascii=False), flush=True)
        elements: list[dict[str, object]] = []
        for child in split_tile(tile):
            elements.extend(fetch_tile(session, city, child, depth + 1))
        return elements
    try:
        print(json.dumps({"city": city.display_name, "retry": "OSM main API small-tile fallback", "tile": tile}, ensure_ascii=False), flush=True)
        elements = fetch_from_osm_map_api(session, tile)
        cache_elements(cache_path, OSM_MAP_API, elements)
        time.sleep(1)
        return elements
    except Exception as map_error:
        last_error = map_error
        if depth < 2:
            print(json.dumps({"city": city.display_name, "retry": "split after OSM main API limit", "depth": depth + 1, "tile": tile}, ensure_ascii=False), flush=True)
            elements: list[dict[str, object]] = []
            for child in split_tile(tile):
                elements.extend(fetch_tile(session, city, child, depth + 1, main_api_only=True))
            return elements
    raise RuntimeError(f"Could not download OSM highway tile {tile}: {last_error}")


def output_fields() -> QgsFields:
    fields = QgsFields()
    fields.append(QgsField("osm_way_id", QVariant.String, "string", 20))
    fields.append(QgsField("highway", QVariant.String, "string", 80))
    fields.append(QgsField("name", QVariant.String, "string", 255))
    fields.append(QgsField("ref", QVariant.String, "string", 255))
    fields.append(QgsField("lanes", QVariant.String, "string", 255))
    fields.append(QgsField("lanes_forward", QVariant.String, "string", 255))
    fields.append(QgsField("lanes_backward", QVariant.String, "string", 255))
    fields.append(QgsField("oneway", QVariant.String, "string", 255))
    fields.append(QgsField("maxspeed", QVariant.String, "string", 255))
    fields.append(QgsField("surface", QVariant.String, "string", 255))
    fields.append(QgsField("bridge", QVariant.String, "string", 255))
    fields.append(QgsField("tunnel", QVariant.String, "string", 255))
    fields.append(QgsField("source", QVariant.String, "string", 80))
    fields.append(QgsField("download_scope", QVariant.String, "string", 255))
    fields.append(QgsField("fetched_utc", QVariant.String, "string", 40))
    fields.append(QgsField("other_tags", QVariant.String, "string", 0))
    return fields


def tags_to_attributes(element: dict[str, object], scope: str, fetched_utc: str) -> list[str | None]:
    tags = element.get("tags", {})
    if not isinstance(tags, dict):
        tags = {}
    get = lambda key: str(tags[key]) if key in tags else None
    return [
        str(element.get("id")), get("highway"), get("name"), get("ref"), get("lanes"),
        get("lanes:forward"), get("lanes:backward"), get("oneway"), get("maxspeed"),
        get("surface"), get("bridge"), get("tunnel"), "OpenStreetMap", scope, fetched_utc, json.dumps(tags, ensure_ascii=False),
    ]


def parse_osm_other_tags(value: object) -> dict[str, str]:
    """Read the GDAL OSM driver's hstore-style ``other_tags`` attribute."""
    if not value:
        return {}
    text = str(value)
    pairs: dict[str, str] = {}
    # GDAL encodes OSM tags as `"key"=>"value"`, with backslash escapes.
    import re
    for key, raw in re.findall(r'"((?:\\.|[^"\\])*)"=>"((?:\\.|[^"\\])*)"', text):
        pairs[key.replace(r'\\"', '"').replace(r'\\\\', '\\')] = raw.replace(r'\\"', '"').replace(r'\\\\', '\\')
    return pairs


def pbf_boundary_coverage(pbf_layer: QgsVectorLayer, boundary: QgsGeometry, boundary_crs: QgsCoordinateReferenceSystem) -> bool:
    boundary_wgs84 = QgsGeometry(boundary)
    to_wgs84 = QgsCoordinateTransform(boundary_crs, QgsCoordinateReferenceSystem("EPSG:4326"), QgsProject.instance().transformContext())
    if boundary_wgs84.transform(to_wgs84) != 0:
        return False
    required = boundary_wgs84.boundingBox()
    available = pbf_layer.extent()
    tolerance = 0.0001
    return (
        available.xMinimum() <= required.xMinimum() + tolerance
        and available.yMinimum() <= required.yMinimum() + tolerance
        and available.xMaximum() >= required.xMaximum() - tolerance
        and available.yMaximum() >= required.yMaximum() - tolerance
    )


def pbf_attributes(feature: QgsFeature, scope: str, fetched_utc: str, source_name: str) -> list[str | None]:
    other_tags_value = feature["other_tags"]
    tags = parse_osm_other_tags(other_tags_value)
    get = lambda key: tags.get(key)
    return [
        str(feature["osm_id"]), str(feature["highway"]), str(feature["name"]) if feature["name"] else get("name"), get("ref"),
        get("lanes"), get("lanes:forward"), get("lanes:backward"), get("oneway"), get("maxspeed"),
        get("surface"), get("bridge"), get("tunnel"), source_name, scope, fetched_utc,
        str(other_tags_value) if other_tags_value else None,
    ]


def write_highway_data_from_pbf(
    city: CitySpec,
    pbf_path: Path,
    boundary: QgsGeometry,
    target_crs: QgsCoordinateReferenceSystem,
    boundary_path: Path,
    area_km2: float,
    source_name: str,
) -> dict[str, object]:
    """Copy every PBF line with highway=* that intersects the exact study area."""
    pbf_layer = QgsVectorLayer(f"{pbf_path}|layername=lines", pbf_path.stem, "ogr")
    if not pbf_layer.isValid():
        raise RuntimeError(f"Could not open {pbf_path.name} as OSM PBF lines")
    if not pbf_boundary_coverage(pbf_layer, boundary, target_crs):
        raise RuntimeError(f"The PBF envelope does not fully cover {city.display_name}'s selected study polygon")
    if not pbf_layer.setSubsetString('"highway" IS NOT NULL'):
        raise RuntimeError(f"Could not set the highway filter on {pbf_path.name}")

    if city.output_path.exists():
        city.output_path.unlink()
    fields = output_fields()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "osm_highways_all"
    writer = QgsVectorFileWriter.create(
        str(city.output_path), fields, QgsWkbTypes.MultiLineString, target_crs,
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(f"Could not create {city.output_path.name}: {writer.errorMessage()}")
    to_target = QgsCoordinateTransform(pbf_layer.crs(), target_crs, QgsProject.instance().transformContext())
    boundary_engine = QgsGeometry.createGeometryEngine(boundary.constGet())
    boundary_engine.prepareGeometry()
    scope = f"Largest local study-boundary polygon: {boundary_path.name} ({area_km2:.3f} km2); source PBF {pbf_path.name}; exactly clipped"
    fetched_utc = datetime.now(UTC).isoformat()
    batch: list[QgsFeature] = []
    accepted = 0
    ignored = 0
    source_count = 0
    for source_count, source_feature in enumerate(pbf_layer.getFeatures(), start=1):
        geometry = QgsGeometry(source_feature.geometry())
        if geometry.isEmpty() or geometry.transform(to_target) != 0 or not boundary_engine.intersects(geometry.constGet()):
            ignored += 1
            continue
        clipped = geometry if boundary_engine.contains(geometry.constGet()) else geometry.intersection(boundary)
        if clipped.isEmpty() or QgsWkbTypes.geometryType(clipped.wkbType()) != QgsWkbTypes.LineGeometry:
            ignored += 1
            continue
        if QgsWkbTypes.isSingleType(clipped.wkbType()):
            clipped.convertToMultiType()
        feature = QgsFeature(fields)
        feature.setAttributes(pbf_attributes(source_feature, scope, fetched_utc, source_name))
        feature.setGeometry(clipped)
        batch.append(feature)
        if len(batch) >= 5000:
            if not writer.addFeatures(batch):
                raise RuntimeError(f"Could not write PBF roads for {city.display_name}: {writer.errorMessage()}")
            accepted += len(batch)
            batch.clear()
            print(json.dumps({"city": city.display_name, "source": "PBF", "scanned": source_count, "written": accepted}, ensure_ascii=False), flush=True)
    if batch:
        if not writer.addFeatures(batch):
            raise RuntimeError(f"Could not write final PBF roads for {city.display_name}: {writer.errorMessage()}")
        accepted += len(batch)
    del writer
    if accepted == 0:
        raise RuntimeError(f"No highway features were retained from {pbf_path.name} for {city.display_name}")
    return {"city": city.display_name, "features": accepted, "ignored": ignored, "source_features": source_count, "tiles": 0, "scope": scope}


def write_highway_data(city: CitySpec, boundary: QgsGeometry, target_crs: QgsCoordinateReferenceSystem, boundary_path: Path, area_km2: float) -> dict[str, object]:
    pbf_path = PBF_SOURCES.get(city.stem)
    if pbf_path and pbf_path.exists():
        source_name = PBF_SOURCE_LABELS.get(city.stem, "OpenStreetMap via BBBike city PBF")
        return write_highway_data_from_pbf(city, pbf_path, boundary, target_crs, boundary_path, area_km2, source_name)
    if city.output_path.exists():
        city.output_path.unlink()
    fields = output_fields()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "osm_highways_all"
    writer = QgsVectorFileWriter.create(
        str(city.output_path), fields, QgsWkbTypes.MultiLineString, target_crs,
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(f"Could not create {city.output_path.name}: {writer.errorMessage()}")

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
    wgs84 = QgsCoordinateReferenceSystem("EPSG:4326")
    to_target = QgsCoordinateTransform(wgs84, target_crs, QgsProject.instance().transformContext())
    tiles = make_tiles(boundary, target_crs)
    # Preparing the detailed study polygon once is crucial at city scale.  The
    # overwhelming majority of roads are fully inside it and can bypass the
    # costly geometric intersection; only edge-crossing roads are clipped.
    boundary_engine = QgsGeometry.createGeometryEngine(boundary.constGet())
    boundary_engine.prepareGeometry()
    seen_osm_ids: set[int] = set()
    accepted = 0
    ignored = 0
    scope = f"Largest local study-boundary polygon: {boundary_path.name} ({area_km2:.3f} km2); queried by OSM bbox tiles then exactly clipped"
    fetched_utc = datetime.now(UTC).isoformat()

    for tile_number, tile in enumerate(tiles, start=1):
        elements = fetch_tile(session, city, tile)
        batch: list[QgsFeature] = []
        for element in elements:
            osm_id = element.get("id")
            if not isinstance(osm_id, int) or osm_id in seen_osm_ids:
                continue
            seen_osm_ids.add(osm_id)
            geometry_points = element.get("geometry", [])
            if not isinstance(geometry_points, list) or len(geometry_points) < 2:
                ignored += 1
                continue
            try:
                points = [QgsPointXY(float(point["lon"]), float(point["lat"])) for point in geometry_points]
            except (KeyError, TypeError, ValueError):
                ignored += 1
                continue
            geometry = QgsGeometry.fromPolylineXY(points)
            if geometry.transform(to_target) != 0 or geometry.isEmpty() or not boundary_engine.intersects(geometry.constGet()):
                ignored += 1
                continue
            clipped = geometry if boundary_engine.contains(geometry.constGet()) else geometry.intersection(boundary)
            if clipped.isEmpty() or QgsWkbTypes.geometryType(clipped.wkbType()) != QgsWkbTypes.LineGeometry:
                ignored += 1
                continue
            if QgsWkbTypes.isSingleType(clipped.wkbType()):
                clipped.convertToMultiType()
            feature = QgsFeature(fields)
            feature.setAttributes(tags_to_attributes(element, scope, fetched_utc))
            feature.setGeometry(clipped)
            batch.append(feature)
        if batch and not writer.addFeatures(batch):
            raise RuntimeError(f"Could not write OSM roads for {city.display_name}, tile {tile_number}")
        accepted += len(batch)
        print(json.dumps({"city": city.display_name, "tile": f"{tile_number}/{len(tiles)}", "downloaded": len(elements), "written": accepted}, ensure_ascii=False), flush=True)
        time.sleep(0.4)
    del writer
    if accepted == 0:
        raise RuntimeError(f"No highway features were retained for {city.display_name}")
    return {"city": city.display_name, "features": accepted, "ignored": ignored, "tiles": len(tiles), "scope": scope}


# Fixed colours make the same highway class visually comparable across projects.
HIGHWAY_COLOURS = {
    "motorway": "#e63946", "motorway_link": "#ef476f", "trunk": "#f77f00", "trunk_link": "#fb8500",
    "primary": "#fcbf49", "primary_link": "#ffd166", "secondary": "#00b4d8", "secondary_link": "#48cae4",
    "tertiary": "#3a86ff", "tertiary_link": "#90caf9", "unclassified": "#9b5de5", "residential": "#d9e1e8",
    "living_street": "#b8de6f", "service": "#9aa5b1", "track": "#a98467", "path": "#e9c46a",
    "footway": "#f4a261", "pedestrian": "#c77dff", "cycleway": "#06d6a0", "bridleway": "#bc6c25",
    "steps": "#9d4edd", "construction": "#6c757d", "proposed": "#495057", "road": "#4cc9f0",
    "busway": "#ff006e", "corridor": "#ced4da", "platform": "#adb5bd", "raceway": "#ff70a6",
    "escape": "#ff595e", "elevator": "#adb5bd",
}


def colour_for(value: str) -> QColor:
    known = HIGHWAY_COLOURS.get(value)
    if known:
        return QColor(known)
    # Deterministic bright fallback for uncommon but valid regional OSM values.
    hue = int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:6], 16) % 360
    return QColor.fromHsv(hue, 155, 245)


def width_for(value: str) -> float:
    if value in {"motorway", "trunk"}:
        return 1.15
    if value in {"primary", "motorway_link", "trunk_link"}:
        return 0.95
    if value in {"secondary", "primary_link"}:
        return 0.80
    if value in {"tertiary", "secondary_link"}:
        return 0.65
    if value in {"cycleway", "pedestrian"}:
        return 0.55
    if value in {"footway", "path", "steps", "track", "bridleway"}:
        return 0.42
    return 0.48


def highway_renderer(layer: QgsVectorLayer) -> QgsCategorizedSymbolRenderer:
    values = sorted({str(feature["highway"] or "(empty)") for feature in layer.getFeatures()})
    categories: list[QgsRendererCategory] = []
    for value in values:
        symbol = QgsLineSymbol.createSimple({"line_color": colour_for(value).name(), "line_width": str(width_for(value)), "line_width_unit": "MM"})
        symbol.setOpacity(0.92)
        categories.append(QgsRendererCategory(value if value != "(empty)" else "", symbol, value))
    return QgsCategorizedSymbolRenderer("highway", categories)


def top_level_node(root, layer_id: str):
    node = root.findLayer(layer_id)
    while node is not None and node.parent() is not root:
        node = node.parent()
    return node


def add_layer_to_project(city: CitySpec) -> dict[str, object]:
    project = QgsProject.instance()
    project.clear()
    if not project.read(str(city.project_path)):
        raise RuntimeError(f"Could not load {city.project_path.name}")
    root = project.layerTreeRoot()
    stale_ids = [layer.id() for layer in project.mapLayers().values() if layer.name().startswith("OSM highways — all highway values")]
    if stale_ids:
        project.removeMapLayers(stale_ids)
    for group in list(root.findGroups()):
        if group.name() == "OSM highways — all highway values":
            root.removeChildNode(group)

    layer = QgsVectorLayer(str(city.output_path), "OSM highways — all highway values", "ogr")
    if not layer.isValid() or layer.featureCount() == 0:
        raise RuntimeError(f"Output highway data did not reopen correctly for {city.display_name}")
    layer.setRenderer(highway_renderer(layer))
    layer.setCustomProperty("osm_attribution", "© OpenStreetMap contributors")
    layer.setCustomProperty("scope_policy", "Largest city study-boundary polygon; all highway=* values retained")
    project.addMapLayer(layer, False)

    # Put roads immediately above CartoDB and beneath all research/boundary
    # layers.  This preserves a visible base map and a boundary outline on top.
    base_nodes = [top_level_node(root, candidate.id()) for candidate in project.mapLayers().values() if "CartoDB" in candidate.name()]
    base_nodes = [node for node in base_nodes if node is not None]
    insert_at = root.children().index(base_nodes[0]) if base_nodes else len(root.children())
    group = root.insertGroup(insert_at, "OSM highways — all highway values")
    group.addLayer(layer)
    group.setItemVisibilityChecked(True)
    project.setTitle(f"{city.display_name} study extent with full OSM highway layer")
    if not project.write(str(city.project_path)):
        raise RuntimeError(f"Could not save {city.project_path.name}")
    return {"project": city.project_path.name, "layer": layer.name(), "features": layer.featureCount(), "classes": len(layer.renderer().categories())}


def build() -> None:
    results: list[dict[str, object]] = []
    for city in selected_cities():
        boundary, crs, boundary_path, area_km2 = largest_study_boundary(city)
        result = write_highway_data(city, boundary, crs, boundary_path, area_km2)
        result.update(add_layer_to_project(city))
        results.append(result)
        print(json.dumps({"complete": result}, ensure_ascii=False), flush=True)
    manifest = OUTPUT_DIR / "osm_highway_layers_manifest.json"
    with manifest.open("w", encoding="utf-8") as stream:
        json.dump({"built_utc": datetime.now(UTC).isoformat(), "results": results}, stream, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        build()
    finally:
        app.exitQgis()
