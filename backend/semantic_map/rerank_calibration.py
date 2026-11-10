"""GPU-only reranking and auditable colour-range calibration of saved scores."""
from __future__ import annotations

import json
import math
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal

from .auth import require_backend_token
from .ai_verification_projection import AIProjectionService, PROFILE

VERSION = 'qwen-rerank-uniform64-agreement-endpoints-v2'
INSTRUCTION = ('Retrieve street-view panoramas relevant to the query. The eight images are '
               'perspective views of the same location. Judge the visible evidence across the '
               'views as one panorama. Do not infer features that are not visible.')


def input_pipeline():
    from .rerank_gpu_input import PIPELINE
    mode = os.getenv('RERANKER_INPUT_PIPELINE','cuda').lower()
    if mode not in ('cuda','legacy'):
        raise ValueError('RERANKER_INPUT_PIPELINE must be cuda or legacy')
    return PIPELINE if mode == 'cuda' else 'legacy-cpu-images-v1'


def sampling_seed(signature):
    # Execution optimizations must not change which cases are sampled.
    semantic = {k:v for k,v in signature.items() if k not in ('input_pipeline','batch_size')}
    key = uuid.uuid5(uuid.NAMESPACE_URL,json.dumps(semantic,sort_keys=True)).hex
    return int(key[:8],16)


def sample_strata(zscores, seed=0, width=0.5, per_bucket=3):
    """Walk outward from zero independently; retain a sparse terminal bucket."""
    z = np.asarray(zscores, dtype=np.float64)
    valid = np.flatnonzero(np.isfinite(z))
    if not len(valid):
        return [], []
    ids = np.floor(z[valid] / width).astype(np.int64)
    rng = np.random.default_rng(seed)
    samples, buckets = [], []
    for start, step in ((0, 1), (-1, -1)):
        bucket = start
        while True:
            rows = valid[ids == bucket]
            selected = rng.choice(rows, min(per_bucket, len(rows)), replace=False)
            buckets.append(dict(bucket=int(bucket), lower=bucket * width,
                                upper=(bucket + 1) * width, population=int(len(rows)),
                                sampled=int(len(selected)), stopped=len(rows) < per_bucket))
            for row in selected:
                samples.append(dict(row_index=int(row), bucket=int(bucket), zscore=float(z[row])))
            if len(rows) < per_bucket:
                break
            bucket += step
    return samples, sorted(buckets, key=lambda b: b['bucket'])


def sample_uniform_zscore(zscores, count=64, width=0.5):
    """Nearest unique rows to equally spaced targets across the finite z range.

    Uniform in score space, rather than quantiles/ranks. Original half-sigma
    populations remain the weights for fitting, including the far tails.
    """
    if count < 1 or width <= 0:
        raise ValueError('Sampling count and bucket width must be positive.')
    z = np.asarray(zscores, dtype=np.float64)
    valid = np.flatnonzero(np.isfinite(z))
    if not len(valid):
        return [], []
    order = valid[np.argsort(z[valid], kind='stable')]
    sorted_z = z[order]
    targets = np.linspace(sorted_z[0], sorted_z[-1], min(count, len(valid)))
    used, samples = set(), []
    for target_index, target in enumerate(targets):
        right = int(np.searchsorted(sorted_z, target, side='left'))
        left = right - 1
        while left >= 0 and left in used:
            left -= 1
        while right < len(order) and right in used:
            right += 1
        candidates = [i for i in (left, right) if 0 <= i < len(order)]
        selected = min(candidates, key=lambda i: (abs(sorted_z[i] - target), i))
        used.add(selected)
        row = int(order[selected])
        samples.append(dict(row_index=row, bucket=int(np.floor(z[row] / width)),
                            zscore=float(z[row]), target_index=target_index,
                            target_zscore=float(target)))
    ids, counts = np.unique(np.floor(z[valid] / width).astype(np.int64), return_counts=True)
    selected_counts = {}
    for sample in samples:
        selected_counts[sample['bucket']] = selected_counts.get(sample['bucket'], 0) + 1
    buckets = [dict(bucket=int(bucket), lower=float(bucket * width),
                    upper=float((bucket + 1) * width), population=int(population),
                    sampled=selected_counts.get(int(bucket), 0), stopped=False)
               for bucket, population in zip(ids, counts)]
    return samples, buckets


