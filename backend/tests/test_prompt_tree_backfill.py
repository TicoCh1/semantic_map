from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.semantic_map import remote_api
from backend.semantic_map.result_storage import PromptCoverage


class PromptTreeBackfillTest(unittest.IsolatedAsyncioTestCase):
    async def test_backfill_queues_only_loaded_datasets_missing_from_tree(self) -> None:
        submissions = []

        class FakeStorage:
            @staticmethod
            def prompts_missing_results(dataset_ids):
                self.assertEqual(tuple(dataset_ids), ("new_york", "rome"))
                return (
                    PromptCoverage(
                        prompt="street market",
                        ready_dataset_ids=("london",),
                        missing_dataset_ids=("new_york", "rome"),
                    ),
                )

            @staticmethod
            def startup_pano_manifests():
                return ()

        class FakeService:
            storage = FakeStorage()

            @staticmethod
            async def submit(payload, **kwargs):
                submissions.append((payload, kwargs))
                return SimpleNamespace(status="queued")

        fake_settings = SimpleNamespace(
            default_dataset_ids=("new_york", "rome"),
            default_dataset_group_id="new_york_rome",
        )
        with (
            patch.object(remote_api, "prompt_batch_service", FakeService()),
            patch.object(remote_api, "settings", fake_settings),
        ):
            await remote_api.backfill_historical_queries()

        self.assertEqual(len(submissions), 1)
        payload, kwargs = submissions[0]
        self.assertEqual(payload.prompt, "street market")
        self.assertEqual(payload.dataset_ids, ["new_york", "rome"])
        self.assertFalse(payload.force_override)
        self.assertEqual(kwargs["entrypoint"], "startup_prompt_tree_backfill")


if __name__ == "__main__":
    unittest.main()
