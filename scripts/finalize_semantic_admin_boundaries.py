"""Make one clean, exact exterior study extent from each OSM admin candidate.

The exterior ring is copied directly from the selected OSM administrative
boundary union.  No simplify or smoothing operation is applied, so source
coastlines and river-following administrative segments are retained.  Tiny
source fragments (<0.01 km²) and interior rings are omitted because each
project represents one usable study extent, rather than a legal cadastral
territory with island slivers or enclaves.
"""

from __future__ import annotations

import gc
from pathlib import Path

from qgis.core import (
    QgsApplication,
    QgsFeature,
    QgsGeometry,
    QgsProject,
    QgsVectorFileWriter,
    QgsVectorLayer,
    QgsWkbTypes,
)


ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / "tmp"
MIN_COMPONENT_AREA_M2 = 10_000


def exterior_only(geometry: QgsGeometry) -> QgsGeometry:
    polygons = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    retained = []
    for polygon in polygons:
        if not polygon or not polygon[0]:
            continue
        exterior = QgsGeometry.fromPolygonXY([polygon[0]])
        if exterior.area() >= MIN_COMPONENT_AREA_M2:
            retained.append(exterior)
    if not retained:
        raise RuntimeError("No substantive administrative-boundary exterior remains")
    result = QgsGeometry.unaryUnion(retained)
    if QgsWkbTypes.isSingleType(result.wkbType()):
        result.convertToMultiType()
    if result.isEmpty() or not result.isGeosValid():
        raise RuntimeError("Exact administrative exterior is invalid")
    return result


def topology(geometry: QgsGeometry) -> tuple[int, int]:
    parts = geometry.asMultiPolygon() if geometry.isMultipart() else [geometry.asPolygon()]
    return len(parts), sum(max(0, len(part) - 1) for part in parts)


def finalize(candidate: Path) -> dict[str, object]:
    layer = QgsVectorLayer(str(candidate), candidate.stem, "ogr")
    if not layer.isValid() or layer.featureCount() != 1:
        raise RuntimeError(f"Invalid semantic candidate: {candidate.name}")
    original = next(layer.getFeatures())
    geometry = exterior_only(original.geometry())
    parts, holes = topology(geometry)
    if parts != 1 or holes != 0:
        raise RuntimeError(f"Expected one exterior and no holes in {candidate.name}; got {parts}, {holes}")

    fields = layer.fields()
    attributes = original.attributes()
    basis_index = fields.indexOf("boundary_basis")
    source_index = fields.indexOf("data_source")
    area_index = fields.indexOf("area_km2")
    if basis_index >= 0:
        prior = str(attributes[basis_index]).split("; exact OSM administrative geometry")[0]
        attributes[basis_index] = (
            f"{prior}; exact OSM administrative exterior "
            "(unsmoothed; source coastlines and river boundary segments preserved)"
        )
    if source_index >= 0:
        attributes[source_index] = "OpenStreetMap administrative-boundary relations via Nominatim"
    if area_index >= 0:
        attributes[area_index] = round(geometry.area() / 1_000_000, 3)

    output = candidate.with_name(candidate.name.replace("__semantic.gpkg", "__semantic_final.gpkg"))
    if output.exists():
        output.unlink()
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "study_boundary"
    writer = QgsVectorFileWriter.create(
        str(output), fields, QgsWkbTypes.MultiPolygon, layer.crs(),
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())
    feature = QgsFeature(fields)
    feature.setAttributes(attributes)
    feature.setGeometry(geometry)
    if not writer.addFeature(feature):
        raise RuntimeError(f"Could not write {output.name}")
    del writer
    del feature
    del original
    del layer
    gc.collect()
    return {
        "source": candidate.name,
        "output": output.name,
        "area_km2": round(geometry.area() / 1_000_000, 3),
        "vertices": sum(1 for _ in geometry.vertices()),
    }


def main() -> None:
    for candidate in sorted(TEMP.glob("*_study_extent__semantic.gpkg")):
        print(finalize(candidate), flush=True)


if __name__ == "__main__":
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main()
    finally:
        app.exitQgis()
