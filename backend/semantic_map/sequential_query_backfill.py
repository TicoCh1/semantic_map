from __future__ import annotations

import asyncio
import gc
import os
import time
from dataclasses import dataclass, field
from typing import Any, Iterable
from uuid import uuid4

from .backend_config import get_backend_settings
from .execution_log import utc_now_precise
from .prompt_ids import normalize_prompt
from .remote_schemas import QueryType, ScoringJobCreate, ScoringJobResponse
from .result_storage import ResultStorage
from .scoring_engine import normalize_reference_dict, reference_prompt_label


TERMINAL_JOB_STATUSES = {"ready", "failed", "cancelled"}


@dataclass(frozen=True, slots=True)
class HistoricalQuery:
    key: tuple[str, ...]
    query_type: QueryType
    prompt: str
    reference_pano: dict[str, Any] | None
    ready_dataset_ids: frozenset[str]
    manifest_dataset_ids: frozenset[str]


@dataclass(slots=True)
class _MutableHistoricalQuery:
    key: tuple[str, ...]
    query_type: QueryType
    prompt: str
    reference_pano: dict[str, Any] | None
    ready_dataset_ids: set[str] = field(default_factory=set)
    manifest_dataset_ids: set[str] = field(default_factory=set)


def discover_historical_queries(
    storage: ResultStorage,
    dataset_ids: Iterable[str],
) -> tuple[HistoricalQuery, ...]:
    selected_dataset_ids = set(dataset_ids)
    queries: dict[tuple[str, ...], _MutableHistoricalQuery] = {}

    try:
        catalog = storage.read_json(storage.prompt_catalog_path())
    except (AttributeError, OSError, ValueError):
        catalog = {}
    raw_catalog_prompts = catalog.get("prompts") if isinstance(catalog, dict) else None
    if isinstance(raw_catalog_prompts, list):
        for raw_prompt in raw_catalog_prompts:
            prompt = normalize_prompt(str(raw_prompt))
            if not prompt:
                continue
            key = ("text", prompt)
            queries[key] = _MutableHistoricalQuery(
                key=key,
                query_type="text",
                prompt=prompt,
                reference_pano=None,
            )

    manifests = sorted(storage.iter_active_manifests(), key=lambda item: (item[0], item[1]))

    for dataset_id, prompt_id, manifest in manifests:
        parsed = historical_query_from_manifest(manifest)
        if parsed is None:
            continue
        key, query_type, prompt, reference_pano = parsed
        query = queries.get(key)
        if query is None:
            query = _MutableHistoricalQuery(
                key=key,
                query_type=query_type,
                prompt=prompt,
                reference_pano=reference_pano,
            )
            queries[key] = query
        elif reference_richness(reference_pano) > reference_richness(query.reference_pano):
            query.prompt = prompt
            query.reference_pano = reference_pano

        if dataset_id not in selected_dataset_ids:
            continue
        query.manifest_dataset_ids.add(dataset_id)
        revision = str(manifest.get("result_revision") or "").strip() or None
        if storage.score_array_path(dataset_id, prompt_id, revision).exists() and storage.zscore_array_path(
            dataset_id,
            prompt_id,
            revision,
        ).exists():
            query.ready_dataset_ids.add(dataset_id)

    return tuple(
        HistoricalQuery(
            key=query.key,
            query_type=query.query_type,
            prompt=query.prompt,
            reference_pano=query.reference_pano,
            ready_dataset_ids=frozenset(query.ready_dataset_ids),
            manifest_dataset_ids=frozenset(query.manifest_dataset_ids),
        )
        for query in sorted(queries.values(), key=lambda item: item.key)
    )


