from __future__ import annotations

from collections.abc import Callable
from typing import Any

import numpy as np

from .backend_config import BackendSettings
from .prompt_ids import make_prompt_key_hash, make_reference_prompt_key_hash, normalize_prompt, utc_now
from .remote_schemas import ResultManifest, ScoreStats, TileCoord
from .result_storage import ResultStorage
from .scoring_models import PanoRecord, PromptScoreResult
from .tile_index import TileIndex
from .tile_math import TileKey


def write_prompt_result(
    result: PromptScoreResult,
    tile_index: TileIndex,
    storage: ResultStorage,
    settings: BackendSettings,
    priority_tile: TileCoord | None,
    result_revision: str | None = None,
    progress_callback: Callable[[TileKey, int, int], None] | None = None,
) -> ResultManifest:
    records, scores, zscores = result_to_arrays(result)
    try:
        storage.write_score_arrays(
            result.dataset_id,
            result.prompt_id,
            scores,
            zscores,
            revision=result_revision,
        )
        if settings.write_scores_jsonl:
            storage.write_scores_jsonl(
                result.dataset_id,
                result.prompt_id,
                iter_score_jsonl_rows(result, records, scores, zscores),
                revision=result_revision,
            )

        write_queue = result_tile_write_queue(tile_index, priority_tile, prewrite_all=settings.prewrite_all_tiles)
        total_tiles = len(write_queue)
        for index, tile in enumerate(write_queue, start=1):
            write_geojson_tile_from_arrays(
                prompt_id=result.prompt_id,
                dataset_id=result.dataset_id,
                tile=tile,
                tile_index=tile_index,
                records=records,
                scores=scores,
                zscores=zscores,
                storage=storage,
                result_revision=result_revision,
            )
            if progress_callback is not None:
                progress_callback(tile, index, total_tiles)

        if result.query_type == "pano_reference" and result.reference_pano:
            reference_dataset_id = str(result.reference_pano.get("dataset_id") or "")
            reference_pano_id = str(result.reference_pano.get("pano_id") or "")
            canonical_prompt = None
            prompt_key_hash = make_reference_prompt_key_hash(
                dataset_id=result.dataset_id,
                reference_dataset_id=reference_dataset_id,
                reference_pano_id=reference_pano_id,
                reference_pano_dataset_id=str(result.reference_pano.get("pano_dataset_id") or "") or None,
                model_version=settings.model_version,
                scoring_version=result.scoring_version or settings.scoring_version,
                tile_index_version=settings.tile_index_version,
            )
        else:
            canonical_prompt = normalize_prompt(result.prompt)
            prompt_key_hash = make_prompt_key_hash(
                dataset_id=result.dataset_id,
                prompt=result.prompt,
                model_version=settings.model_version,
                scoring_version=result.scoring_version or settings.scoring_version,
                tile_index_version=settings.tile_index_version,
            )

        manifest = ResultManifest(
            prompt_id=result.prompt_id,
            dataset_id=result.dataset_id,
            dataset_group_id=result.dataset_group_id,
            prompt=result.prompt,
            query_type=result.query_type,
            reference_pano=result.reference_pano,
            canonical_prompt=canonical_prompt,
            prompt_key_hash=prompt_key_hash,
            tile_url_template=storage.tile_url_template(
                result.dataset_id,
                result.prompt_id,
                revision=result_revision,
            ),
            zooms=list(tile_index.zooms),
            stats=ScoreStats(
                count=result.count,
                score_min=float(result.score_min),
                score_max=float(result.score_max),
                zscore_min=float(result.zscore_min),
                zscore_max=float(result.zscore_max),
            ),
            model_version=settings.model_version,
            scoring_version=result.scoring_version or settings.scoring_version,
            base_scoring_version=result.base_scoring_version,
            tile_index_version=settings.tile_index_version,
            density_rule=tile_index.density_rule,
            density_base_zoom=tile_index.density_base_zoom,
            density_trigger_points=settings.density_trigger_points,
            density_keep_points=settings.density_keep_points,
            result_revision=result_revision,
            created_at=utc_now(),
        )
        manifest_payload = manifest.model_dump()
        manifest_path = storage.manifest_path(result.dataset_id, result.prompt_id, result_revision)
        storage.write_json(manifest_path, manifest_payload)
        if result_revision:
            storage.validate_result_revision(
                result.dataset_id,
                result.prompt_id,
                result_revision,
                expected_count=result.count,
                required_tiles=write_queue,
            )
            storage.activate_result_revision(result.dataset_id, result.prompt_id, result_revision)
        storage.upsert_prompt_result(
            dataset_id=result.dataset_id,
            prompt_id=result.prompt_id,
            payload=manifest_payload,
            manifest_path=manifest_path,
            persist=False,
        )
        return manifest
    except Exception:
        if result_revision:
            storage.delete_result_revision(result.dataset_id, result.prompt_id, result_revision)
        raise


