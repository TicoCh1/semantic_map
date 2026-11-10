"""A separately enabled RunPod worker. Existing scoring services never import it."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import threading
import time
from uuid import uuid4

import numpy as np

from .region_matching_compute import (ALGORITHM_VERSION, REPRESENTATION, Cancelled,
                                      Executor, PcaModel, calibrate_blob, fit_pca, project_views, residuals,
                                      weighted_quantile)
from .region_matching_data import (DEFAULT_DATASETS, AlignedMatrix, DatasetSpec, RegionDataset,
                                   spatial_weights, validate_geometry)
from .region_matching_neighborhoods import rank_neighborhoods
from .region_matching_schemas import ModelRequest, RunRequest


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, value):
    temporary = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, allow_nan=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def atomic_npz(path: Path, **arrays):
    temporary = path.with_name(path.name + "." + uuid4().hex + ".tmp")
    with temporary.open("wb") as handle:
        np.savez(handle, **arrays)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


@dataclass
class RegionConfig:
    data_root: Path
    output_root: Path
    enabled: bool = False
    token: str = ""
    block_size: int = 512
    max_source_rows: int = 50_000
    max_centers: int = 200_000
    queue_size: int = 8
    memory_budget_bytes: int = 3 * 1024**3
    datasets: dict[str, DatasetSpec] = field(default_factory=lambda: dict(DEFAULT_DATASETS))

    def __post_init__(self):
        self.data_root = Path(self.data_root).resolve()
        self.output_root = Path(self.output_root).resolve()
        if self.output_root == self.data_root or self.output_root.is_relative_to(self.data_root):
            raise ValueError("Region output must be outside the read-only embedding root")
        if not 1 <= self.block_size <= 2048 or min(self.max_source_rows, self.max_centers, self.queue_size) < 1:
            raise ValueError("Invalid worker resource limits")
        if self.enabled and not self.token:
            raise ValueError("Configure REGION_MATCHING_TOKEN before enabling expensive research jobs")

    @classmethod
    def from_env(cls):
        return cls(
            data_root=Path(os.getenv("REGION_MATCHING_DATA_ROOT", os.getenv("DATA_ROOT",
                "/workspace/reruns/pano512_8B_q90_20260915_b200/embedding"))),
            output_root=Path(os.getenv("REGION_MATCHING_ROOT", "/workspace/semantic_backend/region_matching")),
            enabled=os.getenv("REGION_MATCHING_ENABLED", "false").lower() in {"1", "true", "yes"},
            token=os.getenv("REGION_MATCHING_TOKEN", ""),
            block_size=int(os.getenv("REGION_MATCHING_BLOCK_SIZE", "512")),
            max_source_rows=int(os.getenv("REGION_MATCHING_MAX_SOURCE_ROWS", "50000")),
            max_centers=int(os.getenv("REGION_MATCHING_MAX_CENTERS", "200000")),
        )


class RegionMatchingService:
    def __init__(self, config: RegionConfig):
        if not config.enabled:
            raise RuntimeError("Region matching is disabled")
        self.config = config
        self.root = config.output_root
        self.lock = threading.RLock()
        self.events: dict[str, threading.Event] = {}
        self.stage_started: dict[str, float] = {}
        self.unpersisted_failures: dict[str, dict] = {}
        self.queue_slots = threading.BoundedSemaphore(config.queue_size)
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="region-matching")
        self.closed = False
        for kind in ("models", "runs", "projections"):
            (self.root / kind).mkdir(parents=True, exist_ok=True)
        # A factory must use a single server process for this worker root.
        # Cross-process ownership is enforced for the entire service lifetime.
        self._lease = (self.root / "worker.lock").open("a+b")
        try:
            import fcntl
            fcntl.flock(self._lease.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except Exception:
            self._lease.close()
            self.pool.shutdown(wait=False)
            raise RuntimeError("Region worker requires Linux and exclusive ownership of its output root")
        try:
            for kind in ("models", "runs"):
                for path in (self.root / kind).glob("*/manifest.json"):
                    data = json.loads(path.read_text(encoding="utf-8"))
                    if data.get("status") not in {"ready", "failed", "cancelled"}:
                        data.update(status="failed", error="Worker interrupted; submit a new job", updated_at=utc_now())
                        atomic_json(path, data)
        except Exception:
            self._lease.close()
            self.pool.shutdown(wait=False)
            raise

    def close(self):
        with self.lock:
            self.closed = True
            for event in self.events.values():
                event.set()
        self.pool.shutdown(wait=True)
        self._lease.close()

    def _path(self, identifier, kind):
        prefix = "model" if kind == "models" else "run"
        if not re.fullmatch(prefix + r"_[a-f0-9]{32}", identifier):
            raise ValueError("Invalid job identifier")
        return self.root / kind / identifier

    def status(self, identifier, kind):
        path = self._path(identifier, kind) / "manifest.json"
        with self.lock:
            if identifier in self.unpersisted_failures:
                return dict(self.unpersisted_failures[identifier])
        if not path.is_file():
            raise FileNotFoundError("Job not found")
        return json.loads(path.read_text(encoding="utf-8"))

    def _update(self, identifier, kind, **changes):
        with self.lock:
            data = self.status(identifier, kind)
            if "status" in changes and changes["status"] != data["status"]:
                now = time.perf_counter()
                previous = self.stage_started.get(identifier)
                if previous is not None:
                    timings = data.setdefault("stage_timings_seconds", {})
                    timings[data["status"]] = timings.get(data["status"], 0) + now - previous
                self.stage_started[identifier] = now
            data.update(changes, updated_at=utc_now())
            atomic_json(self._path(identifier, kind) / "manifest.json", data)

    def cancel(self, identifier, kind):
        with self.lock:
            data = self.status(identifier, kind)
            event = self.events.get(identifier)
            active = event is not None and data["status"] not in {"ready", "failed", "cancelled"}
            if active:
                event.set()
            return {"id": identifier, "status": data["status"],
                    "cancellation_requested": active}

    def check(self, identifier):
        if self.events[identifier].is_set():
            raise Cancelled("Cancellation requested")

    def _dataset(self, identifier):
        spec = self.config.datasets.get(identifier)
        if spec is None:
            raise ValueError("Dataset is not in the region-matching allowlist")
        return RegionDataset(self.config.data_root, identifier, spec)

    def _enqueue(self, kind, request, operation):
        with self.lock:
            if self.closed:
                raise RuntimeError("Worker is shutting down")
            if not self.queue_slots.acquire(blocking=False):
                raise RuntimeError("Region queue is full")
            identifier = ("model_" if kind == "models" else "run_") + uuid4().hex
            try:
                directory = self._path(identifier, kind)
                directory.mkdir()
                manifest = {"id": identifier, "status": "queued", "algorithm_version": ALGORITHM_VERSION,
                            "representation": REPRESENTATION, "created_at": utc_now(), "updated_at": utc_now(),
                            "request": request.model_dump(mode="json"), "artifacts": []}
                atomic_json(directory / "manifest.json", manifest)
                self.events[identifier] = threading.Event()
                self.stage_started[identifier] = time.perf_counter()
                self.pool.submit(self._work, identifier, kind, request, operation)
            except Exception:
                self.queue_slots.release()
                self.events.pop(identifier, None)
                self.stage_started.pop(identifier, None)
                raise
        return manifest

    def submit_model(self, request: ModelRequest):
        if request.source_dataset_id not in self.config.datasets:
            raise ValueError("Source dataset is not allowed")
        validate_geometry(request.source_geometry)
        return self._enqueue("models", request, self._fit)

    def submit_run(self, request: RunRequest):
        model = self.status(request.model_id, "models")
        if model["status"] != "ready":
            raise ValueError("Source model is not ready")
        if request.target_dataset_id not in self.config.datasets:
            raise ValueError("Target dataset is not allowed")
        if request.selected_components > model["fitted_components"]:
            raise ValueError("Requested PCA axes exceed the fitted model")
        return self._enqueue("runs", request, self._match)

    def _work(self, identifier, kind, request, operation):
        start = time.perf_counter()
        try:
            self.check(identifier)
            result = operation(identifier, request)
            with self.lock:
                self.check(identifier)
                self._update(identifier, kind, status="ready", elapsed_seconds=time.perf_counter() - start, **result)
        except Cancelled as exc:
            self._terminal_error(identifier, kind, status="cancelled", error=str(exc),
                                 elapsed_seconds=time.perf_counter() - start)
        except Exception as exc:
            self._terminal_error(identifier, kind, status="failed", error=f"{type(exc).__name__}: {exc}",
                                 elapsed_seconds=time.perf_counter() - start)
        finally:
            with self.lock:
                self.events.pop(identifier, None)
                self.stage_started.pop(identifier, None)
            self.queue_slots.release()

    def _terminal_error(self, identifier, kind, **failure):
        try:
            self._update(identifier, kind, **failure)
        except OSError as storage_error:
            # Disk exhaustion must remain visible to polling clients even when
            # a durable failure or cancellation manifest cannot be written.
            with self.lock:
                current = self.status(identifier, kind)
                current.update(failure, failure_manifest_error=str(storage_error), updated_at=utc_now())
                if len(self.unpersisted_failures) >= 128:
                    self.unpersisted_failures.pop(next(iter(self.unpersisted_failures)))
                self.unpersisted_failures[identifier] = current

    def _project(self, identifier, dataset, rows, views, model, executor):
        projected = np.empty((len(rows), len(model.components)), dtype=np.float32)
        mean_dots, norms = np.empty(len(rows), dtype=np.float64), np.empty(len(rows), dtype=np.float64)
        for positions, block in dataset.iter_views(rows, self.config.block_size):
            self.check(identifier)
            projected[positions], mean_dots[positions], norms[positions] = project_views(block, model, views, executor)
        return projected, mean_dots, norms

    def _fit(self, identifier, request):
        directory = self._path(identifier, "models")
        check = lambda: self.check(identifier)
        self._update(identifier, "models", status="selecting_source")
        dataset = self._dataset(request.source_dataset_id)
        rows = dataset.polygon_rows(request.source_geometry, request.source_date_range)
        if len(rows) > self.config.max_source_rows:
            raise ValueError(f"Selection has {len(rows)} rows; source limit is {self.config.max_source_rows}")
        AlignedMatrix(dataset, rows, request.selected_views)  # Validate view slots before loading payloads.
        raw_count = len(rows)
        rows, excluded = dataset.valid_rows(rows, tuple(request.selected_views), self.config.block_size, check)
        xy = dataset.xy(rows)
        weights, labels, cells = spatial_weights(xy, request.spatial_cell_m)
        maximum = min(32, cells // 5, len(rows) - 1, len(request.selected_views) * dataset.view_dimension)
        count = maximum if request.fit_components == "auto" else request.fit_components
        if cells < max(30, 5 * count) or not 1 <= count <= maximum:
            raise ValueError(f"Insufficient source support: {cells} occupied cells, {len(rows)} rows, maximum {maximum} axes")
        matrix = AlignedMatrix(dataset, rows, request.selected_views, self.config.block_size, check)
        width = min(count + 8, matrix.count, matrix.dimension)
        estimated = 8 * self.config.block_size * matrix.dimension * 4 + 8 * width * (matrix.count + matrix.dimension) * 4
        if estimated > self.config.memory_budget_bytes:
            raise ValueError("PCA buffers exceed worker memory budget; reduce block size")
        executor = Executor(request.compute_device)
        self._update(identifier, "models", status="fitting_pca", selected_rows=len(rows), occupied_cells=cells)
        model = fit_pca(matrix, weights, count, executor, request.seed, check=check,
                        allow_rank_reduction=request.fit_components == "auto")
        count = len(model.components)
        self._update(identifier, "models", status="projecting_source")
        projected, dots, norms = self._project(identifier, dataset, rows, tuple(request.selected_views), model, executor)
        residuals(projected, dots, norms, model.mean)
        dataset.assert_unchanged()
        check()
        atomic_npz(directory / "pca.npz", mean=model.mean, components=model.components,
                   eigenvalues=model.eigenvalues, total_variance=np.asarray(model.total_variance))
        atomic_npz(directory / "source.npz", rows=rows, weights=weights, labels=labels,
                   projected=projected, mean_dots=dots, norms=norms)
        atomic_json(directory / "exclusions.json", excluded)
        examples = []
        for axis in range(count):
            quantiles = np.asarray([0.05, 0.5, 0.95])
            levels = weighted_quantile(projected[:, axis], weights, quantiles)
            examples.append({"axis": axis + 1, "examples": [
                {"quantile": float(q), "coordinate": float(level),
                 "point": dataset.identity(rows[int(np.argmin(np.abs(projected[:, axis] - level)))])}
                for q, level in zip(quantiles, levels)]})
        return {"source_snapshot": dataset.snapshot(), "selected_views": request.selected_views,
                "fitted_components": count, "source_rows": len(rows), "raw_source_rows": raw_count,
                "excluded_rows": len(excluded), "occupied_cells": cells,
                "effective_rows": float(1 / np.sum(weights ** 2)),
                "source_area_m2": dataset.polygon_area(request.source_geometry), "metric_crs": dataset.spec.metric_crs,
                "compute": executor.metadata(), "pca_compute": model.compute,
                "eigenvalues": model.eigenvalues.tolist(), "total_variance": model.total_variance,
                "retained_variance_fraction": float(model.eigenvalues.sum() / model.total_variance),
                "source_axis_examples": examples,
                "artifacts": ["pca.npz", "source.npz", "exclusions.json"]}

    def _target_projection(self, identifier, dataset, model_id, model, views, request, executor):
        directory = self.root / "projections" / model_id / dataset.dataset_id
        directory.mkdir(parents=True, exist_ok=True)
        key = {"snapshot": dataset.snapshot(), "selected_views": list(views),
               "components": len(model.components), "date_range": list(request.target_date_range) if request.target_date_range else None,
               "algorithm_version": ALGORITHM_VERSION}
        for path in directory.glob("*/manifest.json"):
            cache = json.loads(path.read_text(encoding="utf-8"))
            if cache.get("key") == key and cache.get("ready"):
                dataset.assert_unchanged()
                with np.load(path.parent / "arrays.npz", allow_pickle=False) as arrays:
                    values = {name: arrays[name] for name in arrays.files}
                exclusions = json.loads((path.parent / "exclusions.json").read_text(encoding="utf-8"))
                return values, exclusions, True, cache["compute"]
        rows = dataset.dated_rows(request.target_date_range)
        rows, excluded = dataset.valid_rows(rows, views, self.config.block_size, lambda: self.check(identifier))
        projected, dots, norms = self._project(identifier, dataset, rows, views, model, executor)
        values = {"rows": rows, "projected": projected, "mean_dots": dots, "norms": norms}
        dataset.assert_unchanged()
        self.check(identifier)
        cache_dir = directory / uuid4().hex
        cache_dir.mkdir()
        atomic_npz(cache_dir / "arrays.npz", **values)
        atomic_json(cache_dir / "exclusions.json", excluded)
        atomic_json(cache_dir / "manifest.json", {"key": key, "ready": True, "compute": executor.metadata()})
        return values, excluded, False, executor.metadata()

    def _match(self, identifier, request):
        directory = self._path(identifier, "runs")
        check = lambda: self.check(identifier)
        self._update(identifier, "runs", status="validating")
        source_manifest = self.status(request.model_id, "models")
        if source_manifest.get("algorithm_version") != ALGORITHM_VERSION:
            raise ValueError("Source model algorithm version is incompatible")
        source = self._dataset(source_manifest["request"]["source_dataset_id"])
        if source.snapshot() != source_manifest["source_snapshot"]:
            raise ValueError("Source embeddings changed since model fit")
        target = self._dataset(request.target_dataset_id)
        if (source.spec.signature, source.view_count, source.view_dimension) != (target.spec.signature, target.view_count, target.view_dimension):
            raise ValueError("Source and target embedding definitions are incompatible")
        views = tuple(source_manifest["selected_views"])
        model_dir = self._path(request.model_id, "models")
        model = PcaModel.load(model_dir / "pca.npz")
        model.components = model.components[:request.selected_components]
        model.eigenvalues = model.eigenvalues[:request.selected_components]
        with np.load(model_dir / "source.npz", allow_pickle=False) as arrays:
            source_projected = arrays["projected"][:, :request.selected_components]
            source_weights, labels = arrays["weights"], arrays["labels"]
            source_residual = residuals(source_projected, arrays["mean_dots"], arrays["norms"], model.mean)
        self._update(identifier, "runs", status="calibrating")
        profile = calibrate_blob(model, source_projected, source_residual, source_weights,
                                 request.axis_weights or [1.0] * request.selected_components,
                                 request.source_coverage, request.residual_enabled,
                                 request.variance_floor_relative, request.variance_floor_absolute)
        executor = Executor(request.compute_device)
        self._update(identifier, "runs", status="projecting_target")
        values, excluded, cache_hit, projection_compute = self._target_projection(
            identifier, target, request.model_id, model, views, request, executor)
        rows, projected = values["rows"], values["projected"]
        residual = residuals(projected, values["mean_dots"], values["norms"], model.mean)
        scores = profile.distances(projected, residual)
        atomic_json(directory / "profile.json", profile.metadata())
        atomic_json(directory / "exclusions.json", excluded)
        atomic_npz(directory / "projections.npz", **values)
        regions = {"type": "FeatureCollection", "features": [], "diagnostics": {"enabled": False}}
        if request.neighborhoods is not None:
            self._update(identifier, "runs", status="aggregating_regions", valid_target_rows=len(rows))
            regions = rank_neighborhoods(
                target, rows, source_manifest["source_area_m2"], source_manifest["occupied_cells"],
                source_manifest["request"]["spatial_cell_m"], profile.coordinates(source_projected),
                source_weights, labels, profile.coordinates(projected), scores, profile,
                request.neighborhoods, source_manifest["request"]["seed"], self.config.max_centers, check)
        check()
        atomic_json(directory / "regions.geojson", regions)
        self._update(identifier, "runs", status="writing_results")
        chunks = []
        for start in range(0, len(rows), self.config.block_size):
            check()
            stop = min(start + self.config.block_size, len(rows))
            name = f"points_{start:09d}.npz"
            selected = rows[start:stop]
            atomic_npz(directory / name, rows=selected, refs=target.refs[selected],
                       sequences=target.sequences[selected], namespaces=target.namespaces[selected],
                       projected=projected[start:stop], **{key: value[start:stop] for key, value in scores.items()})
            chunks.append({"name": name, "rows": stop - start, "matched": int(scores["matched"][start:stop].sum())})
        source.assert_unchanged()
        target.assert_unchanged()
        return {"model_id": request.model_id, "target_snapshot": target.snapshot(),
                "profile": profile.metadata(), "compute": executor.metadata(),
                "projection_compute": projection_compute, "projection_cache_hit": cache_hit,
                "valid_target_rows": len(rows), "excluded_rows": len(excluded),
                "matched_rows": int(scores["matched"].sum()), "point_chunks": chunks,
                "region_count": len(regions["features"]),
                "artifacts": ["profile.json", "exclusions.json", "projections.npz", "regions.geojson"]
                             + [chunk["name"] for chunk in chunks]}

    def artifact(self, identifier, kind, name):
        data = self.status(identifier, kind)
        if data["status"] != "ready":
            raise ValueError("Job artifacts are not ready")
        if name not in data["artifacts"] or Path(name).name != name:
            raise FileNotFoundError("Artifact not found")
        return self._path(identifier, kind) / name

    def points(self, identifier, offset=0, limit=1000, matched_only=False):
        data = self.status(identifier, "runs")
        if data["status"] != "ready":
            raise ValueError("Run is not ready")
        total = data["matched_rows"] if matched_only else data["valid_target_rows"]
        result, skip = [], offset
        for chunk in data["point_chunks"]:
            count = chunk["matched"] if matched_only else chunk["rows"]
            if skip >= count:
                skip -= count
                continue
            with np.load(self._path(identifier, "runs") / chunk["name"], allow_pickle=False) as saved:
                indices = np.flatnonzero(saved["matched"]) if matched_only else np.arange(chunk["rows"])
                for index in indices[skip:skip + limit - len(result)]:
                    ref = saved["refs"][index]
                    item = {"dataset_id": data["request"]["target_dataset_id"], "global_row": int(saved["rows"][index]),
                            "source_seq": int(saved["sequences"][index]), "namespace": str(saved["namespaces"][index]),
                            "pano_id": str(int(ref[0])), "lon": float(ref[1]), "lat": float(ref[2]),
                            "capture_date": int(ref[3]), "matched": bool(saved["matched"][index]),
                            "pca_coordinates": saved["projected"][index].tolist()}
                    for field in ("pc_distance", "residual", "joint_distance", "compatibility"):
                        item[field] = float(saved[field][index])
                    result.append(item)
            skip = 0
            if len(result) >= limit:
                break
        following = offset + len(result)
        return {"points": result, "total": total, "next_offset": following if following < total else None}
