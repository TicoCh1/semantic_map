from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class GradientStop(BaseModel):
    value: float = Field(ge=0.0, le=1.0)
    color: str = Field(pattern=r"^#[0-9a-fA-F]{6}$")


class GradientPreset(BaseModel):
    id: str
    name: str
    stops: list[GradientStop] = Field(min_length=2)
    opacity: float = Field(default=0.75, ge=0.0, le=1.0)
    score_min: float = 0.0
    score_max: float = 1.0
    updated_at: str | None = None
    is_default: bool = False


class LayerStyle(BaseModel):
    gradient_id: str = "default_heat"
    gradient_name: str | None = None
    stops: list[GradientStop] | None = None
    opacity: float = Field(default=0.75, ge=0.0, le=1.0)
    score_min: float = 0.0
    score_max: float = 1.0
    point_radius: float = Field(default=5.5, ge=0.25, le=128.0)
    absolute_radius: bool = False


class SemanticLayer(BaseModel):
    id: str
    name: str
    prompt: str
    visible: bool = True
    order: int = 0
    source_type: Literal["geojson"] = "geojson"
    source_path: str
    score_property: str = "score"
    style: LayerStyle = Field(default_factory=LayerStyle)
    status: Literal["queued", "running", "ready", "failed"] = "ready"
    created_at: str


class LayerState(BaseModel):
    layers: list[SemanticLayer] = Field(default_factory=list)
    selected_layer_id: str | None = None
    updated_at: str | None = None


class LayerCreate(BaseModel):
    prompt: str = Field(min_length=1)
    name: str | None = None
    gradient_id: str | None = None


class LayerPatch(BaseModel):
    name: str | None = None
    visible: bool | None = None
    style: LayerStyle | None = None
    selected: bool | None = None


class LayerReorder(BaseModel):
    layer_ids: list[str]


class AppStateResponse(BaseModel):
    state: LayerState
    gradients: list[GradientPreset]


class ScoringJobCreate(BaseModel):
    prompt: str = Field(min_length=1)


class ScoringJob(BaseModel):
    job_id: str
    prompt: str
    status: Literal["queued", "running", "ready", "failed", "cancelled"]
    progress: float = Field(ge=0.0, le=1.0)
    layer_id: str | None = None
    message: str = ""
    created_at: str
    updated_at: str


JsonObject = dict[str, Any]
