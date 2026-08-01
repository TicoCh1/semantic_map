from __future__ import annotations

import asyncio
import shutil
import time
from dataclasses import replace
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import Response
from fastapi.responses import FileResponse, JSONResponse

from .auth import require_backend_token
from .backend_config import get_backend_settings
from .demo_alerts import DemoAlertManager
from .execution_log import utc_now_precise
from .job_service import PromptBatchService
from .job_service import job_timestamp_seconds
from .pano_service import PanoServiceRegistry
from .remote_schemas import (
    ArcGISFeature,
    ArcGISFeatureField,
    ArcGISMergedFeaturePage,
    ArcGISMergedFeatureRequest,
    ArcGISMergedPromptRef,
    ArcGISFeaturePage,
    ArcGISFeatureSchema,
    DemoMonitorEvent,
    DemoMonitorHeartbeat,
    DemoMonitorIngestResponse,
    PanoImageResponse,
    ReadyResponse,
    ResultManifest,
    ScoringJobBatchCreate,
    ScoringJobBatchItemResponse,
    ScoringJobBatchResponse,
    ScoringJobCreate,
    ScoringJobResponse,
)
from .result_storage import ResultStorage
from .scoring_models import PanoRecord
from .scoring_engine import TemporarySemanticScoringEngine
from .text_cor_t_engine import TextCorTScoringEngine
from .tile_math import TileKey
from .tile_writer import write_geojson_tile_from_arrays


settings = get_backend_settings()
engine = TemporarySemanticScoringEngine(settings) if settings.temporary_scorer_enabled else TextCorTScoringEngine(settings)
prompt_batch_service = PromptBatchService(settings, engine=engine)
storage = ResultStorage(settings)
pano_registry = PanoServiceRegistry(settings)
demo_alert_manager = DemoAlertManager(settings)
pano_warmup_task: asyncio.Task[None] | None = None
demo_monitor_task: asyncio.Task[None] | None = None
pano_warmup_started_at: float | None = None
active_frontend_stale_sessions: set[str] = set()
active_watchdog_stale_sessions: set[str] = set()
active_stale_job_ids: set[str] = set()
active_failed_job_ids: set[str] = set()
active_pano_warmup_stale = False

router = APIRouter()

IMMUTABLE_RESULT_HEADERS = {
    "Cache-Control": "private, max-age=31536000, immutable",
    "Vary": "Authorization",
}
NO_STORE_HEADERS = {"Cache-Control": "no-store"}
ARCGIS_FEATURE_DEFAULT_LIMIT = 50_000
ARCGIS_FEATURE_MAX_LIMIT = 200_000
ARCGIS_MERGED_JOB_POLL_INTERVAL_SECONDS = 1.5
ARCGIS_MERGED_JOB_MAX_WAIT_SECONDS = 1_800
ARCGIS_SPATIAL_REFERENCE = {"wkid": 4326}
ARCGIS_FEATURE_FIELDS = [
    ArcGISFeatureField(name="objectid", type="oid", alias="Object ID"),
    ArcGISFeatureField(name="pano_id", type="string", alias="Pano ID", length=128),
    ArcGISFeatureField(name="dataset_id", type="string", alias="Dataset ID", length=96),
    ArcGISFeatureField(name="city_id", type="string", alias="City", length=32),
    ArcGISFeatureField(name="prompt_id", type="string", alias="Prompt result ID", length=160),
    ArcGISFeatureField(name="prompt", type="string", alias="Prompt", length=512),
    ArcGISFeatureField(name="query_type", type="string", alias="Query type", length=32),
    ArcGISFeatureField(name="score", type="double", alias="Score"),
    ArcGISFeatureField(name="zscore", type="double", alias="Z-score"),
    ArcGISFeatureField(name="lon", type="double", alias="Longitude"),
    ArcGISFeatureField(name="lat", type="double", alias="Latitude"),
    ArcGISFeatureField(name="capture_date", type="string", alias="Capture date", length=32),
]


async def start_prompt_batch_service() -> None:
    global demo_monitor_task, pano_warmup_started_at, pano_warmup_task
    if demo_alert_manager.enabled and not demo_alert_manager.email_configured:
        print(f"Demo alert monitor is enabled, but {demo_alert_manager.alert_channel} email settings are incomplete.", flush=True)
    try:
        await prompt_batch_service.start()
    except Exception as exc:
        await record_backend_alert(
            severity="critical",
            code="backend_startup_failed",
            message=f"Backend startup or warmup failed: {type(exc).__name__}: {exc}",
            details={"exception_type": type(exc).__name__},
        )
        raise
    if pano_warmup_task is None or pano_warmup_task.done():
        pano_warmup_started_at = time.time()
        pano_warmup_task = asyncio.create_task(warmup_pano_index_background())
    if demo_alert_manager.enabled and (demo_monitor_task is None or demo_monitor_task.done()):
        demo_monitor_task = asyncio.create_task(demo_monitor_loop())
        await record_backend_alert(
            severity="info",
            code="backend_demo_monitor_started",
            message="Backend demo monitor started.",
            details={"email_configured": demo_alert_manager.email_configured, "alert_channel": demo_alert_manager.alert_channel},
        )


async def warmup_pano_index_background() -> None:
    try:
        print("Pano index warmup starting in background.", flush=True)
        started_at = time.time()
        timings = await asyncio.to_thread(pano_registry.warmup)
        elapsed = time.time() - started_at
        print(f"Pano index warmup: {timings}", flush=True)
        if elapsed > settings.demo_alert_pano_warmup_timeout_seconds:
            await record_backend_alert(
                severity="warning",
                code="pano_index_warmup_slow",
                message=f"Pano index warmup took {elapsed:.1f} seconds.",
                details={
                    "elapsed_seconds": round(elapsed, 1),
                    "timeout_seconds": settings.demo_alert_pano_warmup_timeout_seconds,
                    "timings": timings,
                },
            )
    except Exception as exc:
        print(f"Pano index warmup skipped: {type(exc).__name__}: {exc}", flush=True)
        await record_backend_alert(
            severity="critical",
            code="pano_index_warmup_failed",
            message=f"Pano index warmup failed: {type(exc).__name__}: {exc}",
            details={"exception_type": type(exc).__name__},
        )


