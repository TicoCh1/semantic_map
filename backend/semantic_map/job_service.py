from __future__ import annotations

import asyncio
import time
import traceback
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import datetime
from uuid import uuid4

from .backend_config import BackendSettings
from .city_catalog import city_catalog, city_id_for_dataset
from .dataset_groups import dataset_group_id_for, scoring_version_for_dataset_group, unique_dataset_ids
from .execution_log import ExecutionAuditLog, utc_now_precise
from .prompt_ids import (
    make_job_id,
    make_prompt_id,
    make_reference_prompt_id,
    normalize_prompt,
    utc_now,
)
from .remote_schemas import PanoReference, QueryType, ScoringJobCreate, ScoringJobResponse, ScoringResultRef, TileCoord
from .result_storage import ResultStorage
from .scoring_engine import SemanticScoringEngine, TemporarySemanticScoringEngine
from .tile_index import TileIndex, load_or_build_tile_index
from .tile_math import latlon_to_tile
from .tile_writer import result_tile_write_queue, write_prompt_result


TERMINAL_JOB_STATUSES = {"ready", "failed", "cancelled"}
PANO_REFERENCE_SCORING_SUFFIX = "pano-reference-aligned-v1"


@dataclass(frozen=True, slots=True)
class DatasetTarget:
    prompt_id: str
    dataset_id: str
    priority_tile: TileCoord | None
    result_revision: str | None = None


