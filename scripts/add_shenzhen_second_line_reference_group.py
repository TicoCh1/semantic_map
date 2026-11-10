"""Add a transparent reference note for the historic Shenzhen Second Line."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsProject


ROOT = Path(__file__).resolve().parents[1]
PROJECT_PATH = ROOT / "outputs" / "qgis_city_study_extents" / "Shenzhen_study_extent.qgz"
NAME = "Reference: Original SEZ Second Line — 327.5 km² (no auditable vector released)"


def main() -> None:
    project = QgsProject.instance()
    if not project.read(str(PROJECT_PATH)):
        raise RuntimeError(PROJECT_PATH.name)
    root = project.layerTreeRoot()
    existing = root.findGroup(NAME)
    if existing is None:
        root.insertGroup(1, NAME).setExpanded(False)
    if not project.write(str(PROJECT_PATH)):
        raise RuntimeError(PROJECT_PATH.name)
    print({"project": PROJECT_PATH.name, "reference_group": NAME})


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
