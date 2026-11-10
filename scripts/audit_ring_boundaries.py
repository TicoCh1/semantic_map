"""Read-only validation for the road-derived study boundaries."""

from __future__ import annotations

from pathlib import Path

from qgis.core import QgsApplication, QgsVectorLayer


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
STEMS = ("Rome_Vatican_study_extent", "Paris_study_extent", "Beijing_study_extent")


def main() -> None:
    for stem in STEMS:
        layer = QgsVectorLayer(str(OUTPUT / f"{stem}.gpkg"), stem, "ogr")
        if not layer.isValid() or layer.featureCount() != 1:
            raise RuntimeError(f"Invalid study boundary: {stem}")
        feature = next(layer.getFeatures())
        geometry = feature.geometry()
        parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
        print({
            "file": f"{stem}.gpkg",
            "crs": layer.crs().authid(),
            "parts": len(parts),
            "holes": sum(max(0, len(part) - 1) for part in parts),
            "vertices": sum(1 for _ in geometry.vertices()),
            "area_km2": round(geometry.area() / 1_000_000, 3),
            "basis": feature["boundary_basis"],
        })


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
