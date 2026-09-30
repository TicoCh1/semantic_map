"""Read existing results on CPU without importing a scorer or admitting jobs."""
from __future__ import annotations

import csv
import io
from contextlib import ExitStack
from pathlib import Path
from urllib.parse import quote, urlencode

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

from .auth import require_backend_token
from .backend_config import BackendSettings
from .dataset_loader import shard_index_from_name
from .result_storage import ResultStorage
from .tile_index import safe_segment


NO_STORE_HEADERS = {"Cache-Control": "no-store", "Vary": "Authorization"}
DOWNLOAD_FILES = {"manifest.json", "score.npy", "zscore.npy", "scores.jsonl"}


def checked_segment(value: str) -> str:
    if value != safe_segment(value):
        raise HTTPException(status_code=400, detail="Invalid result identifier")
    return value


def contained_path(path: Path, root: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise HTTPException(status_code=400, detail="Artifact is outside the configured data directory")
    return resolved


def create_saved_results_router(settings: BackendSettings, storage: ResultStorage) -> APIRouter:
    router = APIRouter(dependencies=[Depends(require_backend_token)])

    def result(dataset_id: str, prompt_id: str, revision: str | None = None):
        checked_segment(dataset_id)
        checked_segment(prompt_id)
        if dataset_id not in settings.default_dataset_ids:
            raise HTTPException(status_code=404, detail="Dataset is not enabled on this backend")
        if revision is not None:
            checked_segment(revision)
        # Resolve current.json once, then pin every artifact to this directory.
        pointer = contained_path(storage.revision_pointer_path(dataset_id, prompt_id), settings.result_root)
        try:
            effective_revision = revision or (storage.read_json(pointer) or {}).get("revision")
            if effective_revision:
                checked_segment(effective_revision)
            directory = contained_path(
                storage.revision_dir(dataset_id, prompt_id, effective_revision)
                if effective_revision else storage.result_dir(dataset_id, prompt_id),
                settings.result_root,
            )
            manifest_path = contained_path(directory / "manifest.json", directory)
            manifest = storage.read_json(manifest_path)
        except (OSError, ValueError, TypeError, AttributeError):
            raise HTTPException(status_code=409, detail="Saved result metadata cannot be read") from None
        if not manifest:
            raise HTTPException(status_code=404, detail="Saved result not found; query generation is disabled")
        if not isinstance(manifest, dict) or not isinstance(manifest.get("stats"), dict):
            raise HTTPException(status_code=409, detail="Saved result metadata is malformed")
        if (manifest.get("dataset_id") != dataset_id or manifest.get("prompt_id") != prompt_id
                or (manifest.get("result_revision") or None) != (effective_revision or None)):
            raise HTTPException(status_code=409, detail="Saved result metadata does not match its location")
        return directory, manifest

    @router.get("/api/scoring/results")
    def list_results(dataset_id: str | None = None):
        if dataset_id is not None and dataset_id not in settings.default_dataset_ids:
            raise HTTPException(status_code=404, detail="Dataset is not enabled on this backend")
        results = []
        skipped = 0
        for current_dataset in settings.default_dataset_ids:
            if dataset_id is not None and current_dataset != dataset_id:
                continue
            dataset_dir = contained_path(storage.dataset_dir(current_dataset), settings.result_root)
            if not dataset_dir.exists():
                continue
            for prompt_dir in sorted(dataset_dir.iterdir()):
                if not prompt_dir.is_dir():
                    continue
                try:
                    directory, manifest = result(current_dataset, prompt_dir.name)
                    files = {}
                    for name in sorted(DOWNLOAD_FILES):
                        path = contained_path(directory / name, directory)
                        if path.is_file():
                            files[name] = path.stat().st_size
                    if not {"score.npy", "zscore.npy"}.issubset(files):
                        skipped += 1
                        continue
                except (HTTPException, OSError):
                    skipped += 1
                    continue
                base = f"/api/scoring/results/{quote(current_dataset)}/{quote(prompt_dir.name)}"
                revision = manifest.get("result_revision")
                suffix = "?" + urlencode({"revision": revision}) if revision else ""
                results.append({
                    "dataset_id": current_dataset, "prompt_id": prompt_dir.name,
                    "prompt": manifest.get("prompt"), "query_type": manifest.get("query_type", "text"),
                    "result_revision": revision, "created_at": manifest.get("created_at"),
                    "count": (manifest.get("stats") or {}).get("count"),
                    "zooms": manifest.get("zooms", []),
                    "manifest_url": base + "/manifest" + suffix,
                    "csv_url": base + "/download.csv" + suffix,
                    "files": {name: {"bytes": size, "url": base + "/files/" + name + suffix}
                              for name, size in files.items()},
                })
        return JSONResponse({"results": results, "count": len(results), "skipped_incomplete": skipped},
                            headers=NO_STORE_HEADERS)

    @router.get("/api/scoring/results/{dataset_id}/{prompt_id}/manifest")
    def get_manifest(dataset_id: str, prompt_id: str, revision: str | None = None):
        _, manifest = result(dataset_id, prompt_id, revision)
        manifest = dict(manifest)
        manifest["tile_url_template"] = storage.tile_url_template(
            dataset_id, prompt_id, revision=manifest.get("result_revision"))
        return JSONResponse(manifest, headers=NO_STORE_HEADERS)

    @router.get("/api/scoring/results/{dataset_id}/{prompt_id}/files/{filename}")
    def download_file(dataset_id: str, prompt_id: str, filename: str, revision: str | None = None):
        if filename not in DOWNLOAD_FILES:
            raise HTTPException(status_code=404, detail="Result file is not available for download")
        directory, _ = result(dataset_id, prompt_id, revision)
        path = contained_path(directory / filename, directory)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Saved file not found; generation is disabled")
        return FileResponse(path, filename=filename, headers=NO_STORE_HEADERS)

    @router.get("/api/scoring/results/{dataset_id}/{prompt_id}/download.csv")
    def download_csv(dataset_id: str, prompt_id: str, revision: str | None = None):
        import numpy as np

        directory, manifest = result(dataset_id, prompt_id, revision)
        mapped_inputs = ExitStack()

        def load_array(path):
            array = np.load(path, mmap_mode="r", allow_pickle=False)
            mapped_inputs.callback(array._mmap.close)
            return array

        try:
            scores, zscores = [load_array(contained_path(directory / name, directory))
                               for name in ("score.npy", "zscore.npy")]
            # Only reference shards are opened: no embedding tensors or model dependencies.
            dataset_dir = contained_path(settings.data_root / dataset_id, settings.data_root)
            ref_paths = sorted(dataset_dir.glob("views_emb_shard_*_ref.npy"), key=shard_index_from_name)
            refs = [load_array(contained_path(path, dataset_dir))
                    for path in ref_paths]
            if not refs or any(ref.ndim != 2 or ref.shape[1] < 4 or ref.dtype.kind not in "iuf" for ref in refs):
                raise ValueError("Missing or invalid reference shards")
            count = sum(len(ref) for ref in refs)
            if (scores.ndim != 1 or zscores.ndim != 1 or scores.dtype.kind not in "iuf"
                    or zscores.dtype.kind not in "iuf" or len(scores) != count or len(zscores) != count
                    or count != manifest["stats"]["count"]):
                raise ValueError("Reference and score row counts do not match")
        except (OSError, ValueError, KeyError, TypeError):
            mapped_inputs.close()
            raise HTTPException(status_code=409, detail="Saved scores and reference shards are missing or inconsistent") from None
        except BaseException:
            mapped_inputs.close()
            raise

        def chunks():
            buffer = io.StringIO(newline="")
            writer = csv.writer(buffer)
            writer.writerow(["dataset_id", "prompt_id", "result_revision", "row_index", "pano_id",
                             "lon", "lat", "capture_date", "score", "zscore"])
            row_index = 0
            for ref in refs:
                for record in ref:
                    writer.writerow([dataset_id, prompt_id, manifest.get("result_revision") or "", row_index,
                                     str(int(record[0])), float(record[1]), float(record[2]), int(record[3]),
                                     float(scores[row_index]), float(zscores[row_index])])
                    row_index += 1
                    if row_index % 1024 == 0:
                        yield buffer.getvalue()
                        buffer.seek(0)
                        buffer.truncate(0)
            if buffer.tell():
                yield buffer.getvalue()

        def stream():
            with mapped_inputs:
                yield from chunks()

        return StreamingResponse(stream(), media_type="text/csv", background=BackgroundTask(mapped_inputs.close), headers={
            **NO_STORE_HEADERS,
            "Content-Disposition": f'attachment; filename="{dataset_id}-{prompt_id}.csv"',
            "X-Result-Count": str(count),
        })

    @router.get("/api/scoring/results/{dataset_id}/{prompt_id}/tiles/{z}/{x}/{y}.geojson")
    @router.get("/api/scoring/results/{dataset_id}/{prompt_id}/revisions/{revision}/tiles/{z}/{x}/{y}.geojson")
    def get_tile(dataset_id: str, prompt_id: str, z: int, x: int, y: int, revision: str | None = None):
        if not (0 <= z <= 24 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
            raise HTTPException(status_code=400, detail="Invalid tile coordinates")
        directory, _ = result(dataset_id, prompt_id, revision)
        path = contained_path(directory / "tiles" / str(z) / str(x) / f"{y}.geojson", directory)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Saved tile not found; generation is disabled")
        return FileResponse(path, media_type="application/geo+json", headers=NO_STORE_HEADERS)

    @router.post("/api/scoring/jobs", status_code=403)
    @router.post("/api/scoring/jobs/batch", status_code=403)
    @router.post("/api/scoring/arcgis/merged-features/page", status_code=403)
    def reject_new_queries():
        raise HTTPException(status_code=403, detail={
            "code": "query_submission_disabled",
            "message": "This CPU backend serves human verification and saved downloads only. New queries are disabled.",
        })

    return router
