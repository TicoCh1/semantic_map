"""Opt-in research API factory, deliberately not mounted in existing servers."""
from __future__ import annotations

from contextlib import asynccontextmanager
import hmac

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

from .region_matching_compute import ALGORITHM_VERSION, REPRESENTATION
from .region_matching_schemas import ModelRequest, RunRequest
from .region_matching_service import RegionConfig, RegionMatchingService


class BodyLimitMiddleware:
    """Bound request bodies through ASGI without private Request attributes."""

    def __init__(self, app, maximum=1_048_576):
        self.app, self.maximum = app, maximum

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") != "POST":
            await self.app(scope, receive, send)
            return
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            block = message.get("body", b"")
            if len(body) + len(block) > self.maximum:
                await JSONResponse(status_code=413, content={"detail": "Request body exceeds 1 MiB"})(scope, receive, send)
                return
            body.extend(block)
            if not message.get("more_body", False):
                break
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


def create_app(config: RegionConfig | None = None):
    config = config or RegionConfig.from_env()

    @asynccontextmanager
    async def lifespan(app):
        app.state.region_service = RegionMatchingService(config) if config.enabled else None
        try:
            yield
        finally:
            if app.state.region_service is not None:
                app.state.region_service.close()

    app = FastAPI(title="UrbanFabric region matching research API", lifespan=lifespan)
    app.add_middleware(BodyLimitMiddleware)

    @app.exception_handler(ValueError)
    async def bad_request(_request, error):
        return JSONResponse(status_code=400, content={"detail": str(error)})

    @app.exception_handler(FileNotFoundError)
    async def not_found(_request, error):
        return JSONResponse(status_code=404, content={"detail": str(error)})

    def service(authorization: str | None = Header(default=None)):
        if not config.enabled or app.state.region_service is None:
            raise HTTPException(503, "Region matching is disabled")
        supplied = authorization or ""
        if not hmac.compare_digest(supplied.encode("utf-8"), ("Bearer " + config.token).encode("utf-8")):
            raise HTTPException(401, "Missing or invalid region research token")
        return app.state.region_service

    @app.get("/api/health")
    @app.get("/api/ready")
    def ready():
        return {"ready": config.enabled and getattr(app.state, "region_service", None) is not None,
                "region_matching_enabled": config.enabled, "algorithm_version": ALGORITHM_VERSION}

    @app.get("/api/region-matching/capabilities")
    def capabilities():
        return {"region_matching_enabled": config.enabled, "algorithm_version": ALGORITHM_VERSION,
                "representation": REPRESENTATION, "compute_devices": ["auto", "cpu", "cuda"],
                "default_compute_device": "auto", "dataset_ids": list(config.datasets),
                "max_source_rows": config.max_source_rows, "max_pca_components": 32,
                "active_worker_limit": 1, "deployment": "standalone_research_service"}

    @app.post("/api/region-matching/models", status_code=202)
    def create_model(payload: ModelRequest, worker=Depends(service)):
        try:
            result = worker.submit_model(payload)
        except RuntimeError as error:
            raise HTTPException(429, str(error)) from error
        return {**result, "status_url": f"/api/region-matching/models/{result['id']}"}

    @app.get("/api/region-matching/models/{model_id}")
    def model_status(model_id: str, worker=Depends(service)):
        return worker.status(model_id, "models")

    @app.post("/api/region-matching/models/{model_id}/cancel")
    def cancel_model(model_id: str, worker=Depends(service)):
        return worker.cancel(model_id, "models")

    @app.post("/api/region-matching/runs", status_code=202)
    def create_run(payload: RunRequest, worker=Depends(service)):
        try:
            result = worker.submit_run(payload)
        except RuntimeError as error:
            raise HTTPException(429, str(error)) from error
        return {**result, "status_url": f"/api/region-matching/runs/{result['id']}"}

    @app.get("/api/region-matching/runs/{run_id}")
    def run_status(run_id: str, worker=Depends(service)):
        return worker.status(run_id, "runs")

    @app.post("/api/region-matching/runs/{run_id}/cancel")
    def cancel_run(run_id: str, worker=Depends(service)):
        return worker.cancel(run_id, "runs")

    @app.get("/api/region-matching/runs/{run_id}/points")
    def points(run_id: str, offset: int = Query(0, ge=0), limit: int = Query(1000, ge=1, le=1000),
               matched_only: bool = False, worker=Depends(service)):
        return worker.points(run_id, offset, limit, matched_only)

    @app.get("/api/region-matching/runs/{run_id}/regions")
    def regions(run_id: str, worker=Depends(service)):
        return FileResponse(worker.artifact(run_id, "runs", "regions.geojson"), media_type="application/geo+json")

    @app.get("/api/region-matching/runs/{run_id}/artifacts/{name}")
    def run_artifact(run_id: str, name: str, worker=Depends(service)):
        return FileResponse(worker.artifact(run_id, "runs", name))

    @app.get("/api/region-matching/models/{model_id}/artifacts/{name}")
    def model_artifact(model_id: str, name: str, worker=Depends(service)):
        return FileResponse(worker.artifact(model_id, "models", name))

    return app
