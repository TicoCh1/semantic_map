import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

from semantic_map.rerank_calibration import (
    CalibrationColorRange, RerankCalibrationService, calibration_router, fit_threshold, sample_strata,
    sample_uniform_zscore, correlation_summary,
)


class CalibrationMathTests(unittest.TestCase):
    def test_uniform_score_sampling_is_not_uniform_in_rank(self):
        values = np.concatenate([np.linspace(-2, 0, 10000), np.linspace(1, 8, 65)])
        samples, buckets = sample_uniform_zscore(values)
        self.assertEqual(len(samples), 64)
        self.assertEqual(len({s['row_index'] for s in samples}), 64)
        self.assertEqual(samples[0]['zscore'], -2)
        self.assertEqual(samples[-1]['zscore'], 8)
        np.testing.assert_allclose([s['target_zscore'] for s in samples], np.linspace(-2, 8, 64))
        self.assertGreater(sum(s['zscore'] > 1 for s in samples), 35)
        self.assertEqual(sum(b['population'] for b in buckets), len(values))
        self.assertEqual(sum(b['sampled'] for b in buckets), 64)
        self.assertTrue(all(not b['stopped'] for b in buckets))

    def test_uniform_sampling_handles_ties_sparse_ranges_and_nonfinite_values(self):
        values = [np.nan, np.inf] + [0.] * 100 + [100.]
        samples, _ = sample_uniform_zscore(values)
        self.assertEqual(len(samples), 64)
        self.assertEqual(len({s['row_index'] for s in samples}), 64)
        self.assertNotIn(0, [s['row_index'] for s in samples])
        self.assertNotIn(1, [s['row_index'] for s in samples])
        self.assertIn(102, [s['row_index'] for s in samples])
        self.assertEqual(samples, sample_uniform_zscore(values)[0])
        small, _ = sample_uniform_zscore([np.nan, -1, 1])
        self.assertEqual(len(small), 2)
        self.assertEqual(sample_uniform_zscore([np.nan, np.inf]), ([], []))

    def test_uniform_is_default_with_separate_original_cache(self):
        import torch
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'RERANKER_ENABLED': 'true'}), patch.object(torch.cuda, 'is_available', return_value=True), patch('semantic_map.rerank_calibration.ThreadPoolExecutor', side_effect=lambda **_: Mock()):
            settings = SimpleNamespace(workspace_root=Path(root), pano_cache_root=Path(root) / 'panos')
            service = RerankCalibrationService(settings, None, lambda ref: dict(
                identity=dict(dataset_id=ref, prompt_id='query', result_revision='revision'), prompt='trees'))
            original = service.submit(['london'], sampling='half_sigma')
            original_signature = service.pool.submit.call_args.args[3]
            uniform = service.submit(['london'])
            uniform_signature = service.pool.submit.call_args.args[3]
            self.assertNotEqual(original['job_id'], uniform['job_id'])
            self.assertNotIn('sampling', original_signature)
            self.assertEqual(uniform_signature['sampling']['count'], 64)
            self.assertEqual({k:v for k,v in uniform_signature.items() if k != 'sampling'}, original_signature)
            service.close()

    def test_range_contract_rejects_wrong_field_nonfinite_and_unordered_bounds(self):
        from pydantic import ValidationError
        for fields in (dict(mean=3, lower=1, upper=5, field='score'),
                       dict(mean=8, lower=1, upper=5),
                       dict(mean=3, lower=5, upper=1),
                       dict(mean=3, lower=1, upper=float('inf'))):
            with self.assertRaises(ValidationError):
                CalibrationColorRange(**fields)

    def test_http_job_contract_preserves_real_range_and_null_fallback(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from semantic_map.auth import require_backend_token
        app = FastAPI()
        app.dependency_overrides[require_backend_token] = lambda: None
        service = Mock()
        service.submit.return_value = dict(status='ready', job_id='job',
            color_range=dict(mean=3.21, lower=1.21, upper=5.21, field='zscore'), calibration={})
        service.get.return_value = dict(status='ready', job_id='empty', color_range=None, calibration={})
        app.include_router(calibration_router(service))
        with TestClient(app) as client:
            submitted = client.post('/api/scoring/calibration/jobs', json={'results':[{}]}).json()
            self.assertEqual(submitted['color_range'], service.submit.return_value['color_range'])
            service.submit.assert_called_once_with([{}], force=False, sampling='uniform_zscore_64')
            self.assertIsNone(client.get('/api/scoring/calibration/jobs/empty').json()['color_range'])

    def test_inference_refuses_anything_other_than_eight_reprojected_views(self):
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ,
                {'RERANKER_ENABLED':'false','RERANKER_INPUT_PIPELINE':'legacy'}):
            settings = SimpleNamespace(workspace_root=Path(root), pano_cache_root=Path(root) / 'panos')
            service = RerankCalibrationService(settings, None, None)
            service.projection = Mock()
            service.projection.views.return_value = [Path('raw-pano.jpg')]
            service._load_model = Mock()
            source = dict(zscores=np.array([.1,.2,.3]), scores=np.array([.1,.2,.3]),
                identity=dict(dataset_id='london'),
                records=[SimpleNamespace(pano_id=str(i),lon=0,lat=0,date=None) for i in range(3)])
            service.jobs['00000000'] = dict(status='queued')
            service._run('00000000', [source], {})
            self.assertEqual(service.jobs['00000000']['status'], 'failed')
            self.assertIn('eight reprojected', service.jobs['00000000']['error'])
            service._load_model.assert_not_called()
            service.close()

    def test_half_sigma_sampling_stops_each_tail_independently(self):
        values = [-2.1] * 4 + [-0.9] * 3 + [-0.4] * 3 + [0.1] * 3 + [0.6] * 2 + [1.1] * 6
        samples, buckets = sample_strata(values, seed=42)
        self.assertEqual({s['bucket'] for s in samples}, {-2, -1, 0, 1})
        self.assertEqual(sum(s['bucket'] == 1 for s in samples), 2)
        self.assertNotIn(2, [s['bucket'] for s in samples])
        self.assertTrue(next(b for b in buckets if b['bucket'] == -3)['stopped'])
        self.assertEqual(samples, sample_strata(values, seed=42)[0])
        self.assertEqual(len({s['row_index'] for s in samples}), len(samples))

    def test_population_weighted_pooling_and_zero_interpolation(self):
        samples = [dict(bucket=i, zscore=x, logit=y) for i, x, y in [(0, 0.25, -2), (1, 0.75, 2), (2, 1.25, 0), (3, 1.75, 4)]]
        buckets = [dict(bucket=i, population=w) for i, w in enumerate([1, 1, 3, 1])]
        fit = fit_threshold(samples, buckets)
        self.assertEqual(fit['status'], 'calibrated')
        self.assertEqual([p['fitted_logit'] for p in fit['curve']], [-2, .5, .5, 4])
        self.assertAlmostEqual(fit['color_range']['mean'], .65)
        self.assertAlmostEqual(fit['color_range']['lower'], -1.35)
        self.assertAlmostEqual(fit['color_range']['upper'], 2.65)

    def test_no_crossing_uses_retrieval_endpoints(self):
        # The raw logit extremum need not be the retrieval-score endpoint.
        for values, mean, method in (([-1, -4], .5, 'all_negative_max_score'),
                                    ([4, 1], 0, 'all_positive_min_score')):
            samples = [dict(bucket=i, zscore=i * .5, logit=y) for i, y in enumerate(values)]
            fit = fit_threshold(samples, [dict(bucket=i, population=3) for i in range(2)])
            self.assertEqual(fit['status'], 'calibrated')
            self.assertEqual(fit['center_method'], method)
            self.assertFalse(fit['has_zero_crossing'])
            self.assertEqual(fit['color_range'], dict(mean=mean, lower=mean-2, upper=mean+2, field='zscore'))
        self.assertIsNone(fit_threshold([], [])['color_range'])

    def test_mixed_raw_logits_with_one_sided_fit_still_have_bounds(self):
        samples = [dict(bucket=i, zscore=i*.5, logit=y) for i, y in enumerate([1., -2.])]
        fit = fit_threshold(samples, [dict(bucket=i, population=3) for i in range(2)])
        self.assertEqual(fit['center_method'], 'negative_fit_max_score')
        self.assertEqual(fit['color_range']['mean'], .5)

    def test_correlations_agree_with_scipy_including_ties(self):
        from scipy.stats import pearsonr, spearmanr
        x = np.array([-3, -2, -2, -.5, 0, 1, 1, 2, 3.])
        y = np.array([2, -5, 1, 1, .7, 1.1, .2, 1.6, 2.4])
        result = correlation_summary([dict(zscore=a, logit=b) for a, b in zip(x, y)])
        self.assertAlmostEqual(result['pearson_r'], pearsonr(x, y).statistic, places=12)
        self.assertAlmostEqual(result['spearman_rho'], spearmanr(x, y).statistic, places=12)
        centered = []
        for values in (x, y):
            delta = values - np.median(values)
            u = delta/(9*np.median(np.abs(delta)))
            centered.append(delta * (1-u*u)**2 * (np.abs(u)<1))
        a, b = centered
        bicor = np.dot(a,b)/np.sqrt(np.dot(a,a)*np.dot(b,b))
        self.assertAlmostEqual(result['bicor'], bicor, places=12)
        self.assertAlmostEqual(result['agreement_percent'],
            100*max(0, (result['pearson_r']+result['spearman_rho']+bicor)/3), places=12)

    def test_correlations_keep_signed_metrics_clip_agreement_and_reject_undefined(self):
        for sign, expected in ((1, 100), (-1, 0)):
            result = correlation_summary([dict(zscore=i, logit=sign*i) for i in range(9)])
            self.assertAlmostEqual(result['agreement_percent'], expected)
            for key in ('pearson_r', 'spearman_rho', 'bicor'):
                self.assertAlmostEqual(result[key], sign)
        for samples in ([], [dict(zscore=1, logit=2)],
                        [dict(zscore=i, logit=2) for i in range(9)]):
            result = correlation_summary(samples)
            self.assertIsNone(result['agreement_percent'])
            self.assertEqual(result['status'], 'undefined')

    def test_zero_plateau_has_explicit_midpoint(self):
        samples = [dict(bucket=i, zscore=i * .5, logit=y) for i, y in enumerate([-1, 0, 0, 2])]
        fit = fit_threshold(samples, [dict(bucket=i, population=3) for i in range(4)])
        self.assertEqual(fit['color_range']['mean'], .75)

    def test_nonfinite_zscores_are_not_sampled(self):
        samples, _ = sample_strata([np.nan, np.inf, -.1, -.2, -.3, .1, .2, .3])
        self.assertEqual({s['row_index'] for s in samples}, set(range(2, 8)))

    def test_no_gpu_does_not_start_worker_resolve_or_load_weights(self):
        import torch
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'RERANKER_ENABLED': 'true'}), patch.object(torch.cuda, 'is_available', return_value=False):
            settings = SimpleNamespace(workspace_root=Path(root), pano_cache_root=Path(root) / 'panos')
            def unexpected(_):
                raise AssertionError('No-GPU mode must not resolve or score candidates')
            service = RerankCalibrationService(settings, None, unexpected)
            self.assertFalse(service.enabled)
            self.assertIsNone(service.pool)
            self.assertIsNone(service.model)
            self.assertIsNone(service.image_reader)
            self.assertIsNone(service.cuda_pipeline)
            self.assertEqual(service.submit([{}])['status'], 'disabled')
            self.assertFalse((Path(root) / 'semantic_backend').exists())
            service.close()

    def test_city_order_does_not_change_sampling_cohort_or_cache_key(self):
        import torch
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'RERANKER_ENABLED': 'true'}), patch.object(torch.cuda, 'is_available', return_value=True), patch('semantic_map.rerank_calibration.ThreadPoolExecutor', side_effect=lambda **_: Mock()):
            settings = SimpleNamespace(workspace_root=Path(root), pano_cache_root=Path(root) / 'panos')
            def resolve(ref):
                return dict(identity=dict(dataset_id=ref, prompt_id='query', result_revision='revision'), prompt='trees')
            first = RerankCalibrationService(settings, None, resolve)
            second = RerankCalibrationService(settings, None, resolve)
            self.assertEqual(first.submit(['rome', 'london'])['job_id'], second.submit(['london', 'rome'])['job_id'])
            self.assertEqual(first.pool.submit.call_args.args[2], second.pool.submit.call_args.args[2])
            first.close()
            second.close()


if __name__ == '__main__':
    unittest.main()
