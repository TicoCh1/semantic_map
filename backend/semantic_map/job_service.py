from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime

from .backend_config import BackendSettings
from .dataset_groups import dataset_group_id_for, scoring_version_for_dataset_group, unique_dataset_ids
from .prompt_ids import (
    make_job_id,
    make_legacy_prompt_id,
    make_prompt_id,
    make_reference_prompt_id,
    normalize_prompt,
    normalize_prompt_legacy,
    utc_now,
)
from .remote_schemas import PanoReference, QueryType, ScoringJobCreate, ScoringJobResponse, ScoringResultRef, TileCoord
from .result_storage import ResultStorage
from .scoring_engine import SemanticScoringEngine, TemporarySemanticScoringEngine
from .tile_index import TileIndex, load_or_build_tile_index
from .tile_writer import result_tile_write_queue, write_prompt_result


TERMINAL_JOB_STATUSES = {"ready", "failed", "cancelled"}
PANO_REFERENCE_SCORING_SUFFIX = "pano-reference-aligned-v1"


@dataclass(frozen=True, slots=True)
class DatasetTarget:
    prompt_id: str
    dataset_id: str
    priority_tile: TileCoord | None


@dataclass(frozen=True, slots=True)
class QueuedSubmission:
    job_id: str
    dataset_group_id: str
    dataset_ids: tuple[str, ...]
    targets: tuple[DatasetTarget, ...]
    prompt: str
    query_type: QueryType
    reference_pano: dict | None
    zooms: tuple[int, ...]
    scoring_version: str

    @property
    def prompt_id(self) -> str:
        return self.targets[0].prompt_id

    @property
    def dataset_id(self) -> str:
        return self.targets[0].dataset_id

    @property
    def batch_key(self) -> tuple[tuple[str, ...], tuple[int, ...], str, QueryType]:
        return self.dataset_ids, self.zooms, self.scoring_version, self.query_type


