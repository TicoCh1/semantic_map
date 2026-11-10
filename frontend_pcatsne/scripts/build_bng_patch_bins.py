from __future__ import annotations

import json
import math
import re
import struct
from pathlib import Path

from slim_geojson_for_viewer import iter_feature_json


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "frontend_pcatsne" / "public" / "bng_test" / "bng_grid_2km_test_pca50_tsne3"
WEB_ROOT = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "bng_grid_2km"

VARIANTS = {
    "rgb48": SOURCE_ROOT / "geojson_rgb48",
    "rgbrot": SOURCE_ROOT / "geojson_rgbrot",
}

RECORD = struct.Struct("<ffBBBB")
CHUNK_RECORDS = 100_000
PATCH_RE = re.compile(r"^2km_(-?\d+)_(-?\d+)_(rgb48|rgbrot)\.geojson$")


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


def build_patch(source: Path, output_dir: Path, patch_id: str, gx: int, gy: int, variant: str) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    bin_path = output_dir / "points.bin"
    manifest_path = output_dir / "points.json"

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

    bounds = {
        "west": min_lon if count else None,
        "south": min_lat if count else None,
        "east": max_lon if count else None,
        "north": max_lat if count else None,
    }
    manifest = {
        "id": patch_id,
        "label": patch_id,
        "variant": variant,
        "grid": {"x": gx, "y": gy},
        "count": count,
        "recordBytes": RECORD.size,
        "byteLength": bin_path.stat().st_size,
        "format": "mercator_xy_float32_rgba_uint8",
        "bounds": bounds,
        "bin": "points.bin",
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  done: {count:,} points, {manifest['byteLength'] / 1024 / 1024:.2f} MiB")
    return manifest


def find_variant_sources(variant: str, source_dir: Path) -> list[tuple[Path, str, int, int]]:
    if not source_dir.exists():
        raise FileNotFoundError(source_dir)

    records = []
    for source in source_dir.glob("2km_*_*.geojson"):
        match = PATCH_RE.match(source.name)
        if not match:
            continue
        gx = int(match.group(1))
        gy = int(match.group(2))
        file_variant = match.group(3)
        if file_variant != variant:
            continue
        patch_id = f"2km_{gx}_{gy}"
        records.append((source, patch_id, gx, gy))
    records.sort(key=lambda item: (item[3], item[2]))
    return records


def main() -> None:
    all_variants = {}
    for variant, source_dir in VARIANTS.items():
        variant_root = WEB_ROOT / variant
        patch_manifests = []
        for source, patch_id, gx, gy in find_variant_sources(variant, source_dir):
            patch_manifest = build_patch(source, variant_root / patch_id, patch_id, gx, gy, variant)
            patch_manifest["url"] = f"./data/bng_grid_2km/{variant}/{patch_id}/points.bin"
            patch_manifest["manifestUrl"] = f"./data/bng_grid_2km/{variant}/{patch_id}/points.json"
            patch_manifests.append(patch_manifest)

        variant_manifest = {
            "id": f"bng-grid-2km-{variant}",
            "label": f"2km grid {variant}",
            "variant": variant,
            "patchCount": len(patch_manifests),
            "patches": patch_manifests,
            "totalCount": sum(p["count"] for p in patch_manifests),
            "totalByteLength": sum(p["byteLength"] for p in patch_manifests),
        }
        (variant_root / "manifest.json").write_text(json.dumps(variant_manifest, indent=2), encoding="utf-8")
        all_variants[variant] = variant_manifest

    summary = {
        "id": "bng-grid-2km",
        "label": "BNG 2km grid",
        "format": "mercator_xy_float32_rgba_uint8",
        "variants": {
            variant: {
                "manifestUrl": f"./data/bng_grid_2km/{variant}/manifest.json",
                "patchCount": manifest["patchCount"],
                "totalCount": manifest["totalCount"],
                "totalByteLength": manifest["totalByteLength"],
            }
            for variant, manifest in all_variants.items()
        },
    }
    WEB_ROOT.mkdir(parents=True, exist_ok=True)
    (WEB_ROOT / "manifest.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"Summary: {(WEB_ROOT / 'manifest.json').relative_to(ROOT)}")


if __name__ == "__main__":
    main()
