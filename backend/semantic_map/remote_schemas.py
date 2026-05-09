from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


JobStatus = Literal[
    "queued",
    "loading_model",
    "loading_dataset",
    "scoring",
    "building_tiles",
    "ready",
    "failed",
    "cancelled",
]
QueryType = Literal["text", "pano_reference"]


class TileCoord(BaseModel):
    z: int = Field(ge=0, le=30)
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    dataset_id: str | None = None


class PanoReference(BaseModel):
    pano_id: str = Field(min_length=1)
    dataset_id: str = Field(min_length=1)
    city_id: str | None = None
    lon: float | None = None
    lat: float | None = None
    date: str | int | None = None


class ScoringJobCreate(BaseModel):
    dataset_id: str | None = None
    dataset_group_id: str | None = None
    dataset_ids: list[str] | None = None
    prompt: str = ""
    query_type: QueryType = "text"
    reference_pano: PanoReference | None = None
    zooms: list[int] | None = None
    priority_tile: TileCoord | None = None
    priority_tiles: list[TileCoord] | None = None


class ScoringResultRef(BaseModel):
    dataset_id: str
    prompt_id: str
    manifest_url: str
    tile_url_template: str
    priority_tile: TileCoord | None = None


class ScoringJobResponse(BaseModel):
    job_id: str
    prompt_id: str
    dataset_id: str
    dataset_group_id: str | None = None
    dataset_ids: list[str] = Field(default_factory=list)
    prompt: str
    query_type: QueryType = "text"
    reference_pano: PanoReference | None = None
    status: JobStatus
    progress: float = Field(ge=0.0, le=1.0)
    message: str = ""
    created_at: str
    updated_at: str
    priority_tile: TileCoord | None = None
    priority_tiles: list[TileCoord] = Field(default_factory=list)
    current_stage: str | None = None
    current_tile: TileCoord | None = None
    tiles_done: int = 0
    tiles_total: int = 0
    stage_timings: dict[str, float] = Field(default_factory=dict)
    manifest_url: str | None = None
    tile_url_template: str | None = None
    results: list[ScoringResultRef] = Field(default_factory=list)


class ScoreStats(BaseModel):
    count: int
    score_min: float
    score_max: float
    zscore_min: float
    zscore_max: float


class ResultManifest(BaseModel):
    prompt_id: str
    dataset_id: str
    dataset_group_id: str | None = None
    prompt: str
    query_type: QueryType = "text"
    reference_pano: PanoReference | None = None
    canonical_prompt: str | None = None
    prompt_key_hash: str | None = None
    source_type: Literal["zxy_geojson"] = "zxy_geojson"
    tile_url_template: str
    score_property: str = "score"
    zscore_property: str = "zscore"
    zooms: list[int]
    stats: ScoreStats
    model_version: str
    scoring_version: str
    base_scoring_version: str | None = None
    tile_index_version: str
    density_rule: str = "legacy_tile_threshold_v1"
    density_base_zoom: int | None = None
    density_trigger_points: int
    density_keep_points: int
    created_at: str


class ReadyResponse(BaseModel):
    ready: bool
    workspace_root: str
    qwen_repo_dir: str
    model_dir: str
    data_root: str
    result_root: str
    tile_index_root: str
    default_dataset_id: str
    default_dataset_ids: list[str]
    default_dataset_group_id: str | None = None
    token_configured: bool
    temporary_scorer_enabled: bool


class PanoImageResponse(BaseModel):
    pano_id: str
    status: Literal["ready", "missing", "unavailable"]
    image_url: str | None = None
    member_name: str | None = None
    tar_id: str | None = None
    byte_size: int | None = None
    message: str = ""


AlertSeverity = Literal["info", "warning", "critical", "recovered"]
AlertSource = Literal["frontend", "watchdog", "backend"]


class DemoMonitorEvent(BaseModel):
    source: AlertSource
    severity: AlertSeverity = "warning"
    code: str = Field(min_length=1, max_length=96)
    message: str = Field(min_length=1, max_length=1000)
    session_id: str | None = Field(default=None, max_length=128)
    observed_at: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class DemoMonitorHeartbeat(BaseModel):
    source: Literal["frontend", "watchdog"]
    session_id: str | None = Field(default=None, max_length=128)
    status: str = Field(default="ok", max_length=64)
    observed_at: str | None = None
    frontend_url: str | None = None
    backend_url: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class DemoMonitorIngestResponse(BaseModel):
    accepted: bool
    enabled: bool
    emailed: bool = False
    message: str = ""