def historical_query_from_manifest(
    manifest: dict[str, Any],
) -> tuple[tuple[str, ...], QueryType, str, dict[str, Any] | None] | None:
    query_type = str(manifest.get("query_type") or "text").strip()
    if query_type == "text":
        prompt = normalize_prompt(str(manifest.get("canonical_prompt") or manifest.get("prompt") or ""))
        return (("text", prompt), "text", prompt, None) if prompt else None
    if query_type != "pano_reference":
        return None

    reference = manifest.get("reference_pano")
    if not isinstance(reference, dict):
        return None
    try:
        normalized_reference = normalize_reference_dict(reference)
    except ValueError:
        return None
    dataset_id = str(normalized_reference["dataset_id"])
    pano_id = str(normalized_reference["pano_id"])
    pano_dataset_id = str(normalized_reference.get("pano_dataset_id") or dataset_id)
    prompt = str(manifest.get("canonical_prompt") or manifest.get("prompt") or "").strip()
    return (
        ("pano_reference", dataset_id, pano_dataset_id, pano_id),
        "pano_reference",
        prompt or reference_prompt_label(normalized_reference),
        normalized_reference,
    )


def reference_richness(reference: dict[str, Any] | None) -> int:
    if not reference:
        return 0
    return sum(reference.get(key) is not None for key in ("pano_dataset_id", "city_id", "lon", "lat", "date"))


def missing_queries_for_dataset(
    queries: Iterable[HistoricalQuery],
    dataset_id: str,
) -> tuple[HistoricalQuery, ...]:
    return tuple(query for query in queries if dataset_id not in query.ready_dataset_ids)


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def wait_for_job(
    service,
    initial_job: ScoringJobResponse,
    *,
    poll_seconds: float,
    timeout_seconds: float,
) -> ScoringJobResponse:
    job = initial_job
    started = time.monotonic()
    previous_state: tuple[str, str | None, int] | None = None
    while True:
        progress_percent = round(job.progress * 100)
        state = job.status, job.current_stage, progress_percent
        if state != previous_state:
            print(
                f"    {job.status:>15} {progress_percent:>3}% "
                f"stage={job.current_stage or '-'} {job.message}",
                flush=True,
            )
            previous_state = state
        if job.status in TERMINAL_JOB_STATUSES:
            return job
        if timeout_seconds > 0 and time.monotonic() - started > timeout_seconds:
            raise TimeoutError(f"Job {job.job_id} exceeded {timeout_seconds:.0f} seconds")
        await asyncio.sleep(max(0.1, poll_seconds))
        refreshed = await service.get_job(job.job_id)
        if refreshed is None:
            raise RuntimeError(f"Job {job.job_id} disappeared before reaching a terminal state")
        job = refreshed


def verify_ready_artifacts(storage: ResultStorage, job: ScoringJobResponse, dataset_id: str) -> None:
    result = next((item for item in job.results if item.dataset_id == dataset_id), None)
    if result is None:
        raise RuntimeError(f"Ready job {job.job_id} did not return a result for {dataset_id}")
    score_path = storage.score_array_path(dataset_id, result.prompt_id, result.result_revision)
    zscore_path = storage.zscore_array_path(dataset_id, result.prompt_id, result.result_revision)
    if not score_path.exists() or not zscore_path.exists():
        raise RuntimeError(
            f"Ready job {job.job_id} is missing score arrays for {dataset_id}: "
            f"score={score_path.exists()}, zscore={zscore_path.exists()}"
        )


def release_temporary_cuda_memory() -> None:
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except (ImportError, RuntimeError):
        pass


