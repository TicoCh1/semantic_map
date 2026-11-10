from __future__ import annotations

import json
import math
import re
import shutil
import struct
from pathlib import Path

from slim_geojson_for_viewer import iter_feature_json


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "frontend_pcatsne" / "public" / "webmercator_grid_rgb48_pca50_tsne3"
SOURCE_GEOJSON_DIR = SOURCE_ROOT / "geojson_rgb48"
WEB_ROOT = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "webmercator_grid_rgb48"
OLD_32KM_DIR = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "r32km_all_london"

PATCH_RE = re.compile(r"^(?P<radius>\d+)km_(?P<gx>-?\d+)_(?P<gy>-?\d+)_rgb48\.geojson$")
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


def format_bounds(min_lon: float, min_lat: float, max_lon: float, max_lat: float, count: int) -> dict:
    if count <= 0:
        return {"west": None, "south": None, "east": None, "north": None}
    return {"west": min_lon, "south": min_lat, "east": max_lon, "north": max_lat}


def build_patch(source: Path, output_dir: Path, patch_id: str, radius_m: int, gx: int, gy: int) -> dict:
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

    manifest = {
        "id": patch_id,
        "label": patch_id.replace("_", " "),
        "radiusMeters": radius_m,
        "grid": {"x": gx, "y": gy},
        "count": count,
        "recordBytes": RECORD.size,
        "byteLength": bin_path.stat().st_size,
        "format": "mercator_xy_float32_rgba_uint8",
        "bounds": format_bounds(min_lon, min_lat, max_lon, max_lat, count),
        "bin": "points.bin",
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"  done: {count:,} points, {manifest['byteLength'] / 1024 / 1024:.2f} MiB")
    return manifest


def iter_patch_sources() -> list[tuple[Path, str, int, int, int]]:
    if not SOURCE_GEOJSON_DIR.exists():
        raise FileNotFoundError(SOURCE_GEOJSON_DIR)

    records = []
    for source in SOURCE_GEOJSON_DIR.glob("*_rgb48.geojson"):
        match = PATCH_RE.match(source.name)
        if not match:
            continue
        radius_km = int(match.group("radius"))
        gx = int(match.group("gx"))
        gy = int(match.group("gy"))
        radius_m = radius_km * 1000
        patch_id = f"{radius_km}km_{gx}_{gy}"
        records.append((source, patch_id, radius_m, gx, gy))
    return sorted(records, key=lambda item: (item[2], item[4], item[3]))


def copy_old_32km() -> dict:
    source_bin = OLD_32KM_DIR / "points.bin"
    source_manifest = OLD_32KM_DIR / "points.json"
    if not source_bin.exists() or not source_manifest.exists():
        raise FileNotFoundError(f"Missing old 32km point cloud in {OLD_32KM_DIR}")

    output_dir = WEB_ROOT / "32km_all_london"
    output_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_bin, output_dir / "points.bin")
    old_manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
    manifest = {
        **old_manifest,
        "id": "32km_all_london",
        "label": "32 km all London",
        "radiusMeters": 32000,
        "source": "reused_original_32km_pointcloud",
        "bin": "points.bin",
    }
    (output_dir / "points.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return {
        **manifest,
        "url": "./data/webmercator_grid_rgb48/32km_all_london/points.bin",
        "manifestUrl": "./data/webmercator_grid_rgb48/32km_all_london/points.json",
    }


def main() -> None:
    WEB_ROOT.mkdir(parents=True, exist_ok=True)
    groups: dict[str, dict] = {}

    for source, patch_id, radius_m, gx, gy in iter_patch_sources():
        radius_label = f"{radius_m // 1000}km"
        output_dir = WEB_ROOT / radius_label / patch_id
        patch_manifest = build_patch(source, output_dir, patch_id, radius_m, gx, gy)
        patch_manifest["url"] = f"./data/webmercator_grid_rgb48/{radius_label}/{patch_id}/points.bin"
        patch_manifest["manifestUrl"] = f"./data/webmercator_grid_rgb48/{radius_label}/{patch_id}/points.json"
        groups.setdefault(
            radius_label,
            {
                "id": radius_label,
                "label": f"{radius_m // 1000} km grid",
                "radiusMeters": radius_m,
                "patches": [],
            },
        )["patches"].append(patch_manifest)

    old_32km = copy_old_32km()
    groups["32km"] = {
        "id": "32km",
        "label": "32 km all London",
        "radiusMeters": 32000,
        "patches": [old_32km],
        "source": "reused_original_32km_pointcloud",
    }

    ordered_groups = [groups[key] for key in sorted(groups, key=lambda key: int(key.replace("km", "")))]
    for group in ordered_groups:
        group["patchCount"] = len(group["patches"])
        group["totalCount"] = sum(int(p.get("count", 0)) for p in group["patches"])
        group["totalByteLength"] = sum(int(p.get("byteLength", 0)) for p in group["patches"])

    source_summary = SOURCE_ROOT / "summary_manifest.json"
    manifest = {
        "id": "webmercator-grid-rgb48",
        "label": "WebMercator grid rgb48",
        "format": "mercator_xy_float32_rgba_uint8",
        "sourceSummary": str(source_summary.relative_to(ROOT)) if source_summary.exists() else None,
        "groups": ordered_groups,
        "totalPatchCount": sum(group["patchCount"] for group in ordered_groups),
        "totalCount": sum(group["totalCount"] for group in ordered_groups),
        "totalByteLength": sum(group["totalByteLength"] for group in ordered_groups),
    }
    (WEB_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Summary: {(WEB_ROOT / 'manifest.json').relative_to(ROOT)}")
    group_counts = ", ".join(f"{group['id']}={group['patchCount']}" for group in ordered_groups)
    print(
        f"Groups: {group_counts}; "
        f"points={manifest['totalCount']:,}; bytes={manifest['totalByteLength'] / 1024 / 1024:.2f} MiB"
    )


if __name__ == "__main__":
    main()
