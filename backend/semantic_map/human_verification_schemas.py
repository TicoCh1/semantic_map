from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HumanVerificationSampleRequest(BaseModel):
    dataset_ids: list[str] | None = Field(default=None, min_length=1, max_length=8)
    samples_per_bucket_per_dataset: int = Field(default=5, ge=1, le=100)
    seed: int | None = None


class HumanVerificationTask(BaseModel):
    task_id: str
    dataset_id: str
    city_id: str
    pano_id: str
    lon: float
    lat: float
    date: int | None = None
    prompt_id: str
    result_revision: str | None = None
    score: float
    zscore: float
    ai_bucket: int = Field(ge=1, le=5)
    bucket_min: float | None = None
    bucket_max: float | None = None
    stratum_population: int = Field(ge=1)
    stratum_sample_count: int = Field(ge=1)


class HumanVerificationStratum(BaseModel):
    dataset_id: str
    city_id: str
    ai_bucket: int = Field(ge=1, le=5)
    bucket_min: float | None = None
    bucket_max: float | None = None
    population: int = Field(ge=0)
    sampled: int = Field(ge=0)


class HumanVerificationStudy(BaseModel):
    schema_version: int = 1
    study_id: str
    prompt: str
    score_property: Literal["zscore"] = "zscore"
    range_min: float = -1.0
    range_max: float = 3.0
    bucket_count: int = 5
    bucket_width: float = 0.8
    tail_policy: Literal["include_in_edge_buckets"] = "include_in_edge_buckets"
    samples_per_bucket_per_dataset: int
    seed: int
    dataset_ids: list[str]
    dataset_group_id: str | None = None
    tasks: list[HumanVerificationTask]
    strata: list[HumanVerificationStratum]


class HumanVerificationRatingSubmission(BaseModel):
    study_id: str = Field(min_length=1, max_length=160)
    task_id: str = Field(min_length=1, max_length=160)
    rater_id: str = Field(min_length=1, max_length=160)
    human_rating: int = Field(ge=1, le=5)
    elapsed_ms: int = Field(default=0, ge=0, le=86_400_000)
    rated_at: str = Field(min_length=1, max_length=64)


class HumanVerificationRatingBatch(BaseModel):
    ratings: list[HumanVerificationRatingSubmission] = Field(min_length=1, max_length=100)


class HumanVerificationPromptStats(BaseModel):
    prompt: str
    ratings: int = Field(ge=0)
    raters: int = Field(ge=0)
    mean_rating: float | None = None


class HumanVerificationStats(BaseModel):
    total_ratings: int = Field(ge=0)
    total_raters: int = Field(ge=0)
    total_studies: int = Field(ge=0)
    total_prompts: int = Field(ge=0)
    rating_counts: dict[int, int]
    prompts: list[HumanVerificationPromptStats]


class HumanVerificationRatingIngestResponse(BaseModel):
    accepted: int = Field(ge=0)
    stats: HumanVerificationStats
