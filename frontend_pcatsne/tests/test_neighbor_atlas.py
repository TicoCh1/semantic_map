"""Small synthetic checks only: never read London data or run production PCA."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import pca64_pacmap_neighbor_atlas as atlas
atlas.numpy()


class FakePaCMAP:
    """An explicit fake pair/gradient backend for pipeline plumbing tests."""
    class PaCMAP:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def decide_num_pairs(self, n):
            self.n = n

        def sample_pairs(self, x, save_tree):
            pairs = np.column_stack((np.arange(len(x)), np.roll(np.arange(len(x)), 1))).astype(np.int32)
            self.pair_neighbors = self.pair_MN = self.pair_FP = pairs

    @staticmethod
    def find_weight(initial, step, *, num_iters):
        return 1., 1., 1.

    @staticmethod
    def pacmap_grad(y, pn, pm, pf, wn, wm, wf):
        result = np.zeros((len(y) + 1, 3), np.float32)
        result[:-1] = y * .01
        result[-1, 0] = np.sum(y * y)
        return result


class AtlasTests(unittest.TestCase):
    def config(self):
        c = json.loads(atlas.DEFAULT_CONFIG.read_text(encoding="utf-8"))
        c["iterations"] = [1, 1, 2]
        c["cross_scale_anchor_count"] = 8
        return c

    def test_concat_preserves_view_order_and_rejects_old_dimensions(self):
        x = np.arange(2 * 8 * 4096, dtype=np.float32).reshape(2, 8, 4096)
        actual = atlas.flatten_views(x)
        self.assertEqual(actual.shape, (2, 32768))
        np.testing.assert_array_equal(actual[1, 4096:8192], x[1, 1])
        with self.assertRaises(ValueError):
            atlas.flatten_views(np.zeros((1, 8, 2048)))

    def test_partial_shards_use_cumulative_offsets_and_numeric_sort(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = self.config()
            c["input_dir"] = tmp
            for shard, rows in [(10, 3), (2, 1), (0, 2)]:
                path = Path(tmp) / f"views_emb_shard_{shard}.npy"
                np.save(path, np.full((rows, 8, 4096), shard, dtype=np.float16))
                np.save(path.with_name(path.stem + "_ref.npy"), np.zeros((rows, 5)))
            sources = atlas.inspect_sources(c)
            self.assertEqual([s["number"] for s in sources], [0, 2, 10])
            self.assertEqual([s["offset"] for s in sources], [0, 2, 3])
            self.assertEqual([i for i, x in atlas.batches(sources, 2)], [0, 2, 3, 5])
            np.testing.assert_array_equal(atlas.batches(sources, 2).__next__()[1], 0)

    def test_streaming_pca_matches_small_exact_svd_and_counts_all_rows(self):
        rng = np.random.default_rng(8)
        x = rng.normal(size=(97, 12)).astype(np.float32) * np.linspace(1, 5, 12) + 30
        factory = lambda: ((i, x[i:i + 11]) for i in range(0, len(x), 11))
        result = atlas.streaming_pca(factory, 12, 5, 7, 2, 42)
        _, s, vt = np.linalg.svd(x - x.mean(axis=0), full_matrices=False)
        self.assertEqual(result["rows"], 97)
        np.testing.assert_allclose(result["mean"], x.mean(axis=0), atol=1e-5)
        np.testing.assert_allclose(result["eigenvalues"], s[:5] ** 2 / 96, rtol=1e-5)
        np.testing.assert_allclose(result["components"].T @ result["components"], vt[:5].T @ vt[:5], atol=1e-5)
        self.assertAlmostEqual(result["total_variance"], float(np.var(x, axis=0, ddof=1).sum()), places=8)

    def test_native_reference_unknown_heading_is_allowed(self):
        with tempfile.TemporaryDirectory() as tmp:
            ref = Path(tmp) / "refs.npy"
            values = np.array([[1, -.12, 51.5, 202601, np.nan], [2, -.1, 51.6, 202602, 0]])
            np.save(ref, values)
            sources = [{"rows": 2, "offset": 0, "reference": {"path": str(ref)}}]
            actual = atlas.load_references(sources)
            self.assertTrue(np.isnan(actual[0, 4]))
            values[1, 2] = np.nan
            np.save(ref, values)
            with self.assertRaises(ValueError):
                atlas.load_references(sources)

    def test_half_open_cores_and_shared_halo_have_single_ownership(self):
        xy = np.array([[0, 0], [1999, 0], [2000, 0], [2001, 0], [3999, 0], [2000, 2000]], float)
        patches = atlas.grid_patches(xy, np.zeros(2), 2000, 250)
        self.assertEqual(patches[0][:2], (0, 0))
        owned = np.concatenate([ids[core] for _, _, ids, core in patches])
        np.testing.assert_array_equal(np.sort(owned), np.arange(len(xy)))
        root = patches[0][2]
        east = next(p[2] for p in patches if p[:2] == (1, 0))
        self.assertTrue({1, 2, 3}.issubset(set(root) & set(east)))
        self.assertNotIn(2, patches[0][2][patches[0][3]])

    def test_hard_anchors_do_not_move_at_any_adam_iteration(self):
        initial = np.array([[20, -7, 3], [-1, 4, 6], [4, 5, 6]], np.float32)
        anchors = np.array([True, True, False])
        observed = []
        def gradient(y, wn, wm, wf):
            result = np.ones((len(y) + 1, 3), np.float32)
            result[-1, 0] = 1
            return result
        def observer(y):
            np.testing.assert_array_equal(y[anchors], initial[anchors])
            observed.append(1)
        final, _ = atlas.anchored_adam(initial, anchors, gradient, FakePaCMAP.find_weight, [2, 3, 4], 1, observer)
        self.assertEqual(len(observed), 9)
        self.assertFalse(np.array_equal(final[-1], initial[-1]))
        np.testing.assert_array_equal(initial[0], [20, -7, 3])

    def test_corner_registry_rejects_conflicting_shared_positions(self):
        registry = np.full((6, 3), np.nan, np.float32)
        atlas.merge_registry(registry, np.array([0, 2, 3]), np.ones((3, 3), np.float32))
        y = np.array([[1, 1, 1], [2, 2, 2]], np.float32)
        atlas.merge_registry(registry, np.array([3, 4]), y)
        with self.assertRaises(RuntimeError):
            atlas.merge_registry(registry, np.array([3]), np.zeros((1, 3), np.float32))
        np.testing.assert_array_equal(registry[3], [1, 1, 1])

    def test_cross_scale_reference_subset_is_diverse_and_deterministic(self):
        x = np.column_stack([np.arange(50)] * 64).astype(np.float32)
        first = atlas.select_reference_anchors(x, 8)
        np.testing.assert_array_equal(first, atlas.select_reference_anchors(x, 8))
        self.assertEqual(len(set(first)), 8)
        self.assertIn(0, first)
        self.assertIn(49, first)
        self.assertLess(len(first), len(x))

    def test_palette_maps_shared_coordinates_to_identical_bytes(self):
        root = np.random.default_rng(4).normal(size=(200, 3)).astype(np.float32)
        palette = atlas.palette_for_root(root, .0475)
        first, _ = atlas.colors(root[:3], palette)
        second, _ = atlas.colors(np.vstack([root[2], root[0], root[1]]), palette)
        np.testing.assert_array_equal(first, second[[1, 2, 0]])
        self.assertGreater(palette["uniform_scale"], 0)

    def test_plan_does_not_load_sources_or_write_even_for_run_stage(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "must_not_exist"
            with patch.object(atlas, "inspect_sources", side_effect=AssertionError("loaded data")):
                with contextlib.redirect_stdout(io.StringIO()) as capture:
                    atlas.main(["--stage", "run", "--output-dir", str(dest)])
            plan = json.loads(capture.getvalue())
            self.assertEqual(plan["active_scales_km"], [2])
            self.assertFalse(plan["writes"])
            self.assertFalse(dest.exists())

    def test_resume_rejects_source_change_before_any_fitting(self):
        with tempfile.TemporaryDirectory() as tmp:
            inp, out = Path(tmp) / "input", Path(tmp) / "out"
            inp.mkdir()
            out.mkdir()
            np.save(inp / "views_emb_shard_0.npy", np.zeros((2, 8, 4096), np.float16))
            np.save(inp / "views_emb_shard_0_ref.npy", np.zeros((2, 5)))
            c = self.config()
            c["input_dir"], c["output_dir"] = str(inp), str(out)
            config = Path(tmp) / "config.json"
            atlas.atomic_json(config, c)
            atlas.atomic_json(out / "run_config.json", c)
            atlas.atomic_json(out / "prepared.json", {"sources": []})
            with self.assertRaisesRegex(RuntimeError, "provenance changed"):
                atlas.main(["--config", str(config), "--stage", "export", "--execute"])
            self.assertFalse((out / ".pipeline.lock").exists())

    def test_synthetic_fit_export_resume_and_all_later_scales(self):
        c = self.config()
        # 80 artificial rows straddle the east and north interfaces.
        rng = np.random.default_rng(3)
        center = atlas.mercator(np.array([c["center_lon_lat"]]))[0]
        relative = np.vstack([rng.uniform(-100, 100, (30, 2)),
                              np.column_stack([rng.uniform(1800, 2200, 30), rng.uniform(-100, 100, 30)]),
                              np.column_stack([rng.uniform(-100, 100, 20), rng.uniform(1800, 2200, 20)])])
        x = rng.normal(size=(80, 64)).astype(np.float32)
        reference = np.zeros((80, 5))
        reference[:, 0] = np.arange(80)
        reference[:, 1:3] = c["center_lon_lat"]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            np.save(out / "pca64.npy", x)
            atlas.atomic_npz(out / "source_rows.npz", xy=center + relative, reference=reference)
            atlas.atomic_json(out / "prepared.json", {"rows": 80})
            with contextlib.redirect_stdout(io.StringIO()):
                atlas.fit_scales(c, out, [2], FakePaCMAP)
                atlas.fit_scales(c, out, [2], FakePaCMAP)
                atlas.fit_scales(c, out, [4, 8, 16, 32], FakePaCMAP)
                atlas.export_scales(c, out, [2])
                atlas.export_scales(c, out, [4, 8, 16, 32])
            root = np.load(out / "patches/2km/0_0.npz")
            east = np.load(out / "patches/2km/1_0.npz")
            common, a, b = np.intersect1d(root["ids"], east["ids"], return_indices=True)
            self.assertGreater(len(common), 0)
            np.testing.assert_array_equal(root["y"][a], east["y"][b])
            whole = np.load(out / "patches/32km/0_0.npz")
            selected = atlas.select_reference_anchors(x[root["ids"]], c["cross_scale_anchor_count"])
            np.testing.assert_array_equal(whole["y"][root["ids"][selected]], root["y"][selected])
            free = np.setdiff1d(np.arange(len(root["ids"])), selected)
            self.assertFalse(np.array_equal(whole["y"][root["ids"][free]], root["y"][free]))
            manifest = json.loads((out / "viewer_data/manifest.json").read_text())
            self.assertEqual(manifest["readyScalesKm"], [2, 4, 8, 16, 32])
            for scale in manifest["readyScalesKm"]:
                self.assertEqual((out / f"viewer_data/{scale}km/points.bin").stat().st_size, 80 * 12)
            root.close()
            east.close()
            whole.close()

    def test_whole16_includes_rows_outside_old_tile_and_preserves_reference_anchors(self):
        c = self.config()
        c["whole_dataset_scales_km"] = [16]
        atlas.validate_config(c)
        rng = np.random.default_rng(19)
        center = atlas.mercator(np.array([c["center_lon_lat"]]))[0]
        relative = np.vstack([rng.uniform(-100, 100, (40, 2)),
                              rng.uniform(19000, 21000, (40, 2))])
        x = rng.normal(size=(80, 64)).astype(np.float32)
        reference = np.zeros((80, 5))
        reference[:, 1:3] = c["center_lon_lat"]
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            np.save(out / "pca64.npy", x)
            atlas.atomic_npz(out / "source_rows.npz", xy=center + relative, reference=reference)
            atlas.atomic_json(out / "prepared.json", {"rows": 80})
            with contextlib.redirect_stdout(io.StringIO()):
                atlas.fit_scales(c, out, [2, 16], FakePaCMAP)
                atlas.export_scales(c, out, [2, 16])
            with np.load(out / "patches/16km/0_0.npz") as whole, np.load(out / "patches/2km/0_0.npz") as root:
                np.testing.assert_array_equal(whole["ids"], np.arange(80))
                self.assertTrue(whole["core"].all())
                selected = atlas.select_reference_anchors(x[root["ids"]], c["cross_scale_anchor_count"])
                np.testing.assert_array_equal(whole["y"][root["ids"][selected]], root["y"][selected])
            layer = json.loads((out / "viewer_data/manifest.json").read_text())["layers"][-1]
            self.assertEqual(layer["coverageMode"], "whole_dataset")
            self.assertEqual(len(layer["patches"]), 1)
            self.assertEqual(layer["patches"][0]["count"], 80)
            self.assertIsNone(layer["patches"][0]["radiusMeters"])

    @unittest.skipUnless(importlib.util.find_spec("pacmap"), "Pinned PaCMAP is not installed locally")
    def test_real_pinned_backend_gradient_adapter(self):
        c = self.config()
        impl = atlas.pacmap_backend(c)
        x = np.random.default_rng(5).normal(size=(40, 64)).astype(np.float32)
        anchors = np.zeros(40, bool)
        anchors[:5] = True
        fixed = np.random.default_rng(6).normal(size=(40, 3)).astype(np.float32)
        y, stats = atlas.fit_patch(x, anchors, fixed, c, impl)
        np.testing.assert_array_equal(y[:5], fixed[:5])
        self.assertEqual(stats["method"], "hard_anchored_pacmap")


if __name__ == "__main__":
    unittest.main()
