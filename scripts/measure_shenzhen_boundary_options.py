"""Measure Shenzhen options defined by named contemporary OSM districts."""

from __future__ import annotations

from qgis.core import QgsApplication, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsGeometry, QgsProject

from build_osm_study_boundaries import Fetcher


CRS = QgsCoordinateReferenceSystem("EPSG:4547")
FUTIAN, LUOHU, NANSHAN, LONGHUA, YANTIAN = 5664191, 5664194, 5664195, 5664193, 5663273
OPTIONS = {
    "Three-district core: Nanshan + Futian + Luohu": (NANSHAN, FUTIAN, LUOHU),
    "Historic-SEZ district proxy: Nanshan + Futian + Luohu + Yantian": (NANSHAN, FUTIAN, LUOHU, YANTIAN),
    "Current project: Nanshan + Futian + Luohu + Longhua": (NANSHAN, FUTIAN, LUOHU, LONGHUA),
}


def main() -> None:
    fetcher = Fetcher()
    transform = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"), CRS, QgsProject.instance().transformContext())
    for name, relation_ids in OPTIONS.items():
        geometry = QgsGeometry.unaryUnion(fetcher.nominatim_geometries(relation_ids))
        if geometry.transform(transform) != 0:
            raise RuntimeError(name)
        print({"option": name, "area_km2": round(geometry.area() / 1_000_000, 3), "pct_of_shanghai_680": round(geometry.area() / 6_800_000, 1)})


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
