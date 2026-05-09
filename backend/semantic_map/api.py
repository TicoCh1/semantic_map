from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import scoring
from .schemas import (
    AppStateResponse,
    GradientPreset,
    LayerCreate,
    LayerPatch,
    LayerReorder,
    LayerState,
    ScoringJob,
    ScoringJobCreate,
    SemanticLayer,
)
from .state_store import (
    DEFAULT_GRADIENTS,
    create_layer,
    delete_layer,
    get_state_model,
    load_gradients,
    load_state,
    read_layer_geojson,
    reorder_layers,
    save_gradients,
    save_state,
    update_layer,
)


app = FastAPI(title="Semantic Map API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "Semantic Map API", "status": "ok"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/state", response_model=AppStateResponse)
def get_app_state() -> AppStateResponse:
    return AppStateResponse(state=get_state_model(), gradients=load_gradients())


@app.put("/api/state", response_model=LayerState)
def put_app_state(state: LayerState) -> LayerState:
    save_state(state.model_dump())
    return get_state_model()


@app.get("/api/layers", response_model=list[SemanticLayer])
def get_layers() -> list[SemanticLayer]:
    return get_state_model().layers


@app.post("/api/layers", response_model=SemanticLayer)
def post_layer(layer: LayerCreate) -> SemanticLayer:
    created = create_layer(
        prompt=layer.prompt,
        name=layer.name,
        gradient_id=layer.gradient_id,
    )
    return SemanticLayer.model_validate(created)


@app.patch("/api/layers/{layer_id}", response_model=SemanticLayer)
def patch_layer(layer_id: str, patch: LayerPatch) -> SemanticLayer:
    updated = update_layer(layer_id, patch.model_dump(exclude_unset=True))
    if updated is None:
        raise HTTPException(status_code=404, detail="Layer not found")
    return SemanticLayer.model_validate(updated)


@app.delete("/api/layers/{layer_id}", status_code=204)
def remove_layer(layer_id: str) -> None:
    if not delete_layer(layer_id):
        raise HTTPException(status_code=404, detail="Layer not found")


@app.post("/api/layers/reorder", response_model=LayerState)
def post_layer_reorder(payload: LayerReorder) -> LayerState:
    return LayerState.model_validate(reorder_layers(payload.layer_ids))


@app.get("/api/layers/{layer_id}/geojson")
def get_layer_geojson(layer_id: str) -> JSONResponse:
    geojson = read_layer_geojson(layer_id)
    if geojson is None:
        raise HTTPException(status_code=404, detail="Layer GeoJSON not found")
    return JSONResponse(geojson)


@app.get("/api/gradients", response_model=list[GradientPreset])
def get_gradients() -> list[GradientPreset]:
    return [GradientPreset.model_validate(item) for item in load_gradients()]


@app.post("/api/gradients", response_model=GradientPreset)
def post_gradient(gradient: GradientPreset) -> GradientPreset:
    gradients = [item for item in load_gradients() if item["id"] != gradient.id]
    gradients.append(gradient.model_dump())
    save_gradients(gradients)
    return gradient


@app.put("/api/gradients/{gradient_id}", response_model=GradientPreset)
def put_gradient(gradient_id: str, gradient: GradientPreset) -> GradientPreset:
    data = gradient.model_dump()
    data["id"] = gradient_id
    gradients = [item for item in load_gradients() if item["id"] != gradient_id]
    gradients.append(data)
    save_gradients(gradients)
    return GradientPreset.model_validate(data)


@app.delete("/api/gradients/{gradient_id}", status_code=204)
def delete_gradient(gradient_id: str) -> None:
    built_in_ids = {item["id"] for item in DEFAULT_GRADIENTS if item.get("is_default")}
    if gradient_id in built_in_ids:
        raise HTTPException(status_code=400, detail="Built-in gradients cannot be deleted")

    gradients = load_gradients()
    kept = [item for item in gradients if item["id"] != gradient_id]
    if len(kept) == len(gradients):
        raise HTTPException(status_code=404, detail="Gradient not found")
    save_gradients(kept)


@app.post("/api/scoring/jobs", response_model=ScoringJob)
def post_scoring_job(payload: ScoringJobCreate) -> ScoringJob:
    return ScoringJob.model_validate(scoring.create_mock_scoring_job(payload.prompt))


@app.get("/api/scoring/jobs/{job_id}", response_model=ScoringJob)
def get_scoring_job(job_id: str) -> ScoringJob:
    job = scoring.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScoringJob.model_validate(job)


@app.post("/api/scoring/jobs/{job_id}/cancel", response_model=ScoringJob)
def cancel_scoring_job(job_id: str) -> ScoringJob:
    job = scoring.cancel_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScoringJob.model_validate(job)