async def stop_prompt_batch_service() -> None:
    global demo_monitor_task
    if demo_monitor_task is not None and not demo_monitor_task.done():
        demo_monitor_task.cancel()
        try:
            await demo_monitor_task
        except asyncio.CancelledError:
            pass
    demo_monitor_task = None
    if pano_warmup_task is not None and not pano_warmup_task.done():
        pano_warmup_task.cancel()
    await prompt_batch_service.stop()


async def demo_monitor_loop() -> None:
    while True:
        await asyncio.sleep(max(1, settings.demo_alert_check_interval_seconds))
        checks = (
            ("heartbeats", check_demo_heartbeats),
            ("jobs", check_demo_jobs),
            ("disk_space", check_demo_disk_space),
            ("worker", check_demo_worker),
            ("pano_warmup", check_demo_pano_warmup),
        )
        for check_name, check in checks:
            try:
                await check()
            except Exception as exc:
                print(f"Demo monitor check failed: {check_name}: {type(exc).__name__}: {exc}", flush=True)
                try:
                    await record_backend_alert(
                        severity="critical",
                        code="demo_monitor_check_failed",
                        message=f"Demo monitor check failed: {check_name}: {type(exc).__name__}: {exc}",
                        details={"check": check_name, "exception_type": type(exc).__name__},
                    )
                except Exception as nested_exc:
                    print(f"Demo monitor failure alert failed: {type(nested_exc).__name__}: {nested_exc}", flush=True)


async def check_demo_heartbeats() -> None:
    global active_frontend_stale_sessions, active_watchdog_stale_sessions

    latest_watchdog = await demo_alert_manager.latest_heartbeat("watchdog")
    current_frontend_stale_sessions: set[str] = set()
    for stale in await demo_alert_manager.stale_heartbeats("frontend", settings.demo_alert_frontend_timeout_seconds):
        session_id = str(stale.get("session_id") or "frontend")
        if frontend_stale_is_backgrounded(stale):
            continue
        current_frontend_stale_sessions.add(session_id)
        if session_id in active_frontend_stale_sessions:
            continue
        await record_backend_alert(
            severity="critical",
            code="frontend_heartbeat_stale",
            message=f"Frontend heartbeat is stale for {stale.get('age_seconds')} seconds.",
            session_id=session_id,
            details=frontend_stale_details(stale, latest_watchdog),
        )

    for session_id in sorted(active_frontend_stale_sessions - current_frontend_stale_sessions):
        await record_backend_alert(
            severity="recovered",
            code="frontend_heartbeat_recovered",
            message="Frontend heartbeat is no longer stale.",
            session_id=session_id,
            details={"session_id": session_id, "analysis": "A fresh frontend heartbeat arrived, or the last known page state is hidden/backgrounded and no longer treated as a demo failure."},
        )
    active_frontend_stale_sessions = current_frontend_stale_sessions

    current_watchdog_stale_sessions: set[str] = set()
    latest_frontend = await demo_alert_manager.latest_heartbeat("frontend")
    latest_watchdog = await demo_alert_manager.latest_heartbeat("watchdog")
    if latest_watchdog is not None:
        received_timestamp = float(latest_watchdog.get("received_timestamp") or 0)
        age_seconds = time.time() - received_timestamp if received_timestamp else 0
        if received_timestamp and age_seconds > settings.demo_alert_watchdog_timeout_seconds:
            stale = {**latest_watchdog, "age_seconds": round(age_seconds, 1)}
            session_id = str(stale.get("session_id") or "watchdog")
            current_watchdog_stale_sessions.add(session_id)
            if session_id not in active_watchdog_stale_sessions:
                await record_backend_alert(
                    severity="critical",
                    code="watchdog_heartbeat_stale",
                    message=f"A-side watchdog heartbeat is stale for {stale.get('age_seconds')} seconds.",
                    session_id=session_id,
                    details={**stale, "latest_frontend": compact_heartbeat(latest_frontend)},
                )

    for session_id in sorted(active_watchdog_stale_sessions - current_watchdog_stale_sessions):
        await record_backend_alert(
            severity="recovered",
            code="watchdog_heartbeat_recovered",
            message="A-side watchdog heartbeat is no longer stale.",
            session_id=session_id,
            details={"session_id": session_id, "analysis": "Backend received a fresh watchdog heartbeat again, or a newer watchdog session superseded an older stale session."},
        )
    active_watchdog_stale_sessions = current_watchdog_stale_sessions


def frontend_stale_is_backgrounded(payload: dict) -> bool:
    status = str(payload.get("status") or "").strip().lower()
    details = payload.get("details") if isinstance(payload.get("details"), dict) else {}
    visibility_state = str(details.get("visibility_state") or "").strip().lower()
    return status == "hidden" or visibility_state == "hidden"


def compact_heartbeat(payload: dict | None) -> dict | None:
    if payload is None:
        return None
    received_timestamp = float(payload.get("received_timestamp") or 0)
    return {
        "source": payload.get("source"),
        "session_id": payload.get("session_id"),
        "status": payload.get("status"),
        "received_at": payload.get("received_at"),
        "age_seconds": round(time.time() - received_timestamp, 1) if received_timestamp else None,
        "frontend_url": payload.get("frontend_url"),
        "backend_url": payload.get("backend_url"),
        "details": payload.get("details") if isinstance(payload.get("details"), dict) else {},
    }


