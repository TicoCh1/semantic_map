from __future__ import annotations

import unittest

from backend.semantic_map.prompt_ids import make_reference_prompt_id
from backend.semantic_map.scoring_models import PanoRecord
from backend.semantic_map.text_cor_t_engine import TextCorTScoringEngine


class DuplicatePanoIdentityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.records = (
            PanoRecord(pano_id="42", row_index=0, lon=-73.9855, lat=40.7580, date=20200101),
            PanoRecord(pano_id="42", row_index=1, lon=-73.9000, lat=40.6500, date=20200202),
        )
        self.engine = TextCorTScoringEngine.__new__(TextCorTScoringEngine)
        self.engine._record_indexes = {}
        self.engine.get_dataset_records = lambda _dataset_id: self.records

    def test_reference_record_uses_location_instead_of_last_duplicate_id(self) -> None:
        manhattan = self.engine._record_for_pano(
            "new_york_224_8_45",
            "42",
            lon=-73.9855,
            lat=40.7580,
            capture_date=20200101,
        )
        outside = self.engine._record_for_pano(
            "new_york_224_8_45",
            "42",
            lon=-73.9000,
            lat=40.6500,
            capture_date=20200202,
        )
        self.assertEqual(manhattan.row_index, 0)
        self.assertEqual(outside.row_index, 1)
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            self.engine._record_for_pano("new_york_224_8_45", "42")

    def test_reference_cache_identity_includes_pano_dataset(self) -> None:
        common = {
            "dataset_id": "london_224_8_45",
            "reference_dataset_id": "new_york_224_8_45",
            "reference_pano_id": "42",
            "model_version": "test-model",
            "scoring_version": "test-scoring",
            "tile_index_version": "test-tiles",
        }
        manhattan = make_reference_prompt_id(
            **common,
            reference_pano_dataset_id="new_york_manhattan_224_8_45",
        )
        outside = make_reference_prompt_id(
            **common,
            reference_pano_dataset_id="new_york_outside_manhattan_224_8_45",
        )
        self.assertNotEqual(manhattan, outside)


if __name__ == "__main__":
    unittest.main()
