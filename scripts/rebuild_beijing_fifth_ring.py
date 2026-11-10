"""Derive Beijing's study boundary from the real S50 (Fifth Ring Road) alignment.

The source is Geofabrik's Beijing OSM GeoPackage.  It contains both carriageways
of S50 as separately digitised road segments.  Polygonising the road geometry
therefore yields a small number of nested closed candidates; the outer
carriageway is selected using the known study-scale area rather than any
administrative boundary.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from qgis.PyQt.QtCore import QVariant
from qgis.core import (
    QgsApplication,
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsFields,
    QgsGeometry,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "downloads" / "geofabrik_beijing" / "beijing.gpkg"
OUTPUT = ROOT / "tmp" / "Beijing_study_extent_fifth_ring_candidate.gpkg"
TARGET_CRS = QgsCoordinateReferenceSystem("EPSG:4548")


def polygon_without_holes(geometry: QgsGeometry) -> QgsGeometry:
    """Keep the road-enclosed exterior only; do not retain incidental road holes."""
    polygons = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    exteriors = [polygon[:1] for polygon in polygons if polygon and polygon[0]]
    return QgsGeometry.fromMultiPolygonXY(exteriors)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    TARGET_CRS.validate()

    roads = QgsVectorLayer(f"{SOURCE}|layername=gis_osm_roads_free", "Beijing OSM roads", "ogr")
    if not roads.isValid():
        raise RuntimeError("Could not open the local Beijing OSM road layer")

    # S50 is the official OSM route reference for all four named sections:
    # North, East, South and West Fifth Ring Road.  Including motorway links
    # closes the occasional junction gap while keeping all input on the real
    # motorway alignment.
    roads.setSubsetString("\"ref\" = 'S50' AND \"fclass\" IN ('motorway', 'motorway_link')")
    lines = [QgsGeometry(feature.geometry()) for feature in roads.getFeatures() if not feature.geometry().isEmpty()]
    if len(lines) < 100:
        raise RuntimeError(f"Expected S50 road segments, got {len(lines)}")

    noded = QgsGeometry.unaryUnion(lines)
    candidates_wgs84 = [
        polygon
        for polygon in QgsGeometry.polygonize([noded]).asGeometryCollection()
        if not polygon.isEmpty()
    ]
    if not candidates_wgs84:
        raise RuntimeError("The S50 road alignment did not polygonise")

    transform = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:4326"), TARGET_CRS, QgsProject.instance().transformContext()
    )
    candidates: list[QgsGeometry] = []
    for candidate in candidates_wgs84:
        projected = QgsGeometry(candidate)
        if projected.transform(transform) != 0:
            raise RuntimeError("Could not reproject an S50 polygon candidate")
        area_km2 = projected.area() / 1_000_000
        if 500 <= area_km2 <= 900:
            candidates.append(projected)

    if not candidates:
        all_areas = sorted(round(c.area() / 1_000_000, 2) for c in candidates_wgs84)
        raise RuntimeError(f"No plausible Fifth Ring candidate; raw candidate areas: {all_areas[-20:]}")

    # The enclosing carriageway has the largest area.  This preserves the
    # exact road trace and makes the study area the land inside the true ring.
    selected = max(candidates, key=lambda geometry: geometry.area())
    selected = polygon_without_holes(selected)
    if QgsWkbTypes.isSingleType(selected.wkbType()):
        selected.convertToMultiType()
    if selected.isEmpty() or not selected.isGeosValid():
        raise RuntimeError("Selected Fifth Ring polygon is invalid")
    area_km2 = selected.area() / 1_000_000
    if not 500 <= area_km2 <= 900:
        raise RuntimeError(f"Unexpected Fifth Ring area: {area_km2:.2f} km2")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT.exists():
        OUTPUT.unlink()
    fields = QgsFields()
    fields.append(QgsField("city", QVariant.String))
    fields.append(QgsField("boundary_basis", QVariant.String))
    fields.append(QgsField("data_source", QVariant.String))
    fields.append(QgsField("crs", QVariant.String))
    fields.append(QgsField("area_km2", QVariant.Double, "double", 20, 3))
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(OUTPUT), fields, QgsWkbTypes.MultiPolygon, TARGET_CRS,
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    feature = QgsFeature(fields)
    feature.setAttributes([
        "Beijing",
        "S50 / Beijing Fifth Ring Road motorway alignment",
        "OpenStreetMap via Geofabrik Beijing extract",
        "EPSG:4548",
        area_km2,
    ])
    feature.setGeometry(selected)
    if not writer.addFeature(feature):
        raise RuntimeError("Could not write S50 study boundary")
    del writer

    check = QgsVectorLayer(str(OUTPUT), "check", "ogr")
    stored = next(check.getFeatures()).geometry()
    outer_parts = len(stored.asMultiPolygon())
    holes = sum(max(0, len(part) - 1) for part in stored.asMultiPolygon())
    vertices = sum(1 for _ in stored.vertices())
    print({
        "s50_segments": len(lines),
        "polygon_candidates": len(candidates_wgs84),
        "plausible_candidates": len(candidates),
        "area_km2": round(area_km2, 3),
        "outer_parts": outer_parts,
        "holes": holes,
        "vertices": vertices,
        "output": str(OUTPUT),
    })


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
