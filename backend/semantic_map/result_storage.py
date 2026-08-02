from __future__ import annotations

import json
import shutil
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

    def revision_pointer_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "current.json"

    def revision_dir(self, dataset_id: str, prompt_id: str, revision: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "revisions" / safe_segment(revision)

    def active_revision(self, dataset_id: str, prompt_id: str) -> str | None:
        payload = self.read_json(self.revision_pointer_path(dataset_id, prompt_id))
        if not payload:
            return None
        revision = str(payload.get("revision") or "").strip()
        return revision or None

    def artifact_dir(self, dataset_id: str, prompt_id: str, revision: str | None = None) -> Path:
        effective_revision = revision or self.active_revision(dataset_id, prompt_id)
        if effective_revision:
            return self.revision_dir(dataset_id, prompt_id, effective_revision)
        return self.result_dir(dataset_id, prompt_id)

    def manifest_path(self, dataset_id: str, prompt_id: str, revision: str | None = None) -> Path:
        return self.artifact_dir(dataset_id, prompt_id, revision) / "manifest.json"

    def scores_path(self, dataset_id: str, prompt_id: str, revision: str | None = None) -> Path:
        return self.artifact_dir(dataset_id, prompt_id, revision) / "scores.jsonl"

    def score_array_path(self, dataset_id: str, prompt_id: str, revision: str | None = None) -> Path:
        return self.artifact_dir(dataset_id, prompt_id, revision) / "score.npy"

    def zscore_array_path(self, dataset_id: str, prompt_id: str, revision: str | None = None) -> Path:
        return self.artifact_dir(dataset_id, prompt_id, revision) / "zscore.npy"

    def tile_path(
        self,
        dataset_id: str,
        prompt_id: str,
        z: int,
        x: int,
        y: int,
        revision: str | None = None,
    ) -> Path:
        return self.artifact_dir(dataset_id, prompt_id, revision) / "tiles" / str(z) / str(x) / f"{y}.geojson"

    def legacy_tile_path(self, dataset_id: str, prompt_id: str, z: int, x: int, y: int) -> Path:
        """Return the pre-revision tile path without resolving current.json."""

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
            manifest_path = self.manifest_path(dataset_dir.name, target_name)
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
            manifest_path = self.manifest_path(dataset_id, result_dir.name)
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

    def write_score_arrays(
        self,
        dataset_id: str,
        prompt_id: str,
        scores,
        zscores,
        *,
        revision: str | None = None,
    ) -> None:
        import numpy as np

        score_path = self.score_array_path(dataset_id, prompt_id, revision)
        zscore_path = self.zscore_array_path(dataset_id, prompt_id, revision)
        score_path.parent.mkdir(parents=True, exist_ok=True)

        for path, values in ((score_path, scores), (zscore_path, zscores)):
            tmp_path = self.tmp_path_for(path)
            with tmp_path.open("wb") as handle:
                np.save(handle, np.asarray(values, dtype=np.float32))
            tmp_path.replace(path)

    def read_score_arrays(self, dataset_id: str, prompt_id: str, *, revision: str | None = None):
        import numpy as np

        score_path = self.score_array_path(dataset_id, prompt_id, revision)
        zscore_path = self.zscore_array_path(dataset_id, prompt_id, revision)
        if not score_path.exists() or not zscore_path.exists():
            return None
        return (
            np.load(score_path, mmap_mode="r"),
            np.load(zscore_path, mmap_mode="r"),
        )

    def activate_result_revision(self, dataset_id: str, prompt_id: str, revision: str) -> None:
        manifest_path = self.manifest_path(dataset_id, prompt_id, revision)
        if not manifest_path.exists():
            raise RuntimeError(f"Cannot activate incomplete result revision without manifest: {manifest_path}")
        self.write_json(
            self.revision_pointer_path(dataset_id, prompt_id),
            {"revision": safe_segment(revision)},
            compact=True,
        )

    def validate_result_revision(
        self,
        dataset_id: str,
        prompt_id: str,
        revision: str,
        *,
        expected_count: int,
        required_tiles,
    ) -> None:
        manifest_path = self.manifest_path(dataset_id, prompt_id, revision)
        manifest = self.read_json(manifest_path)
        if not manifest:
            raise RuntimeError(f"Result revision manifest is missing or empty: {manifest_path}")
        if manifest.get("result_revision") != revision:
            raise RuntimeError(
                f"Result revision manifest mismatch: expected {revision}, got {manifest.get('result_revision')}"
            )

        arrays = self.read_score_arrays(dataset_id, prompt_id, revision=revision)
        if arrays is None:
            raise RuntimeError(f"Result revision score arrays are missing: {revision}")
        scores, zscores = arrays
        if len(scores) != expected_count or len(zscores) != expected_count:
            raise RuntimeError(
                f"Result revision array length mismatch for {revision}: "
                f"scores={len(scores)}, zscores={len(zscores)}, expected={expected_count}"
            )

        for tile in required_tiles:
            tile_path = self.tile_path(dataset_id, prompt_id, tile.z, tile.x, tile.y, revision)
            if not tile_path.exists():
                raise RuntimeError(f"Result revision tile is missing: {tile_path}")
            tile_payload = self.read_json(tile_path)
            if not tile_payload or tile_payload.get("type") != "FeatureCollection":
                raise RuntimeError(f"Result revision tile is invalid: {tile_path}")

    def delete_result_revision(self, dataset_id: str, prompt_id: str, revision: str) -> None:
        revision_dir = self.revision_dir(dataset_id, prompt_id, revision)
        if revision_dir.exists():
            shutil.rmtree(revision_dir)

    def prune_superseded_results(self, dataset_id: str, prompt_id: str, *, keep_revision: str) -> list[str]:
        active_revision = self.active_revision(dataset_id, prompt_id)
        if active_revision != keep_revision:
            raise RuntimeError(
                f"Refusing to prune result revisions because active={active_revision!r}, keep={keep_revision!r}"
            )

        removed: list[str] = []
        revisions_dir = self.result_dir(dataset_id, prompt_id) / "revisions"
        if revisions_dir.exists():
            for candidate in revisions_dir.iterdir():
                if not candidate.is_dir() or candidate.name == safe_segment(keep_revision):
                    continue
                shutil.rmtree(candidate)
                removed.append(candidate.name)

        legacy_result_dir = self.result_dir(dataset_id, prompt_id)
        legacy_tiles = legacy_result_dir / "tiles"
        if legacy_tiles.exists():
            shutil.rmtree(legacy_tiles)
            removed.append("legacy:tiles")
        for name in ("manifest.json", "score.npy", "zscore.npy", "scores.jsonl"):
            path = legacy_result_dir / name
            if path.exists():
                path.unlink()
                removed.append(f"legacy:{name}")
        return removed

    def write_scores_jsonl(
        self,
        dataset_id: str,
        prompt_id: str,
        rows: Iterable[dict[str, Any]],
        *,
        revision: str | None = None,
    ) -> None:
        path = self.scores_path(dataset_id, prompt_id, revision)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.tmp_path_for(path)
        with tmp_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row, separators=(",", ":")))
                handle.write("\n")
        tmp_path.replace(path)

    def tile_url_template(
        self,
        dataset_id: str,
        prompt_id: str,
        *,
        revision: str | None = None,
    ) -> str:
        dataset_segment = safe_segment(dataset_id)
        prompt_segment = safe_segment(prompt_id)
        if revision:
            revision_segment = safe_segment(revision)
            route = (
                f"/api/scoring/results/{dataset_segment}/{prompt_segment}"
                f"/revisions/{revision_segment}/tiles/{{z}}/{{x}}/{{y}}.geojson"
            )
        else:
            route = f"/api/scoring/results/{dataset_segment}/{prompt_segment}/tiles/{{z}}/{{x}}/{{y}}.geojson"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"

    def manifest_url(self, dataset_id: str, prompt_id: str) -> str:
        route = f"/api/scoring/results/{safe_segment(dataset_id)}/{safe_segment(prompt_id)}/manifest"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"
