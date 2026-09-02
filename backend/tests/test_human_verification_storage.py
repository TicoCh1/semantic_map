import csv
import io
import tempfile
import unittest
from pathlib import Path

from backend.semantic_map.human_verification_schemas import (
    HumanVerificationRatingBatch,
    HumanVerificationRatingSubmission,
    HumanVerificationStudy,
    HumanVerificationTask,
)
from backend.semantic_map.human_verification_storage import HumanVerificationStorage


class HumanVerificationStorageTests(unittest.TestCase):
    def test_encore_is_stored_as_a_second_rating_with_the_same_pano_id(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            storage = HumanVerificationStorage(Path(directory) / "ratings.sqlite3")
            source_task = HumanVerificationTask(
                task_id="task-source",
                dataset_id="london_224_8_45",
                city_id="london",
                pano_id="12345",
                lon=-0.1,
                lat=51.5,
                prompt_id="prompt-one",
                score=0.25,
                zscore=1.5,
                ai_bucket=4,
                bucket_min=1.4,
                bucket_max=2.2,
                stratum_population=100,
                stratum_sample_count=1,
            )
            storage.register_study(
                HumanVerificationStudy(
                    study_id="study-one",
                    prompt="a test prompt",
                    samples_per_bucket_per_dataset=1,
                    seed=42,
                    dataset_ids=["london_224_8_45"],
                    tasks=[source_task],
                    strata=[],
                )
            )

            storage.record_ratings(
                HumanVerificationRatingBatch(
                    ratings=[
                        HumanVerificationRatingSubmission(
                            study_id="study-one",
                            task_id="task-source",
                            source_task_id="task-source",
                            rater_id="rater-one",
                            human_rating=4,
                            elapsed_ms=1200,
                            rated_at="2026-09-02T12:00:00Z",
                        ),
                        HumanVerificationRatingSubmission(
                            study_id="study-one",
                            task_id="encore-one",
                            source_task_id="task-source",
                            rater_id="rater-one",
                            human_rating=3,
                            elapsed_ms=900,
                            rated_at="2026-09-02T12:01:00Z",
                        ),
                    ]
                ),
                client_ip="203.0.113.7",
                user_agent="test-browser",
            )

            rows = list(csv.DictReader(io.StringIO(storage.export_csv().lstrip("\ufeff"))))
            self.assertEqual(len(rows), 2)
            self.assertEqual({row["task_id"] for row in rows}, {"task-source", "encore-one"})
            self.assertEqual({row["pano_id"] for row in rows}, {"12345"})
            self.assertEqual({row["client_ip"] for row in rows}, {"203.0.113.7"})
            self.assertEqual(len({row["visitor_label"] for row in rows}), 1)
            self.assertTrue(rows[0]["visitor_label"].startswith("visitor-"))
            self.assertEqual(storage.stats().total_ratings, 2)
            self.assertEqual(storage.stats().total_raters, 1)


if __name__ == "__main__":
    unittest.main()
