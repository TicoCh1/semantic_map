from __future__ import annotations

import asyncio
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from backend.semantic_map.job_service import PromptBatchService
from backend.semantic_map.remote_schemas import ScoringJobCreate, TileCoord


class PromptBatchServicePlaintextCatalogTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.settings = SimpleNamespace(
            result_root=root / "results",
            public_base_url=None,
            execution_log_root=root / "audit",
            execution_log_enabled=False,
            execution_log_fsync=False,
            prompt_queue_max_size=8,
            default_dataset_id="london",
            default_dataset_ids=("london", "new_york"),
            default_dataset_group_id="london_new_york",
            scoring_version="current-scoring",
            model_version="current-model",
            tile_index_version="current-tiles",
            tile_zooms=(13,),
            job_memory_ttl_seconds=0,
            job_memory_max_count=100,
        )
        self.service = PromptBatchService(self.settings, engine=object())

        async def save_without_disk(job) -> None:
            async with self.service._lock:
                self.service._jobs[job.job_id] = job

        self.service._save_job = save_without_disk  # type: ignore[method-assign]

    async def asyncTearDown(self) -> None:
        await self.service.stop()
        self.temp_dir.cleanup()

    @staticmethod
    def request(prompt: str) -> ScoringJobCreate:
        return ScoringJobCreate(
            dataset_group_id="london_new_york",
            dataset_ids=["london", "new_york"],
            prompt=prompt,
            zooms=[13],
            priority_tiles=[
                TileCoord(z=13, x=1, y=1, dataset_id="london"),
                TileCoord(z=13, x=2, y=2, dataset_id="new_york"),
            ],
        )

    def write_active_manifest(self, dataset_id: str, prompt_id: str, prompt: str) -> None:
        revision = f"rev_{dataset_id}"
        payload = {
            "prompt": prompt,
            "canonical_prompt": prompt,
            "query_type": "text",
            "model_version": "historical-model",
            "scoring_version": "historical-scoring",
            "tile_index_version": "historical-tiles",
            "result_revision": revision,
            "created_at": "2026-08-10T00:00:00Z",
        }
        self.service.storage.write_json(
            self.service.storage.manifest_path(dataset_id, prompt_id, revision),
            payload,
        )
        self.service.storage.write_json(
            self.service.storage.revision_pointer_path(dataset_id, prompt_id),
            {"revision": revision},
        )

    async def test_cache_hit_uses_plaintext_only_and_never_touches_result_tree(self) -> None:
        self.write_active_manifest("london", "historical-london-id", "brick facade")
        self.write_active_manifest("new_york", "historical-new-york-id", "brick facade")
        self.assertEqual(self.service.storage.rebuild_prompt_catalog(), 2)

        def forbidden(*_args, **_kwargs):
            raise AssertionError("request-time result-tree access")

        self.service.storage.iter_active_manifests = forbidden  # type: ignore[method-assign]
        self.service.storage.manifest_path = forbidden  # type: ignore[method-assign]

        with patch(
            "backend.semantic_map.job_service.make_prompt_id",
            side_effect=AssertionError("cache-hit path must not compute a prompt hash"),
        ):
            job = await self.service.submit(self.request("BRICK-FACADE"), entrypoint="test")

        self.assertEqual(job.status, "ready")
        self.assertEqual(job.cache_status, "cache_hit")
        self.assertEqual(
            [result.prompt_id for result in job.results],
            ["historical-london-id", "historical-new-york-id"],
        )
        self.assertEqual(
            [result.result_revision for result in job.results],
            ["rev_london", "rev_new_york"],
        )
        self.assertTrue(all("/revisions/" in result.tile_url_template for result in job.results))

    async def test_new_plaintext_prompt_is_queued_without_disk_fallback(self) -> None:
        self.assertEqual(self.service.storage.rebuild_prompt_catalog(), 0)

        def forbidden(*_args, **_kwargs):
            raise AssertionError("request-time result-tree access")

        self.service.storage.iter_active_manifests = forbidden  # type: ignore[method-assign]
        self.service.storage.manifest_path = forbidden  # type: ignore[method-assign]

        job = await self.service.submit(self.request("new work"), entrypoint="test")

        self.assertEqual(job.status, "queued")
        self.assertEqual(job.cache_status, "pending")
        self.assertEqual(self.service._queue.qsize(), 1)
        rome_gaps = self.service.storage.prompts_missing_results(("rome_224_8_45",))
        self.assertEqual([coverage.prompt for coverage in rome_gaps], ["new work"])
        self.assertEqual(rome_gaps[0].missing_dataset_ids, ("rome_224_8_45",))
        if self.service._prompt_catalog_persist_task is not None:
            await self.service._prompt_catalog_persist_task
        catalog = self.service.storage.read_json(self.service.storage.prompt_catalog_path())
        self.assertIn("new work", catalog["prompts"])
        node = next(node for node in catalog["prompt_tree"] if node["prompt"] == "new work")
        self.assertEqual(node["ready_dataset_ids"], [])
        self.assertIn("rome_224_8_45", node["missing_dataset_ids"])

    async def test_active_text_job_deduplicates_by_plaintext_not_prompt_id(self) -> None:
        self.assertEqual(self.service.storage.rebuild_prompt_catalog(), 0)
        first = await self.service.submit(self.request("new work"), entrypoint="test")

        # Changing version inputs changes newly computed prompt IDs. Active
        # deduplication must still return the same plaintext-prompt job.
        self.settings.model_version = "different-model"
        self.settings.scoring_version = "different-scoring"
        second = await self.service.submit(self.request("NEW-WORK"), entrypoint="test")

        self.assertEqual(second.job_id, first.job_id)
        self.assertEqual(self.service._queue.qsize(), 1)

    async def test_interactive_request_bypasses_and_supersedes_queued_backfill(self) -> None:
        self.assertEqual(self.service.storage.rebuild_prompt_catalog(), 0)
        background = await self.service.submit(
            self.request("new work"),
            entrypoint="startup_prompt_tree_backfill",
        )
        interactive = await self.service.submit(
            self.request("NEW-WORK"),
            entrypoint="/api/scoring/jobs/batch",
        )

        self.assertNotEqual(interactive.job_id, background.job_id)
        self.assertEqual((await self.service.get_job(background.job_id)).status, "cancelled")
        self.assertEqual(self.service._queue.qsize(), 1)
        self.assertEqual(self.service._background_queue.qsize(), 1)

        submission, source_queue = await self.service._get_submission()
        self.assertEqual(submission.job_id, interactive.job_id)
        self.assertFalse(submission.background)
        source_queue.task_done()


