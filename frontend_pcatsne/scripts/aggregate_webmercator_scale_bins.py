from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PATCH_ROOT = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "webmercator_grid_rgb48"
GROUP_ROOT = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "webmercator_grid_rgb48_grouped"
OLD_32KM_DIR = ROOT / "frontend_pcatsne" / "public_pointcloud" / "data" / "r32km_all_london"

GROUPS = [
    ("2km", "wm02km_grid", "2 km grid", 2_000, "identity"),
    ("4km", "wm04km_grid", "4 km grid", 4_000, "identity"),
    ("8km", "wm08km_grid", "8 km grid", 8_000, "identity"),
    ("16km", "wm16km_grid", "16 km grid", 16_000, "identity"),
]


def union_bounds(bounds_list: list[dict]) -> dict:
    numeric = [
        bounds
        for bounds in bounds_list
        if bounds
        and all(bounds.get(key) is not None for key in ["west", "south", "east", "north"])
    ]
    if not numeric:
        return {"west": None, "south": None, "east": None, "north": None}
    return {
        "west": min(float(bounds["west"]) for bounds in numeric),
        "south": min(float(bounds["south"]) for bounds in numeric),
        "east": max(float(bounds["east"]) for bounds in numeric),
        "north": max(float(bounds["north"]) for bounds in numeric),
    }


def aggregate_group(source_group: str, layer_id: str, label: str, radius_m: int, color_matrix: str) -> dict:
    source_dir = PATCH_ROOT / source_group
    if not source_dir.exists():
        raise FileNotFoundError(source_dir)

    patch_dirs = sorted(path for path in source_dir.iterdir() if path.is_dir())
    if not patch_dirs:
        raise FileNotFoundError(f"No patch bins found in {source_dir}")

    output_dir = GROUP_ROOT / layer_id
    output_dir.mkdir(parents=True, exist_ok=True)
    output_bin = output_dir / "points.bin"
    manifests = []

    with output_bin.open("wb") as out:
        for patch_dir in patch_dirs:
            patch_bin = patch_dir / "points.bin"
            patch_manifest = patch_dir / "points.json"
            if not patch_bin.exists() or not patch_manifest.exists():
                raise FileNotFoundError(f"Missing patch output in {patch_dir}")
            manifests.append(json.loads(patch_manifest.read_text(encoding="utf-8")))
            with patch_bin.open("rb") as src:
                shutil.copyfileobj(src, out, length=1024 * 1024)

    manifest = {
        "id": layer_id,
        "label": label,
        "radiusMeters": radius_m,
        "boundaryMeters": radius_m * 1.8,
        "patchCount": len(manifests),
        "count": sum(int(item.get("count", 0)) for item in manifests),
        "recordBytes": 12,
        "byteLength": output_bin.stat().st_size,
        "format": "mercator_xy_float32_rgba_uint8",
        "bounds": union_bounds([item.get("bounds", {}) for item in manifests]),
        "colorMatrix": color_matrix,
        "bin": "points.bin",
    }
    (output_dir / "points.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return {
        **manifest,
        "url": f"./data/webmercator_grid_rgb48_grouped/{layer_id}/points.bin",
        "manifestUrl": f"./data/webmercator_grid_rgb48_grouped/{layer_id}/points.json",
    }


def copy_old_32km() -> dict:
    source_bin = OLD_32KM_DIR / "points.bin"
    source_manifest = OLD_32KM_DIR / "points.json"
    if not source_bin.exists() or not source_manifest.exists():
        raise FileNotFoundError(f"Missing old 32km point cloud in {OLD_32KM_DIR}")

    output_dir = GROUP_ROOT / "wm32km_all_london"
    output_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_bin, output_dir / "points.bin")
    old_manifest = json.loads(source_manifest.read_text(encoding="utf-8"))
    manifest = {
        **old_manifest,
        "id": "wm32km_all_london",
        "label": "32 km all London",
        "radiusMeters": 32_000,
        "boundaryMeters": 32_000 * 1.8,
        "patchCount": 1,
        "colorMatrix": "swap_rg",
        "source": "reused_original_32km_pointcloud",
        "bin": "points.bin",
    }
    (output_dir / "points.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return {
        **manifest,
        "url": "./data/webmercator_grid_rgb48_grouped/wm32km_all_london/points.bin",
        "manifestUrl": "./data/webmercator_grid_rgb48_grouped/wm32km_all_london/points.json",
    }


def main() -> None:
    GROUP_ROOT.mkdir(parents=True, exist_ok=True)
    layers = [aggregate_group(*group) for group in GROUPS]
    layers.append(copy_old_32km())

    manifest = {
        "id": "webmercator-grid-rgb48-grouped",
        "label": "WebMercator grid rgb48",
        "format": "mercator_xy_float32_rgba_uint8",
        "layers": layers,
        "totalLayerCount": len(layers),
        "totalPatchCount": sum(int(layer.get("patchCount", 0)) for layer in layers),
        "totalCount": sum(int(layer.get("count", 0)) for layer in layers),
        "totalByteLength": sum(int(layer.get("byteLength", 0)) for layer in layers),
    }
    (GROUP_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Summary: {(GROUP_ROOT / 'manifest.json').relative_to(ROOT)}")
    print(
        f"layers={manifest['totalLayerCount']}; patches={manifest['totalPatchCount']}; "
        f"points={manifest['totalCount']:,}; bytes={manifest['totalByteLength'] / 1024 / 1024:.2f} MiB"
    )


if __name__ == "__main__":
    main()
