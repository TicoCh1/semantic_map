"""Create hole-free copies of all study-boundary GeoPackages."""

from __future__ import annotations

from pathlib import Path

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


def hole_count(geometry: QgsGeometry) -> int:
    if geometry.isMultipart():
        return sum(max(0, len(polygon) - 1) for polygon in geometry.asMultiPolygon())
    return max(0, len(geometry.asPolygon()) - 1)


def rewrite(path: Path) -> dict[str, object]:
    source = QgsVectorLayer(str(path), path.stem, "ogr")
    if not source.isValid() or source.featureCount() != 1:
        raise RuntimeError(f"Invalid study boundary: {path.name}")
    original = next(source.getFeatures())
    geometry = original.geometry()
    before = hole_count(geometry)
    result = geometry.removeInteriorRings()
    after = hole_count(result)
    if after != 0:
        raise RuntimeError(f"Interior rings remain in {path.name}")
    if result.isMultipart() and len(result.asGeometryCollection()) != 1:
        raise RuntimeError(f"Multiple outer parts remain in {path.name}")

    attributes = original.attributes()
    basis_index = source.fields().indexOf("boundary_basis")
    if basis_index >= 0:
        attributes[basis_index] = f"{attributes[basis_index]}; interior rings removed"

    destination = path.with_name(f"{path.stem}__noholes.gpkg")
    if destination.exists():
        destination.unlink()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(destination), source.fields(), QgsWkbTypes.MultiPolygon, source.crs(), QgsProject.instance().transformContext(), options
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    feature = QgsFeature(source.fields())
    feature.setAttributes(attributes)
    feature.setGeometry(result)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write {destination.name}")
    del writer
    return {"file": path.name, "holes_before": before, "holes_after": after, "candidate": destination.name}


def main() -> None:
    for path in sorted(OUTPUT_DIR.glob("*_study_extent.gpkg")):
        if path.name.endswith("__normalized.gpkg") or path.name.endswith("__noholes.gpkg"):
            continue
        print(rewrite(path), flush=True)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
