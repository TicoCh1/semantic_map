"""Normalise study-area GeoPackages to one smooth, continuous boundary each.

This keeps the largest connected urban-core component from each source
boundary. It removes small island/flyout components and applies a controlled
metre-based generalisation before Chaikin smoothing. Rome is excluded because
its A90/GRA geometry is already a road-derived closed ring and must remain
unaltered.
"""

from __future__ import annotations

import os
import gc
from pathlib import Path

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsApplication,
    QgsFeature,
    QgsGeometry,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "outputs" / "qgis_city_study_extents"
ROAD_DERIVED = {"Rome_Vatican_study_extent"}


def vertex_count(geometry: QgsGeometry) -> int:
    return sum(1 for _ in geometry.vertices())


def largest_connected_component(geometry: QgsGeometry) -> QgsGeometry:
    if not geometry.isMultipart():
        return QgsGeometry(geometry)
    parts = geometry.asGeometryCollection()
    if not parts:
        raise RuntimeError("Multipart geometry contains no parts")
    return QgsGeometry(max(parts, key=lambda part: part.area()))


def make_multipolygon(geometry: QgsGeometry) -> QgsGeometry:
    result = QgsGeometry(geometry)
    if QgsWkbTypes.isSingleType(result.wkbType()):
        result.convertToMultiType()
    return result


def generalise(stem: str, geometry: QgsGeometry) -> QgsGeometry:
    core = largest_connected_component(geometry)
    if stem in ROAD_DERIVED:
        return make_multipolygon(core)
    # The 75 m simplification removes parcel-scale administrative zig-zags;
    # smoothing operates only on longer segments so the city-scale outline is
    # retained without a sawtooth appearance.
    result = core.simplify(75).smooth(iterations=2, offset=0.25, minimumDistance=150, maxAngle=180)
    if result.isNull() or result.isEmpty():
        raise RuntimeError(f"Generalisation generated an empty geometry for {stem}")
    if not result.isGeosValid():
        result = result.makeValid()
    return make_multipolygon(result)


def rewrite(path: Path) -> dict[str, object]:
    stem = path.stem
    source = QgsVectorLayer(str(path), stem, "ogr")
    if not source.isValid() or source.featureCount() != 1:
        raise RuntimeError(f"Expected exactly one valid feature in {path.name}")
    original = next(source.getFeatures())
    before = original.geometry()
    after = generalise(stem, before)
    area_ratio = after.area() / before.area()
    if not 0.85 <= area_ratio <= 1.15:
        raise RuntimeError(f"{path.name} changed area by too much ({area_ratio:.3f})")
    if after.isMultipart() and len(after.asGeometryCollection()) != 1:
        raise RuntimeError(f"{path.name} still contains multiple boundary parts")
    if vertex_count(after) <= 8:
        raise RuntimeError(f"{path.name} was oversimplified")

    fields = source.fields()
    attributes = original.attributes()
    basis_index = fields.indexOf("boundary_basis")
    area_index = fields.indexOf("area_km2")
    if basis_index >= 0:
        attributes[basis_index] = f"{attributes[basis_index]}; largest contiguous core, 75 m generalisation"
    if area_index >= 0:
        attributes[area_index] = round(after.area() / 1_000_000, 3)

    temporary = path.with_name(f"{stem}__normalized.gpkg")
    if temporary.exists():
        temporary.unlink()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(temporary), fields, QgsWkbTypes.MultiPolygon, source.crs(), QgsProject.instance().transformContext(), options
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    feature = QgsFeature(fields)
    feature.setAttributes(attributes)
    feature.setGeometry(after)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write {path.name}")
    del writer
    # Release the OGR datasource before replacing the GeoPackage on Windows.
    del feature
    del original
    del source
    gc.collect()
    return {
        "file": path.name,
        "normalized_file": temporary.name,
        "area_ratio": round(area_ratio, 4),
        "vertices_before": vertex_count(before),
        "vertices_after": vertex_count(after),
        "parts_after": len(after.asGeometryCollection()) if after.isMultipart() else 1,
    }


def main() -> None:
    for path in sorted(OUTPUT_DIR.glob("*_study_extent.gpkg")):
        print(rewrite(path), flush=True)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
