"""Dormancy and small CPU end-to-end tests, to run on RunPod only."""
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
import numpy as np

from backend.semantic_map.region_matching_api import create_app
from backend.semantic_map.region_matching_data import DatasetSpec
from backend.semantic_map.region_matching_schemas import ModelRequest, RunRequest
from backend.semantic_map.region_matching_service import RegionConfig
from backend.tests.test_region_matching_data import write_dataset


class RegionApiTest(unittest.TestCase):
    def test_disabled_factory_does_not_start_a_worker_or_create_outputs(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "results"
            config = RegionConfig(Path(temporary) / "data", output)
            with patch("backend.semantic_map.region_matching_api.RegionMatchingService") as worker:
                with TestClient(create_app(config)) as client:
                    self.assertFalse(client.get("/api/ready").json()["ready"])
                    self.assertEqual(client.post("/api/region-matching/models", json={
                        "source_dataset_id": "rome_512_8_45_8B", "source_geometry": {},
                    }).status_code, 503)
                worker.assert_not_called()
            self.assertFalse(output.exists())

    def test_schema_rejects_wrong_weights_and_invalid_view_slots(self):
        with self.assertRaises(ValueError):
            ModelRequest(source_dataset_id="toy", source_geometry={}, selected_views=[0, 0])
        with self.assertRaises(ValueError):
            RunRequest(model_id="model_" + "a" * 32, target_dataset_id="toy", selected_components=3,
                       axis_weights=[1, -1, 1])

    def test_enabled_cpu_flow_and_projection_reuse(self):
        import sys
        if sys.platform != "linux":
            self.skipTest("Worker lock and backend execution require Linux")
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "data"
            root.mkdir()
            rng = np.random.default_rng(91)
            views = rng.normal(size=(40, 2, 3)).astype(np.float16)
            coords = [(12.48 + i * 0.001, 41.90) for i in range(40)]
            target_coords = [(-0.14 + i * 0.001, 51.50) for i in range(40)]
            write_dataset(root, "source", (17, 23), coords, views)
            write_dataset(root, "target", (11, 29), target_coords, views)
            specs = {"source": DatasetSpec("rome", "EPSG:32633", "fixture"),
                     "target": DatasetSpec("london", "EPSG:32630", "fixture")}
            config = RegionConfig(root, Path(temporary) / "results", enabled=True, token="test-token", datasets=specs)
            headers = {"Authorization": "Bearer test-token"}
            polygon = {"type": "Polygon", "coordinates": [
                [[12.47, 41.89], [12.53, 41.89], [12.53, 41.91], [12.47, 41.91], [12.47, 41.89]]
            ]}

            def ready(client, url):
                deadline = time.monotonic() + 20
                while time.monotonic() < deadline:
                    value = client.get(url, headers=headers).json()
                    if value["status"] in {"ready", "failed", "cancelled"}:
                        self.assertEqual(value["status"], "ready", value)
                        return value
                    time.sleep(0.02)
                self.fail("Fixture worker did not finish")

            with TestClient(create_app(config)) as client:
                payload = {"source_dataset_id": "source", "source_geometry": polygon,
                           "selected_views": [0, 1], "fit_components": 3, "compute_device": "cpu"}
                self.assertEqual(client.post("/api/region-matching/models", json=payload).status_code, 401)
                submitted = client.post("/api/region-matching/models", headers=headers, json=payload)
                self.assertEqual(submitted.status_code, 202, submitted.text)
                model = ready(client, submitted.json()["status_url"])
                self.assertEqual(model["pca_compute"]["actual"], "cpu")
                request = {"model_id": model["id"], "target_dataset_id": "target", "selected_components": 3,
                           "axis_weights": [1, 1, 1], "compute_device": "cpu", "neighborhoods": None}
                first = client.post("/api/region-matching/runs", headers=headers, json=request)
                run = ready(client, first.json()["status_url"])
                self.assertFalse(run["projection_cache_hit"])
                points = client.get(first.json()["status_url"] + "/points?limit=5", headers=headers).json()
                self.assertEqual(len(points["points"]), 5)
                self.assertEqual(points["total"], 40)
                request["axis_weights"] = [2, 1, 3]
                second = client.post("/api/region-matching/runs", headers=headers, json=request)
                repeated = ready(client, second.json()["status_url"])
                self.assertTrue(repeated["projection_cache_hit"])
                self.assertGreaterEqual(repeated["profile"]["actual_source_coverage"], 0.9 - 1e-12)
                request["neighborhoods"] = {"refine_candidates": 8, "source_half_splits": 2,
                                              "distribution_random_directions": 2,
                                              "distribution_quantiles": 8, "top_k": 2}
                third = client.post("/api/region-matching/runs", headers=headers, json=request)
                self.assertEqual(third.status_code, 202, third.text)
                aggregated = ready(client, third.json()["status_url"])
                self.assertTrue(aggregated["projection_cache_hit"])
                exported = client.get(third.json()["status_url"] + "/regions", headers=headers)
                self.assertEqual(exported.status_code, 200)
                regions = exported.json()
                self.assertEqual(regions["type"], "FeatureCollection")
                self.assertGreater(len(regions["features"]), 0)
                for feature in regions["features"]:
                    self.assertGreater(feature["properties"]["polygon_area_m2"], 0)
                    self.assertGreaterEqual(feature["properties"]["score"], 0)
                    self.assertLessEqual(feature["properties"]["score"], 1)


if __name__ == "__main__":
    unittest.main()
