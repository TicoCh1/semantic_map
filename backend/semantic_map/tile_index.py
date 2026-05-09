from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from .backend_config import BackendSettings
from .scoring_models import PanoRecord
from .tile_math import TileKey, latlon_to_tile, stable_hash_u64


@dataclass(frozen=True, slots=True)
class TileIndexEntry:
    tile: TileKey
    pano_id: str
    row_index: int
    sample_rank: int
    keep: bool


@dataclass(frozen=True)
class TileIndex:
    dataset_id: str
    zooms: tuple[int, ...]
    entries_by_tile: dict[TileKey, tuple[TileIndexEntry, ...]]
    tiles_by_pano: dict[str, tuple[TileKey, ...]]
    density_rule: str
    density_base_zoom: int
    density_trigger_points: int
    density_keep_points: int
    version: str


def build_tile_index(dataset_id: str, records: tuple[PanoRecord, ...], settings: BackendSettings) -> TileIndex:
    if not settings.tile_zooms:
        raise ValueError("At least one tile zoom must be configured")

    base_zoom = max(settings.tile_zooms)
    density_rule = "base_zoom_area_scaled_v1"
    base_grouped: dict[TileKey, list[tuple[PanoRecord, int]]] = defaultdict(list)

    for record in records:
        base_tile = latlon_to_tile(lat_deg=record.lat, lon_deg=record.lon, z=base_zoom)
        rank = stable_hash_u64(dataset_id, density_rule, base_zoom, base_tile.x, base_tile.y, record.pano_id, settings.tile_index_version)
        base_grouped[base_tile].append((record, rank))

    entries_by_tile_mut: dict[TileKey, list[TileIndexEntry]] = defaultdict(list)
    tiles_by_pano_mut: dict[str, list[TileKey]] = defaultdict(list)

    for base_tile, rows in base_grouped.items():
        ordered = sorted(rows, key=lambda item: item[1])
        for z in settings.tile_zooms:
            target_tile = ancestor_tile(base_tile, z)
            selected_rows = ordered
            if z != base_zoom:
                area_scale = 4 ** (base_zoom - z)
                keep_count = max(1, math.ceil(len(ordered) / area_scale))
                selected_rows = ordered[:keep_count]

            for record, rank in selected_rows:
                entries_by_tile_mut[target_tile].append(
                    TileIndexEntry(
                        tile=target_tile,
                        pano_id=record.pano_id,
                        row_index=record.row_index,
                        sample_rank=rank,
                        keep=True,
                    )
                )
                tiles_by_pano_mut[record.pano_id].append(target_tile)

    return TileIndex(
        dataset_id=dataset_id,
        zooms=settings.tile_zooms,
        entries_by_tile={tile: tuple(entries) for tile, entries in entries_by_tile_mut.items()},
        tiles_by_pano={pano_id: tuple(tiles) for pano_id, tiles in tiles_by_pano_mut.items()},
        density_rule=density_rule,
        density_base_zoom=base_zoom,
        density_trigger_points=settings.density_trigger_points,
        density_keep_points=settings.density_keep_points,
        version=settings.tile_index_version,
    )


def ancestor_tile(tile: TileKey, z: int) -> TileKey:
    if z > tile.z:
        raise ValueError(f"Cannot derive z{z} descendant from base tile {tile.id}")
    shift = tile.z - z
    if shift == 0:
        return tile
    return TileKey(z=z, x=tile.x >> shift, y=tile.y >> shift)


def tile_index_dir(dataset_id: str, settings: BackendSettings) -> Path:
    return settings.tile_index_root / safe_segment(dataset_id)


def safe_segment(value: str) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in value).strip("._") or "default"


def write_tile_index_metadata(index: TileIndex, records: tuple[PanoRecord, ...], settings: BackendSettings) -> Path:
    target_dir = tile_index_dir(index.dataset_id, settings)
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / "tile_index_meta.json"
    payload = {
        "dataset_id": index.dataset_id,
        "version": index.version,
        "zooms": list(index.zooms),
        "pano_count": len(records),
        "dataset_fingerprint": records_fingerprint(records),
        "tile_count": len(index.entries_by_tile),
        "density_rule": index.density_rule,
        "density_base_zoom": index.density_base_zoom,
        "density_trigger_points": index.density_trigger_points,
        "density_keep_points": index.density_keep_points,
    }
    write_json_atomic(path, payload)
    return path


