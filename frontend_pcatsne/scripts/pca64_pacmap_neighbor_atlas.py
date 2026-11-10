"""Global PCA64 and a hard-anchored, multiscale PaCMAP atlas.

The default command prints a plan. Every write/computation needs --execute.
Production data is never loaded by importing this module. See the companion
methodology document for metric, radius semantics, estimates and limitations.
"""
from __future__ import annotations

import argparse
import contextlib
import importlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import time

np = None
DEFAULT_CONFIG = Path(__file__).resolve().parents[1] / "configs/london_4096_pca64_pacmap.json"
EARTH_RADIUS = 6378137.0


def numpy():
    global np
    if np is None:
        np = importlib.import_module("numpy")
    return np


def validate_config(c):
    if (c["views"], c["view_dimensions"], c["combine"], c["feature_scaling"],
            c["pca_dimensions"]) != (8, 4096, "concatenate", "none", 64):
        raise ValueError("This release requires raw 8 x 4096 concatenation and global PCA64")
    if c["planned_scales_km"] != [2, 4, 8, 16, 32]:
        raise ValueError("Expected planned scales 2/4/8/16/32 (32 denotes the whole dataset)")
    if c["default_scales_km"] != [2]:
        raise ValueError("Default execution must remain restricted to 2 km")
    if any(s not in (16, 32) for s in c.get("whole_dataset_scales_km", [])):
        raise ValueError("Whole-dataset fitting is supported at 16 and 32 km")
    if c["pca_device"] not in ("auto", "cpu", "cuda"):
        raise ValueError("pca_device must be auto, cpu or cuda")
    if c["batch_rows"] < 64 or c["pca_power_iterations"] < 0 or c["pca_oversampling"] < 0:
        raise ValueError("Invalid PCA batch/subspace configuration")
    if c["halo_meters"] <= 0 or c["minimum_fit_rows"] < 4:
        raise ValueError("A positive overlap and minimum_fit_rows >= 4 are required")
    if len(c["iterations"]) != 3 or min(c["iterations"]) <= 0:
        raise ValueError("PaCMAP needs three positive iteration phases")
    if c["learning_rate"] <= 0 or c["anchor_init_neighbors"] <= 0:
        raise ValueError("Learning rate and interpolation neighbor count must be positive")
    if c["cross_scale_anchor_count"] < 1:
        raise ValueError("At least one persistent cross-scale reference anchor is required")
    if not 0 <= c["root_gamut_tail"] < 0.5:
        raise ValueError("Invalid root palette tail budget")
    lon, lat = c["center_lon_lat"]
    if not (-180 <= lon <= 180 and -85 < lat < 85):
        raise ValueError("Invalid WebMercator center")


def atomic_json(path, value):
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def atomic_npz(path, **arrays):
    tmp = Path(path).with_name(Path(path).name + ".tmp")
    with tmp.open("wb") as f:
        np.savez_compressed(f, **arrays)
    tmp.replace(path)