def correlation_summary(samples):
    """Equal-weight raw-pair agreement; undefined statistics never become zero."""
    x = np.asarray([s['zscore'] for s in samples], dtype=np.float64)
    y = np.asarray([s['logit'] for s in samples], dtype=np.float64)
    if not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Correlation inputs must be finite.')

    def pearson(a, b):
        a, b = a - np.mean(a), b - np.mean(b)
        denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
        return float(np.clip(np.dot(a, b) / denominator, -1, 1)) if denominator else None

    def ranks(values):
        order = np.argsort(values, kind='stable')
        _, starts, counts = np.unique(values[order], return_index=True, return_counts=True)
        result = np.empty(len(values), dtype=np.float64)
        result[order] = np.repeat(starts + (counts + 1) / 2, counts)
        return result

    r = rho = bc = None
    if len(samples) >= 2:
        r, rho = pearson(x, y), pearson(ranks(x), ranks(y))
        centered = []
        for values in (x, y):
            delta = values - np.median(values)
            mad = float(np.median(np.abs(delta)))
            if mad == 0:
                break
            u = delta / (9 * mad)
            centered.append(delta * np.where(np.abs(u) < 1, (1 - u * u) ** 2, 0.))
        if len(centered) == 2:
            a, b = centered
            denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
            if denominator:
                bc = float(np.clip(np.dot(a, b) / denominator, -1, 1))
    defined = all(v is not None for v in (r, rho, bc))
    return dict(n=len(samples), pearson_r=r, spearman_rho=rho, bicor=bc, bicor_c=9,
        agreement_percent=float(100 * np.clip((r + rho + bc) / 3, 0, 1)) if defined else None,
        status='defined' if defined else 'undefined',
        formula='100 * clip((pearson_r + spearman_rho + bicor) / 3, 0, 1)')


def fit_threshold(samples, buckets):
    """Population-weighted PAVA, with observed score endpoints if no zero exists."""
    points = []
    for bucket in buckets:
        group = [s for s in samples if s['bucket'] == bucket['bucket']]
        if not group:
            continue
        points.append(dict(bucket=bucket['bucket'], x=float(np.mean([s['zscore'] for s in group])),
                           y=float(np.mean([s['logit'] for s in group])),
                           weight=bucket['population']))
    blocks = []
    for i, point in enumerate(points):
        blocks.append(dict(start=i, end=i, weight=point['weight'], total=point['y'] * point['weight']))
        while len(blocks) > 1 and blocks[-2]['total'] / blocks[-2]['weight'] > blocks[-1]['total'] / blocks[-1]['weight']:
            right, left = blocks.pop(), blocks.pop()
            blocks.append(dict(start=left['start'], end=right['end'],
                               weight=left['weight'] + right['weight'], total=left['total'] + right['total']))
    for block in blocks:
        for i in range(block['start'], block['end'] + 1):
            points[i]['fitted_logit'] = block['total'] / block['weight']
    zero = [p['x'] for p in points if abs(p['fitted_logit']) < 1e-10]
    center = (min(zero) + max(zero)) / 2 if zero else None
    if center is None:
        for left, right in zip(points, points[1:]):
            a, b = left['fitted_logit'], right['fitted_logit']
            if a < 0 < b:
                center = left['x'] + (-a) * (right['x'] - left['x']) / (b - a)
                break
    method = 'logit_zero'
    if center is None and samples:
        if all(p['fitted_logit'] < 0 for p in points):
            center = max(s['zscore'] for s in samples)
            method = 'all_negative_max_score' if all(s['logit'] < 0 for s in samples) else 'negative_fit_max_score'
        elif all(p['fitted_logit'] > 0 for p in points):
            center = min(s['zscore'] for s in samples)
            method = 'all_positive_min_score' if all(s['logit'] > 0 for s in samples) else 'positive_fit_min_score'
    if center is None:
        return dict(status='no_samples', color_range=None, curve=points,
                    center_method=None, reason='No finite sampled evidence is available.')
    return dict(status='calibrated', color_range=dict(mean=float(center), lower=float(center - 2),
                upper=float(center + 2), field='zscore'), curve=points, center_method=method,
                has_zero_crossing=method == 'logit_zero')


