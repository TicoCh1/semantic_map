"""Aligned-view weighted PCA and calibrated region scores. No model inference.

Torch is optional and imported only when a job requests CUDA discovery. CPU
jobs use NumPy, including QR and SVD; CUDA jobs use torch.linalg on the GPU.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass, field
import importlib
from typing import Callable, Iterator, Protocol

import numpy as np

ALGORITHM_VERSION = "pca_region_blob_aligned_v1"
REPRESENTATION = "pano_aligned_views_v1"


class Cancelled(RuntimeError):
    pass


class BlockMatrix(Protocol):
    count: int
    dimension: int

    def blocks(self) -> Iterator[tuple[slice, np.ndarray]]: ...


def normalized_weights(weights: np.ndarray, count: int) -> np.ndarray:
    weights = np.asarray(weights, dtype=np.float64)
    if weights.shape != (count,) or not np.isfinite(weights).all() or np.any(weights < 0):
        raise ValueError("Weights must be a finite nonnegative vector aligned with rows")
    total = float(weights.sum())
    if not np.isfinite(total) or total <= 0:
        raise ValueError("Weights must have a finite positive total")
    return weights / total


def weighted_quantile(values, weights, quantiles):
    values = np.asarray(values, dtype=np.float64)
    weights = normalized_weights(weights, len(values))
    quantiles = np.asarray(quantiles, dtype=np.float64)
    if not np.isfinite(values).all() or not np.isfinite(quantiles).all():
        raise ValueError("Quantile inputs must be finite")
    if np.any((quantiles < 0) | (quantiles > 1)):
        raise ValueError("Quantiles must be between zero and one")
    positive = weights > 0
    order = np.argsort(values[positive], kind="stable")
    sorted_values = values[positive][order]
    cumulative = np.cumsum(weights[positive][order])
    positions = np.minimum(np.searchsorted(cumulative, quantiles), len(order) - 1)
    return sorted_values[positions]


class Executor:
    """A job-owned numerical device, never a global inference engine."""

    def __init__(self, requested: str = "auto"):
        if requested not in {"auto", "cpu", "cuda"}:
            raise ValueError("compute_device must be auto, cpu, or cuda")
        self.requested = requested
        self.device = "cpu"
        self.torch = None
        self.fallback_reason = None
        self.events: list[dict] = []
        if requested == "cpu":
            return
        try:
            torch = importlib.import_module("torch")
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA is not available")
            # Check allocation and driver initialization before beginning PCA.
            probe = torch.empty(1, device="cuda", dtype=torch.float32)
            del probe
            self.torch = torch
            self.device = "cuda"
        except (ImportError, OSError, RuntimeError) as exc:
            if requested == "cuda":
                raise RuntimeError(f"Explicit CUDA request failed: {exc}") from exc
            self.fallback_reason = f"CUDA discovery unavailable: {exc}"
            self.events.append({"stage": "discovery", "device": "cpu", "reason": self.fallback_reason})

    def metadata(self) -> dict:
        return {"requested": self.requested, "actual": self.device,
                "fallback_reason": self.fallback_reason, "events": list(self.events),
                "numpy_version": np.__version__, "torch_version": getattr(self.torch, "__version__", None),
                "solver": "torch.linalg" if self.device == "cuda" else "numpy.linalg"}

    @contextmanager
    def precision(self):
        if self.device == "cpu":
            yield
            return
        torch = self.torch
        old_tf32 = torch.backends.cuda.matmul.allow_tf32
        try:
            torch.backends.cuda.matmul.allow_tf32 = False
            with torch.no_grad():
                yield
        finally:
            torch.backends.cuda.matmul.allow_tf32 = old_tf32

    def run(self, operation: Callable, stage: str):
        fallback = None
        try:
            with self.precision():
                return operation(self)
        except Exception as exc:
            is_oom = self.torch is not None and isinstance(exc, self.torch.cuda.OutOfMemoryError)
            if self.requested != "auto" or self.device != "cuda" or not is_oom:
                raise
            fallback = f"CUDA out of memory during {stage}; retried on CPU"
        # Exit the exception scope before retrying so failed tensor frames can
        # be released. No global CUDA cache flush or unrelated job interruption.
        self.device = "cpu"
        self.fallback_reason = fallback
        self.events.append({"stage": stage, "device": "cpu", "reason": fallback})
        return operation(self)

    def array(self, values):
        values = np.ascontiguousarray(values, dtype=np.float32)
        return self.torch.from_numpy(values).to("cuda") if self.device == "cuda" else values

    def zeros(self, shape):
        if self.device == "cuda":
            return self.torch.zeros(shape, device="cuda", dtype=self.torch.float32)
        return np.zeros(shape, dtype=np.float32)

    def numpy(self, values):
        return values.detach().cpu().numpy() if self.device == "cuda" else np.asarray(values)

    def qr(self, values):
        return (self.torch.linalg.qr(values, mode="reduced")[0] if self.device == "cuda"
                else np.linalg.qr(values, mode="reduced")[0])

    def svd(self, values):
        if self.device == "cuda":
            return self.torch.linalg.svd(values, full_matrices=False)
        return np.linalg.svd(values, full_matrices=False)


@dataclass
class PcaModel:
    mean: np.ndarray
    components: np.ndarray
    eigenvalues: np.ndarray
    total_variance: float
    compute: dict = field(default_factory=dict)

    def save(self, path) -> None:
        np.savez(path, mean=self.mean, components=self.components,
                 eigenvalues=self.eigenvalues, total_variance=np.asarray(self.total_variance))

    @classmethod
    def load(cls, path):
        with np.load(path, allow_pickle=False) as saved:
            result = cls(saved["mean"], saved["components"], saved["eigenvalues"],
                         float(saved["total_variance"]))
        if not all(np.isfinite(a).all() for a in (result.mean, result.components, result.eigenvalues)):
            raise ValueError("Invalid saved PCA arrays")
        if (result.mean.ndim != 1 or result.components.ndim != 2
                or result.components.shape[1] != result.mean.size
                or result.eigenvalues.shape != (len(result.components),)
                or not len(result.components) or np.any(result.eigenvalues <= 0)
                or not np.isfinite(result.total_variance) or result.total_variance <= 0):
            raise ValueError("Invalid saved PCA dimensions")
        return result


def fit_pca(matrix: BlockMatrix, weights, components: int, executor: Executor,
            seed: int = 20261001, oversampling: int = 8, power_iterations: int = 2,
            check: Callable[[], None] = lambda: None, allow_rank_reduction: bool = False) -> PcaModel:
    """Streaming SVD of sqrt(weight) * centered aligned-view features."""
    weights = normalized_weights(weights, matrix.count)
    if not 1 <= components <= min(matrix.count - 1, matrix.dimension):
        raise ValueError("PCA component count exceeds sample or feature rank")
    width = min(components + oversampling, matrix.count, matrix.dimension)
    mean = np.zeros(matrix.dimension, dtype=np.float64)
    for rows, block in matrix.blocks():
        check()
        mean += weights[rows] @ block
    mean = mean.astype(np.float32)

    def solve(device):
        rng = np.random.default_rng(seed)
        omega = device.array(rng.standard_normal((matrix.dimension, width), dtype=np.float32))
        center = device.array(mean)
        y = device.zeros((matrix.count, width))
        total_variance = 0.0
        for rows, block in matrix.blocks():
            check()
            centered = block - mean
            total_variance += float(weights[rows] @ np.einsum("ij,ij->i", centered, centered))
            a = (device.array(block) - center) * device.array(np.sqrt(weights[rows]))[:, None]
            y[rows] = a @ omega
        if total_variance <= 1e-8:
            raise ValueError("Source descriptors have insufficient variance")
        q = device.qr(y)
        del y, omega
        for _ in range(power_iterations):
            check()
            z = device.zeros((matrix.dimension, width))
            for rows, block in matrix.blocks():
                check()
                a = (device.array(block) - center) * device.array(np.sqrt(weights[rows]))[:, None]
                z += a.T @ q[rows]
            z = device.qr(z)
            y = device.zeros((matrix.count, width))
            for rows, block in matrix.blocks():
                check()
                a = (device.array(block) - center) * device.array(np.sqrt(weights[rows]))[:, None]
                y[rows] = a @ z
            q = device.qr(y)
            del y, z
        b = device.zeros((width, matrix.dimension))
        for rows, block in matrix.blocks():
            check()
            a = (device.array(block) - center) * device.array(np.sqrt(weights[rows]))[:, None]
            b += q[rows].T @ a
        _, singular, vt = device.svd(b)
        values = device.numpy(singular)[:components].astype(np.float64) ** 2
        axes = device.numpy(vt)[:components].copy()
        rank = int(np.count_nonzero(values > max(values[0] * 1e-7, 1e-12)))
        if rank < components:
            if not allow_rank_reduction or rank == 0:
                raise ValueError("Requested PCA axes exceed numerical source rank; select fewer axes")
            values, axes = values[:rank], axes[:rank]
        actual = len(values)
        pivots = np.argmax(np.abs(axes), axis=1)
        signs = np.where(axes[np.arange(actual), pivots] < 0, -1.0, 1.0)
        axes *= signs[:, None]
        if not np.allclose(axes @ axes.T, np.eye(actual), atol=2e-5):
            raise ValueError("PCA solver returned nonorthogonal axes")
        return PcaModel(mean, axes.astype(np.float32), values, total_variance)

    result = executor.run(solve, "pca")
    result.compute = executor.metadata()
    return result


def project_views(views: np.ndarray, model: PcaModel, selected_views: tuple[int, ...],
                  executor: Executor) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """PCA axis responses through the existing corresponding-view mean."""
    k = len(selected_views)
    dimension = views.shape[2]
    if model.mean.size != k * dimension:
        raise ValueError("PCA and selected-view dimensions differ")
    # A PCA axis is not a normalized reference panorama. Its view coefficients
    # deliberately retain their relative lengths.
    coefficients = np.concatenate([model.components, model.mean[None]], axis=0)
    axis_queries = np.zeros((len(coefficients), views.shape[1], dimension), dtype=np.float32)
    axis_queries[:, selected_views, :] = coefficients.reshape(-1, k, dimension) * np.sqrt(k)

    def responses(device):
        if device.device == "cuda":
            from .text_cor_t_engine import compute_reference_scores_from_tensor
            return compute_reference_scores_from_tensor(device.array(views), device.array(axis_queries), selected_views)
        result = np.zeros((len(views), len(axis_queries)), dtype=np.float32)
        for index in selected_views:
            result += views[:, index, :].astype(np.float32) @ axis_queries[:, index, :].T
        return result / k

    raw = executor.run(responses, "projection")
    centered = raw[:, :-1] - model.components @ model.mean
    selected = views[:, selected_views, :].astype(np.float64)
    norms = np.einsum("nkd,nkd->n", selected, selected) / k
    return centered.astype(np.float32), raw[:, -1].astype(np.float64), norms


def residuals(projected, mean_dots, norms, mean):
    residual = (np.asarray(norms, dtype=np.float64) + float(np.dot(mean.astype(np.float64), mean))
                - 2 * mean_dots - np.sum(projected.astype(np.float64) ** 2, axis=1))
    if not np.isfinite(residual).all() or np.any(residual < -1e-5):
        raise ValueError("Invalid PCA residual; check numerical parity and axis orthogonality")
    return np.maximum(residual, 0)


@dataclass
class BlobProfile:
    axis_weights: np.ndarray
    variances: np.ndarray
    pc_scale: float
    residual_scale: float
    threshold: float
    residual_enabled: bool
    requested_coverage: float
    source_coverage: float

    def distances(self, projected, residual):
        pc = np.sum(projected.astype(np.float64) ** 2 * self.axis_weights / self.variances, axis=1)
        joint = pc / self.pc_scale
        if self.residual_enabled:
            joint = np.maximum(joint, residual / self.residual_scale)
        return {"pc_distance": pc, "residual": residual, "joint_distance": joint,
                "matched": joint <= self.threshold,
                "compatibility": np.exp2(-joint / self.threshold)}

    def coordinates(self, projected):
        return projected * np.sqrt(self.axis_weights / self.variances)

    def metadata(self):
        return {"axis_weights": self.axis_weights.tolist(), "effective_variances": self.variances.tolist(),
                "pc_scale": self.pc_scale, "residual_scale": self.residual_scale,
                "threshold": self.threshold, "residual_enabled": self.residual_enabled,
                "requested_source_coverage": self.requested_coverage,
                "actual_source_coverage": self.source_coverage, "score_is_probability": False}


def calibrate_blob(model, projected, residual, spatial_weights, axis_weights, coverage=0.9,
                   residual_enabled=True, floor_relative=0.01, floor_absolute=1e-8):
    if not 0 < coverage < 1:
        raise ValueError("Source coverage must be strictly between zero and one")
    count = projected.shape[1]
    weights = normalized_weights(axis_weights, count)
    variances = np.maximum(model.eigenvalues[:count], max(model.eigenvalues[0] * floor_relative, floor_absolute))
    profile = BlobProfile(weights, variances, 1, 1, 1, residual_enabled, coverage, 0)
    pc = profile.distances(projected, residual)["pc_distance"]
    profile.pc_scale = max(float(weighted_quantile(pc, spatial_weights, 0.90)), 1e-6)
    profile.residual_scale = max(float(weighted_quantile(residual, spatial_weights, 0.95)), 1e-6)
    joint = profile.distances(projected, residual)["joint_distance"]
    profile.threshold = max(float(weighted_quantile(joint, spatial_weights, coverage)), 1e-6)
    profile.source_coverage = float(normalized_weights(spatial_weights, len(projected)) @ (joint <= profile.threshold))
    return profile


@dataclass
class AxisProductProfile(BlobProfile):
    """Fixed single-axis compatibility factors multiplied without root scaling."""

    axis_distance_scales: np.ndarray = field(default_factory=lambda: np.empty(0))
    axis_exponents: np.ndarray = field(default_factory=lambda: np.empty(0))

    def distances(self, projected, residual):
        standardized_squared = projected.astype(np.float64) ** 2 / self.variances
        joint = np.sum(standardized_squared * self.axis_exponents / self.axis_distance_scales, axis=1)
        return {"pc_distance": np.sum(standardized_squared * self.axis_weights, axis=1),
                "residual": residual, "joint_distance": joint,
                "matched": joint <= 1.0, "compatibility": np.exp2(-joint)}

    def metadata(self):
        return {**super().metadata(), "aggregation": "axis_product",
                "axis_distance_scales": self.axis_distance_scales.tolist(),
                "axis_exponents": self.axis_exponents.tolist(),
                "calibration_scope": "per_axis",
                "normalization": "unit peak; no root scaling or target min-max"}


def calibrate_axis_product(model, projected, spatial_weights, axis_exponents, coverage=0.9,
                           floor_relative=0.01, floor_absolute=1e-8):
    """Keep each axis's source envelope fixed, independent of selected axes.

    Default exponents are one per active axis. Normalized weights are used only
    for geographic composition coordinates, never as product exponents.
    """
    if not 0 < coverage < 1:
        raise ValueError("Per-axis source coverage must be strictly between zero and one")
    count = projected.shape[1]
    exponents = np.asarray(axis_exponents, dtype=np.float64)
    weights = normalized_weights(exponents, count)
    variances = np.maximum(model.eigenvalues[:count], max(model.eigenvalues[0] * floor_relative, floor_absolute))
    squared = projected.astype(np.float64) ** 2 / variances
    scales = np.asarray([max(float(weighted_quantile(squared[:, j], spatial_weights, coverage)), 1e-6)
                         for j in range(count)])
    profile = AxisProductProfile(weights, variances, 1, 1, 1, False, coverage, 0,
                                 scales, exponents.copy())
    scored = profile.distances(projected, np.zeros(len(projected)))
    profile.source_coverage = float(normalized_weights(spatial_weights, len(projected)) @ scored["matched"])
    return profile
