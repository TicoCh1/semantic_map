"""Serve immutable saved retrieval cohorts alongside the GPU query service."""
from __future__ import annotations

import threading
from dataclasses import replace

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from .auth import require_backend_token
from .cpu_api import SavedScoreCatalog
from .prompt_ids import utc_now
from .remote_schemas import ScoringJobBatchCreate
from .tile_math import TileKey
from .tile_writer import write_geojson_tile_from_arrays


def create_saved_score_router(settings, catalog_factory=None):
    # These tiles must never overwrite the native scorer's different cohort.
    root = settings.workspace_root / 'semantic_backend/cpu_map'
    settings = replace(settings, result_root=root/'results', tile_index_root=root/'tile_index')
    factory = catalog_factory or (lambda: SavedScoreCatalog(
        settings, settings.workspace_root/'semantic_backend/experiments'))
    catalog_lock = threading.RLock()
    instance = None

    def catalog():
        nonlocal instance
        with catalog_lock:
            if instance is None:
                instance = factory()
            return instance

    def saved_ref(ref):
        return {**ref, **{key: ref[key].replace('/api/scoring/results/', '/api/scoring/saved/results/', 1)
                         for key in ('manifest_url', 'tile_url_template')}}

    def checked(dataset, prompt_id, revision):
        data, column = catalog().resolve(dataset, prompt_id)
        if revision != data['revision']:
            raise HTTPException(404, 'Saved score revision has changed; reopen this prompt')
        return data, column

    router = APIRouter(prefix='/api/scoring/saved', dependencies=[Depends(require_backend_token)])

    @router.post('/jobs/batch')
    def open_prompts(payload: ScoringJobBatchCreate):
        results = []
        saved = catalog()
        for i, query in enumerate(payload.queries):
            try:
                job = saved.job(query)
                refs = [saved_ref(ref) for ref in job['results']]
                job = {**job, 'results': refs, 'manifest_url': refs[0]['manifest_url'],
                       'tile_url_template': refs[0]['tile_url_template'],
                       'message': 'Loaded saved 8B retrieval scores; calibration cache available.'}
                results.append(dict(index=i, status='accepted', job=job))
            except HTTPException as error:
                results.append(dict(index=i, status='rejected', error=str(error.detail)))
        return dict(request_id='gpu-saved', received_at=utc_now(), queries=results)

    @router.get('/results/{dataset}/{prompt_id}/revisions/{revision}/manifest')
    def manifest(dataset: str, prompt_id: str, revision: str):
        data, column = checked(dataset, prompt_id, revision)
        scores, zscores = catalog().arrays(dataset, prompt_id)
        return dict(**saved_ref(catalog().result_ref(dataset, column)),
                    prompt=next(p for p, i in data['lookup'].items() if i == column),
                    source_type='zxy_geojson', score_property='score', zscore_property='zscore',
                    zooms=list(settings.tile_zooms), model_version='8B',
                    scoring_version='saved-city-only-4096',
                    density_rule=data['index'].density_rule,
                    density_base_zoom=data['index'].density_base_zoom,
                    stats=dict(count=len(scores), score_min=float(scores.min()), score_max=float(scores.max()),
                               zscore_min=float(zscores.min()), zscore_max=float(zscores.max())))

    @router.get('/results/{dataset}/{prompt_id}/revisions/{revision}/tiles/{z}/{x}/{y}.geojson')
    def tile(dataset: str, prompt_id: str, revision: str, z: int, x: int, y: int):
        data, _ = checked(dataset, prompt_id, revision)
        if z not in settings.tile_zooms or not (0 <= x < 2**z and 0 <= y < 2**z):
            raise HTTPException(400, 'Invalid tile coordinates or unsupported zoom')
        saved = catalog()
        path = saved.storage.tile_path(dataset, prompt_id, z, x, y, revision)
        with saved.lock:
            if not path.is_file():
                scores, zscores = saved.arrays(dataset, prompt_id)
                write_geojson_tile_from_arrays(prompt_id=prompt_id, dataset_id=dataset,
                    tile=TileKey(z, x, y), tile_index=data['index'], records=data['records'],
                    scores=scores, zscores=zscores, storage=saved.storage, result_revision=revision)
        return FileResponse(path, media_type='application/geo+json')

    return router
