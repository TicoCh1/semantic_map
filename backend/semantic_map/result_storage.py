from __future__ import annotations

import json
import shutil
import threading
from bisect import bisect_left
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from .backend_config import BackendSettings
from .prompt_ids import normalize_prompt
from .tile_index import safe_segment


PROMPT_CATALOG_SCHEMA_VERSION = 2


@dataclass(frozen=True, slots=True)
class PromptCatalogEntry:
    prompt: str
    dataset_id: str
    prompt_id: str
    manifest_path: Path
    created_at: str = ""
    result_revision: str | None = None


@dataclass(frozen=True, slots=True)
class PromptCoverage:
    prompt: str
    ready_dataset_ids: tuple[str, ...]
    missing_dataset_ids: tuple[str, ...]


class ResultStorage:
    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings
        self._prompt_catalog_lock = threading.RLock()
        self._prompt_catalog_write_lock = threading.Lock()
        self._prompt_catalog_keys: list[str] | None = None
        self._prompt_catalog_results: list[dict[str, PromptCatalogEntry]] | None = None
        self._prompt_catalog_known_dataset_ids: set[str] = set()
        self._startup_pano_manifests: tuple[tuple[str, str, dict[str, Any]], ...] | None = None

    def dataset_dir(self, dataset_id: str) -> Path:
        return self.settings.result_root / safe_segment(dataset_id)

    def result_dir(self, dataset_id: str, prompt_id: str) -> Path:
        return self.dataset_dir(dataset_id) / safe_segment(prompt_id)

    def job_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "job.json"

    def prompt_catalog_path(self) -> Path:
        return self.settings.result_root / "prompt_catalog.json"

    def revision_pointer_path(self, dataset_id: str, prompt_id: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "current.json"

    def revision_dir(self, dataset_id: str, prompt_id: str, revision: str) -> Path:
        return self.result_dir(dataset_id, prompt_id) / "revisions" / safe_segment(revision)

    def active_revision(self, dataset_id: str, prompt_id: str) -> str | None:
        payload = self.read_json(self.revision_pointer_path(dataset_id, prompt_id))
        if not isinstance(payload, dict) or not payload:
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

    def iter_active_manifests(self) -> Iterable[tuple[str, str, dict[str, Any]]]:
        """Yield current manifests from disk, including results from past processes."""

        if not self.settings.result_root.exists():
            return
        try:
            dataset_dirs = tuple(self.settings.result_root.iterdir())
        except OSError:
            return
        for dataset_dir in dataset_dirs:
            if not dataset_dir.is_dir():
                continue
            try:
                result_dirs = tuple(dataset_dir.iterdir())
            except OSError:
                continue
            for result_dir in result_dirs:
                if not result_dir.is_dir():
                    continue
                try:
                    manifest_path = self.manifest_path(dataset_dir.name, result_dir.name)
                    payload = self.read_json(manifest_path)
                except (OSError, ValueError):
                    continue
                if isinstance(payload, dict) and payload:
                    yield dataset_dir.name, result_dir.name, payload

    def rebuild_prompt_catalog(self, *, known_dataset_ids: Iterable[str] = ()) -> int:
        """Scan results once at startup and rebuild the prompt/city coverage tree."""

        persisted_prompts, persisted_dataset_ids = self._read_prompt_catalog_registry()
        results_by_prompt: dict[str, dict[str, PromptCatalogEntry]] = {
            prompt: {} for prompt in persisted_prompts
        }
        pano_manifests: list[tuple[str, str, dict[str, Any]]] = []
        catalog_dataset_ids = {
            dataset_id
            for raw_dataset_id in (*persisted_dataset_ids, *tuple(known_dataset_ids))
            if (dataset_id := str(raw_dataset_id).strip())
        }
        for dataset_id, prompt_id, payload in self.iter_active_manifests():
            if str(payload.get("query_type") or "text") == "pano_reference":
                pano_manifests.append((dataset_id, prompt_id, payload))
                continue
            entry = self._prompt_catalog_entry(
                dataset_id=dataset_id,
                prompt_id=prompt_id,
                payload=payload,
            )
            if entry is None:
                continue
            prompt_results = results_by_prompt.setdefault(entry.prompt, {})
            current = prompt_results.get(entry.dataset_id)
            if current is None or self._prompt_catalog_rank(entry) >= self._prompt_catalog_rank(current):
                prompt_results[entry.dataset_id] = entry
            catalog_dataset_ids.add(entry.dataset_id)

        keys = sorted(results_by_prompt)
        results = [results_by_prompt[prompt] for prompt in keys]
        with self._prompt_catalog_lock:
            self._prompt_catalog_keys = keys
            self._prompt_catalog_results = results
            self._prompt_catalog_known_dataset_ids = catalog_dataset_ids
            self._startup_pano_manifests = tuple(pano_manifests)
        self._persist_prompt_catalog()
        return sum(len(prompt_results) for prompt_results in results)

    @property
    def prompt_catalog_ready(self) -> bool:
        with self._prompt_catalog_lock:
            return self._prompt_catalog_results is not None

    @property
    def prompt_catalog_prompt_count(self) -> int:
        with self._prompt_catalog_lock:
            return len(self._prompt_catalog_keys or ())

    def startup_pano_manifests(self) -> tuple[tuple[str, str, dict[str, Any]], ...]:
        """Return pano manifests captured by the one startup result-tree scan."""

        with self._prompt_catalog_lock:
            if self._startup_pano_manifests is None:
                raise RuntimeError("Prompt catalog has not been built. Run service startup before backfill.")
            return self._startup_pano_manifests

    def find_prompt_result(self, *, dataset_id: str, prompt: str) -> str | None:
        """Find an exact canonical plaintext prompt with an O(log n) binary lookup."""

        entry = self.find_prompt_result_entry(dataset_id=dataset_id, prompt=prompt)
        return entry.prompt_id if entry is not None else None

    def find_prompt_result_entry(self, *, dataset_id: str, prompt: str) -> PromptCatalogEntry | None:
        """Return the in-memory result ref without touching the result volume."""

        canonical_prompt = normalize_prompt(prompt)
        with self._prompt_catalog_lock:
            if self._prompt_catalog_keys is None or self._prompt_catalog_results is None:
                raise RuntimeError("Prompt catalog has not been built. Run service startup before accepting queries.")
            index = bisect_left(self._prompt_catalog_keys, canonical_prompt)
            if index >= len(self._prompt_catalog_keys) or self._prompt_catalog_keys[index] != canonical_prompt:
                return None
            entry = self._prompt_catalog_results[index].get(dataset_id)
            if entry is None:
                return None
            return entry

    def register_prompt(
        self,
        *,
        prompt: str,
        known_dataset_ids: Iterable[str] = (),
        persist: bool = False,
    ) -> bool:
        """Register plaintext work without touching the result tree.

        Request admission uses the in-memory update only. The completed result
        persists the node together with its ready/missing city coverage.
        """

        canonical_prompt = normalize_prompt(prompt)
        if not canonical_prompt:
            return False
        dataset_ids = {
            dataset_id
            for raw_dataset_id in known_dataset_ids
            if (dataset_id := str(raw_dataset_id).strip())
        }
        with self._prompt_catalog_lock:
            if self._prompt_catalog_keys is None or self._prompt_catalog_results is None:
                raise RuntimeError("Prompt catalog has not been built. Run service startup before accepting queries.")
            previous_dataset_count = len(self._prompt_catalog_known_dataset_ids)
            self._prompt_catalog_known_dataset_ids.update(dataset_ids)
            index = bisect_left(self._prompt_catalog_keys, canonical_prompt)
            inserted = index >= len(self._prompt_catalog_keys) or self._prompt_catalog_keys[index] != canonical_prompt
            if inserted:
                self._prompt_catalog_keys.insert(index, canonical_prompt)
                self._prompt_catalog_results.insert(index, {})
            changed = inserted or len(self._prompt_catalog_known_dataset_ids) != previous_dataset_count

        if persist and changed:
            self._persist_prompt_catalog()
        return changed

    def prompts_missing_results(self, dataset_ids: Iterable[str]) -> tuple[PromptCoverage, ...]:
        """Return tree nodes missing one or more requested datasets."""

        requested_dataset_ids = tuple(
            dict.fromkeys(
                dataset_id
                for raw_dataset_id in dataset_ids
                if (dataset_id := str(raw_dataset_id).strip())
            )
        )
        with self._prompt_catalog_lock:
            if self._prompt_catalog_keys is None or self._prompt_catalog_results is None:
                raise RuntimeError("Prompt catalog has not been built. Run service startup before accepting queries.")
            missing_nodes: list[PromptCoverage] = []
            for prompt, prompt_results in zip(self._prompt_catalog_keys, self._prompt_catalog_results):
                missing = tuple(dataset_id for dataset_id in requested_dataset_ids if dataset_id not in prompt_results)
                if not missing:
                    continue
                missing_nodes.append(
                    PromptCoverage(
                        prompt=prompt,
                        ready_dataset_ids=tuple(sorted(prompt_results)),
                        missing_dataset_ids=missing,
                    )
                )
            return tuple(missing_nodes)

    def upsert_prompt_result(
        self,
        *,
        dataset_id: str,
        prompt_id: str,
        payload: dict[str, Any],
        manifest_path: Path,
        persist: bool = True,
    ) -> bool:
        """Insert or replace one activated text result in the sorted plaintext catalog."""

        entry = self._prompt_catalog_entry(
            dataset_id=dataset_id,
            prompt_id=prompt_id,
            payload=payload,
            manifest_path=manifest_path,
        )
        if entry is None:
            return False

        with self._prompt_catalog_lock:
            if self._prompt_catalog_keys is None or self._prompt_catalog_results is None:
                return False
            self._prompt_catalog_known_dataset_ids.add(entry.dataset_id)
            index = bisect_left(self._prompt_catalog_keys, entry.prompt)
            if index < len(self._prompt_catalog_keys) and self._prompt_catalog_keys[index] == entry.prompt:
                prompt_results = self._prompt_catalog_results[index]
            else:
                self._prompt_catalog_keys.insert(index, entry.prompt)
                prompt_results = {}
                self._prompt_catalog_results.insert(index, prompt_results)
            # The writer calls this only after the new revision is validated
            # and activated, so the in-process result is authoritative.
            prompt_results[entry.dataset_id] = entry

        if persist:
            try:
                self._persist_prompt_catalog()
            except OSError as exc:
                # The in-memory catalog remains current. Startup rebuilds the
                # plaintext file if the network volume temporarily rejects a write.
                print(f"Prompt catalog persistence skipped: {type(exc).__name__}: {exc}", flush=True)
        return True

    def _prompt_catalog_entry(
        self,
        *,
        dataset_id: str,
        prompt_id: str,
        payload: dict[str, Any],
        manifest_path: Path | None = None,
    ) -> PromptCatalogEntry | None:
        if str(payload.get("query_type") or "text") != "text":
            return None
        prompt = normalize_prompt(str(payload.get("canonical_prompt") or payload.get("prompt") or ""))
        if not prompt:
            return None
        if manifest_path is None:
            revision = str(payload.get("result_revision") or "").strip()
            manifest_path = (
                self.revision_dir(dataset_id, prompt_id, revision) / "manifest.json"
                if revision
                else self.result_dir(dataset_id, prompt_id) / "manifest.json"
            )
        return PromptCatalogEntry(
            prompt=prompt,
            dataset_id=dataset_id,
            prompt_id=prompt_id,
            manifest_path=manifest_path,
            created_at=str(payload.get("created_at") or ""),
            result_revision=str(payload.get("result_revision") or "").strip() or None,
        )

    @staticmethod
    def _prompt_catalog_rank(entry: PromptCatalogEntry) -> tuple[str, str, str]:
        return entry.created_at, entry.prompt_id, str(entry.manifest_path)

    def _persist_prompt_catalog(self) -> None:
        with self._prompt_catalog_write_lock:
            with self._prompt_catalog_lock:
                prompts = tuple(self._prompt_catalog_keys or ())
                results_by_prompt = tuple(
                    dict(prompt_results) for prompt_results in (self._prompt_catalog_results or ())
                )
                known_dataset_ids = tuple(sorted(self._prompt_catalog_known_dataset_ids))
            entries = tuple(
                entry
                for prompt_results in results_by_prompt
                for _dataset_id, entry in sorted(prompt_results.items())
            )
            payload = {
                "schema_version": PROMPT_CATALOG_SCHEMA_VERSION,
                "known_dataset_ids": list(known_dataset_ids),
                "prompts": list(prompts),
                "prompt_tree": [
                    {
                        "prompt": prompt,
                        "ready_dataset_ids": sorted(prompt_results),
                        "missing_dataset_ids": [
                            dataset_id for dataset_id in known_dataset_ids if dataset_id not in prompt_results
                        ],
                    }
                    for prompt, prompt_results in zip(prompts, results_by_prompt)
                ],
                "entries": [
                    {
                        "prompt": entry.prompt,
                        "dataset_id": entry.dataset_id,
                        "prompt_id": entry.prompt_id,
                        "manifest_path": self._catalog_manifest_path(entry.manifest_path),
                        "result_revision": entry.result_revision,
                    }
                    for entry in entries
                ],
            }
            self.write_json(self.prompt_catalog_path(), payload)

    def persist_prompt_catalog(self) -> None:
        """Persist the current in-memory prompt tree without rescanning results."""

        self._persist_prompt_catalog()

    def _read_prompt_catalog_registry(self) -> tuple[tuple[str, ...], tuple[str, ...]]:
        try:
            payload = self.read_json(self.prompt_catalog_path())
        except (OSError, ValueError):
            return (), ()
        if not isinstance(payload, dict) or payload.get("schema_version") != PROMPT_CATALOG_SCHEMA_VERSION:
            return (), ()

        prompts: list[str] = []
        prompt_set: set[str] = set()
        raw_prompts = payload.get("prompts")
        if isinstance(raw_prompts, list):
            for raw_prompt in raw_prompts:
                prompt = normalize_prompt(str(raw_prompt))
                if prompt and prompt not in prompt_set:
                    prompts.append(prompt)
                    prompt_set.add(prompt)
        raw_tree = payload.get("prompt_tree")
        if isinstance(raw_tree, list):
            for raw_node in raw_tree:
                if not isinstance(raw_node, dict):
                    continue
                prompt = normalize_prompt(str(raw_node.get("prompt") or ""))
                if prompt and prompt not in prompt_set:
                    prompts.append(prompt)
                    prompt_set.add(prompt)

        dataset_ids: list[str] = []
        dataset_id_set: set[str] = set()
        raw_dataset_ids = payload.get("known_dataset_ids")
        if isinstance(raw_dataset_ids, list):
            for raw_dataset_id in raw_dataset_ids:
                dataset_id = str(raw_dataset_id).strip()
                if dataset_id and dataset_id not in dataset_id_set:
                    dataset_ids.append(dataset_id)
                    dataset_id_set.add(dataset_id)
        return tuple(prompts), tuple(dataset_ids)

    def _catalog_manifest_path(self, manifest_path: Path) -> str:
        try:
            return manifest_path.relative_to(self.settings.result_root).as_posix()
        except ValueError:
            return str(manifest_path)

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
