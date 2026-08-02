from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.responses import FileResponse

os.environ.setdefault("TEMPORARY_SCORER_ENABLED", "true")

from backend.semantic_map import remote_api  # noqa: E402
from backend.semantic_map.result_storage import ResultStorage  # noqa: E402


class CountingStorage(ResultStorage):
    def __init__(self, settings) -> None:
        super().__init__(settings)
        self.json_reads = 0

    def read_json(self, path):
        self.json_reads += 1
        return super().read_json(path)


class RevisionTileFastPathTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.result_root = Path(self.temp_dir.name)
        (self.result_root / "london_224_8_45").mkdir()
        self.storage = CountingStorage(
            SimpleNamespace(
                result_root=self.result_root,
                public_base_url="https://example.test",
            )
        )
        self.original_storage = remote_api.storage
        remote_api.storage = self.storage
        remote_api.load_immutable_revision_manifest.cache_clear()

        self.dataset_id = "shanghai_224_8_45_2B"
        self.prompt_id = "sample--abc123"
        self.revision = "rev_test"
        revision_dir = self.storage.revision_dir(self.dataset_id, self.prompt_id, self.revision)
        self.tile_path = revision_dir / "tiles" / "10" / "511" / "340.geojson"
        self.tile_path.parent.mkdir(parents=True)
        self.tile_path.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
        self.storage.write_json(
            revision_dir / "manifest.json",
            {
                "prompt_id": self.prompt_id,
                "dataset_id": self.dataset_id,
                "dataset_group_id": "london_shanghai",
                "prompt": "sample",
                "query_type": "text",
                "source_type": "zxy_geojson",
                "tile_url_template": "unused",
                "zooms": [10, 11, 12, 13],
                "stats": {
                    "count": 1,
                    "score_min": 0,
                    "score_max": 0,
                    "zscore_min": 0,
                    "zscore_max": 0,
                },
                "model_version": "test",
                "scoring_version": "test",
                "tile_index_version": "test",
                "density_trigger_points": 1,
                "density_keep_points": 1,
                "result_revision": self.revision,
                "created_at": "2026-08-02T00:00:00Z",
            },
        )
        self.storage.json_reads = 0

    def tearDown(self) -> None:
        remote_api.load_immutable_revision_manifest.cache_clear()
        remote_api.storage = self.original_storage
        self.temp_dir.cleanup()

    def test_direct_and_legacy_revision_hits_do_not_read_json(self) -> None:
        direct_response = remote_api.get_result_revision_tile(
            self.dataset_id,
            self.prompt_id,
            self.revision,
            10,
            511,
            340,
        )
        legacy_response = remote_api.get_result_tile(
            self.prompt_id,
            10,
            511,
            340,
            self.revision,
        )

        self.assertIsInstance(direct_response, FileResponse)
        self.assertIsInstance(legacy_response, FileResponse)
        self.assertEqual(self.storage.json_reads, 0)

    def test_immutable_revision_manifest_is_parsed_once(self) -> None:
        self.tile_path.unlink()

        first = remote_api.load_immutable_revision_manifest(self.dataset_id, self.prompt_id, self.revision)
        second = remote_api.load_immutable_revision_manifest(self.dataset_id, self.prompt_id, self.revision)

        self.assertIs(first, second)
        self.assertEqual(self.storage.json_reads, 1)

    def test_pre_revision_legacy_tile_hit_does_not_read_json(self) -> None:
        legacy_prompt_id = "legacy--abc123"
        legacy_tile_path = self.storage.legacy_tile_path(self.dataset_id, legacy_prompt_id, 10, 511, 340)
        legacy_tile_path.parent.mkdir(parents=True)
        legacy_tile_path.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")

        response = remote_api.get_result_tile(legacy_prompt_id, 10, 511, 340)

        self.assertIsInstance(response, FileResponse)
        self.assertEqual(self.storage.json_reads, 0)

    def test_revision_url_directly_addresses_dataset_and_revision(self) -> None:
        self.assertEqual(
            self.storage.tile_url_template(self.dataset_id, self.prompt_id, revision=self.revision),
            (
                "https://example.test/api/scoring/results/shanghai_224_8_45_2B/"
                "sample--abc123/revisions/rev_test/tiles/{z}/{x}/{y}.geojson"
            ),
        )


if __name__ == "__main__":
    unittest.main()
