"""Replace a masked portion of a point sample with a denser local sample."""

from pathlib import Path
import sys

from qgis.core import (
    QgsApplication,
    QgsFeature,
    QgsFeatureSink,
    QgsField,
    QgsGeometry,
    QgsVectorFileWriter,
    QgsVectorLayer,
)
from qgis.PyQt.QtCore import QVariant


def add_features(writer, fields, source, engine, keep_inside, interval):
    count = 0
    for feature in source.getFeatures():
        geometry = feature.geometry()
        if geometry is None or geometry.isEmpty():
            continue
        is_inside = engine.intersects(geometry.constGet())
        if is_inside != keep_inside:
            continue
        output = QgsFeature(fields)
        # The two source GeoPackages both start their provider FIDs at 1.
        # Leave the destination FID unset so GeoPackage assigns one sequence.
        output.setId(-1)
        output.setGeometry(geometry)
        output.setAttributes(feature.attributes() + [interval])
        if not writer.addFeature(output, QgsFeatureSink.FastInsert):
            raise RuntimeError("Could not write output feature")
        count += 1
    return count


def main(
    baseline_path: str,
    replacement_path: str,
    mask_path: str,
    output_path: str,
    baseline_interval: float,
    replacement_interval: float,
) -> None:
    baseline = QgsVectorLayer(baseline_path, "baseline", "ogr")
    replacement = QgsVectorLayer(replacement_path, "replacement", "ogr")
    mask = QgsVectorLayer(mask_path, "mask", "ogr")
    if not all(layer.isValid() for layer in (baseline, replacement, mask)):
        raise RuntimeError("Could not open one or more input layers")
    if baseline.fields().names() != replacement.fields().names():
        raise RuntimeError("Baseline and replacement layers do not have matching fields")

    mask_geometry = None
    for feature in mask.getFeatures():
        geometry = feature.geometry()
        if geometry is None or geometry.isEmpty():
            continue
        mask_geometry = geometry if mask_geometry is None else mask_geometry.combine(geometry)
    if mask_geometry is None or mask_geometry.isEmpty():
        raise RuntimeError("Mask layer has no valid geometry")
    engine = QgsGeometry.createGeometryEngine(mask_geometry.constGet())
    engine.prepareGeometry()

    fields = baseline.fields()
    fields.append(QgsField("sample_interval_m", QVariant.Double, "double", 8, 2))
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName = "GPKG"
    options.layerName = "mixed_sampling"
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    writer = QgsVectorFileWriter.create(
        str(destination), fields, baseline.wkbType(), baseline.crs(),
        QgsProject.instance().transformContext(), options,
    )
    if writer.hasError():
        raise RuntimeError(writer.errorMessage())

    baseline_count = add_features(writer, fields, baseline, engine, False, baseline_interval)
    replacement_count = add_features(
        writer, fields, replacement, engine, True, replacement_interval
    )
    del writer
    print(
        f"Kept outside mask from baseline: {baseline_count}; "
        f"inserted inside mask from replacement: {replacement_count}; "
        f"raw total: {baseline_count + replacement_count}",
        flush=True,
    )


if __name__ == "__main__":
    from qgis.core import QgsProject

    if len(sys.argv) != 7:
        raise SystemExit(
            "Usage: merge_sampling_replace_mask.py BASELINE REPLACEMENT MASK OUTPUT "
            "BASELINE_INTERVAL REPLACEMENT_INTERVAL"
        )
    app = QgsApplication([], False)
    app.initQgis()
    try:
        main(
            sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4],
            float(sys.argv[5]), float(sys.argv[6]),
        )
    finally:
        app.exitQgis()
