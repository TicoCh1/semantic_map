"""Strict research API contracts, separate from text and pano-reference jobs."""
from __future__ import annotations

from typing import Any, Literal
import re

from pydantic import BaseModel, ConfigDict, Field, StrictInt, model_validator


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ModelRequest(StrictRequest):
    source_dataset_id: str = Field(min_length=1, max_length=100)
    source_geometry: dict[str, Any]
    source_date_range: tuple[str, str] | None = None
    representation: Literal["pano_aligned_views_v1"] = "pano_aligned_views_v1"
    selected_views: list[StrictInt] = Field(default_factory=lambda: list(range(8)), min_length=1, max_length=8)
    spatial_cell_m: float = Field(default=25, ge=5, le=500)
    fit_components: Literal["auto"] | StrictInt = "auto"
    compute_device: Literal["auto", "cpu", "cuda"] = "auto"
    seed: int = Field(default=20261001, ge=0, le=2**32 - 1)

    @model_validator(mode="after")
    def validate_model(self):
        if len(set(self.selected_views)) != len(self.selected_views) or min(self.selected_views) < 0:
            raise ValueError("View slots must be unique and nonnegative")
        if self.fit_components != "auto" and not 1 <= self.fit_components <= 32:
            raise ValueError("Fit between 1 and 32 PCA components")
        validate_dates(self.source_date_range)
        return self


class NeighborhoodRequest(StrictRequest):
    footprint: Literal["equal_area_circle"] = "equal_area_circle"
    center_step_m: float = Field(default=100, ge=25, le=1000)
    minimum_match_coverage: float = Field(default=0.5, ge=0, le=1)
    minimum_cells_absolute: int = Field(default=20, ge=3, le=10_000)
    minimum_cells_source_fraction: float = Field(default=0.5, ge=0, le=2)
    refine_candidates: int = Field(default=200, ge=1, le=1000)
    distribution_random_directions: int = Field(default=16, ge=1, le=128)
    distribution_quantiles: int = Field(default=64, ge=8, le=256)
    source_half_splits: int = Field(default=20, ge=2, le=100)
    maximum_overlap_iou: float = Field(default=0.5, ge=0, le=1)
    top_k: int = Field(default=20, ge=1, le=100)


class RunRequest(StrictRequest):
    model_id: str = Field(pattern=r"^model_[a-f0-9]{32}$")
    target_dataset_id: str = Field(min_length=1, max_length=100)
    target_date_range: tuple[str, str] | None = None
    selected_components: int = Field(default=8, ge=1, le=32)
    axis_weights: list[float] | None = Field(default=None, min_length=1, max_length=32)
    source_coverage: float = Field(default=0.9, gt=0, lt=1)
    residual_enabled: bool = True
    variance_floor_relative: float = Field(default=0.01, gt=0, le=1)
    variance_floor_absolute: float = Field(default=1e-8, gt=0, le=1)
    compute_device: Literal["auto", "cpu", "cuda"] = "auto"
    neighborhoods: NeighborhoodRequest | None = Field(default_factory=NeighborhoodRequest)

    @model_validator(mode="after")
    def validate_run(self):
        if self.axis_weights is not None:
            if len(self.axis_weights) != self.selected_components or min(self.axis_weights) < 0 or sum(self.axis_weights) <= 0:
                raise ValueError("Supply one nonnegative weight per PCA axis, with positive total")
        validate_dates(self.target_date_range)
        return self


def validate_dates(date_range):
    if date_range is None:
        return
    for value in date_range:
        if not re.fullmatch(r"\d{6}", value) or not 1 <= int(value[4:]) <= 12:
            raise ValueError("Date limits must be YYYYMM")
    if date_range[0] > date_range[1]:
        raise ValueError("Date limits must be ordered")
