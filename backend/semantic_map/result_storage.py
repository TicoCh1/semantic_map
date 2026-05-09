from __future__ import annotations

import json
from pathlib import Path
from collections.abc import Iterable
from typing import Any
from uuid import uuid4

from .backend_config import BackendSettings
from .prompt_ids import normalize_prompt
from .tile_index import safe_segment


class ResultStorage:
    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings

    def dataset_dir(self, dataset_id: str) -> Path:
        return self.settings.result_root / safe_segment(dataset_id)

    def result_dir(self, dataset_id: str, prompt_id: str) -> Path:
        return self.dataset_dir(dataset_id) / safe_segment(prompt_id)

    def job_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "job.json"

    def manifest_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "manifest.json"

    def scores_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "scores.jsonl"

    def score_array_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "score.npy"

    def zscore_array_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "zscore.npy"

    def tile_path(self, dataset_id: str, prompt_id: str, z: int, x: int, y: int) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "tiles" / str(z) / str(x) / f"{y}.geojson"

    def tmp_path_for(self, path: Path) -> Path:
        return path.with_name(f"{path.name}.{uuid4().hex}.tmp")

    def find_manifest_path(self, prompt_id: str) -> Path | None:
        if not self.settings.result_root.exists():
            return None
        target_name = safe_segment(prompt_id)
        for dataset_dir in self.settings.result_root.iterdir():
            if not dataset_dir.is_dir():
                continue
            manifest_path = dataset_dir / target_name / "manifest.json"
            if manifest_path.exists():
                return manifest_path
        return None

    def find_result_dir(self, prompt_id: str) -> Path | None:
        manifest_path = self.find_manifest_path(prompt_id)
        return manifest_path.parent if manifest_path else None

    def find_manifest_for_prompt(
        self,
        *,
        dataset_id: str,
        canonical_prompt: str,
        model_version: str,
        scoring_version: str,
        tile_index_version: str,
    ) -> tuple[str, Path] | None:
        dataset_dir = self.dataset_dir(dataset_id)
        if not dataset_dir.exists():
            return None

        target_prompt = normalize_prompt(canonical_prompt)
        for result_dir in dataset_dir.iterdir():
            if not result_dir.is_dir():
                continue
            manifest_path = result_dir / "manifest.json"
            if not manifest_path.exists():
                continue
            payload = self.read_json(manifest_path)
            if not payload:
                continue
            prompt = str(payload.get("canonical_prompt") or payload.get("prompt") or "")
            if normalize_prompt(prompt) != target_prompt:
                continue
            if payload.get("model_version") != model_version:
                continue
            if payload.get("scoring_version") != scoring_version:
                continue
            if payload.get("tile_index_version") != tile_index_version:
                continue
            return result_dir.name, manifest_path
        return None

    def write_json(self, path: Path, payload: Any, *, compact: bool = False) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.tmp_path_for(path)
        if compact:
            text = json.dumps(payload, separators=(",", ":"))
        else:
            text = json.dumps(payload, indent=2)
        tmp_path.write_text(text, encoding="utf-8")
        tmp_path.replace(path)

    def read_json(self, path: Path) -> dict[str, Any] | None:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def write_score_arrays(self, dataset_id: str, prompt_id: str, scores, zscores) -> None:
        import numpy as np

        score_path = self.score_array_path(dataset_id, prompt_id)
        zscore_path = self.zscore_array_path(dataset_id, prompt_id)
        score_path.parent.mkdir(parents=True, exist_ok=True)

        for path, values in ((score_path, scores), (zscore_path, zscores)):
            tmp_path = self.tmp_path_for(path)
            with tmp_path.open("wb") as handle:
                np.save(handle, np.asarray(values, dtype=np.float32))
            tmp_path.replace(path)

    def read_score_arrays(self, dataset_id: str, prompt_id: str):
        import numpy as np

        score_path = self.score_array_path(dataset_id, prompt_id)
        zscore_path = self.zscore_array_path(dataset_id, prompt_id)
        if not score_path.exists() or not zscore_path.exists():
            return None
        return (
            np.load(score_path, mmap_mode="r"),
            np.load(zscore_path, mmap_mode="r"),
        )

    def write_scores_jsonl(self, dataset_id: str, prompt_id: str, rows: Iterable[dict[str, Any]]) -> None:
        path = self.scores_path(dataset_id, prompt_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.tmp_path_for(path)
        with tmp_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, separators=(",", ":")))
                handle.write("\n")
        tmp_path.replace(path)

    def tile_url_template(self, prompt_id: str) -> str:
        route = f"/api/scoring/results/{prompt_id}/tiles/{{z}}/{{x}}/{{y}}.geojson"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"

    def manifest_url(self, prompt_id: str) -> str:
        route = f"/api/scoring/results/{prompt_id}/manifest"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"