class PromptBatchServiceRuntimeAdmissionTest(unittest.IsolatedAsyncioTestCase):
    async def test_submit_does_not_wait_for_slow_job_snapshot_storage(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            settings = SimpleNamespace(
                result_root=root / "results",
                public_base_url=None,
                execution_log_root=root / "audit",
                execution_log_enabled=False,
                execution_log_fsync=False,
                prompt_queue_max_size=8,
                default_dataset_id="london",
                default_dataset_ids=("london",),
                default_dataset_group_id="london",
                scoring_version="current-scoring",
                model_version="current-model",
                tile_index_version="current-tiles",
                tile_zooms=(13,),
                job_memory_ttl_seconds=0,
                job_memory_max_count=100,
            )
            service = PromptBatchService(settings, engine=object())
            service.storage.rebuild_prompt_catalog()
            write_started = threading.Event()
            release_write = threading.Event()

            def slow_job_write(_job) -> None:
                write_started.set()
                release_write.wait(timeout=2)

            service._write_job_file = slow_job_write  # type: ignore[method-assign]
            try:
                started = time.perf_counter()
                job = await service.submit(
                    ScoringJobCreate(dataset_id="london", prompt="fast admission", zooms=[13]),
                    entrypoint="/api/scoring/jobs",
                )
                elapsed = time.perf_counter() - started

                self.assertEqual(job.status, "queued")
                self.assertLess(elapsed, 0.2)
                self.assertTrue(await asyncio.to_thread(write_started.wait, 1))
            finally:
                release_write.set()
                await service.stop()


if __name__ == "__main__":
    unittest.main()
