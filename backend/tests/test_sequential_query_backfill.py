from __future__ import annotations

import unittest

from backend.semantic_map.sequential_query_backfill import (
    discover_historical_queries,
    historical_query_from_manifest,
    missing_queries_for_dataset,
)


class _FakePath:
    def __init__(self, exists: bool) -> None:
        self._exists = exists

    def exists(self) -> bool:
        return self._exists


class _FakeStorage:
    def __init__(self) -> None:
        self.manifests = [
            (
                "london",
                "prompt-a-london",
                {"query_type": "text", "canonical_prompt": "  Query A  ", "result_revision": "r1"},
            ),
            (
                "shanghai",
                "prompt-a-shanghai",
                {"query_type": "text", "prompt": "query a", "result_revision": "r2"},
            ),
            (
                "london",
                "image-b-london",
                {
                    "query_type": "pano_reference",
                    "prompt": "Reference pano 42 (london)",
                    "reference_pano": {
                        "dataset_id": "london",
                        "pano_id": "42",
                        "city_id": "london",
                        "lon": -0.1,
                        "lat": 51.5,
                    },
                    "result_revision": "r3",
                },
            ),
        ]
        self.ready = {
            ("london", "prompt-a-london", "r1", "score"),
            ("london", "prompt-a-london", "r1", "zscore"),
            ("shanghai", "prompt-a-shanghai", "r2", "score"),
            ("london", "image-b-london", "r3", "score"),
            ("london", "image-b-london", "r3", "zscore"),
        }

    def iter_active_manifests(self):
        return iter(self.manifests)

    def prompt_catalog_path(self):
        return "prompt_catalog.json"

    def read_json(self, _path):
        return {"schema_version": 2, "prompts": ["Query A"]}

    def score_array_path(self, dataset_id, prompt_id, revision):
        return _FakePath((dataset_id, prompt_id, revision, "score") in self.ready)

    def zscore_array_path(self, dataset_id, prompt_id, revision):
        return _FakePath((dataset_id, prompt_id, revision, "zscore") in self.ready)


class SequentialQueryBackfillTests(unittest.TestCase):
    def test_inventory_builds_union_and_requires_both_arrays(self) -> None:
        queries = discover_historical_queries(_FakeStorage(), ("london", "shanghai", "rome"))

        self.assertEqual(len(queries), 2)
        text_query = next(query for query in queries if query.query_type == "text")
        image_query = next(query for query in queries if query.query_type == "pano_reference")
        self.assertEqual(text_query.prompt, "query a")
        self.assertEqual(text_query.ready_dataset_ids, frozenset({"london"}))
        self.assertEqual(text_query.manifest_dataset_ids, frozenset({"london", "shanghai"}))
        self.assertEqual(image_query.ready_dataset_ids, frozenset({"london"}))
        self.assertEqual(len(missing_queries_for_dataset(queries, "rome")), 2)

    def test_image_key_matches_existing_backfill_identity(self) -> None:
        parsed = historical_query_from_manifest(
            {
                "query_type": "pano_reference",
                "reference_pano": {
                    "dataset_id": "new_york",
                    "pano_dataset_id": "new_york_outside",
                    "pano_id": 60000,
                },
            }
        )

        self.assertIsNotNone(parsed)
        assert parsed is not None
        self.assertEqual(parsed[0], ("pano_reference", "new_york", "new_york_outside", "60000"))


if __name__ == "__main__":
    unittest.main()
