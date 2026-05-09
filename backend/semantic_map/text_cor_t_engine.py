from __future__ import annotations

import sys
import threading
import time
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from .backend_config import BackendSettings
from .dataset_groups import dataset_group_id_for, scoring_version_for_dataset_group, unique_dataset_ids
from .dataset_loader import DatasetLayout, load_pano_records_from_refs, locate_dataset
from .prompt_ids import make_prompt_id, make_reference_prompt_id, normalize_prompt
from .scoring_engine import SemanticScoringEngine, normalize_reference_dict, reference_prompt_label
from .scoring_models import PanoRecord, PromptScoreResult
from .tile_index import safe_segment


FILTER_TEXTS = (
    "The scene is an indoor space",
    "The scene is an interior space",
    "The image is color-corrupted",
    "The image has chromatic noise",
    "The scene is a tunnel or underground space",
)


@dataclass(frozen=True, slots=True)
class ShardInfo:
    dataset_id: str
    emb_path: Path
    ref_path: Path
    start: int
    end: int
    count: int
    dim: int


class TextCorTScoringEngine(SemanticScoringEngine):
    """
    Extracted T_text_cor_T scoring path.

    Math matches the notebook:
    raw score = mean selected-view cosine(text_emb, view_emb)
    credibility = cached value, or clip(4 - max(filter_zscore), 0, 1)
    score = raw score * credibility
    zscore = (score - global_mean(score)) / global_std(score)
    """

    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings
        if settings.embedding_device not in {"cuda", "cpu_mmap"}:
            raise ValueError("EMBEDDING_DEVICE must be either 'cuda' or 'cpu_mmap'")
        qwen_path = str(settings.qwen_repo_dir)
        if qwen_path not in sys.path:
            sys.path.insert(0, qwen_path)
        self._layouts: dict[str, DatasetLayout] = {}
        self._records: dict[str, tuple[PanoRecord, ...]] = {}
        self._record_indexes: dict[str, dict[str, int]] = {}
        self._shards: dict[str, tuple[ShardInfo, ...]] = {}
        self._embedding_arrays: dict[Path, object] = {}
        self._embedding_tensors: dict[Path, object] = {}
        self._credibility: dict[str, object] = {}
        self._embedder = None
        self._gpu_lock = threading.RLock()

    def warmup(self, dataset_id: str) -> dict[str, float]:
        with self._gpu_lock:
            return self._warmup_unlocked(dataset_id)

    def warmup_datasets(self, dataset_ids: Sequence[str]) -> dict[str, float]:
        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        with self._gpu_lock:
            if len(dataset_ids_tuple) == 1:
                return self._warmup_unlocked(dataset_ids_tuple[0])
            return self._warmup_datasets_unlocked(dataset_ids_tuple, dataset_group_id_for(dataset_ids_tuple))

    def warmup_dataset_group(self, dataset_ids: Sequence[str], dataset_group_id: str | None = None) -> dict[str, float]:
        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        with self._gpu_lock:
            if len(dataset_ids_tuple) == 1:
                return self._warmup_unlocked(dataset_ids_tuple[0])
            return self._warmup_datasets_unlocked(dataset_ids_tuple, group_id)

    def _warmup_unlocked(self, dataset_id: str) -> dict[str, float]:
        timings: dict[str, float] = {}

        stage_start = time.perf_counter()
        self.get_dataset_records(dataset_id)
        add_timing(timings, "warmup_dataset_records", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        shards = self._dataset_shards(dataset_id)
        add_timing(timings, "warmup_shard_metadata", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._get_embedder()
        add_timing(timings, "warmup_model_load", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._embed_texts(("warmup semantic embedding",))
        add_timing(timings, "warmup_text_embedding", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._preload_embedding_tensors(shards)
        add_timing(timings, "warmup_embedding_device_load", time.perf_counter() - stage_start)

        self._load_or_compute_credibility(dataset_id, shards, timings=timings, prefix="warmup_credibility")
        return rounded_timings(timings)

    def _warmup_datasets_unlocked(self, dataset_ids: tuple[str, ...], group_id: str) -> dict[str, float]:
        timings: dict[str, float] = {}

        stage_start = time.perf_counter()
        for dataset_id in dataset_ids:
            self.get_dataset_records(dataset_id)
        add_timing(timings, "warmup_dataset_records", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        _records_by_dataset, _slices, combined_shards = self._combined_dataset_view(dataset_ids)
        add_timing(timings, "warmup_shard_metadata", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._get_embedder()
        add_timing(timings, "warmup_model_load", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._embed_texts(("warmup semantic embedding",))
        add_timing(timings, "warmup_text_embedding", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        self._preload_embedding_tensors(combined_shards)
        add_timing(timings, "warmup_embedding_device_load", time.perf_counter() - stage_start)

        self._load_or_compute_combined_credibility(group_id, combined_shards, timings=timings, prefix="warmup_credibility")
        return rounded_timings(timings)

    def get_dataset_records(self, dataset_id: str) -> tuple[PanoRecord, ...]:
        records = self._records.get(dataset_id)
        if records is not None:
            return records

        layout = self._layout(dataset_id)
        records = load_pano_records_from_refs(layout)
        self._records[dataset_id] = records
        return records

    def _combined_dataset_view(
        self,
        dataset_ids: tuple[str, ...],
    ) -> tuple[dict[str, tuple[PanoRecord, ...]], dict[str, tuple[int, int]], tuple[ShardInfo, ...]]:
        records_by_dataset: dict[str, tuple[PanoRecord, ...]] = {}
        dataset_slices: dict[str, tuple[int, int]] = {}
        combined_shards: list[ShardInfo] = []
        combined_start = 0

        for dataset_id in dataset_ids:
            records = self.get_dataset_records(dataset_id)
            records_by_dataset[dataset_id] = records
            dataset_slices[dataset_id] = (combined_start, combined_start + len(records))
            for shard in self._dataset_shards(dataset_id):
                combined_shards.append(
                    ShardInfo(
                        dataset_id=dataset_id,
                        emb_path=shard.emb_path,
                        ref_path=shard.ref_path,
                        start=combined_start + shard.start,
                        end=combined_start + shard.end,
                        count=shard.count,
                        dim=shard.dim,
                    )
                )
            combined_start += len(records)

        return records_by_dataset, dataset_slices, tuple(combined_shards)

    def score_prompts(self, dataset_id: str, prompts: Sequence[str]) -> tuple[PromptScoreResult, ...]:
        results, _timings = self.score_prompts_with_timings(dataset_id, prompts)
        return results

    def score_prompts_with_timings(self, dataset_id: str, prompts: Sequence[str]) -> tuple[tuple[PromptScoreResult, ...], dict[str, float]]:
        grouped_results, timings = self.score_dataset_group_with_timings((dataset_id,), prompts)
        return grouped_results.get(dataset_id, ()), timings

    def score_dataset_group(
        self,
        dataset_ids: Sequence[str],
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        results, _timings = self.score_dataset_group_with_timings(
            dataset_ids,
            prompts,
            dataset_group_id=dataset_group_id,
            scoring_version=scoring_version,
        )
        return results

    def score_dataset_group_with_timings(
        self,
        dataset_ids: Sequence[str],
        prompts: Sequence[str],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> tuple[dict[str, tuple[PromptScoreResult, ...]], dict[str, float]]:
        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        effective_group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        effective_scoring_version = scoring_version or scoring_version_for_dataset_group(
            self.settings.scoring_version,
            dataset_ids_tuple,
            effective_group_id,
        )
        with self._gpu_lock:
            return self._score_dataset_group_with_timings_unlocked(
                dataset_ids_tuple,
                prompts,
                dataset_group_id=effective_group_id,
                scoring_version=effective_scoring_version,
            )

    def score_pano_references_dataset_group(
        self,
        dataset_ids: Sequence[str],
        references: Sequence[dict],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> dict[str, tuple[PromptScoreResult, ...]]:
        results, _timings = self.score_pano_references_dataset_group_with_timings(
            dataset_ids,
            references,
            dataset_group_id=dataset_group_id,
            scoring_version=scoring_version,
        )
        return results

    def score_pano_references_dataset_group_with_timings(
        self,
        dataset_ids: Sequence[str],
        references: Sequence[dict],
        *,
        dataset_group_id: str | None = None,
        scoring_version: str | None = None,
    ) -> tuple[dict[str, tuple[PromptScoreResult, ...]], dict[str, float]]:
        dataset_ids_tuple = unique_dataset_ids(dataset_ids)
        effective_group_id = dataset_group_id_for(dataset_ids_tuple, dataset_group_id)
        effective_scoring_version = scoring_version or scoring_version_for_dataset_group(
            self.settings.scoring_version,
            dataset_ids_tuple,
            effective_group_id,
        )
        with self._gpu_lock:
            return self._score_pano_references_dataset_group_with_timings_unlocked(
                dataset_ids_tuple,
                references,
                dataset_group_id=effective_group_id,
                scoring_version=effective_scoring_version,
            )

    def _score_pano_references_dataset_group_with_timings_unlocked(
        self,
        dataset_ids: tuple[str, ...],
        references: Sequence[dict],
        *,
        dataset_group_id: str,
        scoring_version: str,
    ) -> tuple[dict[str, tuple[PromptScoreResult, ...]], dict[str, float]]:
        import numpy as np
        import torch

        total_start = time.perf_counter()
        timings: dict[str, float] = {}

        stage_start = time.perf_counter()
        normalized_references = tuple(normalize_reference_dict(reference) for reference in references)
        add_timing(timings, "reference_normalization", time.perf_counter() - stage_start)
        if not normalized_references:
            add_timing(timings, "scoring_total", time.perf_counter() - total_start)
            return {dataset_id: () for dataset_id in dataset_ids}, rounded_timings(timings)

        stage_start = time.perf_counter()
        records_by_dataset, dataset_slices, combined_shards = self._combined_dataset_view(dataset_ids)
        total_records = sum(len(records) for records in records_by_dataset.values())
        add_timing(timings, "dataset_records_cache", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        query_embeddings = [self._reference_embedding(reference["dataset_id"], reference["pano_id"]) for reference in normalized_references]
        query_emb = torch.stack(query_embeddings, dim=0)
        add_timing(timings, "reference_embedding_lookup", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        raw_scores = np.empty((total_records, len(normalized_references)), dtype=np.float32)
        add_timing(timings, "raw_score_allocate", time.perf_counter() - stage_start)

        self._fill_reference_raw_scores(
            combined_shards,
            query_emb,
            raw_scores,
            timings=timings,
            copy_key="reference_embedding_copy",
            compute_key="reference_cosine",
        )

        stage_start = time.perf_counter()
        means, stds = finalize_mean_std(raw_scores)
        zscores = (raw_scores - means[None, :]) / stds[None, :]
        add_timing(timings, "score_adjustment_zscore", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        results_by_dataset: dict[str, list[PromptScoreResult]] = {dataset_id: [] for dataset_id in dataset_ids}
        for reference_index, reference in enumerate(normalized_references):
            reference_metadata = self._reference_metadata(reference)
            prompt = reference_prompt_label(reference_metadata)
            for dataset_id in dataset_ids:
                start, end = dataset_slices[dataset_id]
                records = records_by_dataset[dataset_id]
                prompt_id = make_reference_prompt_id(
                    dataset_id=dataset_id,
                    reference_dataset_id=reference_metadata["dataset_id"],
                    reference_pano_id=reference_metadata["pano_id"],
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                )
                prompt_scores = np.ascontiguousarray(raw_scores[start:end, reference_index], dtype=np.float32)
                prompt_zscores = np.ascontiguousarray(zscores[start:end, reference_index], dtype=np.float32)
                results_by_dataset[dataset_id].append(
                    PromptScoreResult(
                        prompt_id=prompt_id,
                        dataset_id=dataset_id,
                        prompt=prompt,
                        records=records,
                        scores=prompt_scores,
                        zscores=prompt_zscores,
                        score_min=float(prompt_scores.min()),
                        score_max=float(prompt_scores.max()),
                        zscore_min=float(prompt_zscores.min()),
                        zscore_max=float(prompt_zscores.max()),
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                        base_scoring_version=self.settings.scoring_version,
                        query_type="pano_reference",
                        reference_pano=reference_metadata,
                    )
                )

        add_timing(timings, "build_result_rows", time.perf_counter() - stage_start)
        add_timing(timings, "scoring_total", time.perf_counter() - total_start)
        return {dataset_id: tuple(results_by_dataset[dataset_id]) for dataset_id in dataset_ids}, rounded_timings(timings)

    def _score_dataset_group_with_timings_unlocked(
        self,
        dataset_ids: tuple[str, ...],
        prompts: Sequence[str],
        *,
        dataset_group_id: str,
        scoring_version: str,
    ) -> tuple[dict[str, tuple[PromptScoreResult, ...]], dict[str, float]]:
        import numpy as np

        total_start = time.perf_counter()
        timings: dict[str, float] = {}

        stage_start = time.perf_counter()
        normalized_prompts = tuple(normalize_prompt(prompt) for prompt in prompts)
        add_timing(timings, "prompt_normalization", time.perf_counter() - stage_start)
        if not normalized_prompts:
            add_timing(timings, "scoring_total", time.perf_counter() - total_start)
            return {dataset_id: () for dataset_id in dataset_ids}, rounded_timings(timings)

        stage_start = time.perf_counter()
        records_by_dataset, dataset_slices, combined_shards = self._combined_dataset_view(dataset_ids)
        total_records = sum(len(records) for records in records_by_dataset.values())
        add_timing(timings, "dataset_records_cache", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        text_emb = self._embed_texts(normalized_prompts)
        add_timing(timings, "text_embedding", time.perf_counter() - stage_start)

        if len(dataset_ids) == 1:
            credibility = self._load_or_compute_credibility(dataset_ids[0], combined_shards, timings=timings, prefix="credibility")
        else:
            credibility = self._load_or_compute_combined_credibility(
                dataset_group_id,
                combined_shards,
                timings=timings,
                prefix="credibility",
            )

        stage_start = time.perf_counter()
        raw_scores = np.empty((total_records, len(normalized_prompts)), dtype=np.float32)
        add_timing(timings, "raw_score_allocate", time.perf_counter() - stage_start)

        self._fill_raw_scores(
            combined_shards,
            text_emb,
            raw_scores,
            timings=timings,
            copy_key="prompt_embedding_copy",
            compute_key="prompt_cosine",
        )

        stage_start = time.perf_counter()
        raw_scores *= credibility[:, None]
        means, stds = finalize_mean_std(raw_scores)
        zscores = (raw_scores - means[None, :]) / stds[None, :]
        add_timing(timings, "score_adjustment_zscore", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        results_by_dataset: dict[str, list[PromptScoreResult]] = {dataset_id: [] for dataset_id in dataset_ids}
        for prompt_index, prompt in enumerate(normalized_prompts):
            for dataset_id in dataset_ids:
                start, end = dataset_slices[dataset_id]
                records = records_by_dataset[dataset_id]
                prompt_id = make_prompt_id(
                    dataset_id=dataset_id,
                    prompt=prompt,
                    model_version=self.settings.model_version,
                    scoring_version=scoring_version,
                    tile_index_version=self.settings.tile_index_version,
                )
                prompt_scores = np.ascontiguousarray(raw_scores[start:end, prompt_index], dtype=np.float32)
                prompt_zscores = np.ascontiguousarray(zscores[start:end, prompt_index], dtype=np.float32)
                results_by_dataset[dataset_id].append(
                    PromptScoreResult(
                        prompt_id=prompt_id,
                        dataset_id=dataset_id,
                        prompt=prompt,
                        records=records,
                        scores=prompt_scores,
                        zscores=prompt_zscores,
                        score_min=float(prompt_scores.min()),
                        score_max=float(prompt_scores.max()),
                        zscore_min=float(prompt_zscores.min()),
                        zscore_max=float(prompt_zscores.max()),
                        dataset_group_id=dataset_group_id,
                        scoring_version=scoring_version,
                        base_scoring_version=self.settings.scoring_version,
                    )
                )

        add_timing(timings, "build_result_rows", time.perf_counter() - stage_start)
        add_timing(timings, "scoring_total", time.perf_counter() - total_start)
        return {dataset_id: tuple(results_by_dataset[dataset_id]) for dataset_id in dataset_ids}, rounded_timings(timings)

    def _layout(self, dataset_id: str) -> DatasetLayout:
        layout = self._layouts.get(dataset_id)
        if layout is None:
            layout = locate_dataset(dataset_id, self.settings)
            self._layouts[dataset_id] = layout
        return layout

    def _dataset_shards(self, dataset_id: str) -> tuple[ShardInfo, ...]:
        import numpy as np

        cached = self._shards.get(dataset_id)
        if cached is not None:
            return cached

        layout = self._layout(dataset_id)
        shards = []
        start = 0
        for emb_path, ref_path in zip(layout.embedding_paths, layout.ref_paths):
            emb = self._embedding_array(emb_path)
            ref = np.load(ref_path, mmap_mode="r")
            if emb.ndim != 3:
                raise RuntimeError(f"Unexpected emb shape {emb.shape} in {emb_path.name} (expected N,K,D)")
            if ref.shape != (emb.shape[0], 4):
                raise RuntimeError(f"Ref shape mismatch {ref.shape} for {ref_path.name}, expected ({emb.shape[0]},4)")

            count = int(emb.shape[0])
            shards.append(
                ShardInfo(
                    dataset_id=dataset_id,
                    emb_path=emb_path,
                    ref_path=ref_path,
                    start=start,
                    end=start + count,
                    count=count,
                    dim=int(emb.shape[2]),
                )
            )
            start += count

        self._shards[dataset_id] = tuple(shards)
        return tuple(shards)

    def _embedding_array(self, emb_path: Path):
        import numpy as np

        cached = self._embedding_arrays.get(emb_path)
        if cached is not None:
            return cached
        emb = np.load(emb_path, mmap_mode="r")
        self._embedding_arrays[emb_path] = emb
        return emb

    def _preload_embedding_tensors(self, shards: tuple[ShardInfo, ...]) -> None:
        if self.settings.embedding_device != "cuda":
            return
        for shard in shards:
            self._embedding_tensor(shard.emb_path)

    def _embedding_tensor(self, emb_path: Path):
        cached = self._embedding_tensors.get(emb_path)
        if cached is not None:
            return cached

        import numpy as np
        import torch

        if self.settings.embedding_device != "cuda":
            return None
        if not torch.cuda.is_available():
            raise RuntimeError("EMBEDDING_DEVICE=cuda requires CUDA, but torch.cuda.is_available() is false.")

        emb = self._embedding_array(emb_path)
        dtype = getattr(emb, "dtype", None)
        shape = tuple(int(dim) for dim in getattr(emb, "shape", ()))
        estimated_bytes = int(np.prod(shape, dtype=np.int64)) * np.dtype(dtype).itemsize if shape and dtype is not None else 0
        free_bytes, total_bytes = torch.cuda.mem_get_info()
        safety_bytes = 2 * 1024**3
        if estimated_bytes and free_bytes < estimated_bytes + safety_bytes:
            raise RuntimeError(
                "CUDA VRAM OOM while preloading embedding dataset: "
                f"shard={emb_path.name}, shape={shape}, dtype={dtype}, "
                f"need~{format_gib(estimated_bytes)} plus {format_gib(safety_bytes)} safety, "
                f"free={format_gib(free_bytes)}, total={format_gib(total_bytes)}. "
                "This failure is caused by EMBEDDING_DEVICE=cuda loading the full embedding shard into VRAM. "
                "Use a larger GPU, reduce SELECTED_VIEWS/data size, or set EMBEDDING_DEVICE=cpu_mmap."
            )

        try:
            tensor = torch.from_numpy(np.asarray(emb)).to(device="cuda", non_blocking=False)
            tensor = tensor.contiguous()
        except Exception as exc:
            if is_cuda_oom(exc):
                raise RuntimeError(
                    "CUDA VRAM OOM while preloading embedding dataset: "
                    f"shard={emb_path.name}, shape={shape}, dtype={dtype}, "
                    f"estimated={format_gib(estimated_bytes)}, free_before={format_gib(free_bytes)}. "
                    "This failure is caused by EMBEDDING_DEVICE=cuda loading the full embedding shard into VRAM. "
                    "Use a larger GPU, reduce SELECTED_VIEWS/data size, or set EMBEDDING_DEVICE=cpu_mmap."
                ) from exc
            raise
        self._embedding_tensors[emb_path] = tensor
        return tensor

    def _get_embedder(self):
        if self._embedder is not None:
            return self._embedder

        from src.models.qwen3_vl_embedding import Qwen3VLEmbedder

        self._embedder = Qwen3VLEmbedder(model_name_or_path=str(self.settings.model_dir))
        return self._embedder

    def _embed_texts(self, texts: Sequence[str]):
        import torch

        embedder = self._get_embedder()
        batch_inputs = [{"text": text, "instruction": self.settings.text_instruction} for text in texts]
        emb = embedder.process(batch_inputs, normalize=True)
        if not isinstance(emb, torch.Tensor):
            raise TypeError("Qwen embedder did not return a torch.Tensor")

        device = "cuda" if torch.cuda.is_available() else "cpu"
        emb = emb.to(device).detach()
        return (emb / emb.norm(dim=1, keepdim=True).clamp_min(1e-12)).detach()

    def _fill_raw_scores(
        self,
        shards: tuple[ShardInfo, ...],
        text_emb,
        target,
        timings: dict[str, float] | None = None,
        copy_key: str = "embedding_copy",
        compute_key: str = "cosine_similarity",
    ) -> None:
        import numpy as np

        for shard in shards:
            emb_tensor = self._embedding_tensor(shard.emb_path) if self.settings.embedding_device == "cuda" else None
            emb = None if emb_tensor is not None else self._embedding_array(shard.emb_path)
            for local_start in range(0, shard.count, self.settings.scoring_chunk_size):
                local_end = min(shard.count, local_start + self.settings.scoring_chunk_size)
                global_start = shard.start + local_start
                global_end = shard.start + local_end
                stage_start = time.perf_counter()
                if emb_tensor is not None:
                    views = emb_tensor[local_start:local_end]
                    if timings is not None:
                        add_timing(timings, copy_key, time.perf_counter() - stage_start)
                    stage_start = time.perf_counter()
                    target[global_start:global_end] = compute_scores_from_tensor(views, text_emb, self.settings.selected_views)
                else:
                    views_np = np.array(emb[local_start:local_end], copy=True)
                    if timings is not None:
                        add_timing(timings, copy_key, time.perf_counter() - stage_start)
                    stage_start = time.perf_counter()
                    target[global_start:global_end] = compute_scores(views_np, text_emb, self.settings.selected_views)
                if timings is not None:
                    add_timing(timings, compute_key, time.perf_counter() - stage_start)

    def _fill_reference_raw_scores(
        self,
        shards: tuple[ShardInfo, ...],
        query_emb,
        target,
        timings: dict[str, float] | None = None,
        copy_key: str = "embedding_copy",
        compute_key: str = "image_reference_cosine",
    ) -> None:
        import numpy as np

        for shard in shards:
            emb_tensor = self._embedding_tensor(shard.emb_path) if self.settings.embedding_device == "cuda" else None
            emb = None if emb_tensor is not None else self._embedding_array(shard.emb_path)
            for local_start in range(0, shard.count, self.settings.scoring_chunk_size):
                local_end = min(shard.count, local_start + self.settings.scoring_chunk_size)
                global_start = shard.start + local_start
                global_end = shard.start + local_end
                stage_start = time.perf_counter()
                if emb_tensor is not None:
                    views = emb_tensor[local_start:local_end]
                    if timings is not None:
                        add_timing(timings, copy_key, time.perf_counter() - stage_start)
                    stage_start = time.perf_counter()
                    target[global_start:global_end] = compute_reference_scores_from_tensor(views, query_emb, self.settings.selected_views)
                else:
                    views_np = np.array(emb[local_start:local_end], copy=True)
                    if timings is not None:
                        add_timing(timings, copy_key, time.perf_counter() - stage_start)
                    stage_start = time.perf_counter()
                    target[global_start:global_end] = compute_reference_scores(views_np, query_emb, self.settings.selected_views)
                if timings is not None:
                    add_timing(timings, compute_key, time.perf_counter() - stage_start)

    def _reference_embedding(self, dataset_id: str, pano_id: str):
        import numpy as np
        import torch

        record = self._record_for_pano(dataset_id, pano_id)
        row_index = record.row_index
        for shard in self._dataset_shards(dataset_id):
            if shard.start <= row_index < shard.end:
                local_index = row_index - shard.start
                if self.settings.embedding_device == "cuda":
                    emb_tensor = self._embedding_tensor(shard.emb_path)
                    if emb_tensor is None:
                        raise RuntimeError("CUDA embedding tensor is unavailable.")
                    query = emb_tensor[local_index].detach()
                else:
                    emb = self._embedding_array(shard.emb_path)
                    device = "cuda" if torch.cuda.is_available() else "cpu"
                    query = torch.from_numpy(np.array(emb[local_index], copy=True)).to(device=device, non_blocking=True).detach()
                if query.dtype not in (torch.float16, torch.float32, torch.bfloat16):
                    query = query.to(torch.float32)
                return (query.float() / query.float().norm(dim=1, keepdim=True).clamp_min(1e-12)).detach()
        raise RuntimeError(f"Reference pano {pano_id} row {row_index} was not found in dataset shards for {dataset_id}.")

    def _record_for_pano(self, dataset_id: str, pano_id: str) -> PanoRecord:
        records = self.get_dataset_records(dataset_id)
        index = self._record_indexes.get(dataset_id)
        if index is None:
            index = {record.pano_id: offset for offset, record in enumerate(records)}
            self._record_indexes[dataset_id] = index
        offset = index.get(str(pano_id))
        if offset is None:
            raise ValueError(f"Reference pano {pano_id} was not found in dataset {dataset_id}.")
        return records[offset]

    def _reference_metadata(self, reference: dict) -> dict:
        record = self._record_for_pano(reference["dataset_id"], reference["pano_id"])
        metadata = dict(reference)
        metadata.setdefault("lon", record.lon)
        metadata.setdefault("lat", record.lat)
        if record.date is not None:
            metadata.setdefault("date", record.date)
        return metadata

    def _load_or_compute_credibility(
        self,
        dataset_id: str,
        shards: tuple[ShardInfo, ...],
        timings: dict[str, float] | None = None,
        prefix: str = "credibility",
    ):
        import numpy as np

        stage_start = time.perf_counter()
        cached = self._credibility.get(dataset_id)
        if cached is not None:
            if timings is not None:
                add_timing(timings, f"{prefix}_cache", time.perf_counter() - stage_start)
            return cached

        stage_start = time.perf_counter()
        cred_dir = self._credibility_dir(dataset_id)
        cred_paths = [cred_path_from_emb_path(cred_dir, shard.emb_path) for shard in shards]
        if timings is not None:
            add_timing(timings, f"{prefix}_path_check", time.perf_counter() - stage_start)

        if all(path.exists() for path in cred_paths):
            stage_start = time.perf_counter()
            chunks = []
            for shard, path in zip(shards, cred_paths):
                chunk = np.load(path, mmap_mode="r")
                if chunk.shape != (shard.count,):
                    raise RuntimeError(f"Credibility shape mismatch {chunk.shape} for {path.name}, expected ({shard.count},)")
                chunks.append(np.asarray(chunk, dtype=np.float32))
            credibility = np.concatenate(chunks).astype(np.float32, copy=False)
            if timings is not None:
                add_timing(timings, f"{prefix}_load", time.perf_counter() - stage_start)
            self._credibility[dataset_id] = credibility
            return credibility

        credibility = self._compute_and_save_credibility(cred_dir, shards, timings=timings, prefix=prefix)
        self._credibility[dataset_id] = credibility
        return credibility

    def _load_or_compute_combined_credibility(
        self,
        dataset_group_id: str,
        shards: tuple[ShardInfo, ...],
        timings: dict[str, float] | None = None,
        prefix: str = "credibility",
    ):
        import numpy as np

        cache_key = f"group:{dataset_group_id}"
        stage_start = time.perf_counter()
        cached = self._credibility.get(cache_key)
        if cached is not None:
            if timings is not None:
                add_timing(timings, f"{prefix}_cache", time.perf_counter() - stage_start)
            return cached

        stage_start = time.perf_counter()
        cred_dir = self._combined_credibility_dir(dataset_group_id)
        cred_paths = [self._combined_cred_path(cred_dir, shard) for shard in shards]
        if timings is not None:
            add_timing(timings, f"{prefix}_path_check", time.perf_counter() - stage_start)

        if all(path.exists() for path in cred_paths):
            stage_start = time.perf_counter()
            chunks = []
            for shard, path in zip(shards, cred_paths):
                chunk = np.load(path, mmap_mode="r")
                if chunk.shape != (shard.count,):
                    raise RuntimeError(f"Combined credibility shape mismatch {chunk.shape} for {path.name}, expected ({shard.count},)")
                chunks.append(np.asarray(chunk, dtype=np.float32))
            credibility = np.concatenate(chunks).astype(np.float32, copy=False)
            if timings is not None:
                add_timing(timings, f"{prefix}_load", time.perf_counter() - stage_start)
            self._credibility[cache_key] = credibility
            return credibility

        credibility = self._compute_and_save_combined_credibility(cred_dir, shards, timings=timings, prefix=prefix)
        self._credibility[cache_key] = credibility
        return credibility

    def _compute_and_save_combined_credibility(
        self,
        cred_dir: Path,
        shards: tuple[ShardInfo, ...],
        timings: dict[str, float] | None = None,
        prefix: str = "credibility",
    ):
        import numpy as np

        stage_start = time.perf_counter()
        filter_emb = self._embed_texts(FILTER_TEXTS)
        if timings is not None:
            add_timing(timings, f"{prefix}_filter_embedding", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        total_count = sum(shard.count for shard in shards)
        raw_filter_scores = np.empty((total_count, len(FILTER_TEXTS)), dtype=np.float32)
        if timings is not None:
            add_timing(timings, f"{prefix}_allocate", time.perf_counter() - stage_start)

        self._fill_raw_scores(
            shards,
            filter_emb,
            raw_filter_scores,
            timings=timings,
            copy_key=f"{prefix}_embedding_copy",
            compute_key=f"{prefix}_cosine",
        )

        stage_start = time.perf_counter()
        filter_means, filter_stds = finalize_mean_std(raw_filter_scores)
        filter_zscores = (raw_filter_scores - filter_means[None, :]) / filter_stds[None, :]
        max_filter_zscore = filter_zscores.max(axis=1)
        credibility = np.clip(4.0 - max_filter_zscore, 0.0, 1.0).astype(np.float32, copy=False)
        if timings is not None:
            add_timing(timings, f"{prefix}_zscore_clip", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        for shard in shards:
            path = self._combined_cred_path(cred_dir, shard)
            path.parent.mkdir(parents=True, exist_ok=True)
            np.save(path, credibility[shard.start:shard.end])
        if timings is not None:
            add_timing(timings, f"{prefix}_save", time.perf_counter() - stage_start)

        return credibility

    def _compute_and_save_credibility(
        self,
        cred_dir: Path,
        shards: tuple[ShardInfo, ...],
        timings: dict[str, float] | None = None,
        prefix: str = "credibility",
    ):
        import numpy as np

        stage_start = time.perf_counter()
        filter_emb = self._embed_texts(FILTER_TEXTS)
        if timings is not None:
            add_timing(timings, f"{prefix}_filter_embedding", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        total_count = sum(shard.count for shard in shards)
        raw_filter_scores = np.empty((total_count, len(FILTER_TEXTS)), dtype=np.float32)
        if timings is not None:
            add_timing(timings, f"{prefix}_allocate", time.perf_counter() - stage_start)

        self._fill_raw_scores(
            shards,
            filter_emb,
            raw_filter_scores,
            timings=timings,
            copy_key=f"{prefix}_embedding_copy",
            compute_key=f"{prefix}_cosine",
        )

        stage_start = time.perf_counter()
        filter_means, filter_stds = finalize_mean_std(raw_filter_scores)
        filter_zscores = (raw_filter_scores - filter_means[None, :]) / filter_stds[None, :]
        max_filter_zscore = filter_zscores.max(axis=1)
        credibility = np.clip(4.0 - max_filter_zscore, 0.0, 1.0).astype(np.float32, copy=False)
        if timings is not None:
            add_timing(timings, f"{prefix}_zscore_clip", time.perf_counter() - stage_start)

        stage_start = time.perf_counter()
        cred_dir.mkdir(parents=True, exist_ok=True)
        for shard in shards:
            np.save(cred_path_from_emb_path(cred_dir, shard.emb_path), credibility[shard.start:shard.end])
        if timings is not None:
            add_timing(timings, f"{prefix}_save", time.perf_counter() - stage_start)

        return credibility

    def _credibility_dir(self, dataset_id: str) -> Path:
        return self._layout(dataset_id).dataset_dir / "credibility_cache"

    def _combined_credibility_dir(self, dataset_group_id: str) -> Path:
        return self.settings.result_root.parent / "credibility_cache" / safe_segment(dataset_group_id)

    def _combined_cred_path(self, cred_dir: Path, shard: ShardInfo) -> Path:
        return cred_dir / safe_segment(shard.dataset_id) / f"{shard.emb_path.stem}_cred.npy"


def finalize_mean_std(x):
    import numpy as np

    mean = x.mean(axis=0, dtype=np.float64).astype(np.float32)
    std = x.std(axis=0, dtype=np.float64).astype(np.float32) + 1e-12
    return mean, std


def add_timing(timings: dict[str, float], key: str, elapsed: float) -> None:
    timings[key] = timings.get(key, 0.0) + elapsed


def rounded_timings(timings: dict[str, float]) -> dict[str, float]:
    return {key: round(value, 3) for key, value in timings.items()}


def format_gib(byte_count: int) -> str:
    return f"{byte_count / 1024**3:.2f} GiB"


def is_cuda_oom(exc: Exception) -> bool:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    return "outofmemory" in name or ("cuda" in message and "out of memory" in message)


def cred_path_from_emb_path(cred_dir: Path, emb_path: Path) -> Path:
    return cred_dir / f"{emb_path.stem}_cred.npy"


def compute_scores(views_chunk_np, text_emb, selected_views: tuple[int, ...]):
    import torch

    with torch.no_grad():
        device = text_emb.device
        views = torch.from_numpy(views_chunk_np).to(device=device, non_blocking=True)
        if views.dtype not in (torch.float16, torch.float32, torch.bfloat16):
            views = views.to(torch.float16 if device.type == "cuda" else torch.float32)

        if selected_views:
            selected = [view for view in selected_views if 0 <= view < views.shape[1]]
            if not selected:
                raise RuntimeError(f"No selected views are valid for embedding shape {tuple(views.shape)}")
            views = views[:, selected, :]

        batch_size, view_count, dim = views.shape
        flat_views = views.reshape(batch_size * view_count, dim)
        flat_scores = flat_views.float() @ text_emb.float().T
        scores = flat_scores.reshape(batch_size, view_count, text_emb.shape[0]).mean(dim=1)
        return scores.float().cpu().numpy()


def compute_scores_from_tensor(views, text_emb, selected_views: tuple[int, ...]):
    import torch

    with torch.no_grad():
        if selected_views:
            selected = [view for view in selected_views if 0 <= view < views.shape[1]]
            if not selected:
                raise RuntimeError(f"No selected views are valid for embedding shape {tuple(views.shape)}")
            views = views[:, selected, :]

        batch_size, view_count, dim = views.shape
        flat_views = views.reshape(batch_size * view_count, dim)
        flat_scores = flat_views.float() @ text_emb.float().T
        scores = flat_scores.reshape(batch_size, view_count, text_emb.shape[0]).mean(dim=1)
        return scores.float().cpu().numpy()


def compute_reference_scores(views_chunk_np, query_emb, selected_views: tuple[int, ...]):
    import torch

    with torch.no_grad():
        device = query_emb.device
        views = torch.from_numpy(views_chunk_np).to(device=device, non_blocking=True)
        if views.dtype not in (torch.float16, torch.float32, torch.bfloat16):
            views = views.to(torch.float16 if device.type == "cuda" else torch.float32)
        return compute_reference_scores_from_tensor(views, query_emb, selected_views)


def compute_reference_scores_from_tensor(views, query_emb, selected_views: tuple[int, ...]):
    import torch

    with torch.no_grad():
        query = query_emb.to(device=views.device, non_blocking=True) if query_emb.device != views.device else query_emb
        view_limit = min(int(views.shape[1]), int(query.shape[1]))
        if view_limit <= 0:
            raise RuntimeError(f"No view embeddings are available for shapes views={tuple(views.shape)}, query={tuple(query.shape)}")
        if selected_views:
            selected = [view for view in selected_views if 0 <= view < view_limit]
            if not selected:
                raise RuntimeError(f"No selected views are valid for embedding shapes views={tuple(views.shape)}, query={tuple(query.shape)}")
            views = views[:, selected, :]
            query = query[:, selected, :]
        else:
            views = views[:, :view_limit, :]
            query = query[:, :view_limit, :]

        batch_size, view_count, _dim = views.shape
        scores = torch.zeros((batch_size, query.shape[0]), device=views.device, dtype=torch.float32)
        views_float = views.float()
        query_float = query.float()
        for view_index in range(view_count):
            scores += views_float[:, view_index, :] @ query_float[:, view_index, :].T
        scores /= max(view_count, 1)
        return scores.float().cpu().numpy()
