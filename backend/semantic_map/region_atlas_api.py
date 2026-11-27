"""Read-only GPU atlas distribution for the Semantic Map CPU service."""
from functools import lru_cache
import os
from pathlib import Path
import re

from fastapi import APIRouter, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .region_inspect_api import Circle, City, RegionIndex

router = APIRouter(prefix="/api/region-atlas")
DEFAULT_RELEASE = "/workspace/experiments/spatial_semantic_matching_20261127/atlas_150m_release"


def release_root():
    return Path(os.getenv("REGION_ATLAS_ROOT", DEFAULT_RELEASE))


def asset(request, relative_path, content_type):
    path = release_root() / relative_path
    try:
        stat = path.stat()
    except FileNotFoundError:
        status = 404 if (release_root() / "index.json").is_file() else 503
        raise HTTPException(status, "Atlas file unavailable")
    tag = f'"{stat.st_mtime_ns:x}-{stat.st_size:x}"'
    headers = {"ETag": tag, "Cache-Control": "private, no-cache"}
    matches = request.headers.get("if-none-match", "").split(",")
    if any(v.strip().removeprefix("W/") in (tag, "*") for v in matches):
        return Response(status_code=304, headers=headers)
    return FileResponse(path, media_type=content_type, headers=headers, stat_result=stat)


@router.get("/index")
def index(request: Request):
    return asset(request, "index.json", "application/json")


@router.get("/query/{query_id}")
def scores(request: Request, query_id: str):
    if not re.fullmatch(r"[a-z0-9_]{1,64}", query_id):
        raise HTTPException(404, "Unknown reference region")
    return asset(request, f"query/{query_id}.bin", "application/octet-stream")


@router.get("/city/{city}")
def coordinates(request: Request, city: City):
    return asset(request, f"city/{city}.bin", "application/octet-stream")


@router.get("/panoramas/{city}")
def panorama_rows(request: Request, city: City):
    return asset(request, f"panoramas/{city}.bin", "application/octet-stream")


@lru_cache(maxsize=1)
def precheck_index(root):
    return RegionIndex(root / "precheck")


@router.post("/precheck")
def precheck(circle: Circle):
    try:
        return precheck_index(release_root()).inspect(circle)
    except FileNotFoundError as exc:
        raise HTTPException(503, "Region composition data unavailable") from exc


def local_app():
    """Loopback development factory. The production router uses normal CPU bearer auth."""
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origin_regex=r"http://(127\.0\.0\.1|localhost)(:\d+)?",
                       allow_methods=["GET", "POST"], allow_headers=["*"], expose_headers=["ETag"])
    app.include_router(router)
    return app
