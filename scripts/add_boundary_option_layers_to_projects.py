"""Add selectable, source-traceable boundary options to three QGIS projects.

This works without a running desktop QGIS instance.  It preserves the existing
study boundary as the visible default and adds alternative layers disabled by
default in a dedicated layer-tree group.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from qgis.core import QgsApplication, QgsProject, QgsRasterLayer, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
GROUP = "Boundary options (toggle one)"


@dataclass(frozen=True)
class VectorOption:
    filename: str
    label: str
    style: str


NY_OPTIONS = (
    VectorOption("New_York_Option_Harbour_Core.gpkg", "Option A: NYC Harbour Core — 399 km² (58.7% of Shanghai 680)", "boundary_option_gold.qml"),
    VectorOption("New_York_Option_Three_Borough_Core.gpkg", "Option B: NYC Three Borough Core — 804 km² (118.3% of Shanghai 680)", "boundary_option_magenta.qml"),
    VectorOption("New_York_Option_Four_Borough_Core.gpkg", "Option C: NYC Four Borough Core — 953 km² (140.2% of Shanghai 680)", "boundary_option_purple.qml"),
)

SHENZHEN_OPTIONS = (
    VectorOption("Shenzhen_Option_Three_District_Core.gpkg", "Option A: Shenzhen Three District Core — 775 km² (114.0% of Shanghai 680)", "boundary_option_gold.qml"),
    VectorOption("Shenzhen_Option_Historic_SEZ_District_Proxy.gpkg", "Option B: Historic SEZ District Proxy — 876 km² (128.8% of Shanghai 680)", "boundary_option_magenta.qml"),
)


def move_to_group(root, group, layer) -> None:
    node = root.findLayer(layer.id())
    if node is not None:
        node.parent().removeChildNode(node)
    group.addLayer(layer)


def discard_our_previous_options(project: QgsProject, root) -> None:
    existing = root.findGroup(GROUP)
    if existing is None:
        return
    for layer in list(existing.findLayers()):
        project.removeMapLayer(layer.layerId())
    root.removeChildNode(existing)


def find_current_boundary(project: QgsProject, source_filename: str):
    for layer in project.mapLayers().values():
        if source_filename.lower() in layer.source().lower():
            return layer
    raise RuntimeError(f"Could not find current layer using {source_filename}")


def add_vector_option(project: QgsProject, root, group, option: VectorOption) -> None:
    source = OUTPUT / option.filename
    layer = QgsVectorLayer(str(source), option.label, "ogr")
    if not layer.isValid():
        raise RuntimeError(f"Could not load {source.name}")
    style_path = OUTPUT / option.style
    if not layer.loadNamedStyle(str(style_path))[1]:
        raise RuntimeError(f"Could not apply {style_path.name}")
    project.addMapLayer(layer, False)
    group.addLayer(layer)
    root.findLayer(layer.id()).setItemVisibilityChecked(False)


def prepare_vector_option_project(project_filename: str, current_filename: str, current_label: str, options: tuple[VectorOption, ...]) -> None:
    project = QgsProject.instance()
    project_path = OUTPUT / project_filename
    if not project.read(str(project_path)):
        raise RuntimeError(f"Could not open {project_path.name}")
    root = project.layerTreeRoot()
    discard_our_previous_options(project, root)
    group = root.insertGroup(0, GROUP)
    current = find_current_boundary(project, current_filename)
    current.setName(current_label)
    move_to_group(root, group, current)
    root.findLayer(current.id()).setItemVisibilityChecked(True)
    for option in options:
        add_vector_option(project, root, group, option)
    if not project.write(str(project_path)):
        raise RuntimeError(f"Could not save {project_path.name}")
    print({"project": project_filename, "layers": [node.name() for node in group.findLayers()]})
    project.clear()


def prepare_berlin_project() -> None:
    project = QgsProject.instance()
    project_path = OUTPUT / "Berlin_study_extent.qgz"
    if not project.read(str(project_path)):
        raise RuntimeError("Could not open Berlin_study_extent.qgz")
    root = project.layerTreeRoot()
    discard_our_previous_options(project, root)
    group = root.insertGroup(0, GROUP)
    current = find_current_boundary(project, "Berlin_study_extent.gpkg")
    current.setName("Current: Berlin Land administrative boundary — 891 km² (131.0% of Shanghai 680)")
    move_to_group(root, group, current)
    root.findLayer(current.id()).setItemVisibilityChecked(True)

    # Published by the Berlin Senate: the official 88 km² Umweltzone inside
    # the S-Bahn Ring.  It is a WMS because the publisher supplies this option
    # as authoritative map data, not an exported vector file.
    uri = (
        "contextualWMSLegend=0&crs=EPSG:25833&dpiMode=7&featureCount=10&format=image/png&"
        "layers=umweltzone&styles=umweltzone&url=https://gdi.berlin.de/services/wms/umweltzone"
    )
    ring = QgsRasterLayer(uri, "Option A: Official Umweltzone / inside S-Bahn Ring — 88 km² (12.9% of Shanghai 680)", "wms")
    if not ring.isValid():
        raise RuntimeError("Could not load Berlin Umweltzone WMS")
    project.addMapLayer(ring, False)
    group.addLayer(ring)
    root.findLayer(ring.id()).setItemVisibilityChecked(False)
    reference_group = root.insertGroup(1, "Reference: Planwerk Innere Stadt — no published fixed polygon")
    reference_group.setExpanded(False)
    if not project.write(str(project_path)):
        raise RuntimeError("Could not save Berlin_study_extent.qgz")
    print({"project": project_path.name, "layers": [node.name() for node in group.findLayers()]})
    project.clear()


def main() -> None:
    prepare_vector_option_project(
        "New_York_study_extent.qgz",
        "New_York_study_extent.gpkg",
        "Current: Four Boroughs + Jersey City + Hoboken — 1,013 km² (148.9% of Shanghai 680)",
        NY_OPTIONS,
    )
    prepare_berlin_project()
    prepare_vector_option_project(
        "Shenzhen_study_extent.qgz",
        "Shenzhen_study_extent.gpkg",
        "Current: Nanshan + Futian + Luohu + Longhua — 951 km² (139.9% of Shanghai 680)",
        SHENZHEN_OPTIONS,
    )


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
