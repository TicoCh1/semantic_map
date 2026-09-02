from __future__ import annotations

import asyncio

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .auth import require_backend_token
from .backend_config import get_backend_settings
from .human_verification import HumanVerificationSampler
from .human_verification_schemas import (
    HumanVerificationRatingBatch,
    HumanVerificationRatingIngestResponse,
    HumanVerificationSampleRequest,
    HumanVerificationStats,
    HumanVerificationStudy,
)
from .human_verification_storage import HumanVerificationStorage
from .pano_service import AmbiguousPanoIdError, PanoCoordinateMismatchError, PanoServiceRegistry
from .remote_schemas import PanoImageResponse
from .result_storage import ResultStorage


settings = get_backend_settings()
result_storage = ResultStorage(settings)
sampler = HumanVerificationSampler(settings, result_storage)
rating_storage = HumanVerificationStorage(settings.result_root / "human_verification" / "ratings.sqlite3")
pano_registry = PanoServiceRegistry(settings)
pano_warmup_task: asyncio.Task[None] | None = None

app = FastAPI(title="UrbanFabric Human Verification Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMMUTABLE_IMAGE_HEADERS = {"Cache-Control": "public, max-age=31536000, immutable"}


@app.on_event("startup")
async def start_pano_warmup() -> None:
    global pano_warmup_task
    pano_warmup_task = asyncio.create_task(warm_pano_indexes())


@app.on_event("shutdown")
async def close_services() -> None:
    if pano_warmup_task is not None and not pano_warmup_task.done():
        pano_warmup_task.cancel()
    pano_registry.close()


async def warm_pano_indexes() -> None:
    try:
        timings = await asyncio.to_thread(pano_registry.warmup)
        print(f"Human verification pano warmup: {timings}", flush=True)
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        print(f"Human verification pano warmup failed: {type(exc).__name__}: {exc}", flush=True)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "UrbanFabric Human Verification Service", "status": "ok"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "human_verification"}


@app.get("/api/ready")
def ready() -> dict[str, object]:
    return {
        "status": "ready",
        "mode": "human_verification",
        "dataset_ids": list(settings.default_dataset_ids),
        "pano_warmup_running": pano_warmup_task is not None and not pano_warmup_task.done(),
    }


@app.post("/api/verification/sample", response_model=HumanVerificationStudy)
def create_sample(payload: HumanVerificationSampleRequest) -> HumanVerificationStudy:
    try:
        study = sampler.sample(payload)
        rating_storage.register_study(study)
        return study
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None
    except FileNotFoundError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


@app.post("/api/verification/ratings", response_model=HumanVerificationRatingIngestResponse)
def submit_ratings(
    payload: HumanVerificationRatingBatch,
    request: Request,
) -> HumanVerificationRatingIngestResponse:
    try:
        return rating_storage.record_ratings(
            payload,
            client_ip=verification_client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:512] or None,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from None


@app.get(
    "/api/verification/stats",
    response_model=HumanVerificationStats,
    dependencies=[Depends(require_backend_token)],
)
def get_stats() -> HumanVerificationStats:
    return rating_storage.stats()


@app.get(
    "/api/verification/ratings.csv",
    dependencies=[Depends(require_backend_token)],
)
def export_ratings() -> Response:
    return Response(
        content=rating_storage.export_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="human-verification-ratings.csv"'},
    )


@app.get("/api/panos/{pano_id}", response_model=PanoImageResponse)
def get_pano_metadata(
    pano_id: str,
    lon: float | None = Query(default=None, ge=-180.0, le=180.0),
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    date: int | None = Query(default=None),
) -> PanoImageResponse:
    return pano_metadata(None, pano_id, lon=lon, lat=lat, capture_date=date)


@app.get("/api/datasets/{dataset_id}/panos/{pano_id}", response_model=PanoImageResponse)
def get_dataset_pano_metadata(
    dataset_id: str,
    pano_id: str,
    lon: float | None = Query(default=None, ge=-180.0, le=180.0),
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    date: int | None = Query(default=None),
) -> PanoImageResponse:
    return pano_metadata(dataset_id, pano_id, lon=lon, lat=lat, capture_date=date)


def pano_metadata(
    dataset_id: str | None,
    pano_id: str,
    *,
    lon: float | None,
    lat: float | None,
    capture_date: int | None,
) -> PanoImageResponse:
    service = pano_service(dataset_id)
    if pano_index_is_warming(dataset_id):
        return PanoImageResponse(
            pano_id=pano_id,
            pano_dataset_id=dataset_id,
            status="unavailable",
            message="Pano index is warming up. Try again shortly.",
        )
    try:
        result = service.ensure_pano_image(pano_id, lon=lon, lat=lat, capture_date=capture_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Invalid pano id") from None
    except (AmbiguousPanoIdError, PanoCoordinateMismatchError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    if result is None:
        return PanoImageResponse(
            pano_id=pano_id,
            pano_dataset_id=dataset_id,
            status="missing",
            message="Pano not found in configured tar index.",
        )
    entry, image_path = result
    return PanoImageResponse(
        pano_id=entry.pano_id,
        status="ready",
        image_url=service.image_url(entry),
        pano_dataset_id=dataset_id,
        source_id=entry.source_id,
        entry_key=entry.entry_key,
        member_name=entry.member_name,
        tar_id=entry.tar_id,
        byte_size=image_path.stat().st_size,
        message="Ready.",
    )


@app.get("/api/panos/{pano_id}/image")
def get_pano_file(
    pano_id: str,
    entry_key: str | None = Query(default=None, min_length=1, max_length=64),
):
    return pano_file(None, pano_id, entry_key=entry_key)


@app.get("/api/datasets/{dataset_id}/panos/{pano_id}/image")
def get_dataset_pano_file(
    dataset_id: str,
    pano_id: str,
    entry_key: str | None = Query(default=None, min_length=1, max_length=64),
):
    return pano_file(dataset_id, pano_id, entry_key=entry_key)


def pano_file(dataset_id: str | None, pano_id: str, *, entry_key: str | None):
    service = pano_service(dataset_id)
    if pano_index_is_warming(dataset_id):
        raise HTTPException(status_code=503, detail="Pano index is warming up")
    try:
        result = service.ensure_pano_image(pano_id, entry_key=entry_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc) or "Invalid pano id") from None
    except AmbiguousPanoIdError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    if result is None:
        raise HTTPException(status_code=404, detail="Pano not found")
    _entry, image_path = result
    return FileResponse(image_path, media_type=media_type_for_image(image_path), headers=IMMUTABLE_IMAGE_HEADERS)


def pano_service(dataset_id: str | None):
    try:
        return pano_registry.service_for(dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None


def pano_index_is_warming(dataset_id: str | None) -> bool:
    service = pano_service(dataset_id)
    return not service.index_ready and pano_warmup_task is not None and not pano_warmup_task.done()


def media_type_for_image(path) -> str:
    return "image/png" if path.suffix.lower() == ".png" else "image/jpeg"


def verification_client_ip(request: Request) -> str | None:
    for header in ("cf-connecting-ip", "x-forwarded-for", "x-real-ip"):
        value = (request.headers.get(header) or "").strip()
        if value:
            return value.split(",", 1)[0].strip()[:128] or None
    return request.client.host[:128] if request.client and request.client.host else None