def frontend_stale_details(stale: dict, latest_watchdog: dict | None) -> dict:
    watchdog = compact_heartbeat(latest_watchdog)
    details = {**stale, "latest_watchdog": watchdog}
    if watchdog:
        watchdog_details = watchdog.get("details") if isinstance(watchdog.get("details"), dict) else {}
        frontend_probe = watchdog_details.get("frontend_probe") if isinstance(watchdog_details.get("frontend_probe"), dict) else {}
        backend_probe = watchdog_details.get("backend_ready_probe") if isinstance(watchdog_details.get("backend_ready_probe"), dict) else {}
        if frontend_probe.get("ok") is True and backend_probe.get("ok") is True:
            details["analysis"] = {
                "likely_condition": "frontend_page_closed_crashed_or_javascript_stalled",
                "signals": "Watchdog can reach both the local frontend server and backend, but frontend browser heartbeat stopped.",
                "suggested_action": "The A-side watchdog should reopen the frontend. Check the demo computer if this repeats.",
            }
        elif backend_probe.get("ok") is False:
            details["analysis"] = {
                "likely_condition": "frontend_or_demo_computer_network_path_problem",
                "signals": "Watchdog reported backend /api/ready failure while frontend heartbeat was stale.",
                "suggested_action": "Check the demo computer network and RunPod URL.",
            }
    return details


async def check_demo_jobs() -> None:
    global active_stale_job_ids, active_failed_job_ids
    now = time.time()
    current_stale_job_ids: set[str] = set()
    current_failed_job_ids: set[str] = set()
    for job in await prompt_batch_service.list_jobs():
        if job.status == "failed":
            current_failed_job_ids.add(job.job_id)
            if job.job_id not in active_failed_job_ids:
                await record_backend_alert(
                    severity="critical",
                    code="scoring_job_failed",
                    message=f"Scoring job failed: {job.message}",
                    session_id=job.job_id,
                    details=job.model_dump(),
                )
            continue
        if job.status in {"ready", "cancelled"}:
            continue
        age_seconds = now - job_timestamp_seconds(job)
        if age_seconds > settings.demo_alert_job_stage_timeout_seconds:
            current_stale_job_ids.add(job.job_id)
            if job.job_id not in active_stale_job_ids:
                await record_backend_alert(
                    severity="warning",
                    code="scoring_job_stage_stale",
                    message=f"Scoring job has not advanced for {age_seconds:.1f} seconds at stage {job.current_stage or job.status}.",
                    session_id=job.job_id,
                    details={**job.model_dump(), "age_seconds": round(age_seconds, 1)},
                )
    for job_id in sorted(active_stale_job_ids - current_stale_job_ids - current_failed_job_ids):
        await record_backend_alert(
            severity="recovered",
            code="scoring_job_stage_recovered",
            message="Scoring job advanced again or finished.",
            session_id=job_id,
            details={"job_id": job_id, "analysis": "The backend job stage timestamp advanced, or the job reached a terminal status."},
        )
    active_stale_job_ids = current_stale_job_ids
    active_failed_job_ids = current_failed_job_ids


async def check_demo_disk_space() -> None:
    try:
        usage = shutil.disk_usage(settings.result_root)
    except OSError as exc:
        await record_backend_alert(
            severity="warning",
            code="disk_usage_check_failed",
            message=f"Disk usage check failed: {type(exc).__name__}: {exc}",
            details={"path": str(settings.result_root)},
        )
        return

    free_gb = usage.free / (1024**3)
    if free_gb < settings.demo_alert_min_disk_free_gb:
        await record_backend_alert(
            severity="warning",
            code="disk_space_low",
            message=f"Backend result disk has {free_gb:.2f} GB free.",
            details={
                "path": str(settings.result_root),
                "free_gb": round(free_gb, 3),
                "threshold_gb": settings.demo_alert_min_disk_free_gb,
            },
        )


async def check_demo_worker() -> None:
    worker = getattr(prompt_batch_service, "_worker_task", None)
    if worker is None:
        await record_backend_alert(
            severity="critical",
            code="prompt_worker_missing",
            message="Prompt batch worker task is missing.",
        )
        return
    if worker.done() and not worker.cancelled():
        exc = worker.exception()
        await record_backend_alert(
            severity="critical",
            code="prompt_worker_stopped",
            message=f"Prompt batch worker stopped unexpectedly: {type(exc).__name__}: {exc}" if exc else "Prompt batch worker stopped unexpectedly.",
            details={"exception_type": type(exc).__name__ if exc else None},
        )


async def check_demo_pano_warmup() -> None:
    global active_pano_warmup_stale
    if pano_warmup_task is None or pano_warmup_started_at is None:
        active_pano_warmup_stale = False
        return
    if pano_warmup_task.done():
        if active_pano_warmup_stale:
            await record_backend_alert(
                severity="recovered",
                code="pano_index_warmup_recovered",
                message="Pano index warmup finished.",
                details={"analysis": "The pano index warmup task is no longer running."},
            )
        active_pano_warmup_stale = False
        return
    elapsed = time.time() - pano_warmup_started_at
    if elapsed > settings.demo_alert_pano_warmup_timeout_seconds:
        if active_pano_warmup_stale:
            return
        active_pano_warmup_stale = True
        await record_backend_alert(
            severity="warning",
            code="pano_index_warmup_stale",
            message=f"Pano index warmup is still running after {elapsed:.1f} seconds.",
            details={
                "elapsed_seconds": round(elapsed, 1),
                "timeout_seconds": settings.demo_alert_pano_warmup_timeout_seconds,
            },
        )