async def run() -> int:
    settings = get_backend_settings()
    dataset_ids = tuple(dict.fromkeys(settings.default_dataset_ids))
    storage = ResultStorage(settings)
    queries = discover_historical_queries(storage, dataset_ids)
    text_count = sum(query.query_type == "text" for query in queries)
    image_count = sum(query.query_type == "pano_reference" for query in queries)
    missing_counts = {
        dataset_id: len(missing_queries_for_dataset(queries, dataset_id))
        for dataset_id in dataset_ids
    }

    print("Sequential historical-query backfill plan", flush=True)
    print(f"  datasets:      {', '.join(dataset_ids)}", flush=True)
    print(f"  query union:   {len(queries)} ({text_count} text, {image_count} image)", flush=True)
    print("  z-score scope: one target dataset at a time", flush=True)
    for dataset_id in dataset_ids:
        print(f"  {dataset_id}: missing {missing_counts[dataset_id]} / {len(queries)}", flush=True)

    unsupported_sources = sorted(
        {
            str(query.reference_pano["dataset_id"])
            for query in queries
            if query.reference_pano is not None
            and str(query.reference_pano["dataset_id"]) not in dataset_ids
            and any(dataset_id not in query.ready_dataset_ids for dataset_id in dataset_ids)
        }
    )
    if unsupported_sources:
        print(
            "ERROR: image-query source dataset(s) are not loaded: " + ", ".join(unsupported_sources),
            flush=True,
        )
        print("Include the corresponding source cities in the Bash city list and run again.", flush=True)
        return 2

    if not queries:
        print("No existing text or image queries were found; nothing to backfill.", flush=True)
        return 0
    if not any(missing_counts.values()):
        print("Every selected dataset already has every query and both score arrays.", flush=True)
        return 0
    if env_bool("BACKFILL_DRY_RUN"):
        print("BACKFILL_DRY_RUN=true; plan only, no model or scoring service was loaded.", flush=True)
        return 0

    poll_seconds = float(os.getenv("BACKFILL_POLL_SECONDS", "1"))
    timeout_seconds = float(os.getenv("BACKFILL_JOB_TIMEOUT_SECONDS", "0"))
    fail_fast = env_bool("BACKFILL_FAIL_FAST")
    failures: list[str] = []

    from .job_service import PromptBatchService
    from .text_cor_t_engine import TextCorTScoringEngine

    service = PromptBatchService(settings, engine=TextCorTScoringEngine(settings))
    await service.start()
    try:
        for dataset_index, dataset_id in enumerate(dataset_ids, start=1):
            missing = missing_queries_for_dataset(queries, dataset_id)
            print(
                f"\n[{dataset_index}/{len(dataset_ids)}] {dataset_id}: "
                f"processing {len(missing)} missing query(ies) sequentially",
                flush=True,
            )
            for query_index, query in enumerate(missing, start=1):
                label = query.prompt if query.query_type == "text" else reference_prompt_label(query.reference_pano or {})
                print(
                    f"  [{query_index}/{len(missing)}] {query.query_type}: {label}",
                    flush=True,
                )
                force_override = dataset_id in query.manifest_dataset_ids
                payload = ScoringJobCreate(
                    dataset_ids=[dataset_id],
                    dataset_group_id=dataset_id,
                    prompt=query.prompt,
                    query_type=query.query_type,
                    reference_pano=query.reference_pano,
                    force_override=force_override,
                )
                try:
                    job = await service.submit(
                        payload,
                        request_id=f"sequential_backfill_{uuid4().hex}",
                        received_at=utc_now_precise(),
                        entrypoint="sequential_city_query_backfill",
                    )
                    job = await wait_for_job(
                        service,
                        job,
                        poll_seconds=poll_seconds,
                        timeout_seconds=timeout_seconds,
                    )
                    if job.status != "ready":
                        raise RuntimeError(f"Job {job.job_id} ended as {job.status}: {job.message}")
                    verify_ready_artifacts(service.storage, job, dataset_id)
                except Exception as exc:
                    failure = f"{dataset_id} {query.query_type} {query.key}: {type(exc).__name__}: {exc}"
                    failures.append(failure)
                    print(f"    FAILED: {failure}", flush=True)
                    if fail_fast:
                        raise
            release_temporary_cuda_memory()
            print(f"[{dataset_index}/{len(dataset_ids)}] {dataset_id}: pass complete", flush=True)
    finally:
        await service.stop()

    final_queries = discover_historical_queries(ResultStorage(settings), dataset_ids)
    remaining = [
        (dataset_id, query)
        for dataset_id in dataset_ids
        for query in missing_queries_for_dataset(final_queries, dataset_id)
    ]
    print("\nSequential backfill summary", flush=True)
    print(f"  failures observed: {len(failures)}", flush=True)
    print(f"  missing after run: {len(remaining)}", flush=True)
    for failure in failures:
        print(f"  failure: {failure}", flush=True)
    for dataset_id, query in remaining:
        print(f"  still missing: {dataset_id} {query.query_type} {query.key}", flush=True)
    if remaining:
        return 1
    print(f"All {len(dataset_ids)} selected datasets now contain all {len(final_queries)} queries.", flush=True)
    return 0


def main() -> int:
    try:
        return asyncio.run(run())
    except KeyboardInterrupt:
        print("Sequential backfill interrupted by user.", flush=True)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