def write_geojson_tile_from_arrays(
    *,
    prompt_id: str,
    dataset_id: str,
    tile: TileKey,
    tile_index: TileIndex,
    records: tuple[PanoRecord, ...],
    scores,
    zscores,
    storage: ResultStorage,
    result_revision: str | None = None,
) -> None:
    entries = tile_index.entries_by_tile.get(tile, ())
    features = [
        feature_from_record_score(
            records[entry.row_index],
            score=float(scores[entry.row_index]),
            zscore=float(zscores[entry.row_index]),
            prompt_id=prompt_id,
            dataset_id=dataset_id,
        )
        for entry in entries
        if entry.keep
    ]
    payload = {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "prompt_id": prompt_id,
            "dataset_id": dataset_id,
            "tile": tile.id,
            "feature_count": len(features),
        },
    }
    storage.write_json(
        storage.tile_path(dataset_id, prompt_id, tile.z, tile.x, tile.y, result_revision),
        payload,
        compact=True,
    )


def result_to_arrays(result: PromptScoreResult) -> tuple[tuple[PanoRecord, ...], np.ndarray, np.ndarray]:
    if not result.records:
        return (), np.empty((0,), dtype=np.float32), np.empty((0,), dtype=np.float32)

    records = result.records
    scores = np.asarray(result.scores, dtype=np.float32)
    zscores = np.asarray(result.zscores, dtype=np.float32)
    expected_shape = (len(records),)
    if scores.shape != expected_shape or zscores.shape != expected_shape:
        raise RuntimeError(
            f"Score array shape mismatch for {result.prompt_id}: "
            f"scores={scores.shape}, zscores={zscores.shape}, expected={expected_shape}"
        )
    for index, record in enumerate(records):
        if record.row_index != index:
            raise RuntimeError(f"Scored records are not contiguous; row_index {record.row_index} at position {index}")

    return records, scores, zscores


def iter_score_jsonl_rows(
    result: PromptScoreResult,
    records: tuple[PanoRecord, ...],
    scores,
    zscores,
):
    for record in records:
        yield {
            "pano_id": record.pano_id,
            "row_index": record.row_index,
            "lon": record.lon,
            "lat": record.lat,
            "date": record.date,
            "score": float(scores[record.row_index]),
            "zscore": float(zscores[record.row_index]),
            "prompt_id": result.prompt_id,
        }


def result_tile_write_queue(tile_index: TileIndex, priority_tile: TileCoord | None, *, prewrite_all: bool) -> list[TileKey]:
    write_queue: list[TileKey] = []
    written: set[TileKey] = set()
    if priority_tile is not None:
        key = TileKey(priority_tile.z, priority_tile.x, priority_tile.y)
        write_queue.append(key)
        written.add(key)

    if prewrite_all:
        for tile in sorted(tile_index.entries_by_tile, key=lambda item: (item.z, item.x, item.y)):
            if tile in written:
                continue
            write_queue.append(tile)

    return write_queue


def feature_from_record_score(
    record: PanoRecord,
    *,
    score: float,
    zscore: float,
    prompt_id: str,
    dataset_id: str,
) -> dict[str, Any]:
    properties = {
        "id": record.pano_id,
        "pano_id": record.pano_id,
        "score": score,
        "zscore": zscore,
        "prompt_id": prompt_id,
        "dataset_id": dataset_id,
    }
    if record.date is not None:
        properties["date"] = record.date

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [record.lon, record.lat],
        },
        "properties": properties,
    }
