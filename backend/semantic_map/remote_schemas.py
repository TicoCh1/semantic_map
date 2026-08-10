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
    pano_dataset_id: str | None = None
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
    force_override: bool = False
    client_request_id: str | None = Field(default=None, max_length=128)


class ScoringJobBatchCreate(BaseModel):
    """Canonical API envelope for one or more query inputs.

    Every element uses the same ScoringJobCreate schema as the single-query
    endpoint. The backend may coalesce cache misses that share a batch key.
    """

    queries: list[ScoringJobCreate] = Field(min_length=1, max_length=256)
    client_request_id: str | None = Field(default=None, max_length=128)


class ScoringJobBatchItemResponse(BaseModel):
    index: int = Field(ge=0)
    status: Literal["accepted", "rejected"]
    job: "ScoringJobResponse | None" = None
    error_type: str | None = None
    error: str | None = None


class ScoringJobBatchResponse(BaseModel):
    request_id: str
    received_at: str
    queries: list[ScoringJobBatchItemResponse]


class ScoringResultRef(BaseModel):
    dataset_id: str
    prompt_id: str
    manifest_url: str
    tile_url_template: str
    result_revision: str | None = None
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
    request_id: str | None = None
    received_at: str | None = None
    execution_batch_id: str | None = None
    cache_status: Literal["pending", "cache_hit", "force_override", "active_deduplicated"] = "pending"
    force_override: bool = False


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
    result_revision: str | None = None
    created_at: str


class ArcGISFeatureField(BaseModel):
    name: str
    type: Literal["oid", "string", "double", "integer", "date"]
    alias: str | None = None
    length: int | None = None


class ArcGISFeature(BaseModel):
    geometry: dict[str, Any]
    attributes: dict[str, Any]


class ArcGISFeatureSchema(BaseModel):
    prompt_id: str
    dataset_id: str
    dataset_group_id: str | None = None
    prompt: str
    query_type: QueryType = "text"
    reference_pano: PanoReference | None = None
    geometry_type: Literal["esriGeometryPoint"] = "esriGeometryPoint"
    object_id_field_name: str = "objectid"
    spatial_reference: dict[str, int] = Field(default_factory=lambda: {"wkid": 4326})
    fields: list[ArcGISFeatureField]
    stats: ScoreStats
    total: int


class ArcGISFeaturePage(ArcGISFeatureSchema):
    features: list[ArcGISFeature]
    offset: int
    limit: int
    count: int
    has_more: bool
    next_offset: int | None = None


class ArcGISMergedFeatureRequest(BaseModel):
    dataset_id: str = Field(min_length=1)
    dataset_group_id: str | None = None
    dataset_ids: list[str] | None = None
    prompts: list[str] = Field(min_length=1)
    bbox: str | None = None
    limit: int = Field(default=50_000, ge=1, le=200_000)
    offset: int = Field(default=0, ge=0)
    priority_tile: TileCoord | None = None
    priority_tiles: list[TileCoord] | None = None
    force_override: bool = False
    client_request_id: str | None = Field(default=None, max_length=128)


class ArcGISMergedPromptRef(BaseModel):
    index: int = Field(ge=1)
    prompt: str
    prompt_id: str
    dataset_id: str


class ArcGISMergedFeaturePage(BaseModel):
    dataset_id: str
    dataset_group_id: str | None = None
    prompts: list[ArcGISMergedPromptRef]
    geometry_type: Literal["esriGeometryPoint"] = "esriGeometryPoint"
    object_id_field_name: str = "objectid"
    spatial_reference: dict[str, int] = Field(default_factory=lambda: {"wkid": 4326})
    fields: list[ArcGISFeatureField]
    total: int
    features: list[ArcGISFeature]
    offset: int
    limit: int
    count: int
    has_more: bool
    next_offset: int | None = None


class ReadyResponse(BaseModel):
    ready: bool
    workspace_root: str
    qwen_repo_dir: str
    model_dir: str
    data_root: str
    result_root: str
    log_root: str
    execution_log_root: str
    execution_log_enabled: bool
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
    pano_dataset_id: str | None = None
    source_id: str | None = None
    entry_key: str | None = None
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
