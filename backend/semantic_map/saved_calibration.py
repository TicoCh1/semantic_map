"""Read completed four-city colour calibrations without starting inference."""
from __future__ import annotations

import json
import math
import re
import uuid
from pathlib import Path


VERSION = 'qwen-rerank-uniform64-agreement-endpoints-v2'
DATASETS = frozenset(f'{city}_512_8_45_8B' for city in ('london', 'shanghai', 'new_york', 'rome'))
FINAL_RUN = 'combined-uniform64-agreement-20261006'
SIGNATURE_PROFILE = dict(
    version=VERSION,
    model='/workspace/models/Qwen3-VL-Reranker-2B',
    projection='legacy-fov45-pitch0-roll0-bilinear-4096x2048-out512-v1',
    instruction=('Retrieve street-view panoramas relevant to the query. The eight images are '
                 'perspective views of the same location. Judge the visible evidence across the '
                 'views as one panorama. Do not infer features that are not visible.'),
    max_pixels=262144,
    input_pipeline='cuda-eight-view-prefetch-position-v1',
    batch_size=4,
    sampling=dict(method='uniform_zscore', count=64, bucket_width=0.5,
                  range='finite_minmax', selection='nearest_unique_greedy_v1'))
CENTER_METHODS = frozenset(('logit_zero', 'all_negative_max_score', 'negative_fit_max_score',
                            'all_positive_min_score', 'positive_fit_min_score'))


def _read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError, UnicodeError):
        return None


def _identities(refs):
    """Reject variants, duplicates and partial cohorts before comparing refs."""
    if not isinstance(refs, list) or len(refs) != len(DATASETS):
        return None
    identities = []
    for ref in refs:
        if not isinstance(ref, dict) or ref.get('embedding', 'new') != 'new':
            return None
        values = tuple(ref.get(key) for key in ('dataset_id', 'prompt_id', 'result_revision'))
        if any(not isinstance(value, str) or not value for value in values):
            return None
        dataset, prompt_id, revision = values
        if dataset not in DATASETS or not re.fullmatch(r'saved-(0|[1-9][0-9]*)', prompt_id):
            return None
        if not revision.startswith('cpu4096-v2-'):
            return None
        identities.append(values)
    if {identity[0] for identity in identities} != DATASETS:
        return None
    return tuple(sorted(identities))


def _finite_number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def source_file_stamp(path):
    """Detect changed score/identity inputs using file metadata only."""
    stat = path.stat()
    return stat.st_mtime_ns, stat.st_size, stat.st_ino


def _sources_unchanged(data):
    sources = data.get('calibration_sources')
    if not sources:
        return False
    try:
        return all(source_file_stamp(path) == stamp for path, stamp in sources)
    except OSError:
        return False


def _correlations(raw):
    fields = ('n', 'pearson_r', 'spearman_rho', 'bicor', 'bicor_c', 'agreement_percent', 'status')
    if not isinstance(raw, dict) or not set(fields).issubset(raw) or type(raw.get('n')) is not int or raw['n'] != 64 or raw.get('bicor_c') != 9:
        return None
    values = [raw.get(key) for key in ('pearson_r', 'spearman_rho', 'bicor')]
    if any(value is not None and (not _finite_number(value) or not -1 <= value <= 1) for value in values):
        return None
    defined = all(value is not None for value in values)
    agreement = raw.get('agreement_percent')
    if defined:
        expected = 100 * min(1, max(0, sum(values) / 3))
        if raw.get('status') != 'defined' or not _finite_number(agreement) or not math.isclose(agreement, expected, abs_tol=1e-9):
            return None
    elif raw.get('status') != 'undefined' or agreement is not None:
        return None
    return {key: raw[key] for key in fields}


class SavedCalibrationCatalog:
    def __init__(self, root: Path):
        self.root = root
        self.paths = {}
        plan = _read_json(root / FINAL_RUN / 'plan.json')
        if not isinstance(plan, dict) or plan.get('version') != VERSION or plan.get('sampling') != 'uniform_zscore_64':
            return
        tasks = plan.get('tasks')
        if not isinstance(tasks, list):
            return
        allowed = set()
        for task in tasks:
            if not isinstance(task, dict) or not isinstance(task.get('prompt'), str):
                continue
            identities = _identities(task.get('results'))
            if identities is not None:
                allowed.add((task['prompt'], identities))
        duplicates = set()
        for path in root.glob('*.json'):
            if not re.fullmatch(r'[0-9a-f]{32}', path.stem):
                continue
            payload = _read_json(path)
            record = self._validated(path, payload)
            if record is None:
                continue
            prompt, identities, _ = record
            key = prompt, identities
            if key not in allowed:
                continue
            if key in self.paths:
                duplicates.add(key)
            self.paths[key] = path
        for key in duplicates:
            self.paths.pop(key, None)

    @staticmethod
    def _validated(path, payload):
        if not isinstance(payload, dict) or payload.get('status') != 'calibrated':
            return None
        signature = payload.get('signature')
        if not isinstance(signature, dict) or set(signature) != set(SIGNATURE_PROFILE) | {'results'}:
            return None
        if any(signature.get(key) != value for key, value in SIGNATURE_PROFILE.items()):
            return None
        identities = _identities(signature.get('results'))
        if identities is None:
            return None
        # Match the existing UUID cache identity, not a hash of file bytes.
        if uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(signature, sort_keys=True)).hex != path.stem:
            return None
        prompt = payload.get('prompt')
        color = payload.get('color_range')
        method = payload.get('center_method')
        if not isinstance(prompt, str) or not isinstance(color, dict) or color.get('field') != 'zscore':
            return None
        if not isinstance(method, str) or method not in CENTER_METHODS or type(payload.get('has_zero_crossing')) is not bool:
            return None
        if payload['has_zero_crossing'] != (method == 'logit_zero'):
            return None
        mean, lower, upper = (color.get(key) for key in ('mean', 'lower', 'upper'))
        if not all(_finite_number(value) for value in (mean, lower, upper)):
            return None
        if not lower < mean < upper or not math.isclose(lower, mean - 2, rel_tol=0, abs_tol=1e-9) or not math.isclose(upper, mean + 2, rel_tol=0, abs_tol=1e-9):
            return None
        result = dict(job_id=path.stem, color_range=dict(mean=mean, lower=lower, upper=upper, field='zscore'),
                      center_method=method)
        if 'correlations' in payload:
            correlations = _correlations(payload['correlations'])
            if correlations is None:
                return None
            result['correlations'] = correlations
        return prompt, identities, result

    def lookup(self, refs, prompt, datasets):
        identities = _identities(refs)
        if identities is None or not isinstance(prompt, str):
            return None
        # Recheck the live source catalog on every access, including after reload.
        for dataset, prompt_id, revision in identities:
            data = datasets.get(dataset)
            if data is None or data.get('revision') != revision or data.get('lookup', {}).get(prompt) != int(prompt_id[6:]) or not _sources_unchanged(data):
                return None
        key = prompt, identities
        path = self.paths.get(key)
        if path is None:
            return None
        record = self._validated(path, _read_json(path))
        if record is None or record[:2] != key or not all(_sources_unchanged(datasets[dataset]) for dataset, _, _ in identities):
            return None
        return record[2]
