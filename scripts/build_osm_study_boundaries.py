"""Build non-rectangular study-boundary GeoPackages from live OSM geometry.

Each output is an actual administrative boundary union, except the Rome study
area, which is polygonised from the A90/GRA road alignment. The resulting
vector is written in the same local metre-based CRS used by its QGIS project.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path

import requests
from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsFields,
    QgsGeometry,
    QgsJsonUtils,
    QgsPointXY,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "outputs" / "qgis_city_study_extents"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/lookup"
OVERPASS_URL = "https://overpass.private.coffee/api/interpreter"
USER_AGENT = "urbanfabric-qgis-boundary-builder/1.0 (research use)"


@dataclass(frozen=True)
class BoundarySpec:
    stem: str
    city: str
    crs: str
    basis: str
    relation_ids: tuple[int, ...] = ()
    subtract_relation_ids: tuple[int, ...] = ()
    ring_query: str | None = None
    min_area_km2: float | None = None
    max_area_km2: float | None = None


SPECS = (
    BoundarySpec(
        "Rome_Vatican_study_extent",
        "Rome + Vatican City",
        "EPSG:7792",
        "A90 / Grande Raccordo Anulare road alignment",
        ring_query='[out:json][timeout:180];way["ref"="A90"](41.60,12.20,42.20,12.90);out geom;',
        min_area_km2=250,
        max_area_km2=900,
    ),
    BoundarySpec(
        "New_York_study_extent",
        "New York core + Jersey City + Hoboken",
        "EPSG:26918",
        "New York City administrative boundary (Staten Island removed) + Jersey City + Hoboken",
        relation_ids=(175905, 170953, 170708),
        subtract_relation_ids=(9691948,),
    ),
    BoundarySpec(
        "Paris_study_extent",
        "Paris",
        "EPSG:2154",
        "Métropole du Grand Paris administrative boundary",
        relation_ids=(5814660,),
    ),
    BoundarySpec(
        "Tokyo_study_extent",
        "Tokyo",
        "EPSG:6677",
        "Tokyo 23 special wards administrative boundary",
        relation_ids=(19631009,),
    ),
    BoundarySpec(
        "Boston_study_extent",
        "Boston core",
        "EPSG:26986",
        "Union of Boston, Cambridge, Somerville, Brookline, Chelsea and Newton municipal boundaries",
        relation_ids=(2315704, 1933745, 1933746, 2306361, 2362263, 1942017),
    ),
    BoundarySpec(
        "Kyoto_study_extent",
        "Kyoto basin core",
        "EPSG:6674",
        "Union of central Kyoto wards: Kita, Kamigyo, Nakagyo, Higashiyama, Shimogyo, Minami, Fushimi and Nishikyo",
        relation_ids=(357805, 357817, 357816, 357840, 358601, 358594, 358575, 357815),
    ),
    BoundarySpec(
        "Beijing_study_extent",
        "Beijing",
        "EPSG:4548",
        "Union of Dongcheng, Chaoyang, Haidian, Fengtai and Shijingshan core-district boundaries",
        relation_ids=(288600, 2988933, 5505984, 2988946, 5505985),
    ),
    BoundarySpec(
        "Berlin_study_extent",
        "Berlin",
        "EPSG:25833",
        "Berlin Land administrative boundary",
        relation_ids=(62422,),
    ),
    BoundarySpec(
        "Vienna_study_extent",
        "Vienna",
        "EPSG:31256",
        "Vienna municipal administrative boundary",
        relation_ids=(109166,),
    ),
    BoundarySpec(
        "Hong_Kong_study_extent",
        "Hong Kong urban core",
        "EPSG:2326",
        "Union of Hong Kong Island, Kowloon, Tsuen Wan and Sha Tin urban district boundaries",
        relation_ids=(2558879, 2558883, 2558880, 2558881, 2670978, 2800200, 2800201, 2800277, 2800276, 8368100, 8477820),
    ),
    BoundarySpec(
        "Shenzhen_study_extent",
        "Shenzhen core",
        "EPSG:4547",
        "Union of Futian, Luohu, Nanshan and Longhua district boundaries",
        relation_ids=(5664191, 5664194, 5664195, 5664193),
    ),
)


class Fetcher:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._last_nominatim_call = 0.0

    def nominatim_geometries(self, relation_ids: tuple[int, ...]) -> list[QgsGeometry]:
        # Nominatim requests are deliberately batched and rate-limited.
        wait = 1.1 - (time.monotonic() - self._last_nominatim_call)
        if wait > 0:
            time.sleep(wait)
        ids = ",".join(f"R{relation_id}" for relation_id in relation_ids)
        response = self.session.get(
            NOMINATIM_URL,
            params={"format": "jsonv2", "polygon_geojson": 1, "osm_ids": ids},
            timeout=120,
        )
        self._last_nominatim_call = time.monotonic()
        response.raise_for_status()
        by_id = {int(item["osm_id"]): item for item in response.json()}
        missing = sorted(set(relation_ids) - set(by_id))
        if missing:
            raise RuntimeError(f"Nominatim returned no geometry for OSM relations {missing}")
        geometries: list[QgsGeometry] = []
        for relation_id in relation_ids:
            geometry = QgsJsonUtils.geometryFromGeoJson(json.dumps(by_id[relation_id]["geojson"]))
            if geometry.isNull() or geometry.isEmpty():
                raise RuntimeError(f"Invalid geometry for OSM relation {relation_id}")
            geometries.append(geometry)
        return geometries

    def road_ring(self, query: str) -> QgsGeometry:
        response = self.session.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=300,
        )
        response.raise_for_status()
        elements = response.json().get("elements", [])
        lines: list[QgsGeometry] = []
        for element in elements:
            points = [QgsPointXY(point["lon"], point["lat"]) for point in element.get("geometry", [])]
            if len(points) >= 2:
                lines.append(QgsGeometry.fromPolylineXY(points))
        if not lines:
            raise RuntimeError("The road query returned no line geometries")
        noded = QgsGeometry.unaryUnion(lines)
        polygons = QgsGeometry.polygonize([noded]).asGeometryCollection()
        candidates = [polygon for polygon in polygons if not polygon.isEmpty()]
        if not candidates:
            raise RuntimeError("The road alignment could not be polygonised")
        selected = max(candidates, key=lambda geometry: geometry.area())
        # Areas are temporarily in square degrees. The final metre-based area
        # validation happens after reprojection in write_boundary.
        return selected


def union(geometries: list[QgsGeometry]) -> QgsGeometry:
    result = QgsGeometry.unaryUnion(geometries)
    if result.isNull() or result.isEmpty():
        raise RuntimeError("Geometry union produced an empty result")
    return result


def make_multipolygon(geometry: QgsGeometry) -> QgsGeometry:
    result = QgsGeometry(geometry)
    if QgsWkbTypes.isSingleType(result.wkbType()):
        result.convertToMultiType()
    return result


def write_boundary(spec: BoundarySpec, geometry_wgs84: QgsGeometry) -> dict[str, object]:
    target_crs = QgsCoordinateReferenceSystem(spec.crs)
    if not target_crs.isValid():
        raise RuntimeError(f"Invalid target CRS: {spec.crs}")
    geometry = QgsGeometry(geometry_wgs84)
    transform = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:4326"), target_crs, QgsProject.instance().transformContext()
    )
    if geometry.transform(transform) != 0:
        raise RuntimeError(f"Could not reproject {spec.stem} to {spec.crs}")
    geometry = make_multipolygon(geometry)
    area_km2 = geometry.area() / 1_000_000
    if spec.min_area_km2 is not None and not spec.min_area_km2 <= area_km2 <= spec.max_area_km2:
        raise RuntimeError(
            f"{spec.stem} road-ring area {area_km2:.1f} km² is outside the expected range "
            f"{spec.min_area_km2}–{spec.max_area_km2} km²"
        )

    fields = QgsFields()
    fields.append(QgsField("city", QVariant.String))
    fields.append(QgsField("boundary_basis", QVariant.String))
    fields.append(QgsField("data_source", QVariant.String))
    fields.append(QgsField("crs", QVariant.String))
    fields.append(QgsField("area_km2", QVariant.Double, "double", 20, 3))

    output_path = OUTPUT_DIR / f"{spec.stem}.gpkg"
    if output_path.exists():
        output_path.unlink()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(output_path), fields, QgsWkbTypes.MultiPolygon, target_crs, QgsProject.instance().transformContext(), options
    )
    if writer.hasError():
        raise RuntimeError(f"Could not create {output_path.name}: {writer.errorMessage()}")
    feature = QgsFeature(fields)
    feature.setAttributes([spec.city, spec.basis, "OpenStreetMap", spec.crs, area_km2])
    feature.setGeometry(geometry)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write the feature for {spec.stem}")
    del writer

    check_layer = QgsVectorLayer(str(output_path), spec.stem, "ogr")
    if not check_layer.isValid() or check_layer.featureCount() != 1:
        raise RuntimeError(f"Post-write validation failed for {output_path.name}")
    check_feature = next(check_layer.getFeatures())
    vertex_count = sum(1 for _ in check_feature.geometry().vertices())
    if vertex_count <= 5:
        raise RuntimeError(f"{spec.stem} is not a detailed boundary ({vertex_count} vertices)")
    return {"file": output_path.name, "area_km2": round(area_km2, 2), "vertices": vertex_count}


def build() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher()
    results: list[dict[str, object]] = []
    for spec in SPECS:
        only = {item for item in os.environ.get("URBANFABRIC_STUDY_STEMS", "").split(",") if item}
        if only and spec.stem not in only:
            continue
        if spec.ring_query:
            geometry = fetcher.road_ring(spec.ring_query)
        else:
            source_geometries = fetcher.nominatim_geometries(spec.relation_ids)
            geometry = union(source_geometries)
            if spec.subtract_relation_ids:
                for subtraction in fetcher.nominatim_geometries(spec.subtract_relation_ids):
                    geometry = geometry.difference(subtraction)
        results.append(write_boundary(spec, geometry))
        print(json.dumps(results[-1], ensure_ascii=False))


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        build()
    finally:
        app.exitQgis()
