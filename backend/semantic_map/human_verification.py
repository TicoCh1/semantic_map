from __future__ import annotations

import hashlib
import random
from bisect import bisect_right
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from math import isfinite
from pathlib import Path

from .backend_config import BackendSettings
from .city_catalog import city_id_for_dataset
from .dataset_loader import load_pano_records_from_refs, locate_dataset
from .human_verification_schemas import (
    HumanVerificationSampleRequest,
    HumanVerificationStratum,
    HumanVerificationStudy,
    HumanVerificationTask,
)
from .prompt_ids import normalize_prompt
from .remote_schemas import ResultManifest
from .result_storage import ResultStorage
from .scoring_models import PanoRecord


HUMAN_VERIFY_ZSCORE_MIN = -1.0
HUMAN_VERIFY_ZSCORE_MAX = 3.0
HUMAN_VERIFY_BUCKET_COUNT = 5
HUMAN_VERIFY_BUCKET_WIDTH = (HUMAN_VERIFY_ZSCORE_MAX - HUMAN_VERIFY_ZSCORE_MIN) / HUMAN_VERIFY_BUCKET_COUNT


@dataclass(frozen=True, slots=True)
class SampleCandidate:
    record: PanoRecord
    score: float
    zscore: float
    bucket: int


@dataclass(frozen=True, slots=True)
class CompletedResultRef:
    dataset_id: str
    prompt_id: str
    manifest_path: Path
    result_revision: str | None


@dataclass(frozen=True, slots=True)
class CompletedPrompt:
    prompt: str
    results: tuple[CompletedResultRef, ...]