class PromptBatchService:
    def __init__(self, settings: BackendSettings, engine: SemanticScoringEngine | None = None) -> None:
        self.settings = settings
        self.storage = ResultStorage(settings)
        self.engine = engine or TemporarySemanticScoringEngine(settings)
        self._queue: asyncio.Queue[QueuedSubmission] = asyncio.Queue(maxsize=max(0, settings.prompt_queue_max_size))
        self._jobs: dict[str, ScoringJobResponse] = {}
        self._worker_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()
        self._tile_indexes: dict[tuple[str, tuple[int, ...]], TileIndex] = {}
        self._warmed_up = False
        self._warmup_timings: dict[str, float] = {}

    async def start(self) -> None:
        if self.settings.warmup_on_startup and not self._warmed_up:
            await self.warmup()
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def warmup(self) -> dict[str, float]:
        dataset_ids = self.settings.default_dataset_ids or (self.settings.default_dataset_id,)
        zooms = self.settings.tile_zooms
        timings: dict[str, float] = {}

        dataset_group_id = dataset_group_id_for(dataset_ids, self.settings.default_dataset_group_id)
        engine_warmup_group = getattr(self.engine, "warmup_dataset_group", None)
        engine_warmup_datasets = getattr(self.engine, "warmup_datasets", None)
        if callable(engine_warmup_group):
            timings.update(await asyncio.to_thread(engine_warmup_group, dataset_ids, dataset_group_id))
        elif callable(engine_warmup_datasets):
            timings.update(await asyncio.to_thread(engine_warmup_datasets, dataset_ids))
        else:
            engine_warmup = getattr(self.engine, "warmup", None)
            if callable(engine_warmup):
                for dataset_id in dataset_ids:
                    timings.update(await asyncio.to_thread(engine_warmup, dataset_id))

        scoped_settings = replace(self.settings, tile_zooms=zooms)
        stage_start = time.perf_counter()
        for dataset_id in dataset_ids:
            records = await asyncio.to_thread(self.engine.get_dataset_records, dataset_id)
            await asyncio.to_thread(self._get_tile_index, dataset_id, zooms, records, scoped_settings)
        timings["warmup_tile_index"] = round(time.perf_counter() - stage_start, 3)

        self._warmup_timings = timings.copy()
        self._warmed_up = True
        print(f"Startup warmup complete for {dataset_group_id} ({','.join(dataset_ids)}): {timings}", flush=True)
        return timings

    async def stop(self) -> None:
        if self._worker_task is None:
            return
        self._worker_task.cancel()
        try:
            await self._worker_task
        except asyncio.CancelledError:
            pass
        self._worker_task = None

    async def submit(self, payload: ScoringJobCreate) -> ScoringJobResponse:
        dataset_ids = self._payload_dataset_ids(payload)
        default_group_id = self.settings.default_dataset_group_id if len(dataset_ids) > 1 else None
        dataset_group_id = dataset_group_id_for(dataset_ids, payload.dataset_group_id or default_group_id)
        scoring_version = scoring_version_for_dataset_group(self.settings.scoring_version, dataset_ids, dataset_group_id)
        query_type = payload.query_type or "text"
        if query_type == "pano_reference":
            return await self._submit_pano_reference(payload, dataset_ids, dataset_group_id, scoring_version)
        if query_type != "text":
            raise ValueError(f"Unsupported scoring query_type: {query_type}")
        raw_prompt = payload.prompt
        prompt = normalize_prompt(raw_prompt)
        if not prompt:
            raise ValueError("Prompt is required for text scoring jobs.")
        zooms = tuple(int(z) for z in payload.zooms) if payload.zooms else self.settings.tile_zooms
        priority_tiles = self._priority_tiles_by_dataset(payload, dataset_ids)
        targets = tuple(
            DatasetTarget(
                dataset_id=dataset_id,
                prompt_id=make_prompt_id(
                    dataset_id=dataset_id,
                    prompt=prompt,
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                ),
                priority_tile=priority_tiles.get(dataset_id),
            )
            for dataset_id in dataset_ids
        )

        active_prompt_ids = [target.prompt_id for target in targets]
        if len(targets) == 1:
            active_prompt_ids.extend(
                make_legacy_prompt_id(
                    dataset_id=targets[0].dataset_id,
                    prompt=legacy_prompt,
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                )
                for legacy_prompt in (prompt, normalize_prompt_legacy(raw_prompt))
            )
        active_job = await self._find_active_job_by_prompt_ids(active_prompt_ids)
        if active_job is not None:
            return active_job

        existing_targets = []
        all_existing = True
        for target in targets:
            existing_prompt_id = target.prompt_id
            existing_manifest = self.storage.manifest_path(target.dataset_id, target.prompt_id)
            if len(targets) == 1:
                legacy_prompt_ids = tuple(
                    dict.fromkeys(
                        make_legacy_prompt_id(
                            dataset_id=target.dataset_id,
                            prompt=legacy_prompt,
                            model_version=self.settings.model_version,
                            scoring_version=scoring_version,
                            tile_index_version=self.settings.tile_index_version,
                        )
                        for legacy_prompt in (prompt, normalize_prompt_legacy(raw_prompt))
                    )
                )
                for legacy_prompt_id in legacy_prompt_ids:
                    if existing_manifest.exists() or legacy_prompt_id == target.prompt_id:
                        continue
                    legacy_manifest = self.storage.manifest_path(target.dataset_id, legacy_prompt_id)
                    if legacy_manifest.exists():
                        existing_prompt_id = legacy_prompt_id
                        existing_manifest = legacy_manifest
                        break

            matching_manifest = self.storage.find_manifest_for_prompt(
                dataset_id=target.dataset_id,
                canonical_prompt=prompt,
                model_version=self.settings.model_version,
                scoring_version=scoring_version,
                tile_index_version=self.settings.tile_index_version,
            )
            if not existing_manifest.exists() and matching_manifest is not None:
                existing_prompt_id, existing_manifest = matching_manifest
            if existing_manifest.exists():
                existing_targets.append(
                    DatasetTarget(
                        dataset_id=target.dataset_id,
                        prompt_id=existing_prompt_id,
                        priority_tile=target.priority_tile,
                    )
                )
            else:
                all_existing = False
                break

        now = utc_now()
        ready_targets = tuple(existing_targets)
        queued_targets = targets
        job_id = make_job_id(now, ready_targets[0].prompt_id if all_existing and ready_targets else targets[0].prompt_id)
        if all_existing:
            job = self._make_job_response(
                job_id=job_id,
                targets=ready_targets,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                prompt=prompt,
                query_type="text",
                reference_pano=None,
                status="ready",
                progress=1.0,
                message="Using cached result.",
                created_at=now,
                updated_at=now,
                current_stage="ready",
            )
            await self._save_job(job)
            return job

        job = self._make_job_response(
            job_id=job_id,
            targets=queued_targets,
            dataset_group_id=dataset_group_id,
            dataset_ids=dataset_ids,
            prompt=prompt,
            query_type="text",
            reference_pano=None,
            status="queued",
            progress=0.0,
            message="Queued for prompt bucket.",
            created_at=now,
            updated_at=now,
            current_stage="queued",
        )
        await self._save_job(job)
        await self._queue.put(
            QueuedSubmission(
                job_id=job_id,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                targets=queued_targets,
                prompt=prompt,
                query_type="text",
                reference_pano=None,
                zooms=zooms,
                scoring_version=scoring_version,
            )
        )
        return job

    async def _submit_pano_reference(
        self,
        payload: ScoringJobCreate,
        dataset_ids: tuple[str, ...],
        dataset_group_id: str,
        base_scoring_version: str,
    ) -> ScoringJobResponse:
        reference = normalize_reference_pano(payload.reference_pano)
        self._validate_dataset_ids((reference["dataset_id"],))
        scoring_version = f"{base_scoring_version}--{PANO_REFERENCE_SCORING_SUFFIX}"
        prompt = payload.prompt.strip() or reference_prompt_label(reference)
        zooms = tuple(int(z) for z in payload.zooms) if payload.zooms else self.settings.tile_zooms
        priority_tiles = self._priority_tiles_by_dataset(payload, dataset_ids)
        targets = tuple(
            DatasetTarget(
                dataset_id=dataset_id,
                prompt_id=make_reference_prompt_id(
                    dataset_id=dataset_id,
                    reference_dataset_id=reference["dataset_id"],
                    reference_pano_id=reference["pano_id"],
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                ),
                priority_tile=priority_tiles.get(dataset_id),
            )
            for dataset_id in dataset_ids
        )

        active_job = await self._find_active_job_by_prompt_ids([target.prompt_id for target in targets])
        if active_job is not None:
            return active_job

        existing_targets = []
        all_existing = True
        for target in targets:
            existing_manifest = self.storage.manifest_path(target.dataset_id, target.prompt_id)
            if existing_manifest.exists():
                existing_targets.append(target)
            else:
                all_existing = False
                break

        now = utc_now()
        ready_targets = tuple(existing_targets)
        queued_targets = targets
        job_id = make_job_id(now, ready_targets[0].prompt_id if all_existing and ready_targets else targets[0].prompt_id)
        if all_existing:
            job = self._make_job_response(
                job_id=job_id,
                targets=ready_targets,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                prompt=prompt,
                query_type="pano_reference",
                reference_pano=reference,
                status="ready",
                progress=1.0,
                message="Using cached reference pano result.",
                created_at=now,
                updated_at=now,
                current_stage="ready",
            )
            await self._save_job(job)
            return job

        job = self._make_job_response(
            job_id=job_id,
            targets=queued_targets,
            dataset_group_id=dataset_group_id,
            dataset_ids=dataset_ids,
            prompt=prompt,
            query_type="pano_reference",
            reference_pano=reference,
            status="queued",
            progress=0.0,
            message="Queued for reference pano scoring.",
            created_at=now,
            updated_at=now,
            current_stage="queued",
        )
        await self._save_job(job)
        await self._queue.put(
            QueuedSubmission(
                job_id=job_id,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                targets=queued_targets,
                prompt=prompt,
                query_type="pano_reference",
                reference_pano=reference,
                zooms=zooms,
                scoring_version=scoring_version,
            )
        )
        return job

    def _payload_dataset_ids(self, payload: ScoringJobCreate) -> tuple[str, ...]:
        if payload.dataset_ids:
            dataset_ids = unique_dataset_ids(payload.dataset_ids)
        elif payload.dataset_id:
            dataset_ids = unique_dataset_ids((payload.dataset_id,))
        else:
            dataset_ids = unique_dataset_ids(self.settings.default_dataset_ids or (self.settings.default_dataset_id,))
        self._validate_dataset_ids(dataset_ids)
        return dataset_ids

    def _validate_dataset_ids(self, dataset_ids: tuple[str, ...]) -> None:
        allowed = set(unique_dataset_ids((*self.settings.default_dataset_ids, self.settings.default_dataset_id)))
        unknown = [dataset_id for dataset_id in dataset_ids if dataset_id not in allowed]
        if unknown:
            allowed_label = ", ".join(sorted(allowed))
            requested_label = ", ".join(unknown)
            raise ValueError(f"Unsupported dataset id(s): {requested_label}. Allowed dataset ids: {allowed_label}")

    def _priority_tiles_by_dataset(self, payload: ScoringJobCreate, dataset_ids: tuple[str, ...]) -> dict[str, TileCoord]:
        by_dataset: dict[str, TileCoord] = {}
        tiles = list(payload.priority_tiles or [])
        if payload.priority_tile is not None:
            tiles.append(payload.priority_tile)

        for index, tile in enumerate(tiles):
            dataset_id = tile.dataset_id
            if not dataset_id and index < len(dataset_ids):
                dataset_id = dataset_ids[index]
            if not dataset_id or dataset_id not in dataset_ids:
                continue
            by_dataset[dataset_id] = tile.model_copy(update={"dataset_id": dataset_id})
        return by_dataset

    def _make_job_response(
        self,
        *,
        job_id: str,
        targets: tuple[DatasetTarget, ...],
        dataset_group_id: str,
        dataset_ids: tuple[str, ...],
        prompt: str,
        query_type: QueryType,
        reference_pano: dict | None,
        status,
        progress: float,
        message: str,
        created_at: str,
        updated_at: str,
        current_stage: str,
        stage_timings: dict[str, float] | None = None,
    ) -> ScoringJobResponse:
        primary = targets[0]
        results = [
            ScoringResultRef(
                dataset_id=target.dataset_id,
                prompt_id=target.prompt_id,
                manifest_url=self.storage.manifest_url(target.prompt_id),
                tile_url_template=self.storage.tile_url_template(target.prompt_id),
                priority_tile=target.priority_tile,
            )
            for target in targets
        ]
        priority_tiles = [target.priority_tile for target in targets if target.priority_tile is not None]
        return ScoringJobResponse(
            job_id=job_id,
            prompt_id=primary.prompt_id,
            dataset_id=primary.dataset_id,
            dataset_group_id=dataset_group_id,
            dataset_ids=list(dataset_ids),
            prompt=prompt,
            query_type=query_type,
            reference_pano=reference_pano,
            status=status,
            progress=progress,
            message=message,
            created_at=created_at,
            updated_at=updated_at,
            priority_tile=primary.priority_tile,
            priority_tiles=priority_tiles,
            current_stage=current_stage,
            stage_timings=stage_timings or {},
            manifest_url=results[0].manifest_url,
            tile_url_template=results[0].tile_url_template,
            results=results,
        )

    async def get_job(self, job_id: str) -> ScoringJobResponse | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def list_jobs(self) -> list[ScoringJobResponse]:
        async with self._lock:
            return list(self._jobs.values())

    async def cancel(self, job_id: str) -> ScoringJobResponse | None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.status in {"ready", "failed"}:
                return job
            updated = job.model_copy(update={"status": "cancelled", "message": "Cancelled.", "updated_at": utc_now()})
            self._jobs[job_id] = updated
            self._write_job_file(updated)
            self._prune_jobs_locked()
            return updated

    async def _find_active_job_by_prompt_ids(self, prompt_ids) -> ScoringJobResponse | None:
        prompt_id_set = set(prompt_ids)
        async with self._lock:
            for job in self._jobs.values():
                job_prompt_ids = {job.prompt_id, *(result.prompt_id for result in job.results)}
                if job_prompt_ids & prompt_id_set and job.status not in {"ready", "failed", "cancelled"}:
                    return job
        return None

    async def _worker_loop(self) -> None:
        while True:
            first = await self._queue.get()
            batch = [first]
            await asyncio.sleep(self.settings.prompt_batch_window_ms / 1000)
            while len(batch) < self.settings.prompt_batch_max_size:
                try:
                    batch.append(self._queue.get_nowait())
                except asyncio.QueueEmpty:
                    break

            groups: dict[tuple[tuple[str, ...], tuple[int, ...], str, QueryType], list[QueuedSubmission]] = defaultdict(list)
            for item in batch:
                groups[item.batch_key].append(item)

            for submissions in groups.values():
                await self._process_batch(submissions)

            for _item in batch:
                self._queue.task_done()

    async def _process_batch(self, submissions: list[QueuedSubmission]) -> None:
        active = []
        for item in submissions:
            if not await self._is_cancelled(item.job_id):
                active.append(item)
        if not active:
            return

        timings: dict[str, float] = {}
        loop = asyncio.get_running_loop()

        try:
            await self._update_many(
                active,
                status="loading_dataset",
                progress=0.12,
                current_stage="loading_dataset",
                stage_timings=timings.copy(),
                message="Loading cached dataset.",
            )
            dataset_ids = active[0].dataset_ids
            dataset_group_id = active[0].dataset_group_id
            zooms = active[0].zooms
            scoring_version = active[0].scoring_version
            stage_start = time.perf_counter()
            records_by_dataset = {
                dataset_id: await asyncio.to_thread(self.engine.get_dataset_records, dataset_id)
                for dataset_id in dataset_ids
            }
            timings["load_dataset"] = round(time.perf_counter() - stage_start, 3)

            scoped_settings = replace(self.settings, tile_zooms=zooms, scoring_version=scoring_version)
            stage_start = time.perf_counter()
            await self._update_many(
                active,
                status="loading_dataset",
                progress=0.2,
                current_stage="building_tile_index",
                stage_timings=timings.copy(),
                message="Loading or building dataset tile index.",
            )
            tile_indexes = {
                dataset_id: await asyncio.to_thread(self._get_tile_index, dataset_id, zooms, records, scoped_settings)
                for dataset_id, records in records_by_dataset.items()
            }
            timings["tile_index"] = round(time.perf_counter() - stage_start, 3)

            query_type = active[0].query_type
            stage_start = time.perf_counter()
            if query_type == "pano_reference":
                references = [item.reference_pano for item in active if item.reference_pano is not None]
                if len(references) != len(active):
                    raise RuntimeError("Reference pano scoring batch contains a submission without reference metadata.")
                await self._update_many(
                    active,
                    status="scoring",
                    progress=0.35,
                    current_stage="scoring",
                    stage_timings=timings.copy(),
                    message=f"Scoring {len(references)} reference pano(s) across {len(dataset_ids)} dataset(s) as one batch.",
                )
                score_references_with_timings = getattr(self.engine, "score_pano_references_dataset_group_with_timings", None)
                if callable(score_references_with_timings):
                    grouped_results, scoring_timings = await asyncio.to_thread(
                        score_references_with_timings,
                        dataset_ids,
                        references,
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                    )
                    timings.update(scoring_timings)
                    timings.setdefault("scoring_total", round(time.perf_counter() - stage_start, 3))
                else:
                    grouped_results = await asyncio.to_thread(
                        self.engine.score_pano_references_dataset_group,
                        dataset_ids,
                        references,
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                    )
                    timings["scoring_total"] = round(time.perf_counter() - stage_start, 3)
            else:
                unique_prompts = list(dict.fromkeys(item.prompt for item in active))
                await self._update_many(
                    active,
                    status="scoring",
                    progress=0.35,
                    current_stage="scoring",
                    stage_timings=timings.copy(),
                    message=f"Scoring {len(unique_prompts)} prompt(s) across {len(dataset_ids)} dataset(s) as one batch.",
                )
                score_group_with_timings = getattr(self.engine, "score_dataset_group_with_timings", None)
                if callable(score_group_with_timings):
                    grouped_results, scoring_timings = await asyncio.to_thread(
                        score_group_with_timings,
                        dataset_ids,
                        unique_prompts,
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                    )
                    timings.update(scoring_timings)
                    timings.setdefault("scoring_total", round(time.perf_counter() - stage_start, 3))
                else:
                    grouped_results = await asyncio.to_thread(
                        self.engine.score_dataset_group,
                        dataset_ids,
                        unique_prompts,
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                    )
                    timings["scoring_total"] = round(time.perf_counter() - stage_start, 3)
            results_by_key = {
                (dataset_id, result.prompt_id): result
                for dataset_id, results in grouped_results.items()
                for result in results
            }

            for submission in active:
                await self._update_job(
                    submission.job_id,
                    status="building_tiles",
                    progress=0.75,
                    current_stage="building_tiles",
                    current_tile=None,
                    tiles_done=0,
                    tiles_total=self._expected_tile_write_count(submission, tile_indexes, scoped_settings),
                    stage_timings=timings.copy(),
                    message="Writing result cache and GeoJSON tile cache.",
                )

            written_result_keys: set[tuple[str, str]] = set()
            for submission in active:
                if await self._is_cancelled(submission.job_id):
                    continue
                tile_stage_start = time.perf_counter()
                completed_tiles = 0
                total_tiles = self._expected_tile_write_count(submission, tile_indexes, scoped_settings)
                for target in submission.targets:
                    result_key = (target.dataset_id, target.prompt_id)
                    if result_key in written_result_keys:
                        completed_tiles += self._expected_target_tile_write_count(target, tile_indexes[target.dataset_id], scoped_settings)
                        continue
                    result = results_by_key[result_key]
                    tile_index = tile_indexes[target.dataset_id]
                    last_tile_update = 0.0

                    def progress_callback(tile, done: int, total: int) -> None:
                        nonlocal last_tile_update
                        now = time.perf_counter()
                        if done < total and now - last_tile_update < 0.6:
                            return
                        last_tile_update = now
                        elapsed = round(now - tile_stage_start, 3)
                        aggregate_done = completed_tiles + done
                        patch = {
                            "status": "building_tiles",
                            "progress": 0.75 + 0.24 * (aggregate_done / max(total_tiles, 1)),
                            "current_stage": "building_tiles",
                            "current_tile": TileCoord(z=tile.z, x=tile.x, y=tile.y, dataset_id=target.dataset_id),
                            "tiles_done": aggregate_done,
                            "tiles_total": total_tiles,
                            "stage_timings": {**timings, "tile_writing": elapsed},
                            "message": f"Writing {target.dataset_id} tile {tile.id} ({aggregate_done}/{total_tiles}).",
                        }
                        loop.call_soon_threadsafe(
                            lambda job_id=submission.job_id, patch=patch: asyncio.create_task(self._update_job(job_id, **patch))
                        )

                    await asyncio.to_thread(
                        write_prompt_result,
                        result=result,
                        tile_index=tile_index,
                        storage=self.storage,
                        settings=scoped_settings,
                        priority_tile=target.priority_tile,
                        progress_callback=progress_callback,
                    )
                    completed_tiles += self._expected_target_tile_write_count(target, tile_index, scoped_settings)
                    timings["tile_writing"] = round(time.perf_counter() - tile_stage_start, 3)
                    written_result_keys.add(result_key)
                await self._update_job(
                    submission.job_id,
                    status="ready",
                    progress=1.0,
                    current_stage="ready",
                    current_tile=None,
                    stage_timings=timings.copy(),
                    message="Ready.",
                )
        except Exception as exc:
            await self._update_many(
                active,
                status="failed",
                progress=0.0,
                current_stage="failed",
                stage_timings=timings.copy(),
                message=f"{type(exc).__name__}: {exc}",
            )

    def _get_tile_index(
        self,
        dataset_id: str,
        zooms: tuple[int, ...],
        records,
        settings: BackendSettings,
    ) -> TileIndex:
        key = (dataset_id, zooms)
        cached = self._tile_indexes.get(key)
        if cached is not None:
            return cached
        index = load_or_build_tile_index(dataset_id, records, settings)
        self._tile_indexes[key] = index
        return index

    def get_tile_index(self, dataset_id: str, zooms: tuple[int, ...], records, settings: BackendSettings) -> TileIndex:
        return self._get_tile_index(dataset_id, zooms, records, settings)

    def _expected_tile_write_count(
        self,
        submission: QueuedSubmission,
        tile_indexes: dict[str, TileIndex],
        settings: BackendSettings,
    ) -> int:
        return sum(
            self._expected_target_tile_write_count(target, tile_indexes[target.dataset_id], settings)
            for target in submission.targets
        )

    def _expected_target_tile_write_count(
        self,
        target: DatasetTarget,
        tile_index: TileIndex,
        settings: BackendSettings,
    ) -> int:
        return len(result_tile_write_queue(tile_index, target.priority_tile, prewrite_all=settings.prewrite_all_tiles))

    async def _is_cancelled(self, job_id: str) -> bool:
        async with self._lock:
            job = self._jobs.get(job_id)
            return job is not None and job.status == "cancelled"

    async def _update_many(self, submissions: list[QueuedSubmission], **patch) -> None:
        for submission in submissions:
            await self._update_job(submission.job_id, **patch)

    async def _update_job(self, job_id: str, **patch) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.status == "cancelled":
                return
            updated = job.model_copy(update={**patch, "updated_at": utc_now()})
            self._jobs[job_id] = updated
            self._write_job_file(updated)
            self._prune_jobs_locked()

    async def _save_job(self, job: ScoringJobResponse) -> None:
        async with self._lock:
            self._jobs[job.job_id] = job
            self._write_job_file(job)
            self._prune_jobs_locked()

    def _write_job_file(self, job: ScoringJobResponse) -> None:
        payload = job.model_dump()
        result_refs = job.results or [
            ScoringResultRef(
                dataset_id=job.dataset_id,
                prompt_id=job.prompt_id,
                manifest_url=job.manifest_url or self.storage.manifest_url(job.prompt_id),
                tile_url_template=job.tile_url_template or self.storage.tile_url_template(job.prompt_id),
                priority_tile=job.priority_tile,
            )
        ]
        for result in result_refs:
            self.storage.write_json(self.storage.job_path(result.dataset_id, result.prompt_id), payload)

    def _prune_jobs_locked(self) -> None:
        ttl_seconds = self.settings.job_memory_ttl_seconds
        if ttl_seconds > 0:
            now = time.time()
            for job_id, job in list(self._jobs.items()):
                if job.status in TERMINAL_JOB_STATUSES and now - job_timestamp_seconds(job) > ttl_seconds:
                    self._jobs.pop(job_id, None)

        max_count = self.settings.job_memory_max_count
        if max_count <= 0 or len(self._jobs) <= max_count:
            return

        terminal_jobs = sorted(
            (
                (job_id, job)
                for job_id, job in self._jobs.items()
                if job.status in TERMINAL_JOB_STATUSES
            ),
            key=lambda item: (job_timestamp_seconds(item[1]), item[0]),
        )
        for job_id, _job in terminal_jobs:
            if len(self._jobs) <= max_count:
                break
            self._jobs.pop(job_id, None)


def job_timestamp_seconds(job: ScoringJobResponse) -> float:
    raw = job.updated_at or job.created_at
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def normalize_reference_pano(reference: PanoReference | None) -> dict:
    if reference is None:
        raise ValueError("reference_pano is required when query_type is pano_reference.")
    data = reference.model_dump()
    pano_id = str(data.get("pano_id") or "").strip()
    dataset_id = str(data.get("dataset_id") or "").strip()
    if not pano_id or not dataset_id:
        raise ValueError("reference_pano requires pano_id and dataset_id.")
    normalized = {
        "pano_id": pano_id,
        "dataset_id": dataset_id,
    }
    for key in ("city_id", "lon", "lat", "date"):
        value = data.get(key)
        if value is not None:
            normalized[key] = value
    return normalized


def reference_prompt_label(reference: dict) -> str:
    city = str(reference.get("city_id") or reference.get("dataset_id") or "").strip()
    suffix = f" ({city})" if city else ""
    return f"Reference pano {reference.get('pano_id')}{suffix}"
