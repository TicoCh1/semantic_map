"""Correct metadata after preserving a road-derived boundary during normalisation."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "outputs" / "qgis_city_study_extents" / "Rome_Vatican_study_extent.gpkg"
VALUE = "A90 / Grande Raccordo Anulare road alignment; one connected road-derived outline; no smoothing"


def main() -> None:
    layer = QgsVectorLayer(str(PATH), "Rome boundary", "ogr")
    if not layer.isValid() or layer.featureCount() != 1:
        raise RuntimeError("Expected one valid Rome road-boundary feature")
    feature = next(layer.getFeatures())
    field_index = layer.fields().indexOf("boundary_basis")
    if field_index < 0:
        raise RuntimeError("Missing boundary_basis field")
    if not layer.startEditing():
        raise RuntimeError("Could not start metadata edit")
    if not layer.changeAttributeValue(feature.id(), field_index, VALUE):
        layer.rollBack()
        raise RuntimeError("Could not update road-boundary metadata")
    if not layer.commitChanges():
        raise RuntimeError("Could not commit metadata edit")
    print({"file": PATH.name, "boundary_basis": VALUE})


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
