import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from semantic_map.gpu_residency import ModelGpuLock, coordinate_reranker_residency
from semantic_map.rerank_calibration import RerankCalibrationService


class ResidencyTests(unittest.TestCase):
    def test_embedding_waits_for_reranker_then_offloads_before_entering(self):
        raw = threading.RLock()
        entered, leave, called = threading.Event(), threading.Event(), threading.Event()
        service = SimpleNamespace(enabled=True, keep_resident=True,
                                  offload_for_embedding=lambda: called.set(), before_inference=None)
        engine = SimpleNamespace(_gpu_lock=raw)
        coordinate_reranker_residency(engine, service)
        def rerank():
            with service.gpu_lock:
                entered.set()
                leave.wait(2)
        thread = threading.Thread(target=rerank)
        thread.start()
        self.assertTrue(entered.wait(2))
        self.assertFalse(raw.acquire(blocking=False))
        self.assertFalse(called.is_set())
        leave.set()
        with engine._gpu_lock:
            self.assertTrue(called.is_set())
            # Embedding's nested locked operations remain reentrant.
            with engine._gpu_lock:
                pass
        thread.join(2)
        self.assertFalse(thread.is_alive())

    def test_handoff_failure_releases_shared_lock(self):
        raw = threading.RLock()
        lock = ModelGpuLock(raw, Mock(side_effect=RuntimeError('handoff failed')))
        with self.assertRaises(RuntimeError):
            with lock:
                self.fail('embedding must not run')
        result = []
        def check():
            acquired = raw.acquire(timeout=1)
            result.append(acquired)
            if acquired:
                raw.release()
        thread = threading.Thread(target=check)
        thread.start(); thread.join(2)
        self.assertEqual(result, [True])

    def test_disabled_or_nonresident_mode_keeps_original_lock(self):
        for enabled, resident in ((False, True), (True, False)):
            raw = threading.RLock()
            engine = SimpleNamespace(_gpu_lock=raw)
            service = SimpleNamespace(enabled=enabled, keep_resident=resident)
            coordinate_reranker_residency(engine, service)
            self.assertIs(engine._gpu_lock, raw)

    def test_reranker_only_tasks_do_not_clear_the_cuda_allocator(self):
        release = Mock()
        service = SimpleNamespace(enabled=True, keep_resident=True,
            before_inference=release, offload_for_embedding=Mock())
        engine = SimpleNamespace(_gpu_lock=threading.RLock(), _embedder=None, _embedding_tensors={})
        coordinate_reranker_residency(engine, service)
        service.before_inference()
        release.assert_not_called()
        engine._embedder = SimpleNamespace(model=SimpleNamespace(device=SimpleNamespace(type='cuda')))
        service.before_inference()
        release.assert_called_once()

    def test_success_stays_resident_failure_and_embedding_release_buffers_first(self):
        service = object.__new__(RerankCalibrationService)
        service.keep_resident = True
        service.resident_cuda = True
        service.embedding_handoff_count = 0
        calls = []
        service.cuda_pipeline = SimpleNamespace(release_cuda=lambda: calls.append('release'))
        service.model = SimpleNamespace(model=SimpleNamespace(to=lambda device: calls.append('model-' + device)),
            score_linear=SimpleNamespace(to=lambda device: calls.append('head-' + device)))
        with patch('torch.cuda.empty_cache') as clear:
            service._finish_inference(True)
            self.assertEqual(calls, [])
            self.assertTrue(service.resident_cuda)
            service._finish_inference(False)
            self.assertEqual(calls, ['release', 'model-cpu', 'head-cpu'])
            self.assertFalse(service.resident_cuda)
            clear.assert_called_once()
            service.offload_for_embedding()
            self.assertEqual(service.embedding_handoff_count, 1)

    def test_force_reruns_completed_cache_but_deduplicates_running_job(self):
        import torch
        with tempfile.TemporaryDirectory() as root, patch.dict(os.environ, {'RERANKER_ENABLED': 'true'}), \
             patch.object(torch.cuda, 'is_available', return_value=True):
            settings = SimpleNamespace(workspace_root=Path(root), pano_cache_root=Path(root) / 'panos')
            source = dict(identity=dict(dataset_id='london', prompt_id='trees', result_revision='rev'), prompt='trees')
            service = RerankCalibrationService(settings, None, lambda _: source)
            service.pool.shutdown()
            service.pool = Mock()
            initial = service.submit([{}])
            key = initial['job_id']
            service.jobs[key] = dict(job_id=key, status='ready')
            signature = service.pool.submit.call_args.args[2]
            service.root.mkdir(parents=True)
            payload = dict(signature=signature, color_range=None)
            cache = service.root / (key + '.json')
            cache.write_text(json.dumps(payload))
            service.submit([{}], force=True)
            backups = list((service.root / 'rerun-backups').glob('*.json'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), cache.read_bytes())
            self.assertEqual(service.pool.submit.call_count, 2)
            service.submit([{}], force=True)
            self.assertEqual(service.pool.submit.call_count, 2)
            service.close()


if __name__ == '__main__':
    unittest.main()