def stamp(path):
    stat = path.stat()
    return {"path": str(path.resolve()), "bytes": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def flatten_views(block, views=8, dimensions=4096):
    if block.ndim != 3 or block.shape[1:] != (views, dimensions):
        raise ValueError(f"Expected (N, {views}, {dimensions}), received {block.shape}")
    x = np.asarray(block, dtype=np.float32).reshape(len(block), views * dimensions)
    if not np.isfinite(x).all():
        raise ValueError("Embedding contains non-finite values")
    return x


def inspect_sources(c):
    directory = Path(c["input_dir"])
    pattern = re.compile(r"^views_emb_shard_(\d+)\.npy$")
    paths = [(int(m.group(1)), p) for p in directory.glob("views_emb_shard_*.npy")
             if (m := pattern.match(p.name))]
    paths.sort()
    if not paths:
        raise FileNotFoundError(f"No embedding shards in {directory}; score matrices are not inputs")
    result, offset = [], 0
    for number, p in paths:
        ref = p.with_name(p.stem + "_ref.npy")
        x = np.load(p, mmap_mode="r", allow_pickle=False)
        r = np.load(ref, mmap_mode="r", allow_pickle=False)
        if x.ndim != 3 or x.shape[1:] != (c["views"], c["view_dimensions"]):
            raise ValueError(f"Legacy/wrong embedding shape in {p}: {x.shape}")
        if x.dtype.kind != "f" or r.ndim != 2 or r.shape != (len(x), 5) or not len(x):
            raise ValueError(f"Invalid embedding/reference shard {p}")
        identity = p.with_name(p.stem + "_identity.jsonl")
        result.append({"number": number, "offset": offset, "rows": len(x),
                       "shape": list(x.shape), "dtype": str(x.dtype),
                       "embedding": stamp(p), "reference": stamp(ref),
                       "identity": stamp(identity) if identity.exists() else None})
        offset += len(x)
    return result


def batches(sources, rows):
    for source in sources:
        x = np.load(source["embedding"]["path"], mmap_mode="r", allow_pickle=False)
        for start in range(0, len(x), rows):
            yield source["offset"] + start, flatten_views(x[start:start + rows])


def mercator(lon_lat):
    ll = np.asarray(lon_lat, dtype=np.float64)
    if not np.isfinite(ll).all() or np.any(np.abs(ll[:, 0]) > 180) or np.any(np.abs(ll[:, 1]) >= 85):
        raise ValueError("Invalid panorama lon/lat")
    return np.column_stack((EARTH_RADIUS * np.deg2rad(ll[:, 0]),
                            EARTH_RADIUS * np.log(np.tan(math.pi / 4 + np.deg2rad(ll[:, 1]) / 2))))


def load_references(sources):
    refs = np.empty((sum(s["rows"] for s in sources), 5), dtype=np.float64)
    for s in sources:
        r = np.load(s["reference"]["path"], mmap_mode="r", allow_pickle=False)
        # The native 8B contract permits NaN for unknown heading (column 4).
        if not np.isfinite(r[:, :4]).all() or np.isinf(r[:, 4]).any():
            raise ValueError("Non-finite identity/location/date or infinite heading")
        refs[s["offset"]:s["offset"] + s["rows"]] = r
    return refs


def streaming_pca(factory, dimensions, k, oversampling, power, seed, operator=None, progress=None):
    """Randomized covariance subspace; all rows, no dense D x D covariance.

    factory yields (offset, raw_float32_batch) on every pass. operator permits
    CUDA GEMM without changing the shared metric. Returns approximate PCA,
    with a measured total-variance denominator (not a sample-fit PCA).
    """
    count, mean, energy = 0, np.zeros(dimensions, np.float64), 0.0
    times = []
    started = time.monotonic()
    last_report = started
    if progress:
        progress("Measuring the all-row feature mean and total variance")
    for _, x in factory():
        bmean = x.mean(axis=0, dtype=np.float64)
        delta = bmean - mean
        centered = x.astype(np.float64) - bmean
        energy += float(np.einsum("ij,ij->", centered, centered))
        if count:
            energy += float(delta @ delta) * count * len(x) / (count + len(x))
        mean += delta * len(x) / (count + len(x))
        count += len(x)
        if progress and time.monotonic() - last_report >= 15:
            progress(f"Mean/variance: {count} rows measured")
            last_report = time.monotonic()
    if count <= k or energy <= 0:
        raise ValueError("Insufficient rows or variance for global PCA")
    times.append(time.monotonic() - started)
    width = min(dimensions, count - 1, k + oversampling)
    q = np.linalg.qr(np.random.default_rng(seed).normal(size=(dimensions, width)))[0].astype(np.float32)

    def covariance(q):
        cq = np.zeros(q.shape, np.float64)
        processed, last_report = 0, time.monotonic()
        for _, x in factory():
            xc = x - mean.astype(np.float32)
            cq += (xc.T @ (xc @ q)) if operator is None else operator(xc, q)
            processed += len(x)
            if progress and time.monotonic() - last_report >= 15:
                progress(f"Covariance stream: {processed}/{count} rows")
                last_report = time.monotonic()
        return cq / (count - 1)

    # One range-finding pass plus power refinements, then a Rayleigh pass.
    for iteration in range(power + 1):
        started = time.monotonic()
        if progress:
            progress(f"Covariance subspace pass {iteration + 1}/{power + 1}")
        q = np.linalg.qr(covariance(q))[0].astype(np.float32)
        times.append(time.monotonic() - started)
    started = time.monotonic()
    if progress:
        progress("Measuring the subspace covariance and selecting PCA64")
    cq = covariance(q)
    small = q.T @ cq
    values, vectors = np.linalg.eigh((small + small.T) / 2)
    order = np.argsort(values)[::-1][:k]
    components = (q @ vectors[:, order]).T.astype(np.float32)
    # Fix arbitrary component signs for reproducible initialization.
    signs = np.sign(components[np.arange(k), np.abs(components).argmax(axis=1)])
    components *= signs[:, None]
    times.append(time.monotonic() - started)
    return {"mean": mean, "components": components, "eigenvalues": values[order],
            "total_variance": energy / (count - 1), "rows": count,
            "fit_pass_seconds": np.asarray(times)}


def accelerator(device):
    if device == "cpu":
        return None, None, "cpu"
    try:
        cp = importlib.import_module("cupy")
        if cp.cuda.runtime.getDeviceCount() < 1:
            raise RuntimeError("No CUDA devices")
        def cov(x, q):
            gx, gq = cp.asarray(x), cp.asarray(q)
            return cp.asnumpy(gx.T @ (gx @ gq))
        def project(x, components):
            return cp.asnumpy(cp.asarray(x) @ cp.asarray(components).T)
        return cov, project, "cuda"
    except (ImportError, RuntimeError) as exc:
        if device == "cuda":
            raise RuntimeError("CUDA explicitly requested but unavailable") from exc
        print(f"Global PCA uses CPU: {exc}", flush=True)
        return None, None, "cpu"


def prepare(c, out, sources):
    started = time.monotonic()
    n = sum(s["rows"] for s in sources)
    refs = load_references(sources)
    xy = mercator(refs[:, 1:3])
    operator, projector, device = accelerator(c["pca_device"])
    factory = lambda: batches(sources, c["batch_rows"])
    model = streaming_pca(factory, c["views"] * c["view_dimensions"], c["pca_dimensions"],
                          c["pca_oversampling"], c["pca_power_iterations"], c["seed"], operator,
                          lambda message: print(f"Global PCA ({device}): {message}", flush=True))
    print("Projecting every source row into the shared PCA64 frame", flush=True)
    project_started = time.monotonic()
    last_report = project_started
    tmp = out / "pca64.npy.tmp"
    reduced = np.lib.format.open_memmap(tmp, mode="w+", dtype="float32", shape=(n, 64))
    for offset, x in factory():
        xc = x - model["mean"].astype(np.float32)
        reduced[offset:offset + len(x)] = (xc @ model["components"].T if projector is None
                                           else projector(xc, model["components"]))
        if time.monotonic() - last_report >= 15:
            print(f"Global projection: {offset + len(x)}/{n} rows", flush=True)
            last_report = time.monotonic()
    reduced.flush()
    del reduced
    tmp.replace(out / "pca64.npy")
    atomic_npz(out / "source_rows.npz", reference=refs, xy=xy)
    atomic_npz(out / "global_pca_model.npz", **model)
    if inspect_sources(c) != sources:
        raise RuntimeError("Source files changed during PCA; preparation is not committed")
    atomic_json(out / "prepared.json", {"rows": n, "sources": sources, "device": device,
                "pca_method": "all-row randomized covariance subspace, unwhitened",
                "retained_variance_fraction": float(model["eigenvalues"].sum() / model["total_variance"]),
                "input_dimensions": c["views"] * c["view_dimensions"],
                "passes_including_projection": c["pca_power_iterations"] + 4,
                "fit_pass_seconds": model["fit_pass_seconds"].tolist(),
                "projection_and_metadata_seconds": time.monotonic() - project_started,
                "seconds": time.monotonic() - started})


def grid_patches(xy, center, radius, halo):
    owner = np.floor((xy - center + radius) / (2 * radius)).astype(np.int64)
    cells = {tuple(map(int, row)) for row in owner}
    if (0, 0) not in cells:
        raise ValueError("Central patch has no core rows; set a valid center before execution")
    ordered = sorted(cells, key=lambda p: (abs(p[0]) + abs(p[1]), -p[0], -p[1]))
    result = []
    for gx, gy in ordered:
        point = center + np.array([gx, gy]) * (2 * radius)
        analysis = np.flatnonzero(np.all((xy >= point - radius - halo) & (xy < point + radius + halo), axis=1))
        core = np.all(owner[analysis] == (gx, gy), axis=1)
        result.append((gx, gy, analysis, core))
    return result


def interpolate(x, ax, ay, neighbors=12):
    """Feature-neighbor interpolation in the existing coordinate frame."""
    if not len(ax):
        raise ValueError("Interpolation needs reference coordinates")
    k = min(neighbors, len(ax))
    y = np.empty((len(x), 3), np.float32)
    norms = np.einsum("ij,ij->i", ax, ax)
    for start in range(0, len(x), 256):
        block = x[start:start + 256]
        d = np.maximum(np.einsum("ij,ij->i", block, block)[:, None] + norms[None, :] - 2 * block @ ax.T, 0)
        ids = np.argpartition(d, k - 1, axis=1)[:, :k]
        distances = np.take_along_axis(d, ids, axis=1)
        weights = 1 / np.maximum(distances, 1e-12)
        weights /= weights.sum(axis=1, keepdims=True)
        y[start:start + len(block)] = np.einsum("ij,ijk->ik", weights, ay[ids])
    return y


def anchored_adam(initial, anchor_mask, gradient, weights, phases, lr, observer=None):
    """PaCMAP Adam with persistent exact shared-row positions at every step."""
    y = np.array(initial, dtype=np.float32, order="C", copy=True)
    fixed = y[anchor_mask].copy()
    m, v = np.zeros_like(y), np.zeros_like(y)
    loss = None
    for step in range(sum(phases)):
        wmn, wn, wf = weights(1000.0, step, num_iters=tuple(phases))
        raw = gradient(y, wn, wmn, wf)
        grad = np.asarray(raw[:len(y)], dtype=np.float32).copy()
        loss = float(raw[-1, 0])
        if not np.isfinite(grad).all() or not math.isfinite(loss):
            raise RuntimeError("PaCMAP objective diverged")
        grad[anchor_mask] = 0
        m = .9 * m + .1 * grad
        v = .999 * v + .001 * grad * grad
        rate = lr * math.sqrt(1 - .999 ** (step + 1)) / (1 - .9 ** (step + 1))
        y -= rate * m / (np.sqrt(v) + 1e-7)
        y[anchor_mask] = fixed
        if observer is not None:
            observer(y)
    if not np.isfinite(y).all():
        raise RuntimeError("Non-finite final embedding")
    return y, loss


def pacmap_backend(c):
    version = importlib.metadata.version("pacmap")
    if version != c["pacmap_version"]:
        raise RuntimeError(f"PaCMAP {c['pacmap_version']} required for the gradient adapter; found {version}")
    impl = importlib.import_module("pacmap.pacmap")
    for name in ("PaCMAP", "pacmap_grad", "find_weight"):
        if not hasattr(impl, name):
            raise RuntimeError(f"Unsupported PaCMAP API: {name}")
    if getattr(impl, "faiss", None) is None:
        raise RuntimeError("The pinned PaCMAP adapter requires faiss-cpu")
    return impl


def fit_patch(x, anchor_mask, fixed, c, impl, root_reference=None):
    rng = np.random.default_rng(c["seed"])
    if anchor_mask.any():
        initial = interpolate(x, x[anchor_mask], fixed[anchor_mask], c["anchor_init_neighbors"])
        initial += rng.normal(0, 1e-4, initial.shape).astype(np.float32)
        initial[anchor_mask] = fixed[anchor_mask]
    elif root_reference is not None:
        initial = interpolate(x, *root_reference, c["anchor_init_neighbors"])
    else:
        initial = x[:, :3].copy()
        initial -= initial.mean(axis=0)
        initial *= .01 / max(float(initial.std()), 1e-12)
    if anchor_mask.all():
        return initial, {"method": "all_rows_already_fixed", "loss": None}
    if len(x) < c["minimum_fit_rows"] or (not anchor_mask.any() and root_reference is not None):
        method = "pca_initialization_sparse_root" if root_reference is None and not anchor_mask.any() else "feature_interpolation"
        return initial, {"method": method, "loss": None}
    model = impl.PaCMAP(n_components=3, n_neighbors=c["n_neighbors"],
                        MN_ratio=c["MN_ratio"], FP_ratio=c["FP_ratio"], apply_pca=False,
                        random_state=c["seed"], knn_backend="faiss")
    model.decide_num_pairs(len(x))
    # A single scalar changes neither Euclidean neighbor ordering nor the
    # original concatenation metric; no local per-feature normalization.
    pair_x = np.ascontiguousarray(x / max(float(np.std(x)), 1e-12), dtype=np.float32)
    model.sample_pairs(pair_x, save_tree=False)
    pairs = [np.ascontiguousarray(p, dtype=np.int32) for p in
             (model.pair_neighbors, model.pair_MN, model.pair_FP)]
    gradient = lambda y, wn, wm, wf: impl.pacmap_grad(y, *pairs, wn, wm, wf)
    y, loss = anchored_adam(initial, anchor_mask, gradient, impl.find_weight,
                            c["iterations"], c["learning_rate"])
    return y, {"method": "hard_anchored_pacmap" if anchor_mask.any() else "pacmap",
               "loss": loss, "pair_counts": [len(p) for p in pairs]}


def color_helpers():
    # Reuse the already reviewed Oklab / deterministic gamut policy.
    module = importlib.import_module("experiment_affine_colors")
    return module.lab_to_linear, module.gamut_map


def palette_for_root(y, tail):
    linear, _ = color_helpers()
    origin = np.median(y, axis=0).astype(np.float64)
    delta = y.astype(np.float64) - origin
    high = .25 / max(float(np.std(delta)), 1e-12)
    low = 0.0
    for _ in range(40):
        scale = (low + high) / 2
        lab = delta * scale + np.array([.65, 0, 0])
        lin = linear(lab)
        bad = np.any((lin < 0) | (lin > 1), axis=1) | (lab[:, 0] < .5) | (lab[:, 0] > .8)
        if float(bad.mean()) <= tail:
            low = scale
        else:
            high = scale
    return {"coordinate_origin": origin.tolist(), "uniform_scale": low,
            "oklab_origin": [.65, 0, 0], "policy": "fixed-root-uniform-scale-chroma-contraction-v1"}


def colors(y, palette):
    _, gamut = color_helpers()
    lab = ((y.astype(np.float64) - palette["coordinate_origin"]) * palette["uniform_scale"]
           + palette["oklab_origin"])
    rgb, bad = gamut(lab)
    return rgb, float(bad.mean()) if len(bad) else 0.0


def merge_registry(registry, ids, y):
    shared = np.isfinite(registry[ids, 0])
    if not np.array_equal(registry[ids[shared]], y[shared]):
        raise RuntimeError("Shared coordinates changed; refusing to commit conflicting patch")
    registry[ids[~shared]] = y[~shared]
    return shared


def select_reference_anchors(x, count):
    """Deterministic feature-diverse subset; leave the larger-scale center free."""
    if len(x) <= count:
        return np.arange(len(x))
    centered = x - x.mean(axis=0)
    current = int(np.argmin(np.einsum("ij,ij->i", centered, centered)))
    nearest = np.full(len(x), np.inf)
    chosen = []
    for _ in range(count):
        chosen.append(current)
        delta = x - x[current]
        nearest = np.minimum(nearest, np.einsum("ij,ij->i", delta, delta))
        nearest[chosen] = -1
        current = int(nearest.argmax())
    return np.asarray(chosen, dtype=np.int64)


def neighborhood_recall(x, y, seed, samples=64, neighbors=10):
    """Sampled feature-neighbor recall; anchoring is not a quality score."""
    if len(x) < 2:
        return None
    k = min(neighbors, len(x) - 1)
    queries = np.random.default_rng(seed).choice(len(x), min(samples, len(x)), replace=False)
    recalls = []
    # Bound memory even for the whole-city layer.
    for query in queries:
        dx = np.einsum("ij,ij->i", x - x[query], x - x[query])
        dy = np.einsum("ij,ij->i", y - y[query], y - y[query])
        dx[query] = dy[query] = np.inf
        high = np.argpartition(dx, k - 1)[:k]
        low = np.argpartition(dy, k - 1)[:k]
        recalls.append(len(set(map(int, high)) & set(map(int, low))) / k)
    return {"queries": len(queries), "neighbors": k, "mean_recall": float(np.mean(recalls))}


def load_completed(path, ids, core, registry):
    record = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
    with np.load(path, allow_pickle=False) as saved:
        if not np.array_equal(saved["ids"], ids) or not np.array_equal(saved["core"], core):
            raise RuntimeError(f"Patch membership changed on resume: {path}")
        y = saved["y"].copy()
    if record["rows"] != len(ids) or y.shape != (len(ids), 3) or not np.isfinite(y).all():
        raise RuntimeError(f"Invalid completed patch: {path}")
    merge_registry(registry, ids, y)
    return y


def whole_dataset_scale(c, scale):
    return scale == 32 or scale in c.get("whole_dataset_scales_km", [])


def fit_scales(c, out, scales, impl):
    x = np.load(out / "pca64.npy", mmap_mode="r", allow_pickle=False)
    with np.load(out / "source_rows.npz", allow_pickle=False) as saved:
        xy = saved["xy"].copy()
    center = mercator(np.asarray([c["center_lon_lat"]]))[0]
    root_path = out / "patches/2km/0_0.npz"
    if any(scale != 2 for scale in scales) and 2 not in scales and not root_path.with_suffix(".json").exists():
        raise RuntimeError("Fit 2 km first; larger scales reuse only its central root anchors")
    palette_path = out / "palette.json"
    for scale in sorted(scales):
        directory = out / f"patches/{scale}km"
        directory.mkdir(parents=True, exist_ok=True)
        registry = np.full((len(x), 3), np.nan, np.float32)
        owner = np.full(len(x), -1, np.int32)
        patches = ([(0, 0, np.arange(len(x)), np.ones(len(x), bool))] if whole_dataset_scale(c, scale)
                   else grid_patches(xy, center, scale * 1000, c["halo_meters"]))
        root_ref = None
        if scale != 2:
            with np.load(root_path, allow_pickle=False) as saved:
                root_ids, root_y = saved["ids"].copy(), saved["y"].copy()
            selected = select_reference_anchors(np.asarray(x[root_ids]), c["cross_scale_anchor_count"])
            registry[root_ids[selected]] = root_y[selected]
            owner[root_ids[selected]] = -2
            root_ref = (x[root_ids], root_y)
        patch_records = []
        incomplete_seen = False
        for sequence, (gx, gy, ids, core) in enumerate(patches):
            started = time.monotonic()
            path = directory / f"{gx}_{gy}.npz"
            commit = path.with_suffix(".json")
            shared = np.isfinite(registry[ids, 0])
            prior_owners = sorted(set(map(int, owner[ids[shared]])))
            if commit.exists():
                if incomplete_seen:
                    raise RuntimeError("Resume requires a completed traversal prefix; use a new output directory")
                y = load_completed(path, ids, core, registry)
            else:
                incomplete_seen = True
                print(f"Fitting {scale} km ({gx},{gy}): {len(ids)} rows, {shared.sum()} anchors", flush=True)
                y, stats = fit_patch(np.asarray(x[ids]), shared, registry[ids], c, impl, root_ref)
                merge_registry(registry, ids, y)
                atomic_npz(path, ids=ids, core=core, y=y)
                stats.update({"rows": len(ids), "core_rows": int(core.sum()), "anchors": int(shared.sum()),
                              "anchor_owner_sequences": prior_owners, "max_shared_coordinate_drift": 0.0,
                              "sampled_neighborhood_recall": neighborhood_recall(np.asarray(x[ids]), y, c["seed"]),
                              "seconds": time.monotonic() - started})
                atomic_json(commit, stats)
            owner[ids[~shared]] = sequence
            if scale == 2 and sequence == 0:
                if palette_path.exists():
                    palette = json.loads(palette_path.read_text(encoding="utf-8"))
                else:
                    palette = palette_for_root(y, c["root_gamut_tail"])
                    atomic_json(palette_path, palette)
                root_ref = (x[ids], y)
            elif not palette_path.exists():
                raise RuntimeError("Missing central 2 km palette; fit 2 km first")
            patch_records.append({"grid": [gx, gy], "file": str(path.relative_to(out)),
                                  **json.loads(commit.read_text(encoding="utf-8"))})
        if not np.isfinite(registry).all():
            raise RuntimeError("Some source rows have no atlas coordinates")
        atomic_json(directory / "complete.json", {"scale_km": scale, "rows": len(x),
                    "coverageMode": "whole_dataset" if whole_dataset_scale(c, scale) else "grid",
                    "patches": patch_records, "core_rows": sum(p["core_rows"] for p in patch_records)})


def export_scales(c, out, scales):
    palette = json.loads((out / "palette.json").read_text(encoding="utf-8"))
    prepared = json.loads((out / "prepared.json").read_text(encoding="utf-8"))
    with np.load(out / "source_rows.npz", allow_pickle=False) as data:
        xy, reference = data["xy"].copy(), data["reference"].copy()
    world = 2 * math.pi * EARTH_RADIUS
    map_xy = np.column_stack((.5 + xy[:, 0] / world, .5 - xy[:, 1] / world)).astype(np.float32)
    dtype = np.dtype([("xy", "<f4", (2,)), ("rgba", "u1", (4,))])
    all_bounds = {"west": float(reference[:, 1].min()), "east": float(reference[:, 1].max()),
                  "south": float(reference[:, 2].min()), "north": float(reference[:, 2].max())}
    layers = []
    for scale in sorted(scales):
        info = json.loads((out / f"patches/{scale}km/complete.json").read_text(encoding="utf-8"))
        directory = out / f"viewer_data/{scale}km"
        directory.mkdir(parents=True, exist_ok=True)
        seen = np.zeros(len(xy), bool)
        manifests = []
        group_tmp = directory / "points.bin.tmp"
        with group_tmp.open("wb") as group:
            for patch in info["patches"]:
                with np.load(out / patch["file"], allow_pickle=False) as data:
                    ids, y = data["ids"][data["core"]], data["y"][data["core"]]
                if seen[ids].any():
                    raise RuntimeError("Duplicate core ownership in export")
                seen[ids] = True
                rgb, tail = colors(y, palette)
                points = np.empty(len(ids), dtype=dtype)
                points["xy"], points["rgba"][:, :3], points["rgba"][:, 3] = map_xy[ids], rgb, 255
                gx, gy = patch["grid"]
                pdir = directory / f"{gx}_{gy}"
                pdir.mkdir(exist_ok=True)
                temp = pdir / "points.bin.tmp"
                points.tofile(temp)
                temp.replace(pdir / "points.bin")
                atomic_npz(pdir / "source_rows.npz", ids=ids)
                bounds = {"west": float(reference[ids, 1].min()), "east": float(reference[ids, 1].max()),
                          "south": float(reference[ids, 2].min()), "north": float(reference[ids, 2].max())}
                manifest = {"id": f"{scale}km_{gx}_{gy}", "count": len(ids), "grid": {"x": gx, "y": gy},
                            "radiusMeters": None if whole_dataset_scale(c, scale) else scale * 1000,
                            "bin": "points.bin", "recordBytes": 12, "byteLength": len(ids) * 12,
                            "format": "mercator_xy_float32_rgba_uint8", "bounds": bounds,
                            "colorMatrix": "identity", "gamutMappedFraction": tail}
                atomic_json(pdir / "points.json", manifest)
                group.write(points.tobytes())
                manifests.append({**manifest, "bin": f"{gx}_{gy}/points.bin"})
        if not seen.all():
            raise RuntimeError("Export does not cover every source row exactly once")
        group_tmp.replace(directory / "points.bin")
        layer = {"id": f"{scale}km", "count": len(xy), "bin": "points.bin", "recordBytes": 12,
                 "coverageMode": "whole_dataset" if whole_dataset_scale(c, scale) else "grid",
                 "byteLength": len(xy) * 12, "format": "mercator_xy_float32_rgba_uint8",
                 "colorMatrix": "identity", "patches": manifests, "bounds": all_bounds}
        atomic_json(directory / "points.json", layer)
        layers.append({**layer, "bin": f"{scale}km/points.bin"})
    # Merge existing exports so exporting larger scales later retains 2 km.
    manifest_path = out / "viewer_data/manifest.json"
    previous = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"layers": []}
    merged = {layer["id"]: layer for layer in previous["layers"]}
    merged.update({layer["id"]: layer for layer in layers})
    atomic_json(manifest_path, {"dataset": c["dataset"], "sourceRows": prepared["rows"],
                "centerLonLat": c["center_lon_lat"],
                "plannedScalesKm": c["planned_scales_km"], "readyScalesKm": sorted(int(k[:-2]) for k in merged),
                "palette": palette, "layers": [merged[k] for k in sorted(merged, key=lambda v: int(v[:-2]))]})


