"""Small real-embedding smoke check. Execute on RunPod, never on Windows."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-root", type=Path, default=Path("/workspace"))
    parser.add_argument("--data-root", type=Path,
                        default=Path("/workspace/reruns/pano512_8B_q90_20260915_b200/embedding"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--sample-rows", type=int, default=128)
    args = parser.parse_args()
    if sys.platform != "linux":
        parser.error("Backend smoke checks must run on the RunPod Linux environment")
    if not 32 <= args.sample_rows <= 512:
        parser.error("Choose between 32 and 512 smoke-check samples")
    sys.path.insert(0, str(args.backend_root))
    import numpy as np
    from backend.semantic_map.region_matching_compute import (
        Executor, calibrate_blob, fit_pca, project_views, residuals,
    )
    from backend.semantic_map.region_matching_data import (
        AlignedMatrix, DEFAULT_DATASETS, RegionDataset, spatial_weights,
    )

    started = time.perf_counter()
    timings = {}
    datasets, rows_by_city = {}, {}
    for city in ("rome", "london"):
        name = f"{city}_512_8_45_8B"
        dataset = RegionDataset(args.data_root, name, DEFAULT_DATASETS[name])
        if (dataset.view_count, dataset.view_dimension) != (8, 4096):
            raise ValueError("Smoke check expects native eight-view 4096D descriptors")
        # Stratify within the first shard; all input files remain read-only.
        rows = np.unique(np.linspace(0, dataset.shards[0].end - 1,
                                     args.sample_rows, dtype=np.int64))
        rows, excluded = dataset.valid_rows(rows, tuple(range(8)), block_size=32)
        if len(rows) < 32 or excluded:
            raise ValueError("Native smoke samples contain invalid view descriptors")
        datasets[city], rows_by_city[city] = dataset, rows
    timings["metadata_and_samples_seconds"] = time.perf_counter() - started
    source, target = datasets["rome"], datasets["london"]
    source_rows, target_rows = rows_by_city["rome"], rows_by_city["london"]
    weights, _, cells = spatial_weights(source.xy(source_rows), 25)
    matrix = AlignedMatrix(source, source_rows, tuple(range(8)), block_size=32)
    begin = time.perf_counter()
    cpu = fit_pca(matrix, weights, 3, Executor("cpu"))
    timings["cpu_pca_seconds"] = time.perf_counter() - begin
    automatic = Executor("auto")
    begin = time.perf_counter()
    model = fit_pca(matrix, weights, 3, automatic)
    timings["auto_pca_seconds"] = time.perf_counter() - begin
    np.testing.assert_allclose(model.eigenvalues, cpu.eigenvalues, rtol=2e-3, atol=1e-7)
    axis_overlap = np.linalg.svd(cpu.components @ model.components.T, compute_uv=False)
    if float(axis_overlap.min()) < 0.999:
        raise AssertionError("CPU and automatic PCA subspaces disagree")

    def project(dataset, rows):
        parts = [project_views(block, model, tuple(range(8)), automatic)
                 for _, block in dataset.iter_views(rows, block_size=32)]
        return tuple(np.concatenate([part[index] for part in parts]) for index in range(3))

    begin = time.perf_counter()
    projected, dots, norms = project(source, source_rows)
    source_residual = residuals(projected, dots, norms, model.mean)
    profile = calibrate_blob(model, projected, source_residual, weights, [1, 1, 1])
    projected, dots, norms = project(target, target_rows)
    target_residual = residuals(projected, dots, norms, model.mean)
    scores = profile.distances(projected, target_residual)
    timings["projection_and_score_seconds"] = time.perf_counter() - begin
    assert profile.source_coverage >= 0.9 - 1e-12
    assert np.isfinite(scores["compatibility"]).all()
    assert np.all((scores["compatibility"] >= 0) & (scores["compatibility"] <= 1))
    for dataset in datasets.values():
        dataset.assert_unchanged()
    result = {
        "status": "passed", "scope": "bounded_native_embedding_smoke_not_city_search",
        "source_dataset": source.dataset_id, "target_dataset": target.dataset_id,
        "source_rows": len(source_rows), "target_rows": len(target_rows),
        "source_occupied_cells": cells, "joint_dimension": matrix.dimension,
        "compute": automatic.metadata(), "cpu_pca_compute": cpu.compute,
        "auto_pca_compute": model.compute, "minimum_subspace_overlap": float(axis_overlap.min()),
        "retained_variance_fraction": float(model.eigenvalues.sum() / model.total_variance),
        "source_coverage": profile.source_coverage, "target_matched_rows": int(scores["matched"].sum()),
        "target_score_range": [float(scores["compatibility"].min()), float(scores["compatibility"].max())],
        "timings": timings, "total_seconds": time.perf_counter() - started,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
