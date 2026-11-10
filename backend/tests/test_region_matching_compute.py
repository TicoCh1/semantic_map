"""Run on RunPod only; Windows verification is static inspection."""
from contextlib import nullcontext
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import numpy as np

from backend.semantic_map.region_matching_compute import (
    Executor, PcaModel, calibrate_blob, calibrate_axis_product, fit_pca, project_views, residuals, weighted_quantile,
)
from backend.semantic_map.region_matching_neighborhoods import (
    composition_distance, quantile_summary, shortlist_order,
)


class DenseBlocks:
    def __init__(self, values, block=11):
        self.values = np.asarray(values, dtype=np.float32)
        self.count, self.dimension = self.values.shape
        self.block = block

    def blocks(self):
        for start in range(0, self.count, self.block):
            stop = min(start + self.block, self.count)
            yield slice(start, stop), self.values[start:stop]


class RegionComputeTest(unittest.TestCase):
    def test_cpu_mode_does_not_import_torch(self):
        with patch("backend.semantic_map.region_matching_compute.importlib.import_module") as importer:
            self.assertEqual(Executor("cpu").device, "cpu")
            importer.assert_not_called()

    def test_auto_without_torch_falls_back_but_explicit_cuda_fails(self):
        with patch("backend.semantic_map.region_matching_compute.importlib.import_module", side_effect=ImportError("no torch")):
            auto = Executor("auto")
            self.assertEqual(auto.device, "cpu")
            self.assertIn("no torch", auto.fallback_reason)
            with self.assertRaisesRegex(RuntimeError, "Explicit CUDA"):
                Executor("cuda")

    def test_auto_oom_retries_cpu_and_records_reason(self):
        class FakeOOM(RuntimeError):
            pass
        executor = Executor("cpu")
        executor.requested, executor.device = "auto", "cuda"
        executor.torch = SimpleNamespace(cuda=SimpleNamespace(OutOfMemoryError=FakeOOM))
        calls = []

        def operation(device):
            calls.append(device.device)
            if device.device == "cuda":
                raise FakeOOM("memory")
            return 42

        with patch.object(executor, "precision", return_value=nullcontext()):
            self.assertEqual(executor.run(operation, "pca"), 42)
        self.assertEqual(calls, ["cuda", "cpu"])
        self.assertIn("pca", executor.fallback_reason)

    def test_other_cuda_errors_are_not_hidden(self):
        executor = Executor("cpu")
        with self.assertRaisesRegex(ValueError, "bad basis"):
            executor.run(lambda _: (_ for _ in ()).throw(ValueError("bad basis")), "pca")

    def test_weighted_streaming_pca_matches_independent_full_svd(self):
        rng = np.random.default_rng(7)
        x = rng.normal(size=(60, 12)).astype(np.float32)
        weights = rng.random(60)
        weights /= weights.sum()
        model = fit_pca(DenseBlocks(x), weights, 4, Executor("cpu"), seed=17)
        mean = weights @ x
        _, singular, reference = np.linalg.svd(np.sqrt(weights)[:, None] * (x - mean), full_matrices=False)
        np.testing.assert_allclose(model.mean, mean, atol=2e-7)
        np.testing.assert_allclose(model.eigenvalues, singular[:4] ** 2, rtol=3e-5)
        np.testing.assert_allclose(model.components.T @ model.components,
                                   reference[:4].T @ reference[:4], atol=3e-5)
        self.assertEqual(model.compute["actual"], "cpu")

    def test_axis_adapter_preserves_selected_view_order_and_lengths(self):
        rng = np.random.default_rng(4)
        views = rng.normal(size=(13, 8, 5)).astype(np.float16)
        slots = (7, 2, 0)
        axes, _ = np.linalg.qr(rng.normal(size=(15, 3)))
        mean = rng.normal(size=15).astype(np.float32) / 10
        model = PcaModel(mean, axes.T.astype(np.float32), np.ones(3), 3)
        projected, dots, norms = project_views(views, model, slots, Executor("cpu"))
        flat = views[:, slots, :].astype(np.float32).reshape(13, -1) / np.sqrt(3)
        np.testing.assert_allclose(projected, (flat - mean) @ model.components.T, atol=2e-6)
        np.testing.assert_allclose(dots, flat @ mean, atol=2e-6)
        np.testing.assert_allclose(norms, np.sum(flat.astype(np.float64) ** 2, axis=1), rtol=2e-7)
        explicit_residual = flat - mean - projected @ model.components
        np.testing.assert_allclose(residuals(projected, dots, norms, mean),
                                   np.sum(explicit_residual ** 2, axis=1), atol=5e-6)

    def test_residual_rejects_a_point_with_identical_retained_coordinates(self):
        model = PcaModel(np.zeros(4, dtype=np.float32), np.eye(4, dtype=np.float32)[:3], np.ones(3), 3)
        source = np.asarray([[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0]], dtype=np.float32)
        profile = calibrate_blob(model, source, np.zeros(4), np.ones(4), [1, 1, 1])
        scores = profile.distances(np.zeros((2, 3)), np.array([0, 0.3]))
        self.assertEqual(scores["matched"].tolist(), [True, False])

    def test_weight_rescaling_and_joint_coverage(self):
        rng = np.random.default_rng(11)
        model = PcaModel(np.zeros(3, dtype=np.float32), np.eye(3, dtype=np.float32), np.array([3., 2., 1.]), 6)
        source, residual = rng.normal(size=(100, 3)), rng.random(100)
        spatial = rng.random(100)
        first = calibrate_blob(model, source, residual, spatial, [1, 2, 3], 0.9)
        second = calibrate_blob(model, source, residual, spatial, [10, 20, 30], 0.9)
        np.testing.assert_allclose(first.distances(source, residual)["joint_distance"],
                                   second.distances(source, residual)["joint_distance"])
        self.assertGreaterEqual(first.source_coverage, 0.9 - 1e-12)
        self.assertAlmostEqual(first.threshold, second.threshold)
        self.assertEqual(float(weighted_quantile([100, 2, 1], [0, 1, 1], 0)), 1)

    def test_joint_composition_detects_equal_marginals_with_wrong_combinations(self):
        source = np.array([[-1., -1.], [1., 1.]])
        target = np.array([[-1., 1.], [1., -1.]])
        direction = np.array([[1., 1.]]) / np.sqrt(2)
        left = quantile_summary(source, [1, 1], direction, 16)
        right = quantile_summary(target, [1, 1], direction, 16)
        self.assertGreater(composition_distance(left, right), 1)

    def test_product_matches_fixed_single_axes_and_is_monotone(self):
        rng = np.random.default_rng(41)
        model = PcaModel(np.zeros(3, dtype=np.float32), np.eye(3, dtype=np.float32), np.array([3., 2., 1.]), 6)
        source, target = rng.normal(size=(90, 3)), rng.normal(size=(40, 3))
        spatial = rng.random(90)
        zero = np.zeros(len(target))
        singles = []
        for j in range(3):
            exponents = np.eye(3)[j]
            legacy = calibrate_blob(model, source, np.zeros(len(source)), spatial, exponents,
                                    residual_enabled=False)
            single = calibrate_axis_product(model, source, spatial, exponents)
            scores = single.distances(target, zero)["compatibility"]
            np.testing.assert_allclose(scores, legacy.distances(target, zero)["compatibility"], atol=1e-12)
            singles.append(scores)
        pair = calibrate_axis_product(model, source, spatial, [1, 1, 0]).distances(target, zero)["compatibility"]
        full = calibrate_axis_product(model, source, spatial, [1, 1, 1]).distances(target, zero)["compatibility"]
        np.testing.assert_allclose(pair, singles[0] * singles[1], atol=1e-12)
        np.testing.assert_allclose(full, np.prod(singles, axis=0), atol=1e-12)
        self.assertTrue(np.all(pair <= singles[0] + 1e-14))
        self.assertTrue(np.all(full <= pair + 1e-14))

    def test_product_exponents_are_not_averaged_and_log_domain_is_stable(self):
        model = PcaModel(np.zeros(2, dtype=np.float32), np.eye(2, dtype=np.float32), np.ones(2), 2)
        source = np.array([[-1., -1.], [1., 1.], [-1., 1.], [1., -1.]])
        target = np.array([[1., 1.], [0., 0.], [1e4, 1e4]])
        unit = calibrate_axis_product(model, source, np.ones(4), [1, 1])
        stronger = calibrate_axis_product(model, source, np.ones(4), [2, 2])
        first = unit.distances(target, np.zeros(3))["compatibility"]
        second = stronger.distances(target, np.zeros(3))["compatibility"]
        np.testing.assert_allclose(first, [.25, 1., 0.])
        np.testing.assert_allclose(second, first ** 2)
        self.assertEqual(unit.metadata()["calibration_scope"], "per_axis")

    def test_equal_coverage_does_not_rank_by_floating_point_roundoff(self):
        candidates = [(1.0 + 8e-16, 0.1, (0, 0)), (1.0 - 8e-16, 0.9, (1, 1)),
                      (0.98, 0.99, (2, 2))]
        ordered = sorted(candidates, key=shortlist_order)
        self.assertEqual([item[2] for item in ordered], [(1, 1), (0, 0), (2, 2)])

    def test_cuda_pca_and_current_tensor_scorer_parity_when_available(self):
        try:
            gpu = Executor("cuda")
        except RuntimeError:
            self.skipTest("CUDA is unavailable")
        rng = np.random.default_rng(8)
        x = rng.normal(size=(60, 12)).astype(np.float32)
        weights = rng.random(60)
        cpu_model = fit_pca(DenseBlocks(x), weights, 4, Executor("cpu"), seed=17)
        gpu_model = fit_pca(DenseBlocks(x), weights, 4, gpu, seed=17)
        self.assertEqual(gpu_model.compute["actual"], "cuda")
        np.testing.assert_allclose(gpu_model.eigenvalues, cpu_model.eigenvalues, rtol=5e-4)
        np.testing.assert_allclose(gpu_model.components.T @ gpu_model.components,
                                   cpu_model.components.T @ cpu_model.components, atol=3e-4)
        from backend.semantic_map.text_cor_t_engine import compute_reference_scores_from_tensor
        views = rng.normal(size=(13, 8, 5)).astype(np.float16)
        query = views[0].astype(np.float32)
        query /= np.linalg.norm(query, axis=1, keepdims=True)
        scores = compute_reference_scores_from_tensor(gpu.array(views), gpu.array(query[None]), tuple(range(8)))[:, 0]
        reference = sum(views[:, k].astype(np.float32) @ query[k] for k in range(8)) / 8
        np.testing.assert_allclose(scores, reference, atol=2e-5)
        slots = (7, 2, 0)
        axes, _ = np.linalg.qr(rng.normal(size=(15, 3)))
        model = PcaModel(rng.normal(size=15).astype(np.float32) / 10,
                         axes.T.astype(np.float32), np.ones(3), 3)
        cpu_projection = project_views(views, model, slots, Executor("cpu"))
        gpu_projection = project_views(views, model, slots, gpu)
        for cpu_values, gpu_values in zip(cpu_projection, gpu_projection):
            np.testing.assert_allclose(gpu_values, cpu_values, atol=2e-5)


if __name__ == "__main__":
    unittest.main()
