"""Export a sampled GeoPackage point layer to a compact WGS84 CSV.

Output columns are deliberately limited to the requested unique sample-point
ID and WGS84 coordinates: fid, lat and lon.
"""

import csv
from pathlib import Path
import sys

from osgeo import ogr, osr


def main(input_path: str, output_path: str) -> None:
    source = ogr.Open(input_path, 0)
    if source is None:
        raise RuntimeError(f"Could not open input dataset: {input_path}")
    layer = source.GetLayer(0)
    if layer is None:
        raise RuntimeError("Input dataset has no vector layer")

    source_crs = layer.GetSpatialRef()
    if source_crs is None:
        raise RuntimeError("Input layer has no CRS")
    target_crs = osr.SpatialReference()
    target_crs.ImportFromEPSG(4326)
    source_crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source_crs, target_crs)

    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with destination.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["fid", "lat", "lon"])
        for feature in layer:
            geometry = feature.GetGeometryRef()
            if geometry is None or geometry.IsEmpty():
                continue
            point = geometry.Clone()
            point.Transform(transform)
            writer.writerow([
                feature.GetFID(),
                f"{point.GetY():.10f}",
                f"{point.GetX():.10f}",
            ])
            total += 1
    print(f"Exported {total} points to {destination}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: export_sample_latlon_csv.py INPUT_GPKG OUTPUT_CSV")
    main(sys.argv[1], sys.argv[2])