def load_or_build_tile_index(
    dataset_id: str,
    records: tuple[PanoRecord, ...],
    settings: BackendSettings,
) -> TileIndex:
    existing = read_tile_index_if_current(dataset_id, records, settings)
    if existing is not None:
        return existing

    index = build_tile_index(dataset_id, records, settings)
    write_tile_index_tables(index, records, settings)
    return index


def read_tile_index_if_current(
    dataset_id: str,
    records: tuple[PanoRecord, ...],
    settings: BackendSettings,
) -> TileIndex | None:
    target_dir = tile_index_dir(dataset_id, settings)
    meta_path = target_dir / "tile_index_meta.json"
    if not meta_path.exists():
        return None

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if meta.get("dataset_id") != dataset_id:
        return None
    if meta.get("version") != settings.tile_index_version:
        return None
    if tuple(meta.get("zooms", [])) != settings.tile_zooms:
        return None
    if meta.get("pano_count") != len(records):
        return None
    if meta.get("dataset_fingerprint") != records_fingerprint(records):
        return None
    if meta.get("density_rule") != "base_zoom_area_scaled_v1":
        return None
    if meta.get("density_base_zoom") != max(settings.tile_zooms):
        return None

    entries_by_tile_mut: dict[TileKey, list[TileIndexEntry]] = defaultdict(list)
    tiles_by_pano_mut: dict[str, list[TileKey]] = defaultdict(list)
    for z in settings.tile_zooms:
        path = target_dir / f"z{z:02d}.jsonl"
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                tile = TileKey(z=int(row["z"]), x=int(row["x"]), y=int(row["y"]))
                entry = TileIndexEntry(
                    tile=tile,
                    pano_id=str(row["pano_id"]),
                    row_index=int(row["row_index"]),
                    sample_rank=int(row["sample_rank"]),
                    keep=bool(row["keep"]),
                )
                entries_by_tile_mut[tile].append(entry)
                tiles_by_pano_mut[entry.pano_id].append(tile)

    return TileIndex(
        dataset_id=dataset_id,
        zooms=settings.tile_zooms,
        entries_by_tile={tile: tuple(entries) for tile, entries in entries_by_tile_mut.items()},
        tiles_by_pano={pano_id: tuple(tiles) for pano_id, tiles in tiles_by_pano_mut.items()},
        density_rule="base_zoom_area_scaled_v1",
        density_base_zoom=max(settings.tile_zooms),
        density_trigger_points=settings.density_trigger_points,
        density_keep_points=settings.density_keep_points,
        version=settings.tile_index_version,
    )


def write_tile_index_tables(index: TileIndex, records: tuple[PanoRecord, ...], settings: BackendSettings) -> None:
    target_dir = tile_index_dir(index.dataset_id, settings)
    target_dir.mkdir(parents=True, exist_ok=True)
    for z in index.zooms:
        path = target_dir / f"z{z:02d}.jsonl"
        tmp_path = path.with_name(f"{path.name}.tmp")
        with tmp_path.open("w", encoding="utf-8") as handle:
            for tile, entries in sorted(index.entries_by_tile.items(), key=lambda item: (item[0].z, item[0].x, item[0].y)):
                if tile.z != z:
                    continue
                for entry in entries:
                    handle.write(
                        json.dumps(
                            {
                                "z": entry.tile.z,
                                "x": entry.tile.x,
                                "y": entry.tile.y,
                                "pano_id": entry.pano_id,
                                "row_index": entry.row_index,
                                "sample_rank": entry.sample_rank,
                                "keep": entry.keep,
                            },
                            separators=(",", ":"),
                        )
                    )
                    handle.write("\n")
        tmp_path.replace(path)
    write_tile_index_metadata(index, records, settings)


def write_json_atomic(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f"{path.name}.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp_path.replace(path)


def records_fingerprint(records: tuple[PanoRecord, ...]) -> str:
    digest = hashlib.blake2b(digest_size=16)
    for record in records:
        digest.update(str(record.pano_id).encode("utf-8"))
        digest.update(b"\x1f")
        digest.update(str(record.row_index).encode("utf-8"))
        digest.update(b"\x1f")
        digest.update(f"{record.lon:.10f}".encode("ascii"))
        digest.update(b"\x1f")
        digest.update(f"{record.lat:.10f}".encode("ascii"))
        digest.update(b"\x1f")
        digest.update(str(record.date).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()
