"""CPU-only map server for previously computed query scores. Never imports a scorer."""
from __future__ import annotations

import json
import os
import threading
from collections import OrderedDict
from contextlib import asynccontextmanager
from dataclasses import replace
from pathlib import Path
from uuid import uuid4
from typing import Literal

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .auth import require_backend_token
from .backend_config import get_backend_settings
from .city_catalog import active_city_configs
from .pano_service import PanoServiceRegistry, AmbiguousPanoIdError, PanoCoordinateMismatchError
from .prompt_ids import normalize_prompt, utc_now
from .remote_schemas import ScoringJobBatchCreate, ScoringJobCreate
from .result_storage import ResultStorage
from .scoring_models import PanoRecord
from .tile_index import load_or_build_tile_index
from .tile_math import TileKey
from .tile_writer import write_geojson_tile_from_arrays


class SavedScoreCatalog:
    def __init__(self, settings, experiment_root: Path):
        self.settings = settings
        self.storage = ResultStorage(settings)
        self.datasets = {}
        self.prompts = {}
        self.cache = OrderedDict()
        self.lock = threading.RLock()
        for city in active_city_configs(settings):
            dataset = city['dataset_id']
            directory = experiment_root / f"{city['id']}_embedding_comparison_20260917"
            status = json.loads((directory / 'status.json').read_text())
            if status.get('stage') != 'complete':
                raise ValueError(f'Incomplete saved scores: {dataset}')
            prompts = json.loads((directory / 'prompts.json').read_text())
            with np.load(directory / 'alignment.npz', allow_pickle=False) as aligned:
                refs = aligned['refs']
            if refs.ndim != 2 or refs.shape[1] < 4 or not np.isfinite(refs[:, :4]).all():
                raise ValueError(f'Invalid aligned identities: {dataset}')
            records = tuple(PanoRecord(str(int(r[0])), i, float(r[1]), float(r[2]), int(r[3]))
                            for i, r in enumerate(refs))
            path = directory / 'score_new4096.npy'
            scores = np.load(path, mmap_mode='r', allow_pickle=False)
            if scores.shape != (len(records), len(prompts)) or not np.isfinite(scores).all():
                raise ValueError(f'Invalid saved score matrix: {dataset}')
            revision = f"cpu4096-v2-{path.stat().st_mtime_ns}-{(directory / 'alignment.npz').stat().st_mtime_ns}-{(directory / 'prompts.json').stat().st_mtime_ns}"
            index = load_or_build_tile_index(dataset, records, settings)
            lookup = {}
            for column, entry in enumerate(prompts):
                if entry['index'] != column:
                    raise ValueError('Prompt columns are not contiguous')
                canonical = normalize_prompt(entry['prompt'])
                if canonical in lookup:
                    raise ValueError('Duplicate saved prompt')
                lookup[canonical] = column
                self.prompts.setdefault(canonical, []).append(dataset)
            self.datasets[dataset] = dict(records=records, scores=scores, lookup=lookup,
                                          index=index, revision=revision, variants={})
            old_path = directory / 'historical_score.npy'
            if old_path.is_file():
                old_scores = np.load(old_path, mmap_mode='r', allow_pickle=False)
                if old_scores.shape != scores.shape or not np.isfinite(old_scores).all():
                    raise ValueError(f'Invalid historical score matrix: {dataset}')
                self.datasets[dataset]['variants']['old'] = dict(
                    scores=old_scores, revision=f'cpu-old-v1-{old_path.stat().st_mtime_ns}-{revision}')
        if not self.datasets:
            raise ValueError('CPU mode has no configured saved-score datasets')

    def resolve(self, dataset, prompt_id, embedding='new'):
        data = self.datasets.get(dataset)
        if data is None:
            raise HTTPException(404, 'Dataset is not available')
        if not prompt_id.startswith('saved-') or not prompt_id[6:].isdigit():
            raise HTTPException(404, 'Saved prompt not found')
        column = int(prompt_id[6:])
        if column >= data['scores'].shape[1]:
            raise HTTPException(404, 'Saved prompt not found')
        if embedding != 'new':
            variant = data['variants'].get(embedding)
            if variant is None:
                raise HTTPException(404, 'Embedding comparison is not available for this city')
            data = {**data, **variant}
        return data, column

    def arrays(self, dataset, prompt_id, embedding='new'):
        with self.lock:
            key = (dataset, prompt_id, embedding)
            if key not in self.cache:
                data, column = self.resolve(dataset, prompt_id, embedding)
                scores = np.array(data['scores'][:, column], dtype=np.float32)
                mean = np.float32(scores.mean(dtype=np.float64))
                std = np.float32(scores.std(dtype=np.float64)) + np.float32(1e-12)
                zscores = (scores - mean) / std
                self.cache[key] = (scores, zscores)
                if len(self.cache) > 16:
                    self.cache.popitem(last=False)
            self.cache.move_to_end(key)
            return self.cache[key]

    def result_ref(self, dataset, column, embedding='new'):
        prompt_id = f'saved-{column}'
        data, _ = self.resolve(dataset, prompt_id, embedding)
        base = f'/api/scoring/results/{dataset}/{prompt_id}/revisions/{data["revision"]}'
        suffix = '?embedding=old' if embedding == 'old' else ''
        return dict(dataset_id=dataset, prompt_id=prompt_id, result_revision=data['revision'],
                    embedding=embedding, manifest_url=base+'/manifest'+suffix,
                    tile_url_template=base+'/tiles/{z}/{x}/{y}.geojson'+suffix)

    def job(self, query):
        canonical = normalize_prompt(query.prompt)
        if query.query_type != 'text' or query.force_override or canonical not in self.prompts:
            raise HTTPException(403, 'CPU mode only opens existing prompts; new scoring and reference queries are disabled.')
        datasets = query.dataset_ids or ([query.dataset_id] if query.dataset_id else list(self.datasets))
        if any(d not in self.prompts[canonical] for d in datasets):
            raise HTTPException(404, 'This prompt has no saved scores for one or more requested cities')
        results = [self.result_ref(d, self.datasets[d]['lookup'][canonical]) for d in datasets]
        stamp = utc_now()
        return dict(job_id='cpu-'+uuid4().hex, prompt_id=results[0]['prompt_id'], dataset_id=datasets[0],
                    dataset_ids=datasets, dataset_group_id=query.dataset_group_id, prompt=canonical,
                    query_type='text', status='ready', progress=1, message='Loaded existing 4096-dimensional scores on CPU.',
                    created_at=stamp, updated_at=stamp, results=results, cache_status='cache_hit',
                    manifest_url=results[0]['manifest_url'], tile_url_template=results[0]['tile_url_template'])


