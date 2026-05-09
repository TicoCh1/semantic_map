from __future__ import annotations

import math
import random
from collections.abc import Sequence

from .backend_config import BackendSettings
from .dataset_groups import dataset_group_id_for, scoring_version_for_dataset_group, unique_dataset_ids
from .dataset_loader import load_pano_records_from_refs, locate_dataset
from .prompt_ids import make_prompt_id, make_reference_prompt_id, normalize_prompt
from .scoring_models import PanoRecord, PromptScoreResult
from .tile_math import stable_hash_u64


class SemanticScoringEngine:
    def score_prompts(self, dataset_id: str, prompts: Sequence[str]) -> tuple[PromptScoreResult, ...]:
        raise NotImplementedError

    def score_dataset_group(
        self,
        dataset_ids: Sequence[str],
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        effective_group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        effective_scoring_version = scoring_version or scoring_version_for_dataset_group(
            self.settings.scoring_version,
            dataset_ids_tuple,
            effective_group_id,
        )
        return {
            dataset_id: self.score_prompts_with_scoring_version(
                dataset_id,
                prompts,
                dataset_group_id=effective_group_id,
                scoring_version=effective_scoring_version,
            )
            for dataset_id in dataset_ids_tuple
        }

    def score_prompts_with_scoring_version(
        self,
        dataset_id: str,
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None,
        scoring_version: str,
    ) -> tuple[PromptScoreResult, ...]:
        return self.score_prompts(dataset_id, prompts)

    def get_dataset_records(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        raise NotImplementedError

    def score_pano_references_dataset_group(
        self,
        dataset_ids: Sequence[str],
        references: Sequence[dict],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        raise NotImplementedError


class TemporarySemanticScoringEngine(SemanticScoringEngine):
    """Replace this with the extracted T_text_cor_T scorer on the RunPod backend."""

    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings
        self._dataset_cache: dict[str, tuple[PanoRecord, ...]] = {}

    def get_dataset_records(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        cached = self._dataset_cache.get(dataset_id)
        if cached is not None:
            return cached

        records = self._load_real_records_or_make_temporary(dataset_id)
        self._dataset_cache[dataset_id] = records
        return records

    def score_prompts(self, dataset_id: str, prompts: Sequence[str]) -> tuple[PromptScoreResult, ...]:
        return self.score_prompts_with_scoring_version(
            dataset_id,
            prompts,
            dataset_group_id=dataset_id,
            scoring_version=self.settings.scoring_version,
        )

    def score_dataset_group(
        self,
        dataset_ids: Sequence[str],
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        import numpy as np

        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        effective_group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        effective_scoring_version = scoring_version or scoring_version_for_dataset_group(
            self.settings.scoring_version,
            dataset_ids_tuple,
            effective_group_id,
        )
        normalized_prompts = tuple(normalize_prompt(prompt) for prompt in prompts)
        records_by_dataset = {dataset_id: self.get_dataset_records(dataset_id) for dataset_id in dataset_ids_tuple}
        all_scores_by_prompt: list[np.ndarray] = []
        all_records = [record for dataset_id in dataset_ids_tuple for record in records_by_dataset[dataset_id]]

        for prompt in normalized_prompts:
            group_prompt_key = make_prompt_id(
                dataset_id=effective_group_id,
                prompt=prompt,
                model_version=self.settings.model_version,
                scoring_version=effective_scoring_version,
                tile_index_version=self.settings.tile_index_version,
            )
            all_scores_by_prompt.append(np.asarray([self._score_record(group_prompt_key, record) for record in all_records], dtype=np.float32))

        results_by_dataset: dict[str, list[PromptScoreResult]] = {dataset_id: [] for dataset_id in dataset_ids_tuple}
        for prompt_index, prompt in enumerate(normalized_prompts):
            scores_all = all_scores_by_prompt[prompt_index]
            mean = float(scores_all.mean(dtype=np.float64))
            std = float(scores_all.std(dtype=np.float64)) or 1.0
            zscores_all = ((scores_all - mean) / std).astype(np.float32, copy=False)

            offset = 0
            for dataset_id in dataset_ids_tuple:
                records = records_by_dataset[dataset_id]
                end = offset + len(records)
                scores = np.ascontiguousarray(scores_all[offset:end], dtype=np.float32)
                zscores = np.ascontiguousarray(zscores_all[offset:end], dtype=np.float32)
                prompt_id = make_prompt_id(
                    dataset_id=dataset_id,
                    prompt=prompt,
                    model_version=self.settings.model_version,
                    scoring_version=effective_scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                )
                results_by_dataset[dataset_id].append(
                    PromptScoreResult(
                        prompt_id=prompt_id,
                        dataset_id=dataset_id,
                        prompt=prompt,
                        records=records,
                        scores=scores,
                        zscores=zscores,
                        score_min=float(scores.min()),
                        score_max=float(scores.max()),
                        zscore_min=float(zscores.min()),
                        zscore_max=float(zscores.max()),
                        dataset_group_id=effective_group_id,
                        scoring_version=effective_scoring_version,
                        base_scoring_version=self.settings.scoring_version,
                    )
                )
                offset = end

        return {dataset_id: tuple(results) for dataset_id, results in results_by_dataset.items()}

    def score_prompts_with_scoring_version(
        self,
        dataset_id: str,
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None,
        scoring_version: str,
    ) -> tuple[PromptScoreResult, ...]:
        import numpy as np

        records = self.get_dataset_records(dataset_id)
        results = []
        for prompt in prompts:
            normalized = normalize_prompt(prompt)
            prompt_id = make_prompt_id(
                dataset_id=dataset_id,
                prompt=normalized,
                model_version=self.settings.model_version,
                scoring_version=scoring_version,
                tile_index_version=self.settings.tile_index_version,
            )

            raw_scores = [self._score_record(prompt_id, record) for record in records]
            mean = sum(raw_scores) / len(raw_scores)
            variance = sum((value - mean) ** 2 for value in raw_scores) / len(raw_scores)
            std = math.sqrt(variance) or 1.0

            scores = np.asarray(raw_scores, dtype=np.float32)
            zscores = np.asarray([(score - mean) / std for score in raw_scores], dtype=np.float32)

            results.append(
                PromptScoreResult(
                    prompt_id=prompt_id,
                    dataset_id=dataset_id,
                    prompt=normalized,
                    records=records,
                    scores=scores,
                    zscores=zscores,
                    score_min=float(scores.min()),
                    score_max=float(scores.max()),
                    zscore_min=float(zscores.min()),
                    zscore_max=float(zscores.max()),
                    dataset_group_id=dataset_group_id,
                    scoring_version=scoring_version,
                    base_scoring_version=self.settings.scoring_version,
                )
            )

        return tuple(results)

    def score_pano_references_dataset_group(
        self,
        dataset_ids: Sequence[str],
        references: Sequence[dict],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        import numpy as np

        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        effective_group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        effective_scoring_version = scoring_version or scoring_version_for_dataset_group(
            self.settings.scoring_version,
            dataset_ids_tuple,
            effective_group_id,
        )
        normalized_references = tuple(normalize_reference_dict(reference) for reference in references)
        records_by_dataset = {dataset_id: self.get_dataset_records(dataset_id) for dataset_id in dataset_ids_tuple}
        all_records = [record for dataset_id in dataset_ids_tuple for record in records_by_dataset[dataset_id]]

        all_scores_by_reference: list[np.ndarray] = []
        for reference in normalized_references:
            reference_prompt_id = make_reference_prompt_id(
                dataset_id=effective_group_id,
                reference_dataset_id=reference["dataset_id"],
                reference_pano_id=reference["pano_id"],
                model_version=self.settings.model_version,
                scoring_version=effective_scoring_version,
                tile_index_version=self.settings.tile_index_version,
            )
            all_scores_by_reference.append(
                np.asarray([self._score_record(reference_prompt_id, record) for record in all_records], dtype=np.float32)
            )

        results_by_dataset: dict[str, list[PromptScoreResult]] = {dataset_id: [] for dataset_id in dataset_ids_tuple}
        for reference_index, reference in enumerate(normalized_references):
            scores_all = all_scores_by_reference[reference_index]
            mean = float(scores_all.mean(dtype=np.float64))
            std = float(scores_all.std(dtype=np.float64)) or 1.0
            zscores_all = ((scores_all - mean) / std).astype(np.float32, copy=False)
            prompt = reference_prompt_label(reference)

            offset = 0
            for dataset_id in dataset_ids_tuple:
                records = records_by_dataset[dataset_id]
                end = offset + len(records)
                scores = np.ascontiguousarray(scores_all[offset:end], dtype=np.float32)
                zscores = np.ascontiguousarray(zscores_all[offset:end], dtype=np.float32)
                prompt_id = make_reference_prompt_id(
                    dataset_id=dataset_id,
                    reference_dataset_id=reference["dataset_id"],
                    reference_pano_id=reference["pano_id"],
                    model_version=self.settings.model_version,
                    scoring_version=effective_scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                )
                results_by_dataset[dataset_id].append(
                    PromptScoreResult(
                        prompt_id=prompt_id,
                        dataset_id=dataset_id,
                        prompt=prompt,
                        records=records,
                        scores=scores,
                        zscores=zscores,
                        score_min=float(scores.min()),
                        score_max=float(scores.max()),
                        zscore_min=float(zscores.min()),
                        zscore_max=float(zscores.max()),
                        dataset_group_id=effective_group_id,
                        scoring_version=effective_scoring_version,
                        base_scoring_version=self.settings.scoring_version,
                        query_type="pano_reference",
                        reference_pano=dict(reference),
                    )
                )
                offset = end

        return {dataset_id: tuple(results) for dataset_id, results in results_by_dataset.items()}

    def _load_real_records_or_make_temporary(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        try:
            layout = locate_dataset(dataset_id, self.settings)
            return load_pano_records_from_refs(layout)
        except FileNotFoundError:
            return self._make_temporary_dataset(dataset_id)

    def _make_temporary_dataset(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        seed = stable_hash_u64(dataset_id, self.settings.model_version, "temporary-dataset")
        rng = random.Random(seed)
        west, east = -0.31, 0.05
        south, north = 51.42, 51.58
        records = []
        for index in range(self.settings.temporary_point_count):
            records.append(
                PanoRecord(
                    pano_id=f"{dataset_id}_{index:07d}",
                    row_index=index,
                    lon=rng.uniform(west, east),
                    lat=rng.uniform(south, north),
                    date=None,
                )
            )
        return tuple(records)

    def _score_record(self, prompt_id: str, record: PanoRecord) -> float:
        raw = stable_hash_u64(prompt_id, record.pano_id)
        return (raw % 1_000_000) / 1_000_000.0


def normalize_reference_dict(reference: dict) -> dict:
    pano_id = str(reference.get("pano_id") or "").strip()
    dataset_id = str(reference.get("dataset_id") or "").strip()
    if not pano_id or not dataset_id:
        raise ValueError("Reference pano requires pano_id and dataset_id.")
    normalized = {
        "pano_id": pano_id,
        "dataset_id": dataset_id,
    }
    for key in ("city_id", "lon", "lat", "date"):
        value = reference.get(key)
        if value is not None:
            normalized[key] = value
    return normalized


def reference_prompt_label(reference: dict) -> str:
    city = str(reference.get("city_id") or reference.get("dataset_id") or "").strip()
    suffix = f" ({city})" if city else ""
    return f"Reference pano {reference.get('pano_id')}{suffix}"
