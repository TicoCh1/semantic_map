"""Derive the Paris study boundary from the real A86 orbital motorway.

The OSM road-route relation 137767 is the A86 orbital.  Its way geometries are
polygonised without smoothing so the resulting study outline follows the actual
motorway alignment rather than an administrative boundary.
"""

from __future__ import annotations

import json
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
    QgsPointXY,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    ROOT / "tmp" / "paris_a86_ways_overpass.json",
    ROOT / "tmp" / "paris_a86_shared_segments_overpass.json",
)
OUTPUT = ROOT / "tmp" / "Paris_study_extent_a86_candidate.gpkg"
TARGET_CRS = QgsCoordinateReferenceSystem("EPSG:2154")


def exterior_only(geometry: QgsGeometry) -> QgsGeometry:
    polygons = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    return QgsGeometry.fromMultiPolygonXY([polygon[:1] for polygon in polygons if polygon and polygon[0]])


def main() -> None:
    elements = []
    for source in SOURCES:
        elements.extend(json.loads(source.read_text(encoding="utf-8")).get("elements", []))
    lines = []
    for element in elements:
        points = [QgsPointXY(point["lon"], point["lat"]) for point in element.get("geometry", [])]
        if len(points) >= 2:
            lines.append(QgsGeometry.fromPolylineXY(points))
    if len(lines) < 100:
        raise RuntimeError(f"Expected A86 route segments, got {len(lines)}")

    noded = QgsGeometry.unaryUnion(lines)
    merged = noded.mergeLines()
    merged_parts = merged.asGeometryCollection() if merged.isMultipart() else [merged]
    print({
        "merged_a86_paths": len(merged_parts),
        "longest_path_degrees": sorted((round(part.length(), 5) for part in merged_parts), reverse=True)[:12],
        "longest_path_endpoints": [
            [
                (round(part.asPolyline()[0].x(), 5), round(part.asPolyline()[0].y(), 5)),
                (round(part.asPolyline()[-1].x(), 5), round(part.asPolyline()[-1].y(), 5)),
            ]
            for part in sorted(merged_parts, key=lambda geometry: geometry.length(), reverse=True)[:12]
            if part.asPolyline()
        ],
        "longest_path_bboxes": [
            tuple(round(value, 5) for value in (part.boundingBox().xMinimum(), part.boundingBox().yMinimum(), part.boundingBox().xMaximum(), part.boundingBox().yMaximum()))
            for part in sorted(merged_parts, key=lambda geometry: geometry.length(), reverse=True)[:12]
        ],
    })
    transform = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:4326"), TARGET_CRS, QgsProject.instance().transformContext()
    )
    raw_candidates = [polygon for polygon in QgsGeometry.polygonize([noded]).asGeometryCollection() if not polygon.isEmpty()]
    candidates = []
    for candidate in raw_candidates:
        projected = QgsGeometry(candidate)
        if transform is not None and projected.transform(transform) != 0:
            raise RuntimeError("Could not reproject A86 candidate")
        # A86 is the appropriate inner-metropolitan study scale: reject
        # interchange islands and any accidental regional enclosing polygon.
        if 200 <= projected.area() / 1_000_000 <= 800:
            candidates.append(projected)
    if not candidates:
        # A86 briefly shares A3/A4 and national-road sections.  This creates
        # short representation gaps at interchanges in the OSM road relation.
        # Reconnect only endpoints that are geographically co-located (<=330m),
        # then polygonise the actual route again.  This does not generalise or
        # smooth the motorway; the added links only bridge junction geometry.
        endpoints = []
        for part in merged_parts:
            points = part.asPolyline()
            if points:
                endpoints.extend([points[0], points[-1]])
        connectors = []
        for index, first in enumerate(endpoints):
            for second in endpoints[index + 1:]:
                if 0 < first.distance(second) <= 0.003:
                    connectors.append(QgsGeometry.fromPolylineXY([first, second]))
        completed = QgsGeometry.unaryUnion([noded, *connectors])
        raw_candidates = [
            polygon for polygon in QgsGeometry.polygonize([completed]).asGeometryCollection()
            if not polygon.isEmpty()
        ]
        for candidate in raw_candidates:
            projected = QgsGeometry(candidate)
            if projected.transform(transform) != 0:
                raise RuntimeError("Could not reproject completed A86 candidate")
            if 200 <= projected.area() / 1_000_000 <= 800:
                candidates.append(projected)
    if not candidates:
        raw_areas = sorted(round(c.area() / 1_000_000, 2) for c in raw_candidates)
        raise RuntimeError(f"No plausible A86 candidate; raw candidate areas: {raw_areas[-20:]}")

    selected = exterior_only(max(candidates, key=lambda geometry: geometry.area()))
    if QgsWkbTypes.isSingleType(selected.wkbType()):
        selected.convertToMultiType()
    if selected.isEmpty() or not selected.isGeosValid():
        raise RuntimeError("Selected A86 polygon is invalid")
    area_km2 = selected.area() / 1_000_000

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
        "Paris",
        "A86 orbital alignment, including its shared A3/A4 and N186/N385 sections",
        "OpenStreetMap: A86 corridor and shared-route segments",
        "EPSG:2154",
        area_km2,
    ])
    feature.setGeometry(selected)
    if not writer.addFeature(feature):
        raise RuntimeError("Could not write A86 study boundary")
    del writer

    check = QgsVectorLayer(str(OUTPUT), "check", "ogr")
    stored = next(check.getFeatures()).geometry()
    parts = stored.asMultiPolygon()
    print({
        "a86_segments": len(lines),
        "polygon_candidates": len(raw_candidates),
        "plausible_candidates": len(candidates),
        "area_km2": round(area_km2, 3),
        "outer_parts": len(parts),
        "holes": sum(max(0, len(part) - 1) for part in parts),
        "vertices": sum(1 for _ in stored.vertices()),
        "output": str(OUTPUT),
    })


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
