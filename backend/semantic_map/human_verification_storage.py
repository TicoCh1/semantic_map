from __future__ import annotations

import csv
import hashlib
import io
import json
import sqlite3
import threading
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from .human_verification_schemas import (
    HumanVerificationPromptStats,
    HumanVerificationRatingBatch,
    HumanVerificationRatingIngestResponse,
    HumanVerificationStats,
    HumanVerificationStudy,
)


class HumanVerificationStorage:
    """Small SQLite store for trusted human-verification participants."""

    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._lock = threading.RLock()
        self._initialized = False

    def register_study(self, study: HumanVerificationStudy) -> None:
        with self._lock, closing(self._connect()) as connection, connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO verification_studies (
                    study_id, prompt, seed, dataset_ids_json, dataset_group_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    study.study_id,
                    study.prompt,
                    study.seed,
                    json.dumps(study.dataset_ids, ensure_ascii=False, separators=(",", ":")),
                    study.dataset_group_id,
                    utc_now(),
                ),
            )
            connection.executemany(
                """
                INSERT OR IGNORE INTO verification_tasks (
                    study_id, task_id, task_order, dataset_id, city_id, pano_id, lon, lat,
                    capture_date, prompt_id, result_revision, score, zscore, ai_bucket,
                    bucket_min, bucket_max, stratum_population, stratum_sample_count
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        study.study_id,
                        task.task_id,
                        task_order,
                        task.dataset_id,
                        task.city_id,
                        task.pano_id,
                        task.lon,
                        task.lat,
                        task.date,
                        task.prompt_id,
                        task.result_revision,
                        task.score,
                        task.zscore,
                        task.ai_bucket,
                        task.bucket_min,
                        task.bucket_max,
                        task.stratum_population,
                        task.stratum_sample_count,
                    )
                    for task_order, task in enumerate(study.tasks, start=1)
                ],
            )

    def record_ratings(
        self,
        batch: HumanVerificationRatingBatch,
        *,
        client_ip: str | None = None,
        user_agent: str | None = None,
    ) -> HumanVerificationRatingIngestResponse:
        received_at = utc_now()
        with self._lock, closing(self._connect()) as connection, connection:
            for rating in batch.ratings:
                task_exists = connection.execute(
                    "SELECT 1 FROM verification_tasks WHERE study_id = ? AND task_id = ?",
                    (rating.study_id, rating.task_id),
                ).fetchone()
                if task_exists is None:
                    if not rating.source_task_id:
                        raise LookupError(f"Unknown verification task {rating.study_id}/{rating.task_id}")
                    inserted = connection.execute(
                        """
                        INSERT OR IGNORE INTO verification_tasks (
                            study_id, task_id, task_order, dataset_id, city_id, pano_id, lon, lat,
                            capture_date, prompt_id, result_revision, score, zscore, ai_bucket,
                            bucket_min, bucket_max, stratum_population, stratum_sample_count
                        )
                        SELECT
                            study_id, ?, task_order, dataset_id, city_id, pano_id, lon, lat,
                            capture_date, prompt_id, result_revision, score, zscore, ai_bucket,
                            bucket_min, bucket_max, stratum_population, stratum_sample_count
                        FROM verification_tasks
                        WHERE study_id = ? AND task_id = ?
                        """,
                        (
                            rating.task_id,
                            rating.study_id,
                            rating.source_task_id,
                        ),
                    )
                    if inserted.rowcount != 1:
                        raise LookupError(
                            f"Unknown encore source task {rating.study_id}/{rating.source_task_id}"
                        )
                visitor_label = verification_visitor_label(rating.rater_id, user_agent)
                connection.execute(
                    """
                    INSERT INTO verification_ratings (
                        study_id, task_id, rater_id, human_rating, elapsed_ms, rated_at, received_at,
                        client_ip, visitor_label, user_agent
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(study_id, task_id, rater_id) DO UPDATE SET
                        human_rating = excluded.human_rating,
                        elapsed_ms = excluded.elapsed_ms,
                        rated_at = excluded.rated_at,
                        received_at = excluded.received_at,
                        client_ip = excluded.client_ip,
                        visitor_label = excluded.visitor_label,
                        user_agent = excluded.user_agent
                    """,
                    (
                        rating.study_id,
                        rating.task_id,
                        rating.rater_id,
                        rating.human_rating,
                        rating.elapsed_ms,
                        rating.rated_at,
                        received_at,
                        client_ip,
                        visitor_label,
                        user_agent,
                    ),
                )
            stats = self._stats(connection)
        return HumanVerificationRatingIngestResponse(accepted=len(batch.ratings), stats=stats)

    def stats(self) -> HumanVerificationStats:
        with self._lock, closing(self._connect()) as connection, connection:
            return self._stats(connection)

    def export_csv(self) -> str:
        columns = (
            "study_id",
            "rater_id",
            "visitor_label",
            "client_ip",
            "user_agent",
            "task_id",
            "task_order",
            "dataset_group_id",
            "dataset_id",
            "city_id",
            "pano_id",
            "lon",
            "lat",
            "date",
            "prompt_id",
            "prompt",
            "score",
            "zscore",
            "ai_bucket",
            "bucket_min",
            "bucket_max",
            "stratum_population",
            "stratum_sample_count",
            "human_rating",
            "elapsed_ms",
            "rated_at",
            "received_at",
            "result_revision",
        )
        query = """
            SELECT
                ratings.study_id, ratings.rater_id, ratings.visitor_label, ratings.client_ip,
                ratings.user_agent, ratings.task_id, tasks.task_order,
                studies.dataset_group_id, tasks.dataset_id, tasks.city_id, tasks.pano_id,
                tasks.lon, tasks.lat, tasks.capture_date, tasks.prompt_id, studies.prompt,
                tasks.score, tasks.zscore, tasks.ai_bucket, tasks.bucket_min, tasks.bucket_max,
                tasks.stratum_population, tasks.stratum_sample_count, ratings.human_rating,
                ratings.elapsed_ms, ratings.rated_at, ratings.received_at, tasks.result_revision
            FROM verification_ratings AS ratings
            JOIN verification_tasks AS tasks
              ON tasks.study_id = ratings.study_id AND tasks.task_id = ratings.task_id
            JOIN verification_studies AS studies ON studies.study_id = ratings.study_id
            ORDER BY ratings.received_at, ratings.study_id, tasks.task_order, ratings.rater_id
        """
        output = io.StringIO(newline="")
        writer = csv.writer(output, lineterminator="\r\n")
        writer.writerow(columns)
        with self._lock, closing(self._connect()) as connection, connection:
            writer.writerows(connection.execute(query))
        return "\ufeff" + output.getvalue()

    def _stats(self, connection: sqlite3.Connection) -> HumanVerificationStats:
        totals = connection.execute(
            """
            SELECT COUNT(*), COUNT(DISTINCT rater_id), COUNT(DISTINCT study_id)
            FROM verification_ratings
            """
        ).fetchone()
        total_prompts = connection.execute(
            """
            SELECT COUNT(DISTINCT studies.prompt)
            FROM verification_ratings AS ratings
            JOIN verification_studies AS studies ON studies.study_id = ratings.study_id
            """
        ).fetchone()[0]
        rating_counts = {rating: 0 for rating in range(1, 6)}
        for rating, count in connection.execute(
            "SELECT human_rating, COUNT(*) FROM verification_ratings GROUP BY human_rating"
        ):
            rating_counts[int(rating)] = int(count)
        prompts = [
            HumanVerificationPromptStats(
                prompt=row[0],
                ratings=int(row[1]),
                raters=int(row[2]),
                mean_rating=round(float(row[3]), 4) if row[3] is not None else None,
            )
            for row in connection.execute(
                """
                SELECT studies.prompt, COUNT(*), COUNT(DISTINCT ratings.rater_id), AVG(ratings.human_rating)
                FROM verification_ratings AS ratings
                JOIN verification_studies AS studies ON studies.study_id = ratings.study_id
                GROUP BY studies.prompt
                ORDER BY COUNT(*) DESC, studies.prompt
                """
            )
        ]
        return HumanVerificationStats(
            total_ratings=int(totals[0]),
            total_raters=int(totals[1]),
            total_studies=int(totals[2]),
            total_prompts=int(total_prompts),
            rating_counts=rating_counts,
            prompts=prompts,
        )

    def _connect(self) -> sqlite3.Connection:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.database_path, timeout=10)
        connection.execute("PRAGMA busy_timeout = 10000")
        connection.execute("PRAGMA foreign_keys = ON")
        if not self._initialized:
            self._initialize(connection)
            self._initialized = True
        return connection

    @staticmethod
    def _initialize(connection: sqlite3.Connection) -> None:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS verification_studies (
                study_id TEXT PRIMARY KEY,
                prompt TEXT NOT NULL,
                seed INTEGER NOT NULL,
                dataset_ids_json TEXT NOT NULL,
                dataset_group_id TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS verification_tasks (
                study_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                task_order INTEGER NOT NULL,
                dataset_id TEXT NOT NULL,
                city_id TEXT NOT NULL,
                pano_id TEXT NOT NULL,
                lon REAL NOT NULL,
                lat REAL NOT NULL,
                capture_date TEXT,
                prompt_id TEXT NOT NULL,
                result_revision TEXT,
                score REAL NOT NULL,
                zscore REAL NOT NULL,
                ai_bucket INTEGER NOT NULL,
                bucket_min REAL,
                bucket_max REAL,
                stratum_population INTEGER NOT NULL,
                stratum_sample_count INTEGER NOT NULL,
                PRIMARY KEY (study_id, task_id),
                FOREIGN KEY (study_id) REFERENCES verification_studies(study_id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS verification_ratings (
                study_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                rater_id TEXT NOT NULL,
                human_rating INTEGER NOT NULL CHECK (human_rating BETWEEN 1 AND 5),
                elapsed_ms INTEGER NOT NULL,
                rated_at TEXT NOT NULL,
                received_at TEXT NOT NULL,
                PRIMARY KEY (study_id, task_id, rater_id),
                FOREIGN KEY (study_id, task_id)
                    REFERENCES verification_tasks(study_id, task_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS verification_ratings_received_at
                ON verification_ratings(received_at);
            CREATE INDEX IF NOT EXISTS verification_tasks_prompt_id
                ON verification_tasks(prompt_id);
            """
        )
        rating_columns = {
            "client_ip": "TEXT",
            "visitor_label": "TEXT",
            "user_agent": "TEXT",
        }
        existing_columns = {
            str(row[1]) for row in connection.execute("PRAGMA table_info(verification_ratings)")
        }
        for name, declaration in rating_columns.items():
            if name not in existing_columns:
                connection.execute(f"ALTER TABLE verification_ratings ADD COLUMN {name} {declaration}")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS verification_ratings_visitor ON verification_ratings(visitor_label)"
        )


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def verification_visitor_label(rater_id: str, user_agent: str | None) -> str:
    raw = f"{rater_id}\x1f{user_agent or ''}"
    digest = hashlib.blake2b(raw.encode("utf-8"), digest_size=6).hexdigest()
    return f"visitor-{digest}"
