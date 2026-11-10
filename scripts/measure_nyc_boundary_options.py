"""Measure candidate New York study extents defined by named OSM municipalities."""

from __future__ import annotations

from qgis.core import QgsApplication, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsGeometry, QgsProject

from build_osm_study_boundaries import Fetcher


CRS = QgsCoordinateReferenceSystem("EPSG:26918")
OPTIONS = {
    "Harbour core: Manhattan + Brooklyn": (8398124, 9691750),
    "Harbour core plus New Jersey waterfront: Manhattan + Brooklyn + Jersey City + Hoboken": (8398124, 9691750, 170953, 170708),
    "Three borough core: Manhattan + Brooklyn + Queens": (8398124, 9691750, 9691819),
    "Four borough city core: Manhattan + Brooklyn + Queens + Bronx": (8398124, 9691750, 9691819, 9691916),
    "Bi-state waterfront core: three boroughs + Jersey City + Hoboken": (8398124, 9691750, 9691819, 170953, 170708),
    "Current regional option: four boroughs + Jersey City + Hoboken": (8398124, 9691750, 9691819, 9691916, 170953, 170708),
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
