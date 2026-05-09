from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class PanoRecord:
    pano_id: str
    row_index: int
    lon: float
    lat: float
    date: str | int | None = None


@dataclass(frozen=True, slots=True)
class ScoredPano:
    pano: PanoRecord
    score: float
    zscore: float


@dataclass(frozen=True, slots=True)
class PromptScoreResult:
    prompt_id: str
    dataset_id: str
    prompt: str
    records: tuple[PanoRecord, ...]
    scores: Any
    zscores: Any
    score_min: float
    score_max: float
    zscore_min: float
    zscore_max: float
    dataset_group_id: str | None = None
    scoring_version: str | None = None
    base_scoring_version: str | None = None
    query_type: str = "text"
    reference_pano: dict[str, Any] | None = None

    @property
    def count(self) -> int:
        return len(self.records)
