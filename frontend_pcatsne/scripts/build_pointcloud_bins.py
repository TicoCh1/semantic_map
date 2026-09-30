from __future__ import annotations

import json
import math
import struct
from pathlib import Path

from slim_geojson_for_viewer import iter_feature_json


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DATA_DIR = ROOT / "frontend_pcatsne" / "public" / "data"
WEB_DATA_DIR = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data"

LAYERS = [
    "r02km_bbox",
    "r04km_bbox",
    "r08km_bbox",
    "r16km_bbox",
    "r32km_all_london",
]

RECORD = struct.Struct("<ffBBBB")
CHUNK_RECORDS = 100_000


def lon_lat_to_mercator(lon: float, lat: float) -> tuple[float, float]:
    clamped_lat = max(-85.05112878, min(85.05112878, lat))
    sin_lat = math.sin(math.radians(clamped_lat))
    x = (lon + 180.0) / 360.0
    y = 0.5 - math.log((1.0 + sin_lat) / (1.0 - sin_lat)) / (4.0 * math.pi)
    return x, y


def as_uint8(value: object) -> int:
    try:
        return max(0, min(255, int(value)))
    except (TypeError, ValueError):
        return 0


def build_layer(layer_id: str) -> None:
    source = SOURCE_DATA_DIR / layer_id / "tsne3_rgb_uint8.geojson"
    output_dir = WEB_DATA_DIR / layer_id
    output_dir.mkdir(parents=True, exist_ok=True)
    bin_path = output_dir / "points.bin"
    manifest_path = output_dir / "points.json"
    if not source.exists():
        raise FileNotFoundError(source)

    print(f"Building {bin_path.relative_to(ROOT)}")
    count = 0
    min_lon = math.inf
    min_lat = math.inf
    max_lon = -math.inf
    max_lat = -math.inf
    buffer = bytearray()

    with bin_path.open("wb") as out:
        for raw_feature in iter_feature_json(source):
            feature = json.loads(raw_feature)
            geometry = feature.get("geometry") or {}
            coordinates = geometry.get("coordinates") or []
            properties = feature.get("properties") or {}
            if len(coordinates) < 2:
                continue

            lon = float(coordinates[0])
            lat = float(coordinates[1])
            x, y = lon_lat_to_mercator(lon, lat)
            r = as_uint8(properties.get("R", properties.get("r")))
            g = as_uint8(properties.get("G", properties.get("g")))
            b = as_uint8(properties.get("B", properties.get("b")))
            buffer.extend(RECORD.pack(x, y, r, g, b, 255))

            min_lon = min(min_lon, lon)
            min_lat = min(min_lat, lat)
            max_lon = max(max_lon, lon)
            max_lat = max(max_lat, lat)
            count += 1

            if count % CHUNK_RECORDS == 0:
                out.write(buffer)
                buffer.clear()
                print(f"  {count:,} points")

        if buffer:
            out.write(buffer)

    manifest = {
        "id": layer_id,
        "count": count,
        "recordBytes": RECORD.size,
        "byteLength": bin_path.stat().st_size,
        "format": "mercator_xy_float32_rgba_uint8",
        "bounds": {
            "west": min_lon,
            "south": min_lat,
            "east": max_lon,
            "north": max_lat,
        },
        "bin": "points.bin",
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  done: {count:,} points, {manifest['byteLength'] / 1024 / 1024:.2f} MiB")


def main() -> None:
    for layer_id in LAYERS:
        build_layer(layer_id)


if __name__ == "__main__":
    main()
