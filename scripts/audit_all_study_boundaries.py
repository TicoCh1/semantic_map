"""Read-only semantic and topology audit of every study-boundary GeoPackage."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"


def main() -> None:
    for path in sorted(OUTPUT.glob("*_study_extent.gpkg")):
        layer = QgsVectorLayer(str(path), path.stem, "ogr")
        if not layer.isValid() or layer.featureCount() != 1:
            raise RuntimeError(f"Expected one feature in {path.name}")
        feature = next(layer.getFeatures())
        geometry = feature.geometry()
        parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
        print({
            "file": path.name,
            "crs": layer.crs().authid(),
            "area_km2": round(geometry.area() / 1_000_000, 3),
            "parts": len(parts),
            "holes": sum(max(0, len(part) - 1) for part in parts),
            "vertices": sum(1 for _ in geometry.vertices()),
            "basis": feature["boundary_basis"],
        })


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
