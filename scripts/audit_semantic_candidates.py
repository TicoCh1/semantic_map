"""Report per-component topology for exact OSM administrative candidates."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsGeometry, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / "tmp"


def main() -> None:
    for path in sorted(TEMP.glob("*_study_extent__semantic.gpkg")):
        layer = QgsVectorLayer(str(path), path.stem, "ogr")
        if not layer.isValid() or layer.featureCount() != 1:
            raise RuntimeError(path.name)
        geometry = next(layer.getFeatures()).geometry()
        parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
        report = []
        for index, polygon in enumerate(parts, start=1):
            part = QgsGeometry.fromPolygonXY(polygon)
            box = part.boundingBox()
            report.append({
                "part": index,
                "area_km2": round(part.area() / 1_000_000, 4),
                "holes": max(0, len(polygon) - 1),
                "bbox": tuple(round(value, 2) for value in (box.xMinimum(), box.yMinimum(), box.xMaximum(), box.yMaximum())),
            })
        print({"file": path.name, "parts": report})


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
