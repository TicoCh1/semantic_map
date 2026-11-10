"""Build exact, unsmoothed administrative-boundary candidates from OSM.

These candidates intentionally preserve the source geometry: municipal and ward
boundaries can therefore follow rivers, coastlines and island edges exactly.
They are written to ``tmp`` for topology review before replacing any project
data source.
"""

from __future__ import annotations

import gc
from pathlib import Path

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsFields,
    QgsGeometry,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)

from build_osm_study_boundaries import Fetcher, SPECS


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
TEMP = ROOT / "tmp"
ROAD_STEMS = {"Rome_Vatican_study_extent", "Paris_study_extent", "Beijing_study_extent"}


def union(geometries: list[QgsGeometry]) -> QgsGeometry:
    result = QgsGeometry.unaryUnion(geometries)
    if result.isNull() or result.isEmpty():
        raise RuntimeError("OSM administrative-boundary union is empty")
    return result


def make_multipolygon(geometry: QgsGeometry) -> QgsGeometry:
    result = QgsGeometry(geometry)
    if QgsWkbTypes.isSingleType(result.wkbType()):
        result.convertToMultiType()
    return result


def count_parts_and_holes(geometry: QgsGeometry) -> tuple[int, int]:
    parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    return len(parts), sum(max(0, len(part) - 1) for part in parts)


def write_candidate(spec, geometry_wgs84: QgsGeometry) -> dict[str, object]:
    source_path = OUTPUT / f"{spec.stem}.gpkg"
    source = QgsVectorLayer(str(source_path), spec.stem, "ogr")
    if not source.isValid() or source.featureCount() != 1:
        raise RuntimeError(f"Could not read current {source_path.name}")
    original = next(source.getFeatures())
    fields = source.fields()
    attributes = original.attributes()
    for field_name, value in {
        "boundary_basis": f"{spec.basis}; exact OSM administrative geometry (no simplification or smoothing)",
        "data_source": "OpenStreetMap administrative-boundary relations via Nominatim",
        "crs": spec.crs,
    }.items():
        index = fields.indexOf(field_name)
        if index >= 0:
            attributes[index] = value

    target_crs = QgsCoordinateReferenceSystem(spec.crs)
    geometry = QgsGeometry(geometry_wgs84)
    transform = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:4326"), target_crs, QgsProject.instance().transformContext()
    )
    if geometry.transform(transform) != 0:
        raise RuntimeError(f"Could not reproject {spec.stem}")
    if not geometry.isGeosValid():
        geometry = geometry.makeValid()
    geometry = make_multipolygon(geometry)
    area_index = fields.indexOf("area_km2")
    if area_index >= 0:
        attributes[area_index] = round(geometry.area() / 1_000_000, 3)

    candidate = TEMP / f"{spec.stem}__semantic.gpkg"
    if candidate.exists():
        candidate.unlink()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(candidate), fields, QgsWkbTypes.MultiPolygon, target_crs,
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    feature = QgsFeature(fields)
    feature.setAttributes(attributes)
    feature.setGeometry(geometry)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write {candidate.name}")
    del writer
    del feature
    del original
    del source
    gc.collect()

    parts, holes = count_parts_and_holes(geometry)
    return {
        "file": candidate.name,
        "area_km2": round(geometry.area() / 1_000_000, 3),
        "parts": parts,
        "holes": holes,
        "vertices": sum(1 for _ in geometry.vertices()),
    }


def main() -> None:
    TEMP.mkdir(parents=True, exist_ok=True)
    fetcher = Fetcher()
    for spec in SPECS:
        if spec.stem in ROAD_STEMS:
            continue
        included = fetcher.nominatim_geometries(spec.relation_ids)
        geometry = union(included)
        if spec.subtract_relation_ids:
            for excluded in fetcher.nominatim_geometries(spec.subtract_relation_ids):
                geometry = geometry.difference(excluded)
        print({"city": spec.city, **write_candidate(spec, geometry)}, flush=True)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
