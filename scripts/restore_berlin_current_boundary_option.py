"""Restore Berlin's current administrative boundary alongside its WMS option."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsProject, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
PROJECT_PATH = OUTPUT / "Berlin_study_extent.qgz"
GROUP = "Boundary options (toggle one)"
LABEL = "Current: Berlin Land administrative boundary — 891 km² (131.0% of Shanghai 680)"


def main() -> None:
    project = QgsProject.instance()
    if not project.read(str(PROJECT_PATH)):
        raise RuntimeError(PROJECT_PATH.name)
    root = project.layerTreeRoot()
    group = root.findGroup(GROUP)
    if group is None:
        raise RuntimeError("Missing option group")
    for node in group.findLayers():
        if node.name() == LABEL:
            project.removeMapLayer(node.layerId())
    layer = QgsVectorLayer(str(OUTPUT / "Berlin_study_extent.gpkg"), LABEL, "ogr")
    if not layer.isValid():
        raise RuntimeError("Could not open Berlin_study_extent.gpkg")
    if not layer.loadNamedStyle(str(OUTPUT / "study_boundary_outline.qml"))[1]:
        raise RuntimeError("Could not apply current-boundary style")
    project.addMapLayer(layer, False)
    group.insertLayer(0, layer)
    root.findLayer(layer.id()).setItemVisibilityChecked(True)
    if not project.write(str(PROJECT_PATH)):
        raise RuntimeError("Could not save project")
    print({"project": PROJECT_PATH.name, "layer": LABEL})


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
