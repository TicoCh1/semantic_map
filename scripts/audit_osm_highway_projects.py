"""Read-only validation for the city QGIS highway layers."""

from __future__ import annotations

import json
from pathlib import Path

from qgis.core import QgsApplication, QgsProject


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "outputs" / "qgis_city_study_extents"
STEMS = (
    "Rome_Vatican_study_extent",
    "New_York_study_extent",
    "Paris_study_extent",
    "Tokyo_study_extent",
    "Boston_study_extent",
    "Kyoto_study_extent",
    "Beijing_study_extent",
    "Berlin_study_extent",
    "Vienna_study_extent",
    "Hong_Kong_study_extent",
    "Shenzhen_study_extent",
)
REQUIRED_FIELDS = {
    "osm_way_id", "highway", "name", "ref", "lanes", "lanes_forward",
    "lanes_backward", "oneway", "maxspeed", "surface", "bridge", "tunnel",
    "source", "download_scope", "fetched_utc", "other_tags",
}


def audit_project(stem: str) -> dict[str, object]:
    project = QgsProject.instance()
    project.clear()
    project_path = OUTPUT_DIR / f"{stem}.qgz"
    report: dict[str, object] = {"project": project_path.name}
    if not project.read(str(project_path)):
        report["error"] = "could not read project"
        return report

    roads = [layer for layer in project.mapLayers().values() if layer.name().startswith("OSM highways")]
    groups = [group for group in project.layerTreeRoot().findGroups() if group.name().startswith("OSM highways")]
    report["road_layer_count"] = len(roads)
    report["group_count"] = len(groups)
    if len(roads) != 1 or len(groups) != 1:
        report["error"] = "expected exactly one OSM highways layer and group"
        return report

    layer = roads[0]
    fields = {field.name() for field in layer.fields()}
    renderer = layer.renderer()
    layer_node = project.layerTreeRoot().findLayer(layer.id())
    first = next(layer.getFeatures(), None)
    scope = first["download_scope"] if first is not None and "download_scope" in fields else None
    report.update({
        "layer": layer.name(),
        "valid": layer.isValid(),
        "features": layer.featureCount(),
        "source_file": Path(layer.source().split("|")[0]).name,
        "all_required_fields": REQUIRED_FIELDS.issubset(fields),
        "scope": scope,
        "group_visible": groups[0].isVisible(),
        "layer_visible": layer_node.isVisible() if layer_node else False,
        "renderer": renderer.type() if renderer else None,
        "classified_field": renderer.classAttribute() if renderer and hasattr(renderer, "classAttribute") else None,
        "classes": len(renderer.categories()) if renderer and hasattr(renderer, "categories") else 0,
    })
    report["ok"] = bool(
        report["valid"] and report["features"] > 0 and report["all_required_fields"]
        and report["group_visible"] and report["layer_visible"]
        and report["renderer"] == "categorizedSymbol" and report["classified_field"] == "highway"
        and report["classes"] > 0 and isinstance(scope, str) and scope.startswith("Largest local study-boundary polygon")
    )
    return report


def main() -> None:
    results = [audit_project(stem) for stem in STEMS]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if not all(result.get("ok") for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
