from __future__ import annotations

import json
import math
import shutil
from collections import OrderedDict
from pathlib import Path
from typing import TextIO

from slim_geojson_for_viewer import iter_feature_json


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "frontend_pcatsne" / "public" / "data"

LAYERS = [
    "r16km_bbox",
    "r32km_all_london",
]

ZOOMS = [10, 11, 12]
MAX_OPEN_FILES = 64


def lon_lat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    clamped_lat = max(-85.05112878, min(85.05112878, lat))
    wrapped_lon = ((lon + 180.0) % 360.0) - 180.0
    lat_rad = math.radians(clamped_lat)
    n = 2**z
    x = int(((wrapped_lon + 180.0) / 360.0) * n)
    y = int(((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0) * n)
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


class TileWriter:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.handles: OrderedDict[tuple[int, int, int], TextIO] = OrderedDict()
        self.counts: dict[tuple[int, int, int], int] = {}

    def write(self, z: int, x: int, y: int, feature_json: str) -> None:
        key = (z, x, y)
        handle = self._handle_for(key)
        if self.counts.get(key, 0) > 0:
            handle.write(",")
        handle.write(feature_json)
        self.counts[key] = self.counts.get(key, 0) + 1

    def close(self) -> None:
        while self.handles:
            _, handle = self.handles.popitem(last=False)
            handle.close()
        for key in self.counts:
            z, x, y = key
            path = self.root / str(z) / str(x) / f"{y}.geojson"
            with path.open("a", encoding="utf-8") as handle:
                handle.write("]}")

    def _handle_for(self, key: tuple[int, int, int]) -> TextIO:
        existing = self.handles.get(key)
        if existing:
            self.handles.move_to_end(key)
            return existing

        if len(self.handles) >= MAX_OPEN_FILES:
            _, old_handle = self.handles.popitem(last=False)
            old_handle.close()

        z, x, y = key
        path = self.root / str(z) / str(x) / f"{y}.geojson"
        path.parent.mkdir(parents=True, exist_ok=True)
        is_new = self.counts.get(key, 0) == 0 and not path.exists()
        handle = path.open("a", encoding="utf-8")
        if is_new:
            handle.write('{"type":"FeatureCollection","features":[')
        self.handles[key] = handle
        return handle


def prepare_tile_dir(path: Path) -> None:
    resolved = path.resolve()
    allowed_root = DATA_DIR.resolve()
    if allowed_root not in resolved.parents:
        raise RuntimeError(f"Refusing to clear path outside data dir: {resolved}")
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def build_layer_tiles(layer_id: str) -> None:
    source = DATA_DIR / layer_id / "tsne3_rgb_uint8.geojson"
    tile_root = DATA_DIR / layer_id / "tiles"
    if not source.exists():
        raise FileNotFoundError(source)

    print(f"Tiling {source.relative_to(ROOT)}")
    prepare_tile_dir(tile_root)
    writer = TileWriter(tile_root)
    total = 0

    try:
        for raw_feature in iter_feature_json(source):
            feature = json.loads(raw_feature)
            geometry = feature.get("geometry") or {}
            coordinates = geometry.get("coordinates") or []
            if len(coordinates) < 2:
                continue
            lon = float(coordinates[0])
            lat = float(coordinates[1])
            for z in ZOOMS:
                x, y = lon_lat_to_tile(lon, lat, z)
                writer.write(z, x, y, raw_feature)
            total += 1
            if total % 50_000 == 0:
                print(f"  {total:,} features")
    finally:
        writer.close()

    tile_count = len(writer.counts)
    print(f"  done: {total:,} features into {tile_count:,} non-empty tiles")


def main() -> None:
    for layer_id in LAYERS:
        build_layer_tiles(layer_id)


if __name__ == "__main__":
    main()