async def record_backend_alert(
    *,
    severity: str,
    code: str,
    message: str,
    session_id: str | None = "backend",
    details: dict | None = None,
) -> bool:
    if not demo_alert_manager.enabled:
        return False
    return await demo_alert_manager.record_event(
        DemoMonitorEvent(
            source="backend",
            severity=severity,
            code=code,
            message=message,
            session_id=session_id,
            details=details or {},
        )
    )


def require_demo_monitor_enabled() -> None:
    if not settings.demo_alert_enabled:
        raise HTTPException(status_code=404, detail="Demo monitor is disabled.")


@router.get("/api/ready", response_model=ReadyResponse)
def ready() -> ReadyResponse:
    return ReadyResponse(
        ready=True,
        workspace_root=str(settings.workspace_root),
        qwen_repo_dir=str(settings.qwen_repo_dir),
        model_dir=str(settings.model_dir),
        data_root=str(settings.data_root),
        result_root=str(settings.result_root),
        log_root=str(settings.log_root),
        execution_log_root=str(settings.execution_log_root),
        execution_log_enabled=settings.execution_log_enabled,
        tile_index_root=str(settings.tile_index_root),
        default_dataset_id=settings.default_dataset_id,
        default_dataset_ids=list(settings.default_dataset_ids),
        default_dataset_group_id=settings.default_dataset_group_id,
        token_configured=bool(settings.backend_token),
        temporary_scorer_enabled=settings.temporary_scorer_enabled,
    )


@router.post(
    "/api/demo/monitor/heartbeat",
    response_model=DemoMonitorIngestResponse,
    dependencies=[Depends(require_backend_token), Depends(require_demo_monitor_enabled)],
)
async def post_demo_monitor_heartbeat(payload: DemoMonitorHeartbeat) -> DemoMonitorIngestResponse:
    await demo_alert_manager.record_heartbeat(payload)
    emailed = False
    if payload.status.strip().lower() not in {"ok", "healthy", "ready", "hidden", "starting"}:
        await demo_alert_manager.record_event(
            DemoMonitorEvent(
                source=payload.source,
                severity="info",
                code=f"{payload.source}_heartbeat_status",
                message=f"{payload.source} heartbeat reported status {payload.status}.",
                session_id=payload.session_id,
                details=payload.model_dump(),
            )
        )
    return DemoMonitorIngestResponse(accepted=True, enabled=True, emailed=emailed)


@router.post(
    "/api/demo/monitor/events",
    response_model=DemoMonitorIngestResponse,
    dependencies=[Depends(require_backend_token), Depends(require_demo_monitor_enabled)],
)
async def post_demo_monitor_event(payload: DemoMonitorEvent) -> DemoMonitorIngestResponse:
    emailed = await demo_alert_manager.record_event(payload)
    return DemoMonitorIngestResponse(accepted=True, enabled=True, emailed=emailed)


@router.get(
    "/api/demo/monitor/status",
    dependencies=[Depends(require_backend_token), Depends(require_demo_monitor_enabled)],
)
async def get_demo_monitor_status() -> dict:
    return await demo_alert_manager.snapshot()


@router.post(
    "/api/demo/monitor/test-alert",
    response_model=DemoMonitorIngestResponse,
    dependencies=[Depends(require_backend_token), Depends(require_demo_monitor_enabled)],
)
async def post_demo_monitor_test_alert() -> DemoMonitorIngestResponse:
    emailed = await record_backend_alert(
        severity="warning",
        code="demo_alert_test",
        message="Demo alert test message from backend.",
        details={"email_configured": demo_alert_manager.email_configured, "alert_channel": demo_alert_manager.alert_channel},
    )
    return DemoMonitorIngestResponse(accepted=True, enabled=True, emailed=emailed, message="Test alert recorded.")


