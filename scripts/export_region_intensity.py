"""Export cached region PCA scores for an independent map. Run on RunPod only."""
from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
import sys
import time
from dataclasses import replace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--experiment", type=Path, required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--backend-root", type=Path, default=Path("/workspace"))
    parser.add_argument("--aggregation", choices=["calibrated_mean", "axis_product"], default="calibrated_mean")
    parser.add_argument("--data-root", type=Path, default=Path("/workspace/reruns/pano512_8B_q90_20260915_b200/embedding"))
    args = parser.parse_args()
    if sys.platform != "linux":
        parser.error("Numerical exports belong on RunPod, never on Windows")
    import numpy as np
    sys.path.insert(0, str(args.backend_root))
    from backend.semantic_map.region_matching_compute import BlobProfile, PcaModel, calibrate_axis_product, weighted_quantile

    started = time.perf_counter()
    run_dir = args.experiment / "worker" / "runs" / args.run_id
    run = json.loads((run_dir / "manifest.json").read_text())
    profile = json.loads((run_dir / "profile.json").read_text())
    if len(profile["axis_weights"]) != 8 or profile["residual_enabled"]:
        parser.error("This export requires an eight-axis, PCA-only query")
    model_id = run["request"]["model_id"]
    model_dir = args.experiment / "worker" / "models" / model_id
    model = json.loads((model_dir / "manifest.json").read_text())
    pca = PcaModel.load(model_dir / "pca.npz")
    with np.load(model_dir / "source.npz", allow_pickle=False) as z:
        source, source_weights, source_labels = z["projected"].copy(), z["weights"].copy(), z["labels"].copy()
    chunks = sorted(run_dir.glob("points_*.npz"))
    if not chunks:
        raise ValueError("The cached run has no points")
    projected, refs, cached_scores, rows, residual = [], [], [], [], []
    for path in chunks:
        with np.load(path, allow_pickle=False) as z:
            projected.append(z["projected"])
            refs.append(z["refs"])
            cached_scores.append(z["compatibility"])
            rows.append(z["rows"])
            residual.append(z["residual"])
    projected, refs = np.concatenate(projected), np.concatenate(refs)
    cached_scores, rows = np.concatenate(cached_scores), np.concatenate(rows)
    residual = np.concatenate(residual)
    if len(np.unique(rows)) != len(rows) or not np.isfinite(refs[:, 1:3]).all():
        raise ValueError("Invalid cached row identities or coordinates")
    count = len(projected)
    score_bytes = np.empty((255, count), dtype=np.uint8)
    metadata = {}
    max_error = None
    single_axis_max_error = 0.0
    full_product = None
    if args.aggregation == "axis_product":
        raw_weights = np.asarray(run["request"]["axis_weights"] or [1.] * 8)
        if np.any(raw_weights <= 0):
            parser.error("The complete 255-selection product atlas requires positive exponents")
        full_product = calibrate_axis_product(pca, source, source_weights, raw_weights)
    for mask in range(1, 256):
        active = np.array([(mask >> index) & 1 for index in range(8)], dtype=np.float64)
        weights = np.asarray(profile["axis_weights"]) * active
        weights /= weights.sum()
        selected = BlobProfile(weights, np.asarray(profile["effective_variances"]),
                               1, 1, 1, False, 0.9, 0)
        zero_source = np.zeros(len(source))
        source_distance = selected.distances(source, zero_source)["pc_distance"]
        selected.pc_scale = max(float(weighted_quantile(source_distance, source_weights, 0.9)), 1e-6)
        source_joint = selected.distances(source, zero_source)["joint_distance"]
        selected.threshold = max(float(weighted_quantile(source_joint, source_weights, 0.9)), 1e-6)
        legacy_single = selected.distances(projected, np.zeros(count))["compatibility"] if active.sum() == 1 else None
        if full_product is not None:
            exponents = full_product.axis_exponents * active
            selected = replace(full_product, axis_exponents=exponents, axis_weights=exponents / exponents.sum())
            source_joint = selected.distances(source, zero_source)["joint_distance"]
        scored = selected.distances(projected, residual)
        intensity = scored["compatibility"]
        # Floor bins preserve the exact 0.5 envelope boundary at byte 128.
        quantized = np.minimum(np.floor(intensity * 256), 255).astype(np.uint8)
        score_bytes[mask - 1] = quantized
        if full_product is not None and legacy_single is not None and np.all(raw_weights == 1):
            error = float(np.max(np.abs(intensity - legacy_single)))
            single_axis_max_error = max(single_axis_max_error, error)
            if error > 1e-12:
                raise ValueError("Product mode changed an existing single-axis map")
        match_count = int(scored["matched"].sum())
        if int((quantized >= 128).sum()) != match_count:
            raise ValueError("Intensity bins failed to preserve the envelope boundary")
        metadata[str(mask)] = {
            "axes": (np.flatnonzero(active) + 1).tolist(), "weights": weights.tolist(),
            "distance_scale": selected.pc_scale * selected.threshold,
            "source_weighted_coverage": float(source_weights @ (source_joint <= selected.threshold) / source_weights.sum()),
            "matched_points": match_count,
            "histogram": np.bincount(quantized, minlength=256).tolist(),
        }
        if full_product is not None:
            metadata[str(mask)]["axis_exponents"] = selected.axis_exponents.tolist()
        if mask == 255:
            if full_product is None:
                max_error = float(np.max(np.abs(intensity - cached_scores)))
                if max_error > 1e-12:
                    raise ValueError(f"Full-axis map differs from cached query: {max_error}")
            else:
                product_scores = scored
    monotonic_edges = 0
    regions = json.loads((run_dir / "regions.geojson").read_text())
    if full_product is not None:
        for mask in range(1, 256):
            for j in range(8):
                if not (mask & (1 << j)):
                    larger = mask | (1 << j)
                    if np.any(score_bytes[larger - 1] > score_bytes[mask - 1]):
                        raise ValueError("Adding a PCA axis increased product intensity")
                    monotonic_edges += 1
        from backend.semantic_map.region_matching_data import DEFAULT_DATASETS, RegionDataset
        from backend.semantic_map.region_matching_neighborhoods import rank_neighborhoods
        from backend.semantic_map.region_matching_schemas import NeighborhoodRequest
        target_id = run["request"]["target_dataset_id"]
        target = RegionDataset(args.data_root, target_id, DEFAULT_DATASETS[target_id])
        regions = rank_neighborhoods(target, rows, model["source_area_m2"], model["occupied_cells"],
            model["request"]["spatial_cell_m"], full_product.coordinates(source), source_weights,
            source_labels, full_product.coordinates(projected), product_scores, full_product,
            NeighborhoodRequest.model_validate(run["request"]["neighborhoods"]), model["request"]["seed"])
        target.assert_unchanged()
    # Headerless little-endian layout: float64 lon/lat, float64 native pano IDs,
    # then 255 uint8 scores per point (point-major improves compression).
    # No query is scored in the browser.
    payload = refs[:, 1:3].astype("<f8").tobytes() + refs[:, 0].astype("<f8").tobytes() + score_bytes.T.tobytes()
    args.output.mkdir(parents=True, exist_ok=True)
    if full_product is not None:
        (args.output / "product-profile.json").write_text(json.dumps(full_product.metadata(), indent=2), encoding="utf-8")
        (args.output / "product-regions.geojson").write_text(json.dumps(regions), encoding="utf-8")
    compressed = gzip.compress(payload, compresslevel=6, mtime=0)
    (args.output / "intensity.bin.gz").write_bytes(compressed)
    query = json.loads((args.experiment / "query-request.json").read_text())
    result = {
        "format": "region-intensity-masks-v1", "point_count": count,
        "score_order": "point-major",
        "model_id": model_id, "run_id": args.run_id,
        "source_dataset_id": query["model_request"]["source_dataset_id"],
        "target_dataset_id": run["request"]["target_dataset_id"],
        "created_at": run["created_at"],
        "aggregation": args.aggregation,
        "source_label": query["source_label"], "source_center": query["source_center"],
        "source_radius_m": query["source_radius_m"], "source_points": len(source),
        "source_geometry": json.loads((args.experiment / "source.geojson").read_text()),
        "axis_variances": profile["effective_variances"],
        "axis_raw_means": (pca.components @ pca.mean).tolist(),
        "axis_source_stds": np.sqrt(np.asarray(profile["effective_variances"])).tolist(),
        "explained_variance_fraction": model["retained_variance_fraction"],
        "bounds": [[float(refs[:, 1].min()), float(refs[:, 2].min())],
                   [float(refs[:, 1].max()), float(refs[:, 2].max())]],
        "subsets": metadata, "quantization": "floor(256 * intensity), capped at 255; error < 1/256",
        "formula": "I = product_j 2 ** (-axis_exponent_j * t_j**2 / variance_j / fixed_axis_Q90_j)" if full_product is not None else "I = 2 ** ( -sum(w_j * t_j**2 / variance_j) / source_weighted_Q90 )",
        "full_axis_cache_max_error": max_error, "residual_enabled": False,
        "single_axis_parity_max_error": single_axis_max_error,
        "monotonic_subset_edges_checked": monotonic_edges,
        "product_profile": full_product.metadata() if full_product is not None else None,
        "payload_bytes": len(payload), "gzip_bytes": len(compressed),
        "export_seconds": time.perf_counter() - started,
        "regions": regions,
    }
    (args.output / "intensity-manifest.json").write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({key: result[key] for key in ["point_count", "gzip_bytes", "export_seconds", "full_axis_cache_max_error"]}))


if __name__ == "__main__":
    main()
