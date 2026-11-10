"""Read-only audit of the layer trees and data-source validity for option projects."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsLayerTreeGroup, QgsLayerTreeLayer, QgsProject


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
PROJECTS = ("New_York_study_extent.qgz", "Berlin_study_extent.qgz", "Shenzhen_study_extent.qgz")


def nodes(group: QgsLayerTreeGroup) -> list[dict[str, object]]:
    result = []
    for child in group.children():
        if isinstance(child, QgsLayerTreeGroup):
            result.append({"group": child.name(), "visible": child.isVisible(), "children": nodes(child)})
        elif isinstance(child, QgsLayerTreeLayer):
            layer = child.layer()
            result.append({
                "layer": child.name(),
                "visible": child.isVisible(),
                "valid": layer.isValid(),
                "source": layer.source(),
            })
    return result


def main() -> None:
    project = QgsProject.instance()
    for filename in PROJECTS:
        path = OUTPUT / filename
        if not project.read(str(path)):
            raise RuntimeError(filename)
        print({"project": filename, "crs": project.crs().authid(), "layer_count": len(project.mapLayers()), "tree": nodes(project.layerTreeRoot())})
        project.clear()


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
