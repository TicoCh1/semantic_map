import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
import uuid
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient

from semantic_map.backend_config import get_backend_settings
from semantic_map.city_catalog import DEFAULT_CITY_CATALOG
from semantic_map.cpu_api import create_app
from semantic_map.saved_calibration import DATASETS, FINAL_RUN, SIGNATURE_PROFILE, VERSION, SavedCalibrationCatalog, source_file_stamp


def source_refs():
    return [dict(dataset_id=dataset, prompt_id='saved-0', result_revision=f'cpu4096-v2-{index}-2-3', embedding='new')
            for index, dataset in enumerate(sorted(DATASETS))]


def calibration_payload(refs, prompt='a brick facade', mean=0, method='logit_zero'):
    signature = copy.deepcopy(SIGNATURE_PROFILE)
    signature['results'] = [{key: ref[key] for key in ('dataset_id', 'prompt_id', 'result_revision')} for ref in refs]
    return dict(signature=signature, prompt=prompt, status='calibrated',
                color_range=dict(mean=mean, lower=mean - 2, upper=mean + 2, field='zscore'),
                center_method=method, has_zero_crossing=method == 'logit_zero',
                correlations=dict(n=64, pearson_r=.75, spearman_rho=.6, bicor=.45, bicor_c=9,
                                  agreement_percent=60., status='defined'))


def write_payload(root, payload):
    key = uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(payload['signature'], sort_keys=True)).hex
    path = root / f'{key}.json'
    path.write_text(json.dumps(payload))
    return path


def write_plan(root, refs, prompt='a brick facade'):
    directory = root / FINAL_RUN
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'plan.json').write_text(json.dumps(dict(version=VERSION, sampling='uniform_zscore_64',
                                                       tasks=[dict(prompt=prompt, results=refs)])))


class SavedCalibrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.refs = source_refs()
        source = self.root / 'source.npy'
        source.write_bytes(b'scores')
        self.datasets = {ref['dataset_id']: dict(revision=ref['result_revision'], lookup={'a brick facade': 0})
                         for ref in self.refs}
        for data in self.datasets.values():
            data['calibration_sources'] = ((source, source_file_stamp(source)),)
        write_plan(self.root, self.refs)
        self.payload = calibration_payload(self.refs)
        self.path = write_payload(self.root, self.payload)

    def lookup(self, refs=None, prompt='a brick facade', datasets=None):
        return SavedCalibrationCatalog(self.root).lookup(self.refs if refs is None else refs, prompt,
                                                        self.datasets if datasets is None else datasets)

    def test_zero_mean_and_reordered_full_cohort_are_valid(self):
        result = self.lookup(list(reversed(self.refs)))
        self.assertEqual(result['job_id'], self.path.stem)
        self.assertEqual(result['color_range'], dict(mean=0, lower=-2, upper=2, field='zscore'))
        self.assertEqual(result['center_method'], 'logit_zero')
        self.assertAlmostEqual(result['correlations']['agreement_percent'], 60.)

    def test_all_endpoint_methods_are_preserved(self):
        for method in ('all_negative_max_score', 'negative_fit_max_score', 'all_positive_min_score', 'positive_fit_min_score'):
            with self.subTest(method=method):
                self.path.write_text(json.dumps(calibration_payload(self.refs, mean=3.5, method=method)))
                self.assertEqual(self.lookup()['center_method'], method)
                self.assertEqual(self.lookup()['color_range']['lower'], 1.5)

    def test_partial_duplicate_extra_and_native_refs_are_not_calibrated(self):
        cases = [self.refs[:1], self.refs[:3], self.refs + [self.refs[0]], self.refs[:3] + [self.refs[0]],
                 [{**ref, 'prompt_id': 'native-query'} for ref in self.refs],
                 [{**ref, 'prompt_id': 'saved-00'} for ref in self.refs]]
        for refs in cases:
            with self.subTest(refs=refs):
                self.assertIsNone(self.lookup(refs))

    def test_old_difference_unknown_and_implicit_current_variants(self):
        for variant in ('old', 'difference', '', None):
            refs = copy.deepcopy(self.refs)
            refs[0]['embedding'] = variant
            with self.subTest(variant=variant):
                self.assertIsNone(self.lookup(refs))
        refs = [{key: value for key, value in ref.items() if key != 'embedding'} for ref in self.refs]
        self.assertIsNotNone(self.lookup(refs))

    def test_current_revision_and_all_city_prompt_columns_must_match(self):
        datasets = copy.deepcopy(self.datasets)
        datasets[self.refs[0]['dataset_id']]['revision'] += '-stale'
        self.assertIsNone(self.lookup(datasets=datasets))
        datasets = copy.deepcopy(self.datasets)
        datasets[self.refs[0]['dataset_id']]['lookup']['a brick facade'] = 1
        self.assertIsNone(self.lookup(datasets=datasets))
        self.assertIsNone(self.lookup(prompt='trees'))
        refs = copy.deepcopy(self.refs)
        refs[0]['result_revision'] += '-stale'
        self.assertIsNone(self.lookup(refs))

    def test_payload_prompt_and_final_plan_are_required(self):
        self.payload['prompt'] = 'trees'
        self.path.write_text(json.dumps(self.payload))
        self.assertIsNone(self.lookup())
        self.payload['prompt'] = 'a brick facade'
        self.path.write_text(json.dumps(self.payload))
        write_plan(self.root, self.refs, prompt='trees')
        self.assertIsNone(self.lookup())
        (self.root / FINAL_RUN / 'plan.json').unlink()
        self.assertIsNone(self.lookup())

    def test_signature_uuid_and_sampling_profile_must_match(self):
        self.path.rename(self.root / ('0' * 32 + '.json'))
        self.assertIsNone(self.lookup())
        for key, value in (('version', 'old'), ('model', '/other/model'), ('batch_size', 8),
                           ('sampling', {**SIGNATURE_PROFILE['sampling'], 'count': 32})):
            with self.subTest(key=key):
                payload = copy.deepcopy(self.payload)
                payload['signature'][key] = value
                write_payload(self.root, payload)
                self.assertIsNone(self.lookup())

    def test_unlisted_current_v2_source_is_excluded(self):
        other_refs = [{**ref, 'prompt_id': 'saved-1'} for ref in self.refs]
        write_payload(self.root, calibration_payload(other_refs, prompt='trees'))
        datasets = copy.deepcopy(self.datasets)
        for data in datasets.values():
            data['lookup'] = {'trees': 1}
        self.assertIsNone(self.lookup(other_refs, prompt='trees', datasets=datasets))

    def test_nonfinite_boolean_and_non_sigma_bounds_fail_closed(self):
        for field, value in (('mean', float('nan')), ('mean', float('inf')), ('mean', True),
                             ('lower', -3), ('upper', 3), ('upper', '-2'), ('field', 'score')):
            with self.subTest(field=field, value=value):
                payload = copy.deepcopy(self.payload)
                payload['color_range'][field] = value
                self.path.write_text(json.dumps(payload))
                self.assertIsNone(self.lookup())

    def test_crossing_flag_method_and_correlations_are_validated(self):
        changes = [dict(center_method='unknown'), dict(center_method=[]), dict(has_zero_crossing=False),
                   dict(has_zero_crossing=1), dict(status='ready'), dict(correlations={}),
                   dict(correlations={**self.payload['correlations'], 'pearson_r': 1.5}),
                   dict(correlations={**self.payload['correlations'], 'agreement_percent': 100})]
        for change in changes:
            with self.subTest(change=change):
                self.path.write_text(json.dumps({**self.payload, **change}))
                self.assertIsNone(self.lookup())

    def test_optional_and_undefined_correlations(self):
        payload = copy.deepcopy(self.payload)
        payload.pop('correlations')
        self.path.write_text(json.dumps(payload))
        self.assertNotIn('correlations', self.lookup())
        payload['correlations'] = dict(n=64, pearson_r=None, spearman_rho=None, bicor=None, bicor_c=9,
                                       agreement_percent=None, status='undefined')
        self.path.write_text(json.dumps(payload))
        self.assertIsNone(self.lookup()['correlations']['agreement_percent'])

    def test_missing_and_damaged_cache_are_unavailable_even_after_indexing(self):
        catalog = SavedCalibrationCatalog(self.root)
        for content in ('broken', '[]', 'null', '{"signature":null}'):
            with self.subTest(content=content):
                self.path.write_text(content)
                self.assertIsNone(catalog.lookup(self.refs, 'a brick facade', self.datasets))
                self.assertIsNone(self.lookup())
        self.path.unlink()
        self.assertIsNone(catalog.lookup(self.refs, 'a brick facade', self.datasets))

    def test_import_has_no_gpu_or_worker_side_effects(self):
        code = ('import sys, threading; before = set(threading.enumerate()); '
                'import semantic_map.saved_calibration; '
                'assert set(threading.enumerate()) == before; '
                'assert not any(name in sys.modules for name in '
                '("torch", "semantic_map.rerank_gpu_input", "semantic_map.rerank_calibration"))')
        subprocess.run([sys.executable, '-c', code], check=True)


class CpuSavedCalibrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        cities = {city: {**data, 'dataset_id': f'{city}_512_8_45_8B'} for city, data in DEFAULT_CITY_CATALOG.items()}
        self.env = patch.dict(os.environ, {'CPU_CACHE_ROOT': str(self.root / 'cache'), 'BACKEND_TOKEN': '',
                                           'CITY_CATALOG_JSON': json.dumps(cities)})
        self.env.start()
        self.addCleanup(self.env.stop)
        get_backend_settings.cache_clear()
        self.addCleanup(get_backend_settings.cache_clear)
        datasets = tuple(sorted(DATASETS))
        settings = replace(get_backend_settings(), workspace_root=self.root, default_dataset_id=datasets[0],
                           default_dataset_ids=datasets, active_city_ids=tuple(cities), tile_zooms=(13,))
        for city in cities:
            exp = self.root / 'experiments' / f'{city}_embedding_comparison_20260917'
            exp.mkdir(parents=True)
            (exp / 'status.json').write_text(json.dumps(dict(stage='complete')))
            (exp / 'prompts.json').write_text(json.dumps([dict(index=0, prompt='a brick facade')]))
            np.savez(exp / 'alignment.npz', refs=np.array([[10, -.12, 51.5, 202001], [11, -.121, 51.501, 202002]]))
            np.save(exp / 'score_new4096.npy', np.array([[.2], [.8]], dtype=np.float32))
            np.save(exp / 'historical_score.npy', np.array([[.9], [.1]], dtype=np.float32))
        # Obtain immutable refs with the same catalog code used by the service.
        self.app = create_app(settings, self.root / 'experiments')
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)
        self.refs = self.client.post('/api/scoring/jobs', json=dict(prompt='a brick facade')).json()['results']
        self.cache_root = self.root / 'semantic_backend/rerank_calibration'
        write_plan(self.cache_root, self.refs)
        self.path = write_payload(self.cache_root, calibration_payload(self.refs))
        self.app.state.catalog.calibrations = SavedCalibrationCatalog(self.cache_root)

    def test_single_and_batch_jobs_attach_only_full_cohort_metadata(self):
        result = self.client.post('/api/scoring/jobs', json=dict(prompt='A BRICK FACADE')).json()
        self.assertEqual(result['rerank_calibration']['color_range']['mean'], 0)
        batch = self.client.post('/api/scoring/jobs/batch', json=dict(queries=[
            dict(prompt='a brick facade', dataset_ids=list(reversed(sorted(DATASETS))))])).json()
        job = batch['queries'][0]['job']
        self.assertEqual(job['rerank_calibration'], result['rerank_calibration'])
        self.assertEqual(job['cache_status'], 'cache_hit')
        for ref in job['results']:
            manifest = self.client.get(ref['manifest_url']).json()
            self.assertNotIn('rerank_calibration', manifest)
            self.assertNotIn('color_range', manifest)

    def test_city_subsets_duplicates_and_comparison_do_not_get_joint_range(self):
        datasets = sorted(DATASETS)
        for selection in (datasets[:1], datasets[:3], datasets[:3] + datasets[:1], datasets + datasets[:1]):
            with self.subTest(selection=selection):
                job = self.client.post('/api/scoring/jobs', json=dict(prompt='a brick facade', dataset_ids=selection)).json()
                self.assertEqual(job['status'], 'ready')
                self.assertNotIn('rerank_calibration', job)
        comparison = self.client.post('/api/scoring/comparison', json=dict(prompt='a brick facade', dataset_id=datasets[0])).json()
        self.assertNotIn('rerank_calibration', comparison)
        self.assertEqual([ref['embedding'] for ref in comparison['results']], ['old', 'new', 'difference'])

    def test_missing_or_corrupt_cache_preserves_existing_cpu_job(self):
        self.path.write_text('broken')
        batch = self.client.post('/api/scoring/jobs/batch', json=dict(queries=[dict(prompt='a brick facade')])).json()
        item = batch['queries'][0]
        self.assertEqual(item['status'], 'accepted')
        self.assertEqual(item['job']['status'], 'ready')
        self.assertNotIn('rerank_calibration', item['job'])
        self.assertFalse(any(name in sys.modules for name in ('torch', 'semantic_map.rerank_gpu_input', 'semantic_map.rerank_calibration')))

    def test_changed_score_alignment_or_prompt_source_drops_calibration(self):
        for filename in ('score_new4096.npy', 'alignment.npz', 'prompts.json'):
            with self.subTest(filename=filename):
                path = self.root / 'experiments/london_embedding_comparison_20260917' / filename
                stat = path.stat()
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
                try:
                    job = self.client.post('/api/scoring/jobs', json=dict(prompt='a brick facade')).json()
                    self.assertEqual(job['status'], 'ready')
                    self.assertNotIn('rerank_calibration', job)
                finally:
                    os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns))


if __name__ == '__main__':
    unittest.main()
