from __future__ import annotations

from .state_store import create_layer, utc_now


_JOBS: dict[str, dict] = {}


def create_mock_scoring_job(prompt: str) -> dict:
    job_id = f"job_{len(_JOBS) + 1:04d}"
    now = utc_now()
    layer = create_layer(prompt=prompt)
    job = {
        "job_id": job_id,
        "prompt": prompt,
        "status": "ready",
        "progress": 1.0,
        "layer_id": layer["id"],
        "message": "Mock scoring completed.",
        "created_at": now,
        "updated_at": now,
    }
    _JOBS[job_id] = job
    return job


def get_job(job_id: str) -> dict | None:
    return _JOBS.get(job_id)


def cancel_job(job_id: str) -> dict | None:
    job = _JOBS.get(job_id)
    if not job:
        return None
    if job["status"] not in {"ready", "failed"}:
        job["status"] = "cancelled"
        job["updated_at"] = utc_now()
    return job