@dataclass(frozen=True, slots=True)
class QueuedSubmission:
    job_id: str
    request_id: str
    received_at: str
    received_monotonic: float
    request_payload: dict
    dataset_group_id: str
    dataset_ids: tuple[str, ...]
    targets: tuple[DatasetTarget, ...]
    prompt: str
    query_type: QueryType
    reference_pano: dict | None
    zooms: tuple[int, ...]
    scoring_version: str
    force_override: bool
    background: bool

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
        known_dataset_ids = (
            *(str(city.get("dataset_id") or "").strip() for city in city_catalog().values()),
            *settings.default_dataset_ids,
            settings.default_dataset_id,
        )
        self._prompt_catalog_dataset_ids = tuple(
            dict.fromkeys(dataset_id for dataset_id in known_dataset_ids if dataset_id)
        )
        self.engine = engine or TemporarySemanticScoringEngine(settings)
        queue_max_size = max(0, settings.prompt_queue_max_size)
        self._queue: asyncio.Queue[QueuedSubmission] = asyncio.Queue(maxsize=queue_max_size)
        self._background_queue: asyncio.Queue[QueuedSubmission] = asyncio.Queue(maxsize=queue_max_size)
        self._queue_available = asyncio.Event()
        self._background_queued_job_ids: set[str] = set()
        self._jobs: dict[str, ScoringJobResponse] = {}
        self._worker_task: asyncio.Task[None] | None = None
        self._job_persist_task: asyncio.Task[None] | None = None
        self._job_persist_pending: dict[str, ScoringJobResponse] = {}
        self._prompt_catalog_persist_task: asyncio.Task[None] | None = None
        self._prompt_catalog_persist_requested = False
        self._lock = asyncio.Lock()
        self._tile_indexes: dict[tuple[str, tuple[int, ...]], TileIndex] = {}
        self._warmed_up = False
        self._warmup_timings: dict[str, float] = {}
        self.audit_log = ExecutionAuditLog(settings)

    async def start(self) -> None:
        if self.settings.warmup_on_startup and not self._warmed_up:
            await self.warmup()
        if not self.storage.prompt_catalog_ready:
            await asyncio.to_thread(
                self.storage.rebuild_prompt_catalog,
                known_dataset_ids=self._prompt_catalog_dataset_ids,
            )
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

        stage_start = time.perf_counter()
        prompt_catalog_entries = await asyncio.to_thread(
            self.storage.rebuild_prompt_catalog,
            known_dataset_ids=self._prompt_catalog_dataset_ids,
        )
        timings["warmup_prompt_catalog"] = round(time.perf_counter() - stage_start, 3)
        print(
            f"Prompt catalog warmup indexed {self.storage.prompt_catalog_prompt_count} plaintext prompt(s) "
            f"and {prompt_catalog_entries} active city result(s).",
            flush=True,
        )

        self._warmup_timings = timings.copy()
        self._warmed_up = True
        print(f"Startup warmup complete for {dataset_group_id} ({','.join(dataset_ids)}): {timings}", flush=True)
        return timings

    async def stop(self) -> None:
        if self._worker_task is not None:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None

        # Admission and progress updates are intentionally decoupled from
        # /workspace I/O. Drain their latest coalesced snapshots only during
        # orderly shutdown.
        while self._job_persist_task is not None:
            await self._job_persist_task
        while self._prompt_catalog_persist_task is not None:
            await self._prompt_catalog_persist_task
        await asyncio.to_thread(self.audit_log.close)

    async def submit(
        self,
        payload: ScoringJobCreate,
        *,
        request_id: str | None = None,
        received_at: str | None = None,
        entrypoint: str = "/api/scoring/jobs",
    ) -> ScoringJobResponse:
        jobs = await self.submit_many(
            [payload],
            request_id=request_id,
            received_at=received_at,
            entrypoint=entrypoint,
            request_payload=payload.model_dump(mode="json"),
        )
        return jobs[0]

    async def submit_many(
        self,
        payloads: list[ScoringJobCreate] | tuple[ScoringJobCreate, ...],
        *,
        request_id: str | None = None,
        received_at: str | None = None,
        entrypoint: str,
        request_payload: dict | None = None,
    ) -> list[ScoringJobResponse]:
        results = await self.submit_many_results(
            payloads,
            request_id=request_id,
            received_at=received_at,
            entrypoint=entrypoint,
            request_payload=request_payload,
        )
        for result in results:
            if isinstance(result, ValueError):
                raise result
        return [result for result in results if isinstance(result, ScoringJobResponse)]

    async def submit_many_results(
        self,
        payloads: list[ScoringJobCreate] | tuple[ScoringJobCreate, ...],
        *,
        request_id: str | None = None,
        received_at: str | None = None,
        entrypoint: str,
        request_payload: dict | None = None,
    ) -> list[ScoringJobResponse | ValueError]:
        if not payloads:
            raise ValueError("At least one query payload is required.")

        effective_request_id = request_id or f"request_{uuid4().hex}"
        effective_received_at = received_at or utc_now_precise()
        effective_received_monotonic = time.perf_counter()
        payload_list = [payload.model_dump(mode="json") for payload in payloads]
        self.audit_log.record(
            "api_request_received",
            request_id=effective_request_id,
            received_at=effective_received_at,
            entrypoint=entrypoint,
            payload=request_payload if request_payload is not None else {"queries": payload_list},
            query_count=len(payload_list),
        )

        results: list[ScoringJobResponse | ValueError] = []
        background = entrypoint.startswith("startup_")
        for index, payload in enumerate(payloads):
            try:
                results.append(
                    await self._submit_one(
                        payload,
                        request_id=effective_request_id,
                        received_at=effective_received_at,
                        received_monotonic=effective_received_monotonic,
                        request_payload=payload_list[index],
                        background=background,
                    )
                )
            except ValueError as exc:
                self.audit_log.record(
                    "query_rejected",
                    request_id=effective_request_id,
                    received_at=effective_received_at,
                    query_index=index,
                    request_payload=payload_list[index],
                    exception_type=type(exc).__name__,
                    exception_message=str(exc),
                )
                results.append(exc)
        return results

    async def _submit_one(
        self,
        payload: ScoringJobCreate,
        *,
        request_id: str,
        received_at: str,
        received_monotonic: float,
        request_payload: dict,
        background: bool,
    ) -> ScoringJobResponse:
        dataset_ids = self._payload_dataset_ids(payload)
        default_group_id = self.settings.default_dataset_group_id if len(dataset_ids) > 1 else None
        dataset_group_id = dataset_group_id_for(dataset_ids, payload.dataset_group_id or default_group_id)
        scoring_version = scoring_version_for_dataset_group(self.settings.scoring_version, dataset_ids, dataset_group_id)
        query_type = payload.query_type or "text"
        if query_type == "pano_reference":
            return await self._submit_pano_reference(
                payload,
                dataset_ids,
                dataset_group_id,
                scoring_version,
                request_id=request_id,
                received_at=received_at,
                received_monotonic=received_monotonic,
                request_payload=request_payload,
                background=background,
            )
        if query_type != "text":
            raise ValueError(f"Unsupported scoring query_type: {query_type}")
        prompt = normalize_prompt(payload.prompt)
        if not prompt:
            raise ValueError("Prompt is required for text scoring jobs.")
        zooms = tuple(int(z) for z in payload.zooms) if payload.zooms else self.settings.tile_zooms
        priority_tiles = self._priority_tiles_by_dataset(payload, dataset_ids, zooms)

        active_job = await self._find_active_text_job(prompt, dataset_ids)
        if active_job is not None and not background:
            if await self._supersede_queued_background_job(active_job.job_id):
                active_job = None
        if active_job is not None:
            self._record_query_event(
                "query_active_deduplicated",
                job_id=active_job.job_id,
                request_id=request_id,
                received_at=received_at,
                request_payload=request_payload,
                query_type="text",
                prompt=prompt,
                dataset_ids=dataset_ids,
                force_override=payload.force_override,
                cache_status="active_deduplicated",
            )
            return active_job

        existing_targets: list[DatasetTarget] = []
        all_existing = not payload.force_override
        if not payload.force_override:
            for dataset_id in dataset_ids:
                existing_entry = self.storage.find_prompt_result_entry(
                    dataset_id=dataset_id,
                    prompt=prompt,
                )
                if existing_entry is not None:
                    existing_targets.append(
                        DatasetTarget(
                            dataset_id=dataset_id,
                            prompt_id=existing_entry.prompt_id,
                            priority_tile=priority_tiles.get(dataset_id),
                            result_revision=existing_entry.result_revision,
                        )
                    )
                else:
                    all_existing = False
                    break

        now = utc_now()
        ready_targets = tuple(existing_targets)
        if all_existing:
            job_id = f"{make_job_id(now, ready_targets[0].prompt_id)}_{uuid4().hex[:8]}"
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
                request_id=request_id,
                received_at=received_at,
                cache_status="cache_hit",
                force_override=False,
            )
            await self._save_job(job)
            self._record_query_event(
                "query_cache_hit",
                job_id=job.job_id,
                request_id=request_id,
                received_at=received_at,
                request_payload=request_payload,
                query_type="text",
                prompt=prompt,
                dataset_ids=dataset_ids,
                force_override=False,
                cache_status="cache_hit",
                priority_tiles=job.priority_tiles,
            )
            return job

        # Result IDs are only opaque, path-safe storage handles for newly
        # created work. They never participate in the cache-hit decision.
        prompt_tree_changed = self.storage.register_prompt(
            prompt=prompt,
            known_dataset_ids=self._prompt_catalog_dataset_ids,
        )
        if prompt_tree_changed:
            self._schedule_prompt_catalog_persist()
        queued_targets = tuple(
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
        job_id = f"{make_job_id(now, queued_targets[0].prompt_id)}_{uuid4().hex[:8]}"
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
            request_id=request_id,
            received_at=received_at,
            cache_status="force_override" if payload.force_override else "pending",
            force_override=payload.force_override,
        )
        await self._save_job(job)
        self._record_query_event(
            "query_admitted",
            job_id=job.job_id,
            request_id=request_id,
            received_at=received_at,
            request_payload=request_payload,
            query_type="text",
            prompt=prompt,
            dataset_ids=dataset_ids,
            force_override=payload.force_override,
            cache_status=job.cache_status,
            priority_tiles=job.priority_tiles,
        )
        await self._enqueue_submission(
            QueuedSubmission(
                job_id=job_id,
                request_id=request_id,
                received_at=received_at,
                received_monotonic=received_monotonic,
                request_payload=request_payload,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                targets=queued_targets,
                prompt=prompt,
                query_type="text",
                reference_pano=None,
                zooms=zooms,
                scoring_version=scoring_version,
                force_override=payload.force_override,
                background=background,
            )
        )
        return job

    async def _submit_pano_reference(
        self,
        payload: ScoringJobCreate,
        dataset_ids: tuple[str, ...],
        dataset_group_id: str,
        base_scoring_version: str,
        *,
        request_id: str,
        received_at: str,
        received_monotonic: float,
        request_payload: dict,
        background: bool,
    ) -> ScoringJobResponse:
        reference = normalize_reference_pano(payload.reference_pano)
        self._validate_dataset_ids((reference["dataset_id"],))
        scoring_version = f"{base_scoring_version}--{PANO_REFERENCE_SCORING_SUFFIX}"
        prompt = payload.prompt.strip() or reference_prompt_label(reference)
        zooms = tuple(int(z) for z in payload.zooms) if payload.zooms else self.settings.tile_zooms
        priority_tiles = self._priority_tiles_by_dataset(payload, dataset_ids, zooms)
        targets = tuple(
            DatasetTarget(
                dataset_id=dataset_id,
                prompt_id=make_reference_prompt_id(
                    dataset_id=dataset_id,
                    reference_dataset_id=reference["dataset_id"],
                    reference_pano_id=reference["pano_id"],
                    reference_pano_dataset_id=reference.get("pano_dataset_id"),
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                ),
                priority_tile=priority_tiles.get(dataset_id),
            )
            for dataset_id in dataset_ids
        )

        active_job = await self._find_active_job_by_prompt_ids([target.prompt_id for target in targets])
        if active_job is not None and not background:
            if await self._supersede_queued_background_job(active_job.job_id):
                active_job = None
        if active_job is not None:
            self._record_query_event(
                "query_active_deduplicated",
                job_id=active_job.job_id,
                request_id=request_id,
                received_at=received_at,
                request_payload=request_payload,
                query_type="pano_reference",
                prompt=prompt,
                reference_pano=reference,
                dataset_ids=dataset_ids,
                force_override=payload.force_override,
                cache_status="active_deduplicated",
            )
            return active_job

        existing_targets = []
        all_existing = not payload.force_override
        if not payload.force_override:
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
        job_id = f"{make_job_id(now, ready_targets[0].prompt_id if all_existing and ready_targets else targets[0].prompt_id)}_{uuid4().hex[:8]}"
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
                request_id=request_id,
                received_at=received_at,
                cache_status="cache_hit",
                force_override=False,
            )
            await self._save_job(job)
            self._record_query_event(
                "query_cache_hit",
                job_id=job.job_id,
                request_id=request_id,
                received_at=received_at,
                request_payload=request_payload,
                query_type="pano_reference",
                prompt=prompt,
                reference_pano=reference,
                dataset_ids=dataset_ids,
                force_override=False,
                cache_status="cache_hit",
                priority_tiles=job.priority_tiles,
            )
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
            request_id=request_id,
            received_at=received_at,
            cache_status="force_override" if payload.force_override else "pending",
            force_override=payload.force_override,
        )
        await self._save_job(job)
        self._record_query_event(
            "query_admitted",
            job_id=job.job_id,
            request_id=request_id,
            received_at=received_at,
            request_payload=request_payload,
            query_type="pano_reference",
            prompt=prompt,
            reference_pano=reference,
            dataset_ids=dataset_ids,
            force_override=payload.force_override,
            cache_status=job.cache_status,
            priority_tiles=job.priority_tiles,
        )
        await self._enqueue_submission(
            QueuedSubmission(
                job_id=job_id,
                request_id=request_id,
                received_at=received_at,
                received_monotonic=received_monotonic,
                request_payload=request_payload,
                dataset_group_id=dataset_group_id,
                dataset_ids=dataset_ids,
                targets=queued_targets,
                prompt=prompt,
                query_type="pano_reference",
                reference_pano=reference,
                zooms=zooms,
                scoring_version=scoring_version,
                force_override=payload.force_override,
                background=background,
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

    def _priority_tiles_by_dataset(
        self,
        payload: ScoringJobCreate,
        dataset_ids: tuple[str, ...],
        zooms: tuple[int, ...],
    ) -> dict[str, TileCoord]:
        by_dataset: dict[str, TileCoord] = {}
        tiles: list[TileCoord] = []
        if payload.priority_tile is not None:
            tiles.append(payload.priority_tile)
        tiles.extend(payload.priority_tiles or [])

        for index, tile in enumerate(tiles):
            dataset_id = tile.dataset_id
            if not dataset_id and index < len(dataset_ids):
                dataset_id = dataset_ids[index]
            if not dataset_id or dataset_id not in dataset_ids:
                raise ValueError("Each priority tile must target one requested dataset.")
            if tile.z not in zooms:
                raise ValueError(f"Priority tile zoom {tile.z} is not one of the requested zooms: {list(zooms)}")
            by_dataset[dataset_id] = tile.model_copy(update={"dataset_id": dataset_id})

        for dataset_id in dataset_ids:
            by_dataset.setdefault(dataset_id, self._default_priority_tile(dataset_id, zooms))
        return by_dataset

    def _default_priority_tile(self, dataset_id: str, zooms: tuple[int, ...]) -> TileCoord:
        """Use a deterministic city-centre tile whenever the client omits priority."""

        city = city_catalog().get(city_id_for_dataset(dataset_id), {})
        center = city.get("center")
        if isinstance(center, list) and len(center) == 2:
            lon, lat = center
        else:
            lat, lon = 0.0, 0.0
        key = latlon_to_tile(lat, lon, max(zooms))
        return TileCoord(z=key.z, x=key.x, y=key.y, dataset_id=dataset_id)

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
        request_id: str | None = None,
        received_at: str | None = None,
        execution_batch_id: str | None = None,
        cache_status: str = "pending",
        force_override: bool = False,
    ) -> ScoringJobResponse:
        primary = targets[0]
        results = [
            ScoringResultRef(
                dataset_id=target.dataset_id,
                prompt_id=target.prompt_id,
                manifest_url=self.storage.manifest_url(target.dataset_id, target.prompt_id),
                tile_url_template=self.storage.tile_url_template(
                    target.dataset_id,
                    target.prompt_id,
                    revision=target.result_revision,
                ),
                result_revision=target.result_revision,
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
            request_id=request_id,
            received_at=received_at,
            execution_batch_id=execution_batch_id,
            cache_status=cache_status,
            force_override=force_override,
        )

    def _record_query_event(self, event: str, **fields) -> None:
        self.audit_log.record(event, **fields)

    @staticmethod
    def _gpu_cosine_seconds(timings: dict[str, float]) -> float:
        """Return the actual GPU cosine-matrix stage reported by the scorer."""

        return round(
            float(timings.get("prompt_cosine", 0.0)) + float(timings.get("reference_cosine", 0.0)),
            6,
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
            self._prune_jobs_locked()
        self._schedule_job_persist(updated)
        self.audit_log.record(
            "query_cancelled",
            job_id=updated.job_id,
            request_id=updated.request_id,
            execution_batch_id=updated.execution_batch_id,
            cancelled_at=utc_now_precise(),
            received_at=updated.received_at,
            prompt=updated.prompt,
            query_type=updated.query_type,
            dataset_ids=updated.dataset_ids,
        )
        return updated

    async def _find_active_job_by_prompt_ids(self, prompt_ids) -> ScoringJobResponse | None:
        prompt_id_set = set(prompt_ids)
        async with self._lock:
            for job in self._jobs.values():
                job_prompt_ids = {job.prompt_id, *(result.prompt_id for result in job.results)}
                if job_prompt_ids & prompt_id_set and job.status not in {"ready", "failed", "cancelled"}:
                    return job
        return None

    async def _find_active_text_job(
        self,
        prompt: str,
        dataset_ids: tuple[str, ...],
    ) -> ScoringJobResponse | None:
        """Deduplicate active text work by canonical plaintext prompt and datasets."""

        requested_datasets = set(dataset_ids)
        async with self._lock:
            for job in self._jobs.values():
                job_datasets = set(job.dataset_ids or [job.dataset_id])
                if (
                    job.query_type == "text"
                    and normalize_prompt(job.prompt) == prompt
                    and job_datasets == requested_datasets
                    and job.status not in TERMINAL_JOB_STATUSES
                ):
                    return job
        return None

    async def _supersede_queued_background_job(self, job_id: str) -> bool:
        """Cancel background work that has not reached the worker yet."""

        async with self._lock:
            if job_id not in self._background_queued_job_ids:
                return False
            job = self._jobs.get(job_id)
            if job is None or job.status in TERMINAL_JOB_STATUSES:
                return False
            updated = job.model_copy(
                update={
                    "status": "cancelled",
                    "message": "Superseded by an interactive request.",
                    "updated_at": utc_now(),
                }
            )
            self._jobs[job_id] = updated
            self._prune_jobs_locked()
        self._schedule_job_persist(updated)
        return True

    async def _enqueue_submission(self, submission: QueuedSubmission) -> None:
        queue = self._background_queue if submission.background else self._queue
        if submission.background:
            self._background_queued_job_ids.add(submission.job_id)
        try:
            await queue.put(submission)
        except BaseException:
            if submission.background:
                self._background_queued_job_ids.discard(submission.job_id)
            raise
        self._queue_available.set()

    def _get_submission_nowait(self) -> tuple[QueuedSubmission, asyncio.Queue[QueuedSubmission]] | None:
        for queue in (self._queue, self._background_queue):
            try:
                submission = queue.get_nowait()
            except asyncio.QueueEmpty:
                continue
            if submission.background:
                self._background_queued_job_ids.discard(submission.job_id)
            return submission, queue
        return None

    def _get_interactive_submission_nowait(
        self,
    ) -> tuple[QueuedSubmission, asyncio.Queue[QueuedSubmission]] | None:
        try:
            submission = self._queue.get_nowait()
        except asyncio.QueueEmpty:
            return None
        return submission, self._queue

    async def _get_submission(self) -> tuple[QueuedSubmission, asyncio.Queue[QueuedSubmission]]:
        while True:
            queued = self._get_submission_nowait()
            if queued is not None:
                return queued
            self._queue_available.clear()
            # Recheck after clearing so a producer cannot set the event in the
            # narrow interval between the empty check and Event.wait().
            queued = self._get_submission_nowait()
            if queued is not None:
                return queued
            await self._queue_available.wait()

    async def _worker_loop(self) -> None:
        while True:
            batch_entries = [await self._get_submission()]
            try:
                await asyncio.sleep(self.settings.prompt_batch_window_ms / 1000)
                while len(batch_entries) < self.settings.prompt_batch_max_size:
                    # Batch interactive prompts together, but admit only one
                    # background prompt per execution cycle. This bounds the
                    # amount of non-interruptible backfill work a new request
                    # can land behind.
                    queued = self._get_interactive_submission_nowait()
                    if queued is None:
                        break
                    batch_entries.append(queued)

                # A user query that arrived during the batching window must be
                # processed before startup backfill, even if backfill woke the
                # worker first.
                batch_entries.sort(key=lambda entry: entry[0].background)
                groups: dict[
                    tuple[bool, tuple[tuple[str, ...], tuple[int, ...], str, QueryType]],
                    list[QueuedSubmission],
                ] = defaultdict(list)
                for item, _source_queue in batch_entries:
                    groups[(item.background, item.batch_key)].append(item)

                for submissions in groups.values():
                    execution_batch_id = f"batch_{uuid4().hex}"
                    await self._process_batch(submissions, execution_batch_id=execution_batch_id)
            finally:
                for _item, source_queue in batch_entries:
                    source_queue.task_done()

    async def _process_batch(self, submissions: list[QueuedSubmission], *, execution_batch_id: str) -> None:
        active = []
        for item in submissions:
            if not await self._is_cancelled(item.job_id):
                active.append(item)
        if not active:
            return

        timings: dict[str, float] = {}
        loop = asyncio.get_running_loop()
        batch_started_at = utc_now_precise()
        batch_started_monotonic = time.perf_counter()
        batch_received_at = min(item.received_at for item in active)
        self.audit_log.record(
            "execution_batch_started",
            execution_batch_id=execution_batch_id,
            received_at=batch_received_at,
            started_at=batch_started_at,
            scheduler_window_ms=self.settings.prompt_batch_window_ms,
            query_count=len(active),
            query_job_ids=[item.job_id for item in active],
            request_ids=[item.request_id for item in active],
            dataset_ids=list(active[0].dataset_ids),
            dataset_group_id=active[0].dataset_group_id,
            query_type=active[0].query_type,
            force_override_count=sum(1 for item in active if item.force_override),
        )

        try:
            await self._update_many(
                active,
                status="loading_dataset",
                progress=0.12,
                current_stage="loading_dataset",
                stage_timings=timings.copy(),
                message="Loading cached dataset.",
                execution_batch_id=execution_batch_id,
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
                execution_batch_id=execution_batch_id,
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
                    execution_batch_id=execution_batch_id,
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
                    execution_batch_id=execution_batch_id,
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
            self.audit_log.record(
                "execution_batch_scoring_complete",
                execution_batch_id=execution_batch_id,
                completed_at=utc_now_precise(),
                query_count=len(active),
                stage_timings=timings.copy(),
                gpu_cosine_seconds=self._gpu_cosine_seconds(timings),
                scoring_total_seconds=timings.get("scoring_total", 0.0),
            )
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
                    execution_batch_id=execution_batch_id,
                )

            written_result_refs: dict[tuple[str, str], ScoringResultRef] = {}
            tile_stage_started_at = utc_now_precise()
            tile_stage_started_monotonic = time.perf_counter()
            for submission in active:
                if await self._is_cancelled(submission.job_id):
                    continue
                query_tile_stage_start = time.perf_counter()
                query_tile_write_started_at = utc_now_precise()
                first_priority_tile_at: str | None = None
                first_priority_tile_id: str | None = None
                completed_tiles = 0
                total_tiles = self._expected_tile_write_count(submission, tile_indexes, scoped_settings)
                dataset_tile_timings: list[dict] = []
                for target in submission.targets:
                    result_key = (target.dataset_id, target.prompt_id)
                    if result_key in written_result_refs:
                        completed_tiles += self._expected_target_tile_write_count(target, tile_indexes[target.dataset_id], scoped_settings)
                        continue
                    result = results_by_key[result_key]
                    tile_index = tile_indexes[target.dataset_id]
                    dataset_tile_stage_start = time.perf_counter()
                    dataset_tile_write_started_at = utc_now_precise()
                    dataset_first_priority_tile_at: str | None = None
                    dataset_first_priority_tile_id: str | None = None
                    last_tile_update = 0.0
                    previous_revision = self.storage.active_revision(target.dataset_id, target.prompt_id)
                    result_revision = f"rev_{uuid4().hex}"
                    if submission.force_override:
                        self.audit_log.record(
                            "query_override_revision_started",
                            execution_batch_id=execution_batch_id,
                            job_id=submission.job_id,
                            request_id=submission.request_id,
                            dataset_id=target.dataset_id,
                            prompt_id=target.prompt_id,
                            previous_revision=previous_revision,
                            result_revision=result_revision,
                            started_at=dataset_tile_write_started_at,
                        )

                    def progress_callback(tile, done: int, total: int) -> None:
                        nonlocal dataset_first_priority_tile_at
                        nonlocal dataset_first_priority_tile_id
                        nonlocal first_priority_tile_at
                        nonlocal first_priority_tile_id
                        nonlocal last_tile_update
                        now = time.perf_counter()
                        if dataset_first_priority_tile_at is None:
                            dataset_first_priority_tile_at = utc_now_precise()
                            dataset_first_priority_tile_id = tile.id
                            if first_priority_tile_at is None:
                                first_priority_tile_at = dataset_first_priority_tile_at
                                first_priority_tile_id = dataset_first_priority_tile_id
                            self.audit_log.record(
                                "query_first_priority_tile_written",
                                execution_batch_id=execution_batch_id,
                                job_id=submission.job_id,
                                request_id=submission.request_id,
                                dataset_id=target.dataset_id,
                                prompt_id=target.prompt_id,
                                priority_tile=target.priority_tile.model_dump() if target.priority_tile else None,
                                written_tile={"z": tile.z, "x": tile.x, "y": tile.y},
                                first_priority_tile_at=dataset_first_priority_tile_at,
                                latency_from_received_seconds=round(now - submission.received_monotonic, 6),
                            )
                        if done < total and now - last_tile_update < 0.6:
                            return
                        last_tile_update = now
                        elapsed = round(now - dataset_tile_stage_start, 3)
                        aggregate_done = completed_tiles + done
                        timing_key = f"tile_writing_{target.dataset_id}"
                        patch = {
                            "status": "building_tiles",
                            "progress": 0.75 + 0.24 * (aggregate_done / max(total_tiles, 1)),
                            "current_stage": "building_tiles",
                            "current_tile": TileCoord(z=tile.z, x=tile.x, y=tile.y, dataset_id=target.dataset_id),
                            "tiles_done": aggregate_done,
                            "tiles_total": total_tiles,
                            "stage_timings": {**timings, timing_key: elapsed},
                            "message": f"Writing {target.dataset_id} tile {tile.id} ({aggregate_done}/{total_tiles}).",
                            "execution_batch_id": execution_batch_id,
                        }
                        loop.call_soon_threadsafe(
                            lambda job_id=submission.job_id, patch=patch: asyncio.create_task(self._update_job(job_id, **patch))
                        )

                    manifest = await asyncio.to_thread(
                        write_prompt_result,
                        result=result,
                        tile_index=tile_index,
                        storage=self.storage,
                        settings=scoped_settings,
                        priority_tile=target.priority_tile,
                        result_revision=result_revision,
                        progress_callback=progress_callback,
                    )
                    written_result_refs[result_key] = ScoringResultRef(
                        dataset_id=target.dataset_id,
                        prompt_id=target.prompt_id,
                        manifest_url=self.storage.manifest_url(target.dataset_id, target.prompt_id),
                        tile_url_template=manifest.tile_url_template,
                        result_revision=manifest.result_revision,
                        priority_tile=target.priority_tile,
                    )
                    target_tile_count = self._expected_target_tile_write_count(target, tile_index, scoped_settings)
                    completed_tiles += target_tile_count
                    dataset_completed_at = utc_now_precise()
                    dataset_tile_writing_seconds = round(time.perf_counter() - dataset_tile_stage_start, 6)
                    dataset_timing = {
                        "dataset_id": target.dataset_id,
                        "prompt_id": target.prompt_id,
                        "result_revision": result_revision,
                        "previous_revision": previous_revision,
                        "tile_write_started_at": dataset_tile_write_started_at,
                        "first_priority_tile_at": dataset_first_priority_tile_at,
                        "first_priority_tile_id": dataset_first_priority_tile_id,
                        "all_tiles_written_at": dataset_completed_at,
                        "tile_writing_seconds": dataset_tile_writing_seconds,
                        "tiles_written": target_tile_count,
                    }
                    dataset_tile_timings.append(dataset_timing)
                    self.audit_log.record(
                        "query_dataset_tiles_complete",
                        execution_batch_id=execution_batch_id,
                        job_id=submission.job_id,
                        request_id=submission.request_id,
                        **dataset_timing,
                    )
                    if submission.force_override:
                        self.audit_log.record(
                            "query_override_revision_activated",
                            execution_batch_id=execution_batch_id,
                            job_id=submission.job_id,
                            request_id=submission.request_id,
                            dataset_id=target.dataset_id,
                            prompt_id=target.prompt_id,
                            previous_revision=previous_revision,
                            result_revision=result_revision,
                            activated_at=dataset_completed_at,
                        )
                        try:
                            removed_artifacts = self.storage.prune_superseded_results(
                                target.dataset_id,
                                target.prompt_id,
                                keep_revision=result_revision,
                            )
                            self.audit_log.record(
                                "query_override_superseded_results_pruned",
                                execution_batch_id=execution_batch_id,
                                job_id=submission.job_id,
                                request_id=submission.request_id,
                                dataset_id=target.dataset_id,
                                prompt_id=target.prompt_id,
                                result_revision=result_revision,
                                removed_artifacts=removed_artifacts,
                                pruned_at=utc_now_precise(),
                            )
                        except Exception as cleanup_exc:
                            cleanup_traceback = traceback.format_exc()
                            print(
                                f"Override cleanup failed for {target.dataset_id}/{target.prompt_id}: "
                                f"{type(cleanup_exc).__name__}: {cleanup_exc}\n{cleanup_traceback}",
                                flush=True,
                            )
                            self.audit_log.record(
                                "query_override_cleanup_failed",
                                execution_batch_id=execution_batch_id,
                                job_id=submission.job_id,
                                request_id=submission.request_id,
                                dataset_id=target.dataset_id,
                                prompt_id=target.prompt_id,
                                result_revision=result_revision,
                                exception_type=type(cleanup_exc).__name__,
                                exception_message=str(cleanup_exc),
                                traceback=cleanup_traceback,
                            )
                if submission.query_type == "text":
                    self._schedule_prompt_catalog_persist()
                query_completed_at = utc_now_precise()
                query_backend_elapsed = round(time.perf_counter() - submission.received_monotonic, 6)
                query_tile_writing = round(time.perf_counter() - query_tile_stage_start, 6)
                query_timings = {
                    **timings,
                    "tile_writing_total": query_tile_writing,
                    **{
                        f"tile_writing_{item['dataset_id']}": float(item["tile_writing_seconds"])
                        for item in dataset_tile_timings
                    },
                }
                ready_results = [
                    written_result_refs[(target.dataset_id, target.prompt_id)]
                    for target in submission.targets
                ]
                await self._update_job(
                    submission.job_id,
                    status="ready",
                    progress=1.0,
                    current_stage="ready",
                    current_tile=None,
                    stage_timings=query_timings,
                    message="Ready.",
                    execution_batch_id=execution_batch_id,
                    results=ready_results,
                    manifest_url=ready_results[0].manifest_url,
                    tile_url_template=ready_results[0].tile_url_template,
                )
                self.audit_log.record(
                    "query_execution_complete",
                    execution_batch_id=execution_batch_id,
                    job_id=submission.job_id,
                    request_id=submission.request_id,
                    received_at=submission.received_at,
                    tile_write_started_at=query_tile_write_started_at,
                    first_priority_tile_at=first_priority_tile_at,
                    first_priority_tile_id=first_priority_tile_id,
                    all_tiles_written_at=query_completed_at,
                    completed_at=query_completed_at,
                    query_type=submission.query_type,
                    prompt=submission.prompt,
                    reference_pano=submission.reference_pano,
                    dataset_ids=list(submission.dataset_ids),
                    prompt_ids=[target.prompt_id for target in submission.targets],
                    priority_tiles=[target.priority_tile.model_dump() for target in submission.targets if target.priority_tile],
                    force_override=submission.force_override,
                    gpu_cosine_seconds=self._gpu_cosine_seconds(timings),
                    scoring_total_seconds=timings.get("scoring_total", 0.0),
                    tile_writing_seconds=query_tile_writing,
                    dataset_tile_timings=dataset_tile_timings,
                    backend_latency_from_received_seconds=query_backend_elapsed,
                    stage_timings=query_timings,
                )
            batch_completed_at = utc_now_precise()
            batch_tile_writing_seconds = round(time.perf_counter() - tile_stage_started_monotonic, 6)
            self.audit_log.record(
                "execution_batch_complete",
                execution_batch_id=execution_batch_id,
                received_at=batch_received_at,
                started_at=batch_started_at,
                tile_write_started_at=tile_stage_started_at,
                all_tiles_written_at=batch_completed_at,
                completed_at=batch_completed_at,
                query_count=len(active),
                query_job_ids=[item.job_id for item in active],
                gpu_cosine_seconds=self._gpu_cosine_seconds(timings),
                scoring_total_seconds=timings.get("scoring_total", 0.0),
                tile_writing_seconds=batch_tile_writing_seconds,
                execution_seconds=round(time.perf_counter() - batch_started_monotonic, 6),
                stage_timings=timings.copy(),
            )
        except Exception as exc:
            traceback_text = traceback.format_exc()
            print(
                f"Execution batch {execution_batch_id} failed: {type(exc).__name__}: {exc}\n{traceback_text}",
                flush=True,
            )
            await self._update_many(
                active,
                status="failed",
                progress=0.0,
                current_stage="failed",
                stage_timings=timings.copy(),
                message=f"{type(exc).__name__}: {exc}",
                execution_batch_id=execution_batch_id,
            )
            self.audit_log.record(
                "execution_batch_failed",
                execution_batch_id=execution_batch_id,
                failed_at=utc_now_precise(),
                query_job_ids=[item.job_id for item in active],
                exception_type=type(exc).__name__,
                exception_message=str(exc),
                traceback=traceback_text,
                stage_timings=timings.copy(),
            )
            for submission in active:
                self.audit_log.record(
                    "query_execution_failed",
                    execution_batch_id=execution_batch_id,
                    job_id=submission.job_id,
                    request_id=submission.request_id,
                    received_at=submission.received_at,
                    failed_at=utc_now_precise(),
                    query_type=submission.query_type,
                    prompt=submission.prompt,
                    reference_pano=submission.reference_pano,
                    force_override=submission.force_override,
                    exception_type=type(exc).__name__,
                    exception_message=str(exc),
                    traceback=traceback_text,
                    stage_timings=timings.copy(),
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
            if job is None or job.status in TERMINAL_JOB_STATUSES:
                return
            updated = job.model_copy(update={**patch, "updated_at": utc_now()})
            self._jobs[job_id] = updated
            self._prune_jobs_locked()
        self._schedule_job_persist(updated)

    async def _save_job(self, job: ScoringJobResponse) -> None:
        async with self._lock:
            self._jobs[job.job_id] = job
            self._prune_jobs_locked()
        self._schedule_job_persist(job)

    def _schedule_job_persist(self, job: ScoringJobResponse) -> None:
        # Runtime reads come from self._jobs. Persist only the newest snapshot
        # for each job in the background so admission and polling never wait on
        # RunPod's network/FUSE-backed /workspace volume.
        self._job_persist_pending[job.job_id] = job
        if self._job_persist_task is None or self._job_persist_task.done():
            self._job_persist_task = asyncio.create_task(self._persist_jobs_loop())

    async def _persist_jobs_loop(self) -> None:
        try:
            while self._job_persist_pending:
                snapshots = tuple(self._job_persist_pending.values())
                self._job_persist_pending.clear()
                await asyncio.to_thread(self._write_job_files, snapshots)
        finally:
            self._job_persist_task = None
            if self._job_persist_pending:
                self._job_persist_task = asyncio.create_task(self._persist_jobs_loop())

    def _write_job_files(self, jobs: tuple[ScoringJobResponse, ...]) -> None:
        for job in jobs:
            try:
                self._write_job_file(job)
            except Exception as exc:
                print(
                    f"Job snapshot persistence skipped for {job.job_id}: "
                    f"{type(exc).__name__}: {exc}",
                    flush=True,
                )

    def _schedule_prompt_catalog_persist(self) -> None:
        self._prompt_catalog_persist_requested = True
        if self._prompt_catalog_persist_task is None or self._prompt_catalog_persist_task.done():
            self._prompt_catalog_persist_task = asyncio.create_task(self._persist_prompt_catalog_loop())

    async def _persist_prompt_catalog_loop(self) -> None:
        try:
            while self._prompt_catalog_persist_requested:
                self._prompt_catalog_persist_requested = False
                try:
                    await asyncio.to_thread(self.storage.persist_prompt_catalog)
                except OSError as exc:
                    print(f"Prompt catalog persistence skipped: {type(exc).__name__}: {exc}", flush=True)
        finally:
            self._prompt_catalog_persist_task = None
            if self._prompt_catalog_persist_requested:
                self._schedule_prompt_catalog_persist()

    def _write_job_file(self, job: ScoringJobResponse) -> None:
        payload = job.model_dump()
        result_refs = job.results or [
            ScoringResultRef(
                dataset_id=job.dataset_id,
                prompt_id=job.prompt_id,
                manifest_url=job.manifest_url or self.storage.manifest_url(job.dataset_id, job.prompt_id),
                tile_url_template=job.tile_url_template
                or self.storage.tile_url_template(job.dataset_id, job.prompt_id),
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
    for key in ("pano_dataset_id", "city_id", "lon", "lat", "date"):
        value = data.get(key)
        if value is not None:
            normalized[key] = value
    return normalized


def reference_prompt_label(reference: dict) -> str:
    city = str(reference.get("city_id") or reference.get("dataset_id") or "").strip()
    suffix = f" ({city})" if city else ""
    return f"Reference pano {reference.get('pano_id')}{suffix}"
