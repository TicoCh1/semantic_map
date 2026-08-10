from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from backend.semantic_map.result_storage import PromptCoverage, ResultStorage


class ResultStoragePromptCatalogTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.result_root = Path(self.temp_dir.name)
        self.storage = ResultStorage(
            SimpleNamespace(
                result_root=self.result_root,
                public_base_url=None,
            )
        )

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    @staticmethod
    def manifest(
        prompt: str,
        revision: str,
        *,
        created_at: str = "2026-08-10T00:00:00Z",
        query_type: str = "text",
    ) -> dict:
        return {
            "prompt": prompt,
            "canonical_prompt": prompt,
            "query_type": query_type,
            # Versions deliberately remain in historical manifests. They are
            # not part of plaintext prompt matching.
            "model_version": "old-model",
            "scoring_version": "old-scoring",
            "tile_index_version": "old-tiles",
            "result_revision": revision,
            "created_at": created_at,
        }

    def write_active_manifest(self, dataset_id: str, prompt_id: str, payload: dict) -> Path:
        revision = str(payload["result_revision"])
        manifest_path = self.storage.manifest_path(dataset_id, prompt_id, revision)
        self.storage.write_json(manifest_path, payload)
        self.storage.write_json(self.storage.revision_pointer_path(dataset_id, prompt_id), {"revision": revision})
        return manifest_path

    def test_startup_rebuild_writes_sorted_plaintext_catalog(self) -> None:
        self.storage.write_json(
            self.storage.prompt_catalog_path(),
            {
                "schema_version": 1,
                "prompts": ["stale prompt"],
                "entries": [
                    {
                        "prompt": "stale prompt",
                        "dataset_id": "removed_dataset",
                        "prompt_id": "removed-id",
                        "manifest_path": "removed/manifest.json",
                    }
                ],
            },
        )
        self.write_active_manifest(
            "london",
            "legacy-zebra-id",
            self.manifest("Zebra crossing", "rev_zebra"),
        )
        self.write_active_manifest(
            "new_york",
            "legacy-apple-id",
            self.manifest("Apple trees", "rev_apple"),
        )

        self.assertEqual(self.storage.rebuild_prompt_catalog(), 2)
        self.assertEqual(
            self.storage.find_prompt_result(dataset_id="london", prompt="zebra crossing"),
            "legacy-zebra-id",
        )
        self.assertEqual(
            self.storage.find_prompt_result(dataset_id="new_york", prompt="APPLE TREES"),
            "legacy-apple-id",
        )

        payload = self.storage.read_json(self.storage.prompt_catalog_path())
        self.assertIsNotNone(payload)
        self.assertEqual(payload["prompts"], ["apple trees", "zebra crossing"])
        self.assertEqual(
            [(entry["prompt"], entry["dataset_id"]) for entry in payload["entries"]],
            [("apple trees", "new_york"), ("zebra crossing", "london")],
        )

    def test_lookup_miss_never_rescans_disk_after_startup(self) -> None:
        self.assertEqual(self.storage.rebuild_prompt_catalog(), 0)
        self.storage.iter_active_manifests = lambda: (_ for _ in ()).throw(AssertionError("disk rescan"))  # type: ignore[method-assign]

        self.assertIsNone(self.storage.find_prompt_result(dataset_id="london", prompt="brand new query"))

    def test_duplicate_plaintext_prompt_uses_latest_active_result(self) -> None:
        self.write_active_manifest(
            "london",
            "old-id",
            self.manifest("brick facade", "rev_old", created_at="2026-08-09T20:00:00Z"),
        )
        self.write_active_manifest(
            "london",
            "new-id",
            self.manifest("brick facade", "rev_new", created_at="2026-08-10T00:00:00Z"),
        )

        self.assertEqual(self.storage.rebuild_prompt_catalog(), 1)
        self.assertEqual(
            self.storage.find_prompt_result(dataset_id="london", prompt="brick facade"),
            "new-id",
        )

    def test_new_result_upserts_memory_and_plaintext_file(self) -> None:
        known_dataset_ids = ("london", "new_york", "rome")
        self.assertEqual(self.storage.rebuild_prompt_catalog(known_dataset_ids=known_dataset_ids), 0)
        self.storage.register_prompt(prompt="new-work", known_dataset_ids=known_dataset_ids)
        payload = self.manifest("new-work", "rev_new")
        manifest_path = self.storage.manifest_path("new_york", "opaque-result-id", "rev_new")

        self.assertTrue(
            self.storage.upsert_prompt_result(
                dataset_id="new_york",
                prompt_id="opaque-result-id",
                payload=payload,
                manifest_path=manifest_path,
            )
        )
        self.assertEqual(
            self.storage.find_prompt_result(dataset_id="new_york", prompt="new work"),
            "opaque-result-id",
        )
        catalog = self.storage.read_json(self.storage.prompt_catalog_path())
        self.assertEqual(catalog["prompts"], ["new work"])
        self.assertEqual(
            catalog["prompt_tree"],
            [
                {
                    "prompt": "new work",
                    "ready_dataset_ids": ["new_york"],
                    "missing_dataset_ids": ["london", "rome"],
                }
            ],
        )

    def test_city_gaps_survive_restart_and_close_as_results_arrive(self) -> None:
        known_dataset_ids = ("london", "new_york", "rome")
        london_payload = self.manifest("street market", "rev_london")
        self.write_active_manifest("london", "london-result", london_payload)

        self.assertEqual(self.storage.rebuild_prompt_catalog(known_dataset_ids=known_dataset_ids), 1)
        self.assertEqual(
            self.storage.prompts_missing_results(("new_york", "rome")),
            (
                PromptCoverage(
                    prompt="street market",
                    ready_dataset_ids=("london",),
                    missing_dataset_ids=("new_york", "rome"),
                ),
            ),
        )

        restarted = ResultStorage(self.storage.settings)
        self.assertEqual(restarted.rebuild_prompt_catalog(known_dataset_ids=known_dataset_ids), 1)
        restarted_gap = restarted.prompts_missing_results(("new_york", "rome"))
        self.assertEqual(restarted_gap[0].prompt, "street market")
        self.assertEqual(restarted_gap[0].missing_dataset_ids, ("new_york", "rome"))

        new_york_payload = self.manifest("street market", "rev_new_york")
        new_york_path = self.write_active_manifest("new_york", "new-york-result", new_york_payload)
        restarted.upsert_prompt_result(
            dataset_id="new_york",
            prompt_id="new-york-result",
            payload=new_york_payload,
            manifest_path=new_york_path,
        )
        remaining_gap = restarted.prompts_missing_results(known_dataset_ids)
        self.assertEqual(remaining_gap[0].ready_dataset_ids, ("london", "new_york"))
        self.assertEqual(remaining_gap[0].missing_dataset_ids, ("rome",))

    def test_reference_results_are_not_text_prompt_cache_entries(self) -> None:
        self.write_active_manifest(
            "london",
            "reference-id",
            self.manifest("reference pano", "rev_reference", query_type="pano_reference"),
        )

        self.assertEqual(self.storage.rebuild_prompt_catalog(), 0)
        self.assertIsNone(self.storage.find_prompt_result(dataset_id="london", prompt="reference pano"))
        self.assertEqual(len(self.storage.startup_pano_manifests()), 1)


if __name__ == "__main__":
    unittest.main()