class HumanVerificationSampler:
    """Build deterministic, CPU-only human-verification samples from saved results."""

    def __init__(
        self,
        settings: BackendSettings,
        storage: ResultStorage,
        *,
        prompt_completion_counts: Callable[[], Mapping[str, int]] | None = None,
    ) -> None:
        self.settings = settings
        self.storage = storage
        self._prompt_completion_counts = prompt_completion_counts or (lambda: {})
        self._records_by_dataset: dict[str, tuple[PanoRecord, ...]] = {}
        self._completed_prompts_cache: dict[tuple[str, ...], tuple[CompletedPrompt, ...]] = {}

    def sample(self, request: HumanVerificationSampleRequest) -> HumanVerificationStudy:
        requested_dataset_ids = tuple(dict.fromkeys(request.dataset_ids or self.settings.default_dataset_ids))
        if not requested_dataset_ids:
            raise ValueError("At least one dataset is required")
        seed = request.seed if request.seed is not None else random.SystemRandom().randrange(1, 2**63)
        completed_prompts = self._completed_prompts(requested_dataset_ids)
        if not completed_prompts:
            raise LookupError("No completed prompt results are available in the configured datasets")
        selected_prompt = select_completed_prompt(
            completed_prompts,
            seed,
            request.exclude_prompts,
            self._prompt_completion_counts(),
        )
        prompt = selected_prompt.prompt
        selected_dataset_ids = tuple(result.dataset_id for result in selected_prompt.results)

        tasks: list[HumanVerificationTask] = []
        strata: list[HumanVerificationStratum] = []
        dataset_group_ids: set[str] = set()

        for entry in selected_prompt.results:
            dataset_id = entry.dataset_id
            manifest_payload = self.storage.read_json(entry.manifest_path)
            manifest = ResultManifest.model_validate(manifest_payload)
            if manifest.dataset_group_id:
                dataset_group_ids.add(manifest.dataset_group_id)

            arrays = self.storage.read_score_arrays(
                dataset_id,
                entry.prompt_id,
                revision=entry.result_revision,
            )
            if arrays is None:
                raise FileNotFoundError(f"Saved score arrays are missing for {dataset_id}/{entry.prompt_id}")
            scores, zscores = arrays
            records = self._dataset_records(dataset_id)
            if len(scores) != len(records) or len(zscores) != len(records):
                raise RuntimeError(
                    f"Result array length mismatch for {dataset_id}: "
                    f"records={len(records)}, scores={len(scores)}, zscores={len(zscores)}"
                )

            candidates_by_bucket: list[list[SampleCandidate]] = [[] for _ in range(HUMAN_VERIFY_BUCKET_COUNT)]
            population_by_bucket = [0] * HUMAN_VERIFY_BUCKET_COUNT
            rng_by_bucket = [
                random.Random(f"{seed}:{dataset_id}:{entry.prompt_id}:{bucket}")
                for bucket in range(1, HUMAN_VERIFY_BUCKET_COUNT + 1)
            ]
            for record in records:
                zscore = float(zscores[record.row_index])
                score = float(scores[record.row_index])
                if not isfinite(zscore) or not isfinite(score):
                    continue
                bucket = human_verify_bucket(zscore)
                bucket_index = bucket - 1
                population_by_bucket[bucket_index] += 1
                population = population_by_bucket[bucket_index]
                candidates = candidates_by_bucket[bucket_index]
                # Uniform reservoir sampling keeps memory bounded by the requested sample size.
                replacement_index = (
                    len(candidates)
                    if len(candidates) < request.samples_per_bucket_per_dataset
                    else rng_by_bucket[bucket_index].randrange(population)
                )
                if replacement_index >= request.samples_per_bucket_per_dataset:
                    continue
                candidate = SampleCandidate(
                    record=record,
                    score=score,
                    zscore=zscore,
                    bucket=bucket,
                )
                if replacement_index == len(candidates):
                    candidates.append(candidate)
                else:
                    candidates[replacement_index] = candidate

            city_id = city_id_for_dataset(dataset_id)
            for bucket, candidates in enumerate(candidates_by_bucket, start=1):
                bucket_min, bucket_max = human_verify_bucket_bounds(bucket)
                population = population_by_bucket[bucket - 1]
                sample_count = len(candidates)
                strata.append(
                    HumanVerificationStratum(
                        dataset_id=dataset_id,
                        city_id=city_id,
                        ai_bucket=bucket,
                        bucket_min=bucket_min,
                        bucket_max=bucket_max,
                        population=population,
                        sampled=sample_count,
                    )
                )
                if not sample_count:
                    continue

                for candidate in candidates:
                    tasks.append(
                        HumanVerificationTask(
                            task_id=verification_task_id(
                                dataset_id,
                                entry.prompt_id,
                                candidate.record.row_index,
                                entry.result_revision,
                            ),
                            dataset_id=dataset_id,
                            city_id=city_id,
                            pano_id=candidate.record.pano_id,
                            lon=candidate.record.lon,
                            lat=candidate.record.lat,
                            date=candidate.record.date,
                            prompt_id=entry.prompt_id,
                            result_revision=entry.result_revision,
                            score=candidate.score,
                            zscore=candidate.zscore,
                            ai_bucket=bucket,
                            bucket_min=bucket_min,
                            bucket_max=bucket_max,
                            stratum_population=population,
                            stratum_sample_count=sample_count,
                        )
                    )

        study_id = verification_study_id(prompt, selected_dataset_ids, seed, tasks)
        random.Random(f"{seed}:{study_id}:task-order").shuffle(tasks)
        return HumanVerificationStudy(
            study_id=study_id,
            prompt=prompt,
            samples_per_bucket_per_dataset=request.samples_per_bucket_per_dataset,
            seed=seed,
            dataset_ids=list(selected_dataset_ids),
            dataset_group_id=next(iter(dataset_group_ids)) if len(dataset_group_ids) == 1 else None,
            tasks=tasks,
            strata=strata,
        )

    def _dataset_records(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        records = self._records_by_dataset.get(dataset_id)
        if records is None:
            records = load_pano_records_from_refs(locate_dataset(dataset_id, self.settings))
            self._records_by_dataset[dataset_id] = records
        return records

    def _completed_prompts(self, requested_dataset_ids: tuple[str, ...]) -> tuple[CompletedPrompt, ...]:
        cached = self._completed_prompts_cache.get(requested_dataset_ids)
        if cached is not None:
            return cached
        requested = set(requested_dataset_ids)
        results_by_prompt: dict[str, dict[str, CompletedResultRef]] = {}
        for dataset_id, prompt_id, payload in self.storage.iter_active_manifests():
            if dataset_id not in requested or str(payload.get("query_type") or "text") != "text":
                continue
            prompt = normalize_prompt(str(payload.get("canonical_prompt") or payload.get("prompt") or ""))
            if not prompt:
                continue
            revision = str(payload.get("result_revision") or "").strip() or None
            if not self.storage.score_array_path(dataset_id, prompt_id, revision).exists():
                continue
            if not self.storage.zscore_array_path(dataset_id, prompt_id, revision).exists():
                continue
            results_by_prompt.setdefault(prompt, {})[dataset_id] = CompletedResultRef(
                dataset_id=dataset_id,
                prompt_id=prompt_id,
                manifest_path=self.storage.manifest_path(dataset_id, prompt_id, revision),
                result_revision=revision,
            )
        completed = tuple(
            CompletedPrompt(
                prompt=prompt,
                results=tuple(results[dataset_id] for dataset_id in requested_dataset_ids if dataset_id in results),
            )
            for prompt, results in sorted(results_by_prompt.items())
            if requested.issubset(results)
        )
        self._completed_prompts_cache[requested_dataset_ids] = completed
        return completed


def human_verify_bucket(zscore: float) -> int:
    cutpoints = tuple(
        round(HUMAN_VERIFY_ZSCORE_MIN + HUMAN_VERIFY_BUCKET_WIDTH * index, 10)
        for index in range(1, HUMAN_VERIFY_BUCKET_COUNT)
    )
    return bisect_right(cutpoints, zscore) + 1


def select_completed_prompt(
    completed_prompts: tuple[CompletedPrompt, ...],
    seed: int,
    exclude_prompts: list[str],
    prompt_completion_counts: Mapping[str, int] | None = None,
) -> CompletedPrompt:
    excluded = {normalized for prompt in exclude_prompts if (normalized := normalize_prompt(prompt))}
    selectable = tuple(prompt for prompt in completed_prompts if prompt.prompt not in excluded)
    if not selectable:
        raise LookupError("No alternative completed prompt is available in the configured datasets")

    normalized_counts = {
        normalized: max(0, int(count))
        for prompt, count in (prompt_completion_counts or {}).items()
        if (normalized := normalize_prompt(prompt))
    }
    candidates_with_counts = tuple(
        (prompt, normalized_counts.get(prompt.prompt, 0))
        for prompt in selectable
    )

    # Keep partially rated prompts moving toward a useful sample size before
    # opening untouched prompts. Once every prompt has reached 100 ratings,
    # rebalance in 100-rating tiers: 100-199, then 200-299, and so on.
    priority_pool = tuple(
        prompt for prompt, count in candidates_with_counts if 1 <= count < 100
    )
    if not priority_pool:
        priority_pool = tuple(prompt for prompt, count in candidates_with_counts if count == 0)
    if not priority_pool:
        minimum_tier = min(count // 100 for _prompt, count in candidates_with_counts)
        priority_pool = tuple(
            prompt for prompt, count in candidates_with_counts if count // 100 == minimum_tier
        )

    return random.Random(f"{seed}:prompt-selection").choice(priority_pool)


def human_verify_bucket_bounds(bucket: int) -> tuple[float | None, float | None]:
    if bucket < 1 or bucket > HUMAN_VERIFY_BUCKET_COUNT:
        raise ValueError(f"Bucket must be between 1 and {HUMAN_VERIFY_BUCKET_COUNT}")
    start = None if bucket == 1 else round(HUMAN_VERIFY_ZSCORE_MIN + (bucket - 1) * HUMAN_VERIFY_BUCKET_WIDTH, 10)
    end = None if bucket == HUMAN_VERIFY_BUCKET_COUNT else round(HUMAN_VERIFY_ZSCORE_MIN + bucket * HUMAN_VERIFY_BUCKET_WIDTH, 10)
    return start, end


def verification_task_id(dataset_id: str, prompt_id: str, row_index: int, revision: str | None) -> str:
    raw = f"{dataset_id}\x1f{prompt_id}\x1f{row_index}\x1f{revision or ''}"
    return f"task-{hashlib.blake2b(raw.encode('utf-8'), digest_size=10).hexdigest()}"


def verification_study_id(
    prompt: str,
    dataset_ids: tuple[str, ...],
    seed: int,
    tasks: list[HumanVerificationTask],
) -> str:
    raw = "\x1f".join((prompt, ",".join(dataset_ids), str(seed), *(task.task_id for task in tasks)))
    digest = hashlib.blake2b(raw.encode("utf-8"), digest_size=10).hexdigest()
    return f"human-verify-{digest}"