@router.post(
    "/api/scoring/jobs",
    response_model=ScoringJobResponse,
    dependencies=[Depends(require_backend_token)],
)
async def post_scoring_job(payload: ScoringJobCreate) -> ScoringJobResponse:
    try:
        return await prompt_batch_service.submit(
            payload,
            request_id=f"request_{uuid4().hex}",
            received_at=utc_now_precise(),
            entrypoint="/api/scoring/jobs",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@router.post(
    "/api/scoring/jobs/batch",
    response_model=ScoringJobBatchResponse,
    dependencies=[Depends(require_backend_token)],
)
async def post_scoring_job_batch(payload: ScoringJobBatchCreate) -> ScoringJobBatchResponse:
    """Canonical multi-query API; singleton requests use the same item schema."""

    request_id = f"request_{uuid4().hex}"
    received_at = utc_now_precise()
    results = await prompt_batch_service.submit_many_results(
        payload.queries,
        request_id=request_id,
        received_at=received_at,
        entrypoint="/api/scoring/jobs/batch",
        request_payload=payload.model_dump(mode="json"),
    )
    query_results = [
        ScoringJobBatchItemResponse(
            index=index,
            status="rejected" if isinstance(result, ValueError) else "accepted",
            job=None if isinstance(result, ValueError) else result,
            error_type=type(result).__name__ if isinstance(result, ValueError) else None,
            error=str(result) if isinstance(result, ValueError) else None,
        )
        for index, result in enumerate(results)
    ]
    return ScoringJobBatchResponse(request_id=request_id, received_at=received_at, queries=query_results)


@router.get(
    "/api/scoring/jobs/{job_id}",
    response_model=ScoringJobResponse,
    dependencies=[Depends(require_backend_token)],
)
async def get_scoring_job(job_id: str) -> ScoringJobResponse:
    job = await prompt_batch_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post(
    "/api/scoring/jobs/{job_id}/cancel",
    response_model=ScoringJobResponse,
    dependencies=[Depends(require_backend_token)],
)
async def cancel_scoring_job(job_id: str) -> ScoringJobResponse:
    job = await prompt_batch_service.cancel(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get(
    "/api/scoring/results/{prompt_id}/manifest",
    response_model=ResultManifest,
    dependencies=[Depends(require_backend_token)],
)
def get_result_manifest(prompt_id: str, response: Response) -> ResultManifest:
    manifest_path = storage.find_manifest_path(prompt_id)
    if manifest_path is None:
        raise HTTPException(status_code=404, detail="Result manifest not found")
    payload = storage.read_json(manifest_path)
    if payload is None:
        raise HTTPException(status_code=404, detail="Result manifest not found")
    response.headers.update(NO_STORE_HEADERS)
    manifest = ResultManifest.model_validate(payload)
    return manifest.model_copy(
        update={
            "tile_url_template": storage.tile_url_template(
                manifest.prompt_id,
                revision=manifest.result_revision,
            )
        }
    )


@router.get(
    "/api/scoring/results/{prompt_id}/arcgis/schema",
    response_model=ArcGISFeatureSchema,
    dependencies=[Depends(require_backend_token)],
)
def get_arcgis_result_schema(prompt_id: str, dataset_id: str | None = None) -> ArcGISFeatureSchema:
    manifest = load_result_manifest(prompt_id, dataset_id=dataset_id)
    return arcgis_schema_from_manifest(manifest)


@router.get(
    "/api/scoring/results/{prompt_id}/features",
    response_model=ArcGISFeaturePage,
    dependencies=[Depends(require_backend_token)],
)
def get_result_features(
    prompt_id: str,
    dataset_id: str | None = None,
    bbox: str | None = None,
    field: str = Query("zscore", pattern="^(score|zscore)$"),
    min_value: float | None = Query(default=None, alias="min"),
    max_value: float | None = Query(default=None, alias="max"),
    limit: int = Query(default=ARCGIS_FEATURE_DEFAULT_LIMIT, ge=1, le=ARCGIS_FEATURE_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
):
    return get_result_feature_page(
        prompt_id=prompt_id,
        dataset_id=dataset_id,
        bbox=bbox,
        field=field,
        min_value=min_value,
        max_value=max_value,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/api/scoring/results/{prompt_id}/features/page",
    response_model=ArcGISFeaturePage,
    dependencies=[Depends(require_backend_token)],
)
def get_result_features_page(
    prompt_id: str,
    dataset_id: str | None = None,
    bbox: str | None = None,
    field: str = Query("zscore", pattern="^(score|zscore)$"),
    min_value: float | None = Query(default=None, alias="min"),
    max_value: float | None = Query(default=None, alias="max"),
    limit: int = Query(default=ARCGIS_FEATURE_DEFAULT_LIMIT, ge=1, le=ARCGIS_FEATURE_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
):
    return get_result_feature_page(
        prompt_id=prompt_id,
        dataset_id=dataset_id,
        bbox=bbox,
        field=field,
        min_value=min_value,
        max_value=max_value,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/api/scoring/arcgis/merged-features/page",
    response_model=ArcGISMergedFeaturePage,
    dependencies=[Depends(require_backend_token)],
)
async def post_arcgis_merged_features_page(payload: ArcGISMergedFeatureRequest) -> ArcGISMergedFeaturePage:
    prompts = normalize_arcgis_prompts(payload.prompts)
    dataset_ids = arcgis_merged_dataset_ids(payload)

    try:
        submitted_jobs = await prompt_batch_service.submit_many(
            [
                ScoringJobCreate(
                    dataset_group_id=payload.dataset_group_id,
                    dataset_ids=list(dataset_ids),
                    prompt=prompt,
                    query_type="text",
                    priority_tile=payload.priority_tile,
                    priority_tiles=payload.priority_tiles,
                    force_override=payload.force_override,
                    client_request_id=payload.client_request_id,
                )
                for prompt in prompts
            ],
            request_id=f"request_{uuid4().hex}",
            received_at=utc_now_precise(),
            entrypoint="/api/scoring/arcgis/merged-features/page",
            request_payload=payload.model_dump(mode="json"),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    ready_jobs = await asyncio.gather(*(wait_for_arcgis_job_ready(job) for job in submitted_jobs))
    return build_arcgis_merged_feature_page(
        payload=payload,
        prompts=prompts,
        ready_jobs=ready_jobs,
    )


def normalize_arcgis_prompts(raw_prompts: list[str]) -> tuple[str, ...]:
    prompts = tuple(prompt.strip() for prompt in raw_prompts if prompt.strip())
    if not prompts:
        raise HTTPException(status_code=400, detail="At least one non-empty prompt is required")
    return prompts


def arcgis_merged_dataset_ids(payload: ArcGISMergedFeatureRequest) -> tuple[str, ...]:
    configured_ids = payload.dataset_ids or list(settings.default_dataset_ids) or [payload.dataset_id]
    dataset_ids: list[str] = []
    seen: set[str] = set()
    for dataset_id in configured_ids:
        normalized = dataset_id.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        dataset_ids.append(normalized)

    import_dataset_id = payload.dataset_id.strip()
    if not import_dataset_id:
        raise HTTPException(status_code=400, detail="dataset_id is required")
    if import_dataset_id.lower() not in seen:
        dataset_ids.append(import_dataset_id)

    if not dataset_ids:
        raise HTTPException(status_code=400, detail="At least one dataset ID is required")
    return tuple(dataset_ids)


async def wait_for_arcgis_job_ready(job: ScoringJobResponse) -> ScoringJobResponse:
    deadline = time.monotonic() + ARCGIS_MERGED_JOB_MAX_WAIT_SECONDS
    current = job
    while True:
        if current.status == "ready":
            return current
        if current.status in {"failed", "cancelled"}:
            message = current.message or f"Scoring job {current.status}"
            raise HTTPException(status_code=500, detail=message)
        if time.monotonic() >= deadline:
            raise HTTPException(status_code=504, detail=f"Scoring job timed out: {current.job_id}")

        await asyncio.sleep(ARCGIS_MERGED_JOB_POLL_INTERVAL_SECONDS)
        refreshed = await prompt_batch_service.get_job(current.job_id)
        if refreshed is None:
            raise HTTPException(status_code=404, detail=f"Scoring job not found: {current.job_id}")
        current = refreshed


def build_arcgis_merged_feature_page(
    *,
    payload: ArcGISMergedFeatureRequest,
    prompts: tuple[str, ...],
    ready_jobs: tuple[ScoringJobResponse, ...] | list[ScoringJobResponse],
) -> ArcGISMergedFeaturePage:
    score_sets = []
    prompt_refs: list[ArcGISMergedPromptRef] = []
    for index, (prompt, job) in enumerate(zip(prompts, ready_jobs), start=1):
        prompt_id = prompt_result_id_for_dataset(job, payload.dataset_id)
        manifest = load_result_manifest(prompt_id, dataset_id=payload.dataset_id)
        score_arrays = storage.read_score_arrays(manifest.dataset_id, manifest.prompt_id)
        if score_arrays is None:
            raise HTTPException(status_code=409, detail=f"Score arrays are not ready for prompt {index}")

        prompt_ref = ArcGISMergedPromptRef(
            index=index,
            prompt=manifest.prompt or prompt,
            prompt_id=manifest.prompt_id,
            dataset_id=manifest.dataset_id,
        )
        prompt_refs.append(prompt_ref)
        score_sets.append((prompt_ref, *score_arrays))

    records = prompt_batch_service.engine.get_dataset_records(payload.dataset_id)
    for prompt_ref, scores, zscores in score_sets:
        if len(scores) < len(records) or len(zscores) < len(records):
            raise HTTPException(status_code=500, detail=f"Score arrays are shorter than dataset records for prompt {prompt_ref.index}")

    bbox_filter = parse_bbox_filter(payload.bbox)
    fields = arcgis_merged_feature_fields(prompt_refs)
    features: list[ArcGISFeature] = []

    # Score arrays are memory-mapped by ResultStorage; only the requested feature page
    # is materialized here, so full-city exports do not need a full merged table in RAM.
    if bbox_filter is None:
        total = len(records)
        for record in records[payload.offset : payload.offset + payload.limit]:
            features.append(arcgis_merged_feature_from_record(record, payload.dataset_id, score_sets))
    else:
        total = 0
        for record in records:
            if not record_in_bbox(record, bbox_filter):
                continue

            if total >= payload.offset and len(features) < payload.limit:
                features.append(arcgis_merged_feature_from_record(record, payload.dataset_id, score_sets))

            total += 1

    next_offset = payload.offset + len(features)
    has_more = next_offset < total
    return ArcGISMergedFeaturePage(
        dataset_id=payload.dataset_id,
        dataset_group_id=ready_jobs[0].dataset_group_id if ready_jobs else payload.dataset_group_id,
        prompts=prompt_refs,
        spatial_reference=ARCGIS_SPATIAL_REFERENCE,
        fields=fields,
        total=total,
        features=features,
        offset=payload.offset,
        limit=payload.limit,
        count=len(features),
        has_more=has_more,
        next_offset=next_offset if has_more else None,
    )


def prompt_result_id_for_dataset(job: ScoringJobResponse, dataset_id: str) -> str:
    for result in job.results:
        if result.dataset_id.lower() == dataset_id.lower():
            return result.prompt_id
    if job.dataset_id.lower() == dataset_id.lower():
        return job.prompt_id
    raise HTTPException(status_code=500, detail=f"Scoring job did not return result for dataset {dataset_id}")


def arcgis_merged_feature_fields(prompt_refs: list[ArcGISMergedPromptRef]) -> list[ArcGISFeatureField]:
    fields = [
        ArcGISFeatureField(name="objectid", type="oid", alias="Object ID"),
        ArcGISFeatureField(name="pano_id", type="string", alias="Pano ID", length=128),
        ArcGISFeatureField(name="dataset_id", type="string", alias="Dataset ID", length=96),
        ArcGISFeatureField(name="city_id", type="string", alias="City", length=32),
        ArcGISFeatureField(name="lon", type="double", alias="Longitude"),
        ArcGISFeatureField(name="lat", type="double", alias="Latitude"),
        ArcGISFeatureField(name="capture_date", type="string", alias="Capture date", length=32),
    ]
    for prompt_ref in prompt_refs:
        suffix = arcgis_prompt_field_suffix(prompt_ref.index)
        alias_prompt = shorten_arcgis_alias(prompt_ref.prompt)
        fields.extend(
            [
                ArcGISFeatureField(name=f"score_{suffix}", type="double", alias=f"Score {suffix}: {alias_prompt}"),
                ArcGISFeatureField(name=f"zscore_{suffix}", type="double", alias=f"Z-score {suffix}: {alias_prompt}"),
            ]
        )
    return fields


def arcgis_prompt_field_suffix(index: int) -> str:
    return f"{index:02d}" if index < 100 else str(index)


def shorten_arcgis_alias(value: str, max_length: int = 80) -> str:
    normalized = " ".join(value.strip().split())
    if len(normalized) <= max_length:
        return normalized
    return f"{normalized[: max_length - 3].rstrip()}..."


def arcgis_merged_base_attributes(record: PanoRecord, dataset_id: str) -> dict[str, object]:
    capture_date = str(record.date) if record.date is not None else None
    return {
        "objectid": record.row_index + 1,
        "pano_id": record.pano_id,
        "dataset_id": dataset_id,
        "city_id": city_id_for_dataset(dataset_id),
        "lon": record.lon,
        "lat": record.lat,
        "capture_date": capture_date,
    }


def arcgis_merged_feature_from_record(record: PanoRecord, dataset_id: str, score_sets) -> ArcGISFeature:
    attributes = arcgis_merged_base_attributes(record, dataset_id)
    row_index = record.row_index
    for prompt_ref, scores, zscores in score_sets:
        suffix = arcgis_prompt_field_suffix(prompt_ref.index)
        attributes[f"score_{suffix}"] = float(scores[row_index])
        attributes[f"zscore_{suffix}"] = float(zscores[row_index])

    return ArcGISFeature(
        geometry={
            "x": record.lon,
            "y": record.lat,
            "spatialReference": ARCGIS_SPATIAL_REFERENCE,
        },
        attributes=attributes,
    )


def load_result_manifest(prompt_id: str, *, dataset_id: str | None = None) -> ResultManifest:
    if dataset_id:
        manifest_path = storage.manifest_path(dataset_id, prompt_id)
        if not manifest_path.exists():
            raise HTTPException(status_code=404, detail="Result manifest not found for dataset")
    else:
        manifest_path = storage.find_manifest_path(prompt_id)
        if manifest_path is None:
            raise HTTPException(status_code=404, detail="Result manifest not found")

    payload = storage.read_json(manifest_path)
    if payload is None:
        raise HTTPException(status_code=404, detail="Result manifest not found")
    manifest = ResultManifest.model_validate(payload)
    return manifest.model_copy(
        update={
            "tile_url_template": storage.tile_url_template(
                manifest.prompt_id,
                revision=manifest.result_revision,
            )
        }
    )


def arcgis_schema_from_manifest(manifest: ResultManifest) -> ArcGISFeatureSchema:
    return ArcGISFeatureSchema(
        prompt_id=manifest.prompt_id,
        dataset_id=manifest.dataset_id,
        dataset_group_id=manifest.dataset_group_id,
        prompt=manifest.prompt,
        query_type=manifest.query_type,
        reference_pano=manifest.reference_pano,
        spatial_reference=ARCGIS_SPATIAL_REFERENCE,
        fields=ARCGIS_FEATURE_FIELDS,
        stats=manifest.stats,
        total=manifest.stats.count,
    )


def get_result_feature_page(
    *,
    prompt_id: str,
    dataset_id: str | None,
    bbox: str | None,
    field: str,
    min_value: float | None,
    max_value: float | None,
    limit: int,
    offset: int,
):
    # ArcGIS export must return the full point set; score ranges belong to local
    # symbology, so field/min/max are accepted for compatibility but not used here.
    _ = (field, min_value, max_value)
    manifest = load_result_manifest(prompt_id, dataset_id=dataset_id)
    score_arrays = storage.read_score_arrays(manifest.dataset_id, manifest.prompt_id)
    if score_arrays is None:
        return JSONResponse(status_code=202, content={"status": "features_not_ready", "prompt_id": prompt_id}, headers=NO_STORE_HEADERS)

    records = prompt_batch_service.engine.get_dataset_records(manifest.dataset_id)
    scores, zscores = score_arrays
    if len(scores) < len(records) or len(zscores) < len(records):
        raise HTTPException(status_code=500, detail="Score arrays are shorter than dataset records")

    bbox_filter = parse_bbox_filter(bbox)
    features: list[ArcGISFeature] = []
    total = 0
    for record in records:
        if bbox_filter is not None and not record_in_bbox(record, bbox_filter):
            continue
        row_index = record.row_index
        score = float(scores[row_index])
        zscore = float(zscores[row_index])

        if total >= offset and len(features) < limit:
            features.append(
                arcgis_feature_from_record(
                    record,
                    score=score,
                    zscore=zscore,
                    manifest=manifest,
                )
            )
        total += 1

    next_offset = offset + len(features)
    has_more = next_offset < total
    schema_payload = arcgis_schema_from_manifest(manifest).model_dump()
    schema_payload["total"] = total
    return ArcGISFeaturePage(
        **schema_payload,
        features=features,
        offset=offset,
        limit=limit,
        count=len(features),
        has_more=has_more,
        next_offset=next_offset if has_more else None,
    )


def parse_bbox_filter(raw_bbox: str | None) -> tuple[float, float, float, float] | None:
    if raw_bbox is None or not raw_bbox.strip():
        return None
    try:
        values = [float(part.strip()) for part in raw_bbox.split(",")]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bbox must be four comma-separated numbers: xmin,ymin,xmax,ymax") from exc
    if len(values) != 4:
        raise HTTPException(status_code=400, detail="bbox must be four comma-separated numbers: xmin,ymin,xmax,ymax")
    xmin, ymin, xmax, ymax = values
    if xmin > xmax:
        xmin, xmax = xmax, xmin
    if ymin > ymax:
        ymin, ymax = ymax, ymin
    return xmin, ymin, xmax, ymax


def record_in_bbox(record: PanoRecord, bbox: tuple[float, float, float, float]) -> bool:
    xmin, ymin, xmax, ymax = bbox
    return xmin <= record.lon <= xmax and ymin <= record.lat <= ymax


def city_id_for_dataset(dataset_id: str) -> str:
    lowered = dataset_id.lower()
    if "shanghai" in lowered:
        return "shanghai"
    if "london" in lowered:
        return "london"
    return ""


def arcgis_feature_from_record(
    record: PanoRecord,
    *,
    score: float,
    zscore: float,
    manifest: ResultManifest,
) -> ArcGISFeature:
    capture_date = str(record.date) if record.date is not None else None
    return ArcGISFeature(
        geometry={
            "x": record.lon,
            "y": record.lat,
            "spatialReference": ARCGIS_SPATIAL_REFERENCE,
        },
        attributes={
            "objectid": record.row_index + 1,
            "pano_id": record.pano_id,
            "dataset_id": manifest.dataset_id,
            "city_id": city_id_for_dataset(manifest.dataset_id),
            "prompt_id": manifest.prompt_id,
            "prompt": manifest.prompt,
            "query_type": manifest.query_type,
            "score": score,
            "zscore": zscore,
            "lon": record.lon,
            "lat": record.lat,
            "capture_date": capture_date,
        },
    )


@router.get(
    "/api/scoring/results/{prompt_id}/tiles/{z}/{x}/{y}.geojson",
    dependencies=[Depends(require_backend_token)],
)
def get_result_tile(prompt_id: str, z: int, x: int, y: int, revision: str | None = None):
    active_manifest_path = storage.find_manifest_path(prompt_id)
    if active_manifest_path is None:
        return JSONResponse(status_code=202, content={"status": "not_ready", "prompt_id": prompt_id}, headers=NO_STORE_HEADERS)

    active_payload = storage.read_json(active_manifest_path)
    if active_payload is None:
        return JSONResponse(status_code=202, content={"status": "not_ready", "prompt_id": prompt_id}, headers=NO_STORE_HEADERS)
    active_manifest = ResultManifest.model_validate(active_payload)
    manifest_path = storage.manifest_path(active_manifest.dataset_id, prompt_id, revision) if revision else active_manifest_path
    payload = storage.read_json(manifest_path)
    if payload is None:
        raise HTTPException(status_code=404, detail="Result revision not found")

    manifest = ResultManifest.model_validate(payload)
    effective_revision = revision or manifest.result_revision
    tile_path = storage.tile_path(manifest.dataset_id, prompt_id, z, x, y, effective_revision)
    if tile_path.exists():
        return FileResponse(tile_path, media_type="application/geo+json", headers=IMMUTABLE_RESULT_HEADERS)

    if z not in manifest.zooms:
        raise HTTPException(status_code=404, detail="Tile zoom is not available for this result")

    score_arrays = storage.read_score_arrays(manifest.dataset_id, prompt_id, revision=effective_revision)
    if score_arrays is None:
        return JSONResponse(status_code=202, content={"status": "tile_not_ready", "prompt_id": prompt_id}, headers=NO_STORE_HEADERS)

    records = prompt_batch_service.engine.get_dataset_records(manifest.dataset_id)
    scoped_settings = replace(settings, tile_zooms=tuple(manifest.zooms))
    tile_index = prompt_batch_service.get_tile_index(manifest.dataset_id, tuple(manifest.zooms), records, scoped_settings)
    scores, zscores = score_arrays
    write_geojson_tile_from_arrays(
        prompt_id=prompt_id,
        dataset_id=manifest.dataset_id,
        tile=TileKey(z=z, x=x, y=y),
        tile_index=tile_index,
        records=records,
        scores=scores,
        zscores=zscores,
        storage=storage,
        result_revision=effective_revision,
    )

    return FileResponse(tile_path, media_type="application/geo+json", headers=IMMUTABLE_RESULT_HEADERS)


@router.get(
    "/api/panos/{pano_id}",
    response_model=PanoImageResponse,
    dependencies=[Depends(require_backend_token)],
)
def get_pano_image_metadata(pano_id: str) -> PanoImageResponse:
    return get_pano_image_metadata_for_dataset(None, pano_id)


@router.get(
    "/api/datasets/{dataset_id}/panos/{pano_id}",
    response_model=PanoImageResponse,
    dependencies=[Depends(require_backend_token)],
)
def get_dataset_pano_image_metadata(dataset_id: str, pano_id: str) -> PanoImageResponse:
    return get_pano_image_metadata_for_dataset(dataset_id, pano_id)


def get_pano_image_metadata_for_dataset(dataset_id: str | None, pano_id: str) -> PanoImageResponse:
    try:
        service = pano_registry.service_for(dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    if pano_index_is_warming(dataset_id):
        return PanoImageResponse(pano_id=pano_id, status="unavailable", message="Pano index is warming up. Try again shortly.")
    try:
        result = service.ensure_pano_image(pano_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Invalid pano id") from None
    if result is None:
        return PanoImageResponse(pano_id=pano_id, status="missing", message="Pano not found in configured tar index.")

    entry, image_path = result
    return PanoImageResponse(
        pano_id=entry.pano_id,
        status="ready",
        image_url=service.image_url(entry.pano_id),
        member_name=entry.member_name,
        tar_id=entry.tar_id,
        byte_size=image_path.stat().st_size,
        message="Ready.",
    )


@router.get(
    "/api/panos/{pano_id}/image",
    dependencies=[Depends(require_backend_token)],
)
def get_pano_image_file(pano_id: str):
    return get_pano_image_file_for_dataset(None, pano_id)


@router.get(
    "/api/datasets/{dataset_id}/panos/{pano_id}/image",
    dependencies=[Depends(require_backend_token)],
)
def get_dataset_pano_image_file(dataset_id: str, pano_id: str):
    return get_pano_image_file_for_dataset(dataset_id, pano_id)


def get_pano_image_file_for_dataset(dataset_id: str | None, pano_id: str):
    try:
        service = pano_registry.service_for(dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    if pano_index_is_warming(dataset_id):
        raise HTTPException(status_code=503, detail="Pano index is warming up")
    try:
        result = service.ensure_pano_image(pano_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Invalid pano id") from None
    if result is None:
        raise HTTPException(status_code=404, detail="Pano not found")
    _entry, image_path = result
    return FileResponse(image_path, media_type=media_type_for_image(image_path), headers=IMMUTABLE_RESULT_HEADERS)


def media_type_for_image(path):
    suffix = path.suffix.lower()
    if suffix == ".png":
        return "image/png"
    return "image/jpeg"


def pano_index_is_warming(dataset_id: str | None = None) -> bool:
    service = pano_registry.service_for(dataset_id)
    return not service.index_ready and pano_warmup_task is not None and not pano_warmup_task.done()