@contextlib.contextmanager
def writer_lock(out):
    out.mkdir(parents=True, exist_ok=True)
    path = out / ".pipeline.lock"
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        with os.fdopen(fd, "w") as f:
            f.write(f"pid={os.getpid()}\n")
        yield
    finally:
        path.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--stage", choices=["plan", "prepare", "fit", "export", "run"], default="plan")
    parser.add_argument("--scales", type=int, nargs="+", help="Defaults to 2 only; 32 means whole dataset")
    parser.add_argument("--input-dir", help="Override input directory on the execution machine")
    parser.add_argument("--output-dir", help="Separate atlas destination on the execution machine")
    parser.add_argument("--pca-device", choices=["auto", "cpu", "cuda"])
    parser.add_argument("--execute", action="store_true", help="Explicitly allow computation and writes")
    args = parser.parse_args(argv)
    c = json.loads(args.config.read_text(encoding="utf-8"))
    for key in ("input_dir", "output_dir", "pca_device"):
        if getattr(args, key) is not None:
            c[key] = getattr(args, key)
    validate_config(c)
    scales = sorted(set(args.scales or c["default_scales_km"]))
    if any(s not in c["planned_scales_km"] for s in scales):
        parser.error("Supported scales are 2, 4, 8, 16 and 32")
    if not args.execute or args.stage == "plan":
        print(json.dumps({"mode": "plan_only", "requested_stage": args.stage,
                          "active_scales_km": scales, "configuration": c,
                          "input_dimensions": 32768, "writes": False,
                          "note": "No source loading. Execution requires --execute and a non-plan stage."}, indent=2))
        return 0
    numpy()
    source = Path(c["input_dir"]).resolve()
    out = Path(c["output_dir"]).resolve()
    if source == out or source in out.parents or out in source.parents:
        raise ValueError("Source and output directories must be separate, non-nested trees")
    sources = inspect_sources(c)
    # Preflight the pinned optimizer before the expensive PCA in a combined run.
    impl = pacmap_backend(c) if args.stage in ("fit", "run") else None
    with writer_lock(out):
        config_path = out / "run_config.json"
        if config_path.exists():
            if json.loads(config_path.read_text(encoding="utf-8")) != c:
                raise RuntimeError("Configuration changed; use a new output directory")
        else:
            atomic_json(config_path, c)
        prepared = out / "prepared.json"
        if prepared.exists():
            if json.loads(prepared.read_text(encoding="utf-8"))["sources"] != sources:
                raise RuntimeError("Source provenance changed; use a new output directory")
        elif args.stage in ("prepare", "run"):
            prepare(c, out, sources)
        else:
            raise RuntimeError("Run prepare first")
        if args.stage in ("fit", "run"):
            fit_scales(c, out, scales, impl)
        if args.stage in ("export", "run"):
            export_scales(c, out, scales)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
