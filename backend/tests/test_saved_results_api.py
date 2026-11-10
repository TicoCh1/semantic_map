import csv
import io
import os
import subprocess
import sys
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.semantic_map.backend_config import get_backend_settings
from backend.semantic_map.result_storage import ResultStorage
from backend.semantic_map.saved_results_api import create_saved_results_router


class SavedResultsApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.settings = replace(get_backend_settings(), result_root=root / "results", data_root=root / "data",
                                default_dataset_ids=("test_city",), backend_token="test-token")
        self.storage = ResultStorage(self.settings)
        app = FastAPI()
        app.dependency_overrides[get_backend_settings] = lambda: self.settings
        app.include_router(create_saved_results_router(self.settings, self.storage))
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.client.headers["Authorization"] = "Bearer test-token"
        self.base = "/api/scoring/results/test_city/bridge"
        self.directory = self.write_result("bridge", revision="rev1")
        self.data_dir = self.settings.data_root / "test_city"
        self.data_dir.mkdir(parents=True)
        # Deliberately create shards out of lexical/numeric order, with no embedding files.
        np.save(self.data_dir / "views_emb_shard_10_ref.npy", [[77, -0.12, 51.52, 202402]])
        np.save(self.data_dir / "views_emb_shard_2_ref.npy", [[77, -0.10, 51.50, 202401]])

    def write_result(self, prompt_id, revision=None, dataset_id="test_city"):
        directory = (self.storage.revision_dir(dataset_id, prompt_id, revision) if revision
                     else self.storage.result_dir(dataset_id, prompt_id))
        directory.mkdir(parents=True)
        self.storage.write_json(directory / "manifest.json", {
            "dataset_id": dataset_id, "prompt_id": prompt_id, "prompt": "a bridge",
            "result_revision": revision, "stats": {"count": 2}, "zooms": [10, 13],
        })
        np.save(directory / "score.npy", [0.25, 0.75])
        np.save(directory / "zscore.npy", [-0.5, 1.5])
        if revision:
            self.storage.activate_result_revision(dataset_id, prompt_id, revision)
        return directory

    def test_downloads_require_existing_backend_token(self):
        for suffix in ("/api/scoring/results", self.base + "/manifest", self.base + "/download.csv",
                       self.base + "/files/score.npy", self.base + "/tiles/13/0/0.geojson"):
            response = self.client.get(suffix, headers={"Authorization": "Bearer wrong"})
            self.assertEqual(response.status_code, 401, suffix)

    def test_catalog_includes_active_and_legacy_complete_results_only(self):
        self.write_result("legacy")
        self.write_result("hidden", dataset_id="other_city")
        incomplete = self.write_result("incomplete")
        (incomplete / "score.npy").unlink()
        self.storage.result_dir("test_city", "queued").mkdir()
        before = sorted(str(p) for p in self.settings.result_root.rglob("*"))
        response = self.client.get("/api/scoring/results")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 2)
        self.assertEqual(payload["skipped_incomplete"], 2)
        entry = payload["results"][0]
        self.assertEqual(entry["result_revision"], "rev1")
        self.assertIn("revision=rev1", entry["csv_url"])
        self.assertEqual(entry["files"]["score.npy"]["bytes"], (self.directory / "score.npy").stat().st_size)
        self.assertEqual(before, sorted(str(p) for p in self.settings.result_root.rglob("*")))
        self.assertEqual(self.client.get("/api/scoring/results?dataset_id=other_city").status_code, 404)

    def test_csv_contains_all_rows_in_numeric_shard_order_without_deduplicating_panos(self):
        response = self.client.get(self.base + "/download.csv")
        self.assertEqual(response.status_code, 200, response.text)
        rows = list(csv.DictReader(io.StringIO(response.text)))
        self.assertEqual(len(rows), 2)
        self.assertEqual([r["pano_id"] for r in rows], ["77", "77"])
        self.assertEqual([r["lon"] for r in rows], ["-0.1", "-0.12"])
        self.assertEqual([r["score"] for r in rows], ["0.25", "0.75"])
        self.assertEqual([r["row_index"] for r in rows], ["0", "1"])
        self.assertEqual(rows[1]["result_revision"], "rev1")
        self.assertEqual(response.headers["x-result-count"], "2")

    def test_stream_keeps_rows_across_buffer_boundaries(self):
        refs = np.tile([123, 0.1, 51, 202401], (1025, 1))
        np.save(self.data_dir / "views_emb_shard_2_ref.npy", refs)
        (self.data_dir / "views_emb_shard_10_ref.npy").unlink()
        for name in ("score.npy", "zscore.npy"):
            np.save(self.directory / name, np.arange(1025, dtype=np.float32))
        manifest = self.storage.read_json(self.directory / "manifest.json")
        manifest["stats"]["count"] = 1025
        self.storage.write_json(self.directory / "manifest.json", manifest)
        response = self.client.get(self.base + "/download.csv")
        rows = list(csv.DictReader(io.StringIO(response.text)))
        self.assertEqual(len(rows), 1025)
        self.assertEqual(rows[-1]["score"], "1024.0")

    def test_explicit_revision_is_stable_after_pointer_changes(self):
        other = self.write_result("bridge", revision="rev2")
        np.save(other / "score.npy", [9.0, 10.0])
        response = self.client.get(self.base + "/files/score.npy?revision=rev1")
        np.testing.assert_array_equal(np.load(io.BytesIO(response.content)), [0.25, 0.75])
        rows = list(csv.DictReader(io.StringIO(self.client.get(self.base + "/download.csv?revision=rev1").text)))
        self.assertEqual(rows[0]["score"], "0.25")
        self.assertEqual(self.client.get(self.base + "/manifest").json()["result_revision"], "rev2")

    def test_legacy_csv_and_manifest(self):
        self.write_result("legacy")
        base = "/api/scoring/results/test_city/legacy"
        self.assertEqual(self.client.get(base + "/download.csv").status_code, 200)
        self.assertIn("/legacy/tiles/", self.client.get(base + "/manifest").json()["tile_url_template"])

    def test_missing_or_misaligned_data_fails_without_computation(self):
        np.save(self.directory / "score.npy", [1.0])
        self.assertEqual(self.client.get(self.base + "/download.csv").status_code, 409)
        (self.directory / "score.npy").unlink()
        self.assertEqual(self.client.get(self.base + "/download.csv").status_code, 409)
        self.assertEqual(self.client.get(self.base + "/files/score.npy").status_code, 404)
        self.assertEqual(self.client.get(self.base + "/manifest?revision=missing").status_code, 404)
        self.assertEqual(self.client.get(self.base.replace("bridge", "new-query") + "/download.csv").status_code, 404)

    def test_existing_tiles_download_and_missing_tiles_do_not_generate(self):
        tile = self.directory / "tiles/13/0/0.geojson"
        tile.parent.mkdir(parents=True)
        tile.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
        for segment in ("", "/revisions/rev1"):
            self.assertEqual(self.client.get(self.base + segment + "/tiles/13/0/0.geojson").json()["features"], [])
        self.assertEqual(self.client.get(self.base + "/tiles/13/1/0.geojson").status_code, 404)
        self.assertFalse((tile.parent.parent / "1/0.geojson").exists())
        self.assertEqual(self.client.get(self.base + "/tiles/25/0/0.geojson").status_code, 400)

    def test_all_job_admission_routes_are_denied_even_with_valid_token(self):
        for route in ("/api/scoring/jobs", "/api/scoring/jobs/batch", "/api/scoring/arcgis/merged-features/page"):
            response = self.client.post(route, json={"prompt": "new query", "prompts": ["new query"]})
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json()["detail"]["code"], "query_submission_disabled")

    def test_path_validation_and_private_file_allowlist(self):
        for filename in ("job.json", "current.json", "ratings.sqlite3", "anything.env"):
            self.assertEqual(self.client.get(self.base + "/files/" + filename).status_code, 404)
        self.assertEqual(self.client.get(self.base + "/manifest?revision=../outside").status_code, 400)
        self.storage.write_json(self.storage.revision_pointer_path("test_city", "bridge"), {"revision": "../outside"})
        self.assertEqual(self.client.get(self.base + "/manifest").status_code, 400)

    def test_malformed_metadata_is_reported_and_skipped_by_catalog(self):
        self.storage.write_json(self.directory / "manifest.json", ["invalid manifest"])
        self.assertEqual(self.client.get(self.base + "/manifest").status_code, 409)
        catalog = self.client.get("/api/scoring/results").json()
        self.assertEqual(catalog["count"], 0)
        self.assertEqual(catalog["skipped_incomplete"], 1)

    def test_human_app_integrates_downloads_without_importing_scoring_runtime(self):
        env = dict(os.environ, WORKSPACE_ROOT=self.temp.name, RESULT_ROOT=str(self.settings.result_root),
                   DATA_ROOT=str(self.settings.data_root), PANO_CACHE_ROOT=str(Path(self.temp.name) / "cache"),
                   PANO_INDEX_PATH=str(Path(self.temp.name) / "index.sqlite"), DEFAULT_DATASET_IDS="test_city")
        code = """
import json, sys
from backend.semantic_map.human_verification_api import app, capabilities, ready
assert capabilities()['downloads_enabled'] is True
assert ready()['query_submission_enabled'] is False
paths = {route.path for route in app.routes}
assert '/api/scoring/results' in paths
assert '/api/verification/ratings' in paths
assert '/api/verification/sample' in paths
assert not any(name in sys.modules for name in (
    'torch', 'transformers', 'backend.semantic_map.remote_api',
    'backend.semantic_map.job_service', 'backend.semantic_map.text_cor_t_engine'))
print('CPU-only application imports verified')
"""
        process = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True)
        self.assertEqual(process.returncode, 0, process.stdout + process.stderr)


if __name__ == "__main__":
    unittest.main()
