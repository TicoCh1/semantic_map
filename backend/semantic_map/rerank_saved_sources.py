"""Read already-computed 8B prompt columns for calibration; never run embedding."""
from collections import OrderedDict
import json
import threading

import numpy as np

from .city_catalog import active_city_configs
from .prompt_ids import normalize_prompt
from .scoring_models import PanoRecord


class SavedRerankSources:
    def __init__(self, settings, root):
        self.datasets = {}
        self.cache = OrderedDict()
        self.lock = threading.RLock()
        for city in active_city_configs(settings):
            directory = root / f"{city['id']}_embedding_comparison_20260917"
            if not directory.is_dir():
                continue
            if json.loads((directory / 'status.json').read_text()).get('stage') != 'complete':
                raise ValueError(f"Incomplete saved scores: {city['dataset_id']}")
            prompts = json.loads((directory / 'prompts.json').read_text())
            with np.load(directory / 'alignment.npz', allow_pickle=False) as alignment:
                refs = alignment['refs']
            if refs.ndim != 2 or refs.shape[1] < 4 or not np.isfinite(refs[:, :4]).all():
                raise ValueError('Invalid saved query identities')
            records = tuple(PanoRecord(str(int(r[0])), i, float(r[1]), float(r[2]), int(r[3]))
                            for i, r in enumerate(refs))
            path = directory / 'score_new4096.npy'
            scores = np.load(path, mmap_mode='r', allow_pickle=False)
            if scores.shape != (len(records), len(prompts)):
                raise ValueError('Saved query matrix shape does not match identities')
            revision = f"cpu4096-v2-{path.stat().st_mtime_ns}-{(directory / 'alignment.npz').stat().st_mtime_ns}-{(directory / 'prompts.json').stat().st_mtime_ns}"
            for column, entry in enumerate(prompts):
                if entry['index'] != column:
                    raise ValueError('Saved query columns are not contiguous')
            self.datasets[city['dataset_id']] = dict(records=records, scores=scores,
                prompts=prompts, revision=revision)

    def resolve(self, ref):
        dataset, prompt_id, revision = (str(ref.get(k, '')) for k in
                                      ('dataset_id', 'prompt_id', 'result_revision'))
        if ref.get('embedding', 'new') != 'new':
            raise ValueError('Calibration requires current text retrieval scores')
        data = self.datasets.get(dataset)
        if data is None or not prompt_id.startswith('saved-') or not prompt_id[6:].isdigit():
            raise ValueError('Saved query not found')
        column = int(prompt_id[6:])
        if column >= len(data['prompts']) or revision != data['revision']:
            raise ValueError('Saved query revision does not match the immutable source')
        key = dataset, column
        with self.lock:
            if key not in self.cache:
                scores = np.array(data['scores'][:, column], dtype=np.float32)
                if not np.isfinite(scores).all():
                    raise ValueError('Saved query scores are non-finite')
                mean = np.float32(scores.mean(dtype=np.float64))
                std = np.float32(scores.std(dtype=np.float64)) + np.float32(1e-12)
                self.cache[key] = scores, (scores - mean) / std
                if len(self.cache) > 16:
                    self.cache.popitem(last=False)
            self.cache.move_to_end(key)
            scores, zscores = self.cache[key]
        return dict(identity=dict(dataset_id=dataset, prompt_id=prompt_id, result_revision=revision),
            prompt=normalize_prompt(data['prompts'][column]['prompt']),
            records=data['records'], scores=scores, zscores=zscores)

    def references(self):
        for dataset, data in self.datasets.items():
            for column, entry in enumerate(data['prompts']):
                yield dict(dataset_id=dataset, prompt_id=f'saved-{column}',
                           result_revision=data['revision'], embedding='new'), normalize_prompt(entry['prompt'])
