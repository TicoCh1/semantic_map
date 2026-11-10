"""Create selectable, source-traceable boundary option layers for QGIS.

Every polygon is an exact exterior of named OSM administrative relations.  The
outer line is never smoothed; coast, river and administrative segments remain
as supplied by OSM/Nominatim.  The original project layers remain untouched.
"""

from __future__ import annotations

from dataclasses import dataclass
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
    QgsWkbTypes,
)

from build_osm_study_boundaries import Fetcher


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "qgis_city_study_extents"
MIN_COMPONENT_AREA_M2 = 10_000


@dataclass(frozen=True)
class Option:
    filename: str
    layer_name: str
    city: str
    crs: str
    relation_ids: tuple[int, ...]
    basis: str


OPTIONS = (
    Option(
        "New_York_Option_Harbour_Core.gpkg",
        "NYC Harbour Core",
        "New York",
        "EPSG:26918",
        (8398124, 9691750, 170953, 170708),
        "Exact OSM administrative exterior: Manhattan + Brooklyn + Jersey City + Hoboken",
    ),
    Option(
        "New_York_Option_Three_Borough_Core.gpkg",
        "NYC Three Borough Core",
        "New York",
        "EPSG:26918",
        (8398124, 9691750, 9691819),
        "Exact OSM administrative exterior: Manhattan + Brooklyn + Queens",
    ),
    Option(
        "New_York_Option_Four_Borough_Core.gpkg",
        "NYC Four Borough Core",
        "New York",
        "EPSG:26918",
        (8398124, 9691750, 9691819, 9691916),
        "Exact OSM administrative exterior: Manhattan + Brooklyn + Queens + Bronx",
    ),
    Option(
        "Shenzhen_Option_Three_District_Core.gpkg",
        "Shenzhen Three District Core",
        "Shenzhen",
        "EPSG:4547",
        (5664195, 5664191, 5664194),
        "Exact OSM administrative exterior: Nanshan + Futian + Luohu",
    ),
    Option(
        "Shenzhen_Option_Historic_SEZ_District_Proxy.gpkg",
        "Shenzhen Historic SEZ District Proxy",
        "Shenzhen",
        "EPSG:4547",
        (5664195, 5664191, 5664194, 5663273),
        "Exact OSM administrative exterior: Nanshan + Futian + Luohu + Yantian; contemporary district proxy only, not the historic Second Line",
    ),
)


def exterior_only(geometry: QgsGeometry) -> QgsGeometry:
    polygons = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    exteriors = []
    for polygon in polygons:
        if polygon and polygon[0]:
            exterior = QgsGeometry.fromPolygonXY([polygon[0]])
            if exterior.area() >= MIN_COMPONENT_AREA_M2:
                exteriors.append(exterior)
    result = QgsGeometry.unaryUnion(exteriors)
    if QgsWkbTypes.isSingleType(result.wkbType()):
        result.convertToMultiType()
    if result.isEmpty() or not result.isGeosValid():
        raise RuntimeError("Invalid option geometry")
    return result


def write_option(option: Option, geometry_wgs84: QgsGeometry) -> dict[str, object]:
    target_crs = QgsCoordinateReferenceSystem(option.crs)
    geometry = QgsGeometry(geometry_wgs84)
    transform = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:4326"), target_crs, QgsProject.instance().transformContext()
    )
    if geometry.transform(transform) != 0:
        raise RuntimeError(f"Could not transform {option.layer_name}")
    geometry = exterior_only(geometry)
    parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    if any(len(part) != 1 for part in parts):
        raise RuntimeError(f"{option.layer_name} contains an interior ring")

    fields = QgsFields()
    fields.append(QgsField("option", QVariant.String))
    fields.append(QgsField("city", QVariant.String))
    fields.append(QgsField("boundary_basis", QVariant.String))
    fields.append(QgsField("data_source", QVariant.String))
    fields.append(QgsField("source_relation_ids", QVariant.String))
    fields.append(QgsField("crs", QVariant.String))
    fields.append(QgsField("area_km2", QVariant.Double, "double", 20, 3))
    fields.append(QgsField("pct_shanghai_680", QVariant.Double, "double", 20, 1))
    fields.append(QgsField("components", QVariant.Int))

    output = OUTPUT / option.filename
    if output.exists():
        output.unlink()
    save_options = QgsVectorFileWriter.SaveVectorOptions()
    save_options.driverName = "GPKG"
    save_options.layerName = "study_boundary_option"
    writer = QgsVectorFileWriter.create(
        str(output), fields, QgsWkbTypes.MultiPolygon, target_crs,
        QgsProject.instance().transformContext(), save_options,
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    area_km2 = geometry.area() / 1_000_000
    feature = QgsFeature(fields)
    feature.setAttributes([
        option.layer_name,
        option.city,
        option.basis,
        "OpenStreetMap administrative-boundary relations via Nominatim",
        ",".join(str(identifier) for identifier in option.relation_ids),
        option.crs,
        area_km2,
        area_km2 / 680 * 100,
        len(parts),
    ])
    feature.setGeometry(geometry)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write {option.filename}")
    del writer
    return {
        "file": output.name,
        "layer": option.layer_name,
        "area_km2": round(area_km2, 3),
        "pct_shanghai_680": round(area_km2 / 680 * 100, 1),
        "vertices": sum(1 for _ in geometry.vertices()),
        "components": len(parts),
    }


def main() -> None:
    fetcher = Fetcher()
    cache: dict[int, QgsGeometry] = {}
    for option in OPTIONS:
        geometries = []
        for relation_id in option.relation_ids:
            if relation_id not in cache:
                cache[relation_id] = fetcher.nominatim_geometries((relation_id,))[0]
            geometries.append(cache[relation_id])
        union = QgsGeometry.unaryUnion(geometries)
        print(write_option(option, union), flush=True)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