class CalibrationRequest(BaseModel):
    results: list[dict] = Field(min_length=1, max_length=16)
    force: bool = False
    sampling: Literal['half_sigma', 'uniform_zscore_64'] = 'uniform_zscore_64'


class CalibrationColorRange(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    mean: float
    lower: float
    upper: float
    field: Literal['zscore'] = 'zscore'

    @model_validator(mode='after')
    def ordered_range(self):
        if not self.lower <= self.mean <= self.upper or self.lower >= self.upper:
            raise ValueError('Calibration bounds must contain the mean and have positive width.')
        return self


class CalibrationJobResponse(BaseModel):
    status: Literal['disabled', 'queued', 'running', 'ready', 'failed']
    job_id: str | None = None
    color_range: CalibrationColorRange | None = None
    calibration: dict | None = None
    cache_hit: bool | None = None
    stage: str | None = None
    sample_count: int | None = None
    images_prepared: int | None = None
    reason: str | None = None
    error: str | None = None


class RerankCalibrationService:
    def __init__(self, settings, registry, resolve, gpu_lock=None, before_inference=None):
        self.settings, self.resolve = settings, resolve
        self.registry = registry
        self.root = settings.workspace_root / 'semantic_backend' / 'rerank_calibration'
        self.projection = AIProjectionService(registry, settings.pano_cache_root / 'ai_verification_views')
        self.gpu_lock = gpu_lock or threading.RLock()
        self.before_inference = before_inference
        self.model = None
        self.image_reader = None
        self.cuda_pipeline = None
        self.keep_resident = os.getenv('RERANKER_KEEP_RESIDENT', 'false').lower() in ('1', 'true', 'yes')
        self.resident_cuda = False
        self.model_load_count = 0
        self.model_restore_count = 0
        self.embedding_handoff_count = 0
        self.jobs = {}
        self.lock = threading.RLock()
        self.pool = None
        self.enabled = False
        self.reason = 'Reranker is disabled by configuration.'
        if os.getenv('RERANKER_ENABLED', 'true').lower() in ('1', 'true', 'yes'):
            try:
                import torch
                self.enabled = torch.cuda.is_available()
                self.reason = '' if self.enabled else 'No CUDA GPU is available; reranker is not started.'
            except ImportError:
                self.reason = 'CUDA inference runtime is unavailable; reranker is not started.'
        if self.enabled:
            self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='rerank-calibration')

    def capabilities(self):
        return dict(enabled=self.enabled, reason=self.reason, version=VERSION,
                    input_format='perspective_views', views_per_candidate=8, projection_profile=PROFILE,
                    input_pipeline=input_pipeline(), batch_size=max(1,int(os.getenv('RERANKER_BATCH_SIZE','4'))),
                    keep_resident=self.keep_resident, resident_cuda=self.resident_cuda,
                    model_load_count=self.model_load_count, model_restore_count=self.model_restore_count,
                    embedding_handoff_count=self.embedding_handoff_count,
                    model=os.getenv('RERANKER_MODEL_DIR', '/workspace/models/Qwen3-VL-Reranker-2B'))

    def close(self):
        if self.pool:
            self.pool.shutdown(wait=True)
        with self.gpu_lock:
            self.offload_for_embedding()
        if self.cuda_pipeline:
            self.cuda_pipeline.close()
        if self.image_reader:
            self.image_reader.close()

    def _image_reader(self):
        if self.image_reader is None:
            from .rerank_gpu_input import RerankerImageReader
            self.image_reader = RerankerImageReader(self.registry,
                self.settings.pano_cache_root / 'ai_verification_views',
                workers=max(1,int(os.getenv('RERANKER_DECODE_WORKERS','4'))),
                cache_mib=max(0,int(os.getenv('RERANKER_RGB_CACHE_MIB','256'))))
        return self.image_reader

    def submit(self, refs, force=False, sampling='uniform_zscore_64'):
        if not self.enabled:
            return dict(status='disabled', reason=self.reason, color_range=None)
        if sampling not in ('half_sigma', 'uniform_zscore_64'):
            raise ValueError('Unknown calibration sampling method.')
        sources = sorted((self.resolve(ref) for ref in refs),
                         key=lambda source: json.dumps(source['identity'], sort_keys=True))
        if len({s['prompt'] for s in sources}) != 1:
            raise ValueError('Calibration results must belong to the same text query.')
        signature = dict(version=VERSION, results=sorted([s['identity'] for s in sources], key=lambda x: json.dumps(x, sort_keys=True)),
                         model=self.capabilities()['model'], projection=PROFILE, instruction=INSTRUCTION,
                         max_pixels=int(os.getenv('RERANKER_MAX_PIXELS', '262144')))
        signature.update(input_pipeline=input_pipeline(),batch_size=max(1,int(os.getenv('RERANKER_BATCH_SIZE','4'))))
        if sampling == 'uniform_zscore_64':
            signature['sampling'] = dict(method='uniform_zscore', count=64, bucket_width=0.5,
                range='finite_minmax', selection='nearest_unique_greedy_v1')
        key = uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(signature, sort_keys=True)).hex
        with self.lock:
            if key in self.jobs and (not force or self.jobs[key]['status'] in ('queued', 'running')):
                return self.jobs[key].copy()
            cache = self.root / (key + '.json')
            if force and cache.is_file():
                # Preserve the previous audit result before a requested fresh run.
                backup = self.root / 'rerun-backups' / (str(time.time_ns()) + '-' + key + '.json')
                backup.parent.mkdir(parents=True, exist_ok=True)
                backup.write_bytes(cache.read_bytes())
            if not force and cache.is_file():
                payload = json.loads(cache.read_text())
                if payload.get('signature') == signature:
                    self.jobs[key] = dict(job_id=key, status='ready', calibration=payload, color_range=payload['color_range'], cache_hit=True)
                    return self.jobs[key].copy()
            self.jobs[key] = dict(job_id=key, status='queued', color_range=None)
            self.pool.submit(self._run, key, sources, signature, time.perf_counter())
            return self.jobs[key].copy()

    def get(self, key):
        with self.lock:
            return self.jobs.get(key, {}).copy()

    def _load_model(self):
        import torch
        if self.model is None:
            from src.models.qwen3_vl_reranker import Qwen3VLReranker
            self.model = Qwen3VLReranker(model_name_or_path=self.capabilities()['model'],
                max_length=12000, max_pixels=int(os.getenv('RERANKER_MAX_PIXELS', '262144')),
                torch_dtype=torch.bfloat16, attn_implementation='sdpa')
            self.model_load_count += 1
        elif not self.resident_cuda:
            self.model.model.to('cuda')
            self.model.score_linear.to('cuda')
            self.model_restore_count += 1
        self.resident_cuda = True
        return self.model

    def offload_for_embedding(self):
        """Invoked under the shared lock before embedding can allocate CUDA memory."""
        if not self.resident_cuda:
            return
        import torch
        if self.cuda_pipeline is not None:
            self.cuda_pipeline.release_cuda()
        self.model.model.to('cpu')
        self.model.score_linear.to('cpu')
        self.resident_cuda = False
        self.embedding_handoff_count += 1
        torch.cuda.empty_cache()

    def _finish_inference(self, succeeded):
        if self.keep_resident and succeeded:
            return
        self.offload_for_embedding()

    def _batch_logits(self,pairs,image_sources=None,on_batch=None):
        if input_pipeline() == 'legacy-cpu-images-v1':
            return self._batch_logits_legacy(pairs)
        from .rerank_gpu_input import ImageSource,RerankerCudaPipeline
        model = self._load_model()
        if self.cuda_pipeline is None:
            self.cuda_pipeline = RerankerCudaPipeline(model,self._image_reader())
        if image_sources is None:
            image_sources = []
            for pair in pairs:
                paths = [Path(item['image'].removeprefix('file://')) for turn in pair
                    for item in turn['content'] if item['type']=='image']
                image_sources.append(ImageSource('views',tuple(paths)))
        return self.cuda_pipeline.run(pairs,image_sources,
            max(1,int(os.getenv('RERANKER_BATCH_SIZE','4'))),on_batch=on_batch)

    def _batch_logits_legacy(self, pairs):
        import torch
        model = self._load_model()
        size = max(2, int(os.getenv('RERANKER_BATCH_SIZE', '4')))
        logits, batches = [], []
        offset = 0
        oom_sizes = []
        while offset < len(pairs):
            count = min(size, len(pairs) - offset)
            inputs = hidden = score_values = None
            batch_started = time.perf_counter()
            torch.cuda.reset_peak_memory_stats()
            try:
                inputs = model.tokenize(pairs[offset:offset + count]).to(model.model.device)
                tokenization_seconds = time.perf_counter() - batch_started
                forward_started = time.perf_counter()
                gpu_start, gpu_end = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
                with torch.inference_mode():
                    gpu_start.record()
                    hidden = model.model(**inputs, use_cache=False).last_hidden_state[:, -1]
                    score_values = model.score_linear(hidden).float().squeeze(-1)
                    gpu_end.record()
                    values = score_values.cpu().tolist()
                logits.extend(values)
                batches.append(dict(size=count, tokens_per_pair=int(inputs['input_ids'].shape[1]),
                    tokenization_seconds=round(tokenization_seconds, 4),
                    forward_wall_seconds=round(time.perf_counter() - forward_started, 4),
                    gpu_forward_seconds=round(gpu_start.elapsed_time(gpu_end) / 1000, 4),
                    peak_allocated_mib=round(torch.cuda.max_memory_allocated() / 1024**2, 2),
                    oom_batch_sizes=oom_sizes))
                oom_sizes = []
                offset += count
            except torch.cuda.OutOfMemoryError:
                if count <= 1:
                    raise
                oom_sizes.append(count)
                size = max(1, count // 2)
            finally:
                del inputs, hidden, score_values
                torch.cuda.empty_cache()
        return logits, batches

    def _run(self, key, sources, signature, submitted_at=None):
        import torch
        started = time.perf_counter()
        timings = dict(worker_queue_seconds=started - submitted_at if submitted_at is not None else 0.)
        try:
            with self.lock:
                self.jobs[key].update(status='running', stage='sampling')
            zscores = np.concatenate([s['zscores'] for s in sources])
            strategy = signature.get('sampling')
            samples, buckets = (sample_uniform_zscore(zscores, strategy['count'], strategy['bucket_width'])
                if strategy and strategy['method'] == 'uniform_zscore'
                else sample_strata(zscores, seed=sampling_seed(signature)))
            ends = np.cumsum([len(s['records']) for s in sources])
            images = []
            timings['sampling_seconds'] = time.perf_counter() - started
            stage_started = time.perf_counter()
            with self.lock:
                self.jobs[key].update(stage='preparing_images', sample_count=len(samples), images_prepared=0)
            for sample in samples:
                source_index = int(np.searchsorted(ends, sample['row_index'], side='right'))
                local_row = sample['row_index'] - (int(ends[source_index - 1]) if source_index else 0)
                source = sources[source_index]
                record = source['records'][local_row]
                question = dict(dataset_id=source['identity']['dataset_id'], pano_id=record.pano_id,
                                lon=record.lon, lat=record.lat, date=record.date)
                if input_pipeline() == 'legacy-cpu-images-v1':
                    paths = self.projection.views(question)
                    if len(paths) != 8:
                        raise ValueError('Reranking requires eight reprojected perspective views per candidate.')
                    images.append(paths)
                else:
                    # Decode/locate is deferred to bounded workers so it overlaps
                    # the current GPU batch; do not prepare every image upfront.
                    images.append(question)
                sample.update(question, row_index=int(local_row), score=float(source['scores'][local_row]))
                with self.lock:
                    self.jobs[key]['images_prepared'] = len(images) if input_pipeline() == 'legacy-cpu-images-v1' else 0
            timings['prepare_images_seconds'] = time.perf_counter() - stage_started
            lock_started = time.perf_counter()
            with self.gpu_lock:
                timings['shared_gpu_wait_seconds'] = time.perf_counter() - lock_started
                with self.lock:
                    self.jobs[key]['stage'] = 'batched_inference'
                stage_started = time.perf_counter()
                if self.before_inference:
                    self.before_inference()
                timings['embedding_offload_seconds'] = time.perf_counter() - stage_started
                succeeded = False
                try:
                    stage_started = time.perf_counter()
                    model = self._load_model() if samples else None
                    timings['reranker_load_or_restore_seconds'] = time.perf_counter() - stage_started
                    stage_started = time.perf_counter()
                    pairs = [model.format_mm_instruction(query_text=sources[0]['prompt'],
                        doc_image=[str(p) for p in paths] if not isinstance(paths,dict)
                            else [f'perspective-{i}.png' for i in range(8)],
                        instruction=INSTRUCTION) for paths in images]
                    timings['pair_format_seconds'] = time.perf_counter() - stage_started
                    stage_started = time.perf_counter()
                    def prepared_progress(count):
                        with self.lock:
                            self.jobs[key]['images_prepared'] = count
                    logits, batches = self._batch_logits(pairs,
                        image_sources=images if input_pipeline() != 'legacy-cpu-images-v1' else None,
                        on_batch=prepared_progress) if pairs else ([], [])
                    timings['inference_wall_seconds'] = time.perf_counter() - stage_started
                    succeeded = True
                finally:
                    stage_started = time.perf_counter()
                    self._finish_inference(succeeded)
                    timings['reranker_offload_seconds'] = time.perf_counter() - stage_started
            stage_started = time.perf_counter()
            for sample, logit in zip(samples, logits):
                if not math.isfinite(logit):
                    raise RuntimeError('Reranker returned a non-finite logit.')
                sample.update(logit=float(logit), relevance=float(1 / (1 + math.exp(-max(-700, min(700, logit))))))
            samples.sort(key=lambda s: s['logit'], reverse=True)
            for rank, sample in enumerate(samples, 1):
                sample['rerank_rank'] = rank
            payload = dict(signature=signature, prompt=sources[0]['prompt'], samples=samples, buckets=buckets,
                           batches=batches, elapsed_seconds=round(time.perf_counter() - started, 3),
                           correlations=correlation_summary(samples), **fit_threshold(samples, buckets))
            timings['fit_and_pack_seconds'] = time.perf_counter() - stage_started
            payload['stage_timings'] = {name:round(value, 4) for name, value in timings.items()}
            payload['model_residency'] = dict(keep_resident=self.keep_resident, resident_cuda=self.resident_cuda,
                model_load_count=self.model_load_count, model_restore_count=self.model_restore_count)
            if self.cuda_pipeline is not None:
                payload['pipeline_stats'] = self.cuda_pipeline.stats.copy()
            self.root.mkdir(parents=True, exist_ok=True)
            temporary = self.root / (key + '.' + uuid.uuid4().hex + '.tmp')
            temporary.write_text(json.dumps(payload, allow_nan=False), encoding='utf-8')
            temporary.replace(self.root / (key + '.json'))
            with self.lock:
                self.jobs[key] = dict(job_id=key, status='ready', calibration=payload, color_range=payload['color_range'], cache_hit=False)
        except Exception as exc:
            with self.lock:
                self.jobs[key] = dict(job_id=key, status='failed', color_range=None, error=f'{type(exc).__name__}: {exc}')


def calibration_router(service):
    router = APIRouter()
    protected = [Depends(require_backend_token)]

    @router.get('/api/scoring/calibration/capabilities', dependencies=protected)
    def capabilities():
        return service.capabilities()

    @router.post('/api/scoring/calibration/jobs', dependencies=protected,
                 response_model=CalibrationJobResponse, response_model_exclude_unset=True)
    def submit(payload: CalibrationRequest):
        try:
            return service.submit(payload.results, force=payload.force, sampling=payload.sampling)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @router.get('/api/scoring/calibration/jobs/{key}', dependencies=protected,
                response_model=CalibrationJobResponse, response_model_exclude_unset=True)
    def job(key: str):
        result = service.get(key)
        if not result:
            raise HTTPException(404, 'Calibration job not found')
        return result

    return router
