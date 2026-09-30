from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class AIRunRequest(StrictModel):
    request_id: str = Field(min_length=1, max_length=160)
    evaluator_id: str = Field(min_length=1, max_length=160)
    model: str = Field(min_length=1, max_length=160)
    model_settings: dict[str, Any] = Field(default_factory=dict)
    dataset_ids: list[str] | None = Field(default=None, min_length=1, max_length=8)
    seed: int = Field(default=20260908, ge=0, le=2**63 - 1)
    run_id: str | None = Field(default=None, pattern=r'^ai-run-[0-9a-f]{32}$')
    new_run: bool = False


class AIAssignmentRequest(AIRunRequest):
    target: int = Field(default=100, ge=1, le=100000)


class AINextRequest(StrictModel):
    count: int = Field(default=1, ge=1, le=20)
    request_id: str | None = Field(default=None, min_length=1, max_length=160)
    assignment_id: str | None = Field(default=None, pattern=r'^ai-assignment-[0-9a-f]{32}$')


class AIWorkerIdentity(StrictModel):
    worker_id: str = Field(min_length=1, max_length=160)
    model: str = Field(min_length=1, max_length=160)
    model_settings: dict[str, Any] = Field(default_factory=dict)


class AIRating(StrictModel):
    task_id: str = Field(min_length=1, max_length=160)
    rating: int = Field(ge=1, le=5)
    rationale: str = Field(default='', max_length=4000)
    elapsed_ms: int | None = Field(default=None, ge=0, le=86_400_000)
    rated_at: datetime
    worker: AIWorkerIdentity | None = None


class AIRatingBatch(StrictModel):
    run_id: str = Field(min_length=1, max_length=160)
    ratings: list[AIRating] = Field(min_length=1, max_length=20)


class AIView(StrictModel):
    index: int
    yaw_degrees: int
    pitch_degrees: int = 0
    roll_degrees: int = 0
    horizontal_fov_degrees: int = 45
    vertical_fov_degrees: int = 45
    width: int = 512
    height: int = 512
    url: str


class AICollage(StrictModel):
    url: str
    layout: Literal['4x2'] = '4x2'
    width: int = 2048
    height: int = 1024
    columns: int = 4
    rows: int = 2
    cell_width: int = 512
    cell_height: int = 512
    yaw_degrees_row_major: list[int] = Field(default_factory=lambda: [45, 90, 135, 180, 225, 270, 315, 0])


class AITask(StrictModel):
    task_id: str
    prompt: str
    image: AICollage
    views: list[AIView]


class AITaskBatch(StrictModel):
    run_id: str
    status: Literal['ready', 'no_new_sample']
    instructions: str
    submission_url: str = '/api/ai-verification/ratings'
    tasks: list[AITask]