def create_app(settings=None, experiment_root=None):
    settings = settings or get_backend_settings()
    root = Path(os.getenv('CPU_CACHE_ROOT', str(settings.workspace_root / 'semantic_backend/cpu_map')))
    # Keep derived CPU tiles separate from all historical and GPU result revisions.
    settings = replace(settings, result_root=root/'results', tile_index_root=root/'tile_index')
    experiment_root = Path(experiment_root or os.getenv('CPU_EXPERIMENT_ROOT', str(settings.workspace_root/'semantic_backend/experiments')))

    @asynccontextmanager
    async def lifespan(app):
        app.state.catalog = SavedScoreCatalog(settings, experiment_root)
        app.state.panos = PanoServiceRegistry(settings)
        yield

    app = FastAPI(title='SemanticMap CPU saved-prompt mode', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
    protected = [Depends(require_backend_token)]

    @app.get('/api/ready')
    @app.get('/api/health')
    def ready():
        return dict(ready=True, mode='cpu', new_queries_enabled=False,
                    default_dataset_ids=list(app.state.catalog.datasets),
                    prompt_count=len(app.state.catalog.prompts))

    @app.get('/api/capabilities')
    def capabilities():
        return dict(mode='cpu', new_queries_enabled=False, saved_prompts_enabled=True,
                    embedding_comparison_dataset_ids=[d for d, v in app.state.catalog.datasets.items() if 'old' in v['variants']],
                    dataset_id=settings.default_dataset_id, dataset_ids=list(app.state.catalog.datasets),
                    dataset_group_id=settings.default_dataset_group_id, cities=active_city_configs(settings))

    @app.get('/api/scoring/prompts', dependencies=protected)
    def prompts(q: str = Query('', max_length=500)):
        return dict(prompts=[dict(prompt=p, dataset_ids=d) for p, d in sorted(app.state.catalog.prompts.items())
                             if q.casefold() in p.casefold()])

    @app.post('/api/scoring/jobs', dependencies=protected)
    def open_prompt(payload: ScoringJobCreate):
        return app.state.catalog.job(payload)

    @app.post('/api/scoring/comparison', dependencies=protected)
    def comparison(payload: ScoringJobCreate):
        datasets = payload.dataset_ids or ([payload.dataset_id] if payload.dataset_id else [])
        if len(datasets) != 1:
            raise HTTPException(400, 'Choose exactly one city for embedding comparison')
        catalog = app.state.catalog
        job = catalog.job(payload)
        dataset = datasets[0]
        column = catalog.datasets[dataset]['lookup'][normalize_prompt(payload.prompt)]
        return dict(prompt=job['prompt'], dataset_id=dataset,
                    matched_count=len(catalog.datasets[dataset]['records']),
                    normalization='Per-embedding z-score over the same aligned city points',
                    results=[catalog.result_ref(dataset, column, v) for v in ('old', 'new')])

    @app.post('/api/scoring/jobs/batch', dependencies=protected)
    def open_prompts(payload: ScoringJobBatchCreate):
        results = []
        for i, query in enumerate(payload.queries):
            try:
                results.append(dict(index=i, status='accepted', job=app.state.catalog.job(query)))
            except HTTPException as e:
                results.append(dict(index=i, status='rejected', error=str(e.detail)))
        return dict(request_id='cpu-saved', received_at=utc_now(), queries=results)

    def checked(dataset, prompt_id, revision, embedding='new'):
        data, column = app.state.catalog.resolve(dataset, prompt_id, embedding)
        if revision != data['revision']:
            raise HTTPException(404, 'Saved score revision has changed; reopen this prompt')
        return data, column

    @app.get('/api/scoring/results/{dataset}/{prompt_id}/revisions/{revision}/manifest', dependencies=protected)
    def manifest(dataset: str, prompt_id: str, revision: str, embedding: Literal['old', 'new'] = 'new'):
        data, column = checked(dataset, prompt_id, revision, embedding)
        scores, zscores = app.state.catalog.arrays(dataset, prompt_id, embedding)
        return dict(**app.state.catalog.result_ref(dataset, column, embedding),
                    prompt=next(p for p, i in data['lookup'].items() if i == column),
                    source_type='zxy_geojson', score_property='score', zscore_property='zscore',
                    zooms=list(settings.tile_zooms), model_version='2B' if embedding == 'old' else '8B',
                    scoring_version='historical-aligned' if embedding == 'old' else 'saved-city-only-4096',
                    density_rule=data['index'].density_rule, density_base_zoom=data['index'].density_base_zoom,
                    stats=dict(count=len(scores), score_min=float(scores.min()), score_max=float(scores.max()),
                               zscore_min=float(zscores.min()), zscore_max=float(zscores.max())))

    @app.get('/api/scoring/results/{dataset}/{prompt_id}/revisions/{revision}/tiles/{z}/{x}/{y}.geojson', dependencies=protected)
    def tile(dataset: str, prompt_id: str, revision: str, z: int, x: int, y: int, embedding: Literal['old', 'new'] = 'new'):
        data, _ = checked(dataset, prompt_id, revision, embedding)
        if z not in settings.tile_zooms or not (0 <= x < 2**z and 0 <= y < 2**z):
            raise HTTPException(400, 'Invalid tile coordinates or unsupported zoom')
        catalog = app.state.catalog
        path = catalog.storage.tile_path(dataset, prompt_id, z, x, y, revision)
        with catalog.lock:
            if not path.is_file():
                scores, zscores = catalog.arrays(dataset, prompt_id, embedding)
                write_geojson_tile_from_arrays(prompt_id=prompt_id, dataset_id=dataset, tile=TileKey(z,x,y),
                    tile_index=data['index'], records=data['records'], scores=scores, zscores=zscores,
                    storage=catalog.storage, result_revision=revision)
        return FileResponse(path, media_type='application/geo+json')

    def pano_result(dataset, pano_id, **kwargs):
        try:
            service = app.state.panos.service_for(dataset)
            result = service.ensure_pano_image(pano_id, **kwargs)
        except (ValueError, RuntimeError, AmbiguousPanoIdError, PanoCoordinateMismatchError) as e:
            raise HTTPException(409, str(e)) from None
        if result is None:
            raise HTTPException(404, 'Panorama not found')
        return service, result

    @app.get('/api/datasets/{dataset}/panos/{pano_id}', dependencies=protected)
    def pano(dataset: str, pano_id: str, lon: float | None = None, lat: float | None = None, date: int | None = None):
        service, (entry, path) = pano_result(dataset, pano_id, lon=lon, lat=lat, capture_date=date)
        return dict(pano_id=pano_id, pano_dataset_id=dataset, status='ready', image_url=service.image_url(entry),
                    byte_size=path.stat().st_size, member_name=entry.member_name)

    @app.get('/api/datasets/{dataset}/panos/{pano_id}/image', dependencies=protected)
    def image(dataset: str, pano_id: str, entry_key: str | None = None):
        _, (_, path) = pano_result(dataset, pano_id, entry_key=entry_key)
        return FileResponse(path, media_type='image/jpeg')

    return app
