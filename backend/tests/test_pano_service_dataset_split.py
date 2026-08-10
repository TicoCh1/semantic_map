from __future__ import annotations

import io
import os
import sqlite3
import tarfile
import tempfile
import unittest
from dataclasses import replace
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.semantic_map import remote_api
from backend.semantic_map.backend_config import get_backend_settings
from backend.semantic_map.pano_service import (
    NEW_YORK_MANHATTAN_PANO_DATASET_ID,
    NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID,
    NEW_YORK_SCORING_DATASET_ID,
    PanoCoordinateMismatchError,
    PanoServiceRegistry,
)


class PanoDatasetSplitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.tar_dir = self.root / "pano"
        self.tar_dir.mkdir()
        self._write_tar(
            "New_York_Manhattan_chunk_0.tar",
            "42_-73.9855_40.7580_20200101.jpg",
            b"manhattan-image",
        )
        self._write_tar(
            "New_York_Option_A_outside_Manhattan_chunk_0.tar",
            "42_-73.9000_40.6500_20200202.jpg",
            b"outside-image",
        )
        self.settings = replace(
            get_backend_settings(),
            default_dataset_id=NEW_YORK_SCORING_DATASET_ID,
            default_dataset_ids=(NEW_YORK_SCORING_DATASET_ID,),
            pano_tar_dir=self.tar_dir,
            pano_cache_root=self.root / "cache",
            pano_index_path=self.root / "index" / "pano_index.sqlite",
            pano_tar_ranges="unused-default-range",
            public_base_url=None,
        )
        self.environment = patch.dict(
            os.environ,
            {
                "PANO_TAR_RANGES_NEW_YORK_224_8_45": "legacy-combined-index-must-not-be-used",
                "PANO_TAR_RANGES_NEW_YORK_MANHATTAN_224_8_45": "",
                "PANO_TAR_RANGES_NEW_YORK_OUTSIDE_MANHATTAN_224_8_45": "",
            },
        )
        self.environment.start()
        self.registries: list[PanoServiceRegistry] = []

    def tearDown(self) -> None:
        for registry in self.registries:
            registry.close()
        self.environment.stop()
        self.temp_dir.cleanup()

    def _registry(self) -> PanoServiceRegistry:
        registry = PanoServiceRegistry(self.settings)
        self.registries.append(registry)
        return registry

    def _write_tar(self, filename: str, member_name: str, payload: bytes) -> None:
        with tarfile.open(self.tar_dir / filename, "w") as archive:
            info = tarfile.TarInfo(member_name)
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))

    def test_same_numeric_id_is_isolated_by_pano_dataset(self) -> None:
        registry = self._registry()
        manhattan_service = registry.service_for(NEW_YORK_MANHATTAN_PANO_DATASET_ID)
        outside_service = registry.service_for(NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID)

        manhattan_service.warmup()
        outside_service.warmup()

        manhattan = manhattan_service.ensure_pano_image("42")
        outside = outside_service.ensure_pano_image("42")
        self.assertIsNotNone(manhattan)
        self.assertIsNotNone(outside)
        assert manhattan is not None
        assert outside is not None

        manhattan_entry, manhattan_path = manhattan
        outside_entry, outside_path = outside
        self.assertEqual(manhattan_path.read_bytes(), b"manhattan-image")
        self.assertEqual(outside_path.read_bytes(), b"outside-image")
        self.assertNotEqual(manhattan_service.settings.pano_index_path, outside_service.settings.pano_index_path)
        self.assertNotEqual(manhattan_entry.entry_key, outside_entry.entry_key)
        self.assertIn(NEW_YORK_MANHATTAN_PANO_DATASET_ID, manhattan_service.image_url(manhattan_entry))
        self.assertIn(NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID, outside_service.image_url(outside_entry))

        with self.assertRaises(PanoCoordinateMismatchError):
            manhattan_service.ensure_pano_image("42", lon=-73.9000, lat=40.6500)
        selected = outside_service.ensure_pano_image("42", lon=-73.9000, lat=40.6500, capture_date=20200202)
        self.assertIsNotNone(selected)
        assert selected is not None
        self.assertEqual(selected[1].read_bytes(), b"outside-image")

    def test_scoring_dataset_never_builds_a_combined_pano_index(self) -> None:
        registry = self._registry()
        with self.assertRaisesRegex(ValueError, "not configured"):
            registry.service_for(NEW_YORK_SCORING_DATASET_ID)

    def test_lookup_uses_the_pano_id_index(self) -> None:
        service = self._registry().service_for(NEW_YORK_MANHATTAN_PANO_DATASET_ID)
        service.warmup()
        with closing(sqlite3.connect(service.settings.pano_index_path)) as connection:
            plan = connection.execute(
                "EXPLAIN QUERY PLAN SELECT entry_key FROM panos WHERE pano_id = ?",
                (42,),
            ).fetchall()
        self.assertIn("panos_pano_idx", " ".join(str(row) for row in plan))

    def test_http_metadata_and_image_are_pinned_to_the_selected_dataset_entry(self) -> None:
        registry = self._registry()
        registry.service_for(NEW_YORK_MANHATTAN_PANO_DATASET_ID).warmup()
        registry.service_for(NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID).warmup()
        app = FastAPI()
        app.include_router(remote_api.router)
        app.dependency_overrides[get_backend_settings] = lambda: replace(self.settings, backend_token=None)

        with (
            patch.object(remote_api, "pano_registry", registry),
            patch.object(remote_api, "pano_warmup_task", None),
            TestClient(app) as client,
        ):
            rejected = client.get(
                f"/api/datasets/{NEW_YORK_MANHATTAN_PANO_DATASET_ID}/panos/42",
                params={"lon": -73.9000, "lat": 40.6500, "date": 20200202},
            )
            self.assertEqual(rejected.status_code, 409)

            metadata_response = client.get(
                f"/api/datasets/{NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID}/panos/42",
                params={"lon": -73.9000, "lat": 40.6500, "date": 20200202},
            )
            self.assertEqual(metadata_response.status_code, 200)
            metadata = metadata_response.json()
            self.assertEqual(metadata["pano_dataset_id"], NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID)
            self.assertIn("entry_key=", metadata["image_url"])

            image_response = client.get(metadata["image_url"])
            self.assertEqual(image_response.status_code, 200)
            self.assertEqual(image_response.content, b"outside-image")


if __name__ == "__main__":
    unittest.main()
