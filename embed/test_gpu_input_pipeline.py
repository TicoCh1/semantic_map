"""CPU-only lifecycle and durable checkpoint tests for GPU pipeline orchestration."""
import json
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
from test_panorama_pipeline import PipelineTests
from pipeline_runtime import FailurePolicy, close_items
from gpu_input_pipeline import process_city


class FakeEngine:
    def __init__(self, stop=None):
        self.live = self.peak = 0
        self.order = []
        self.stop = stop
    def prepare(self, items):
        self.live += 1
        self.peak = max(self.peak, self.live)
        return items
    def forward(self, items, count):
        self.live -= 1
        self.order.extend(x.record['seq'] for x in items)
        if self.stop is not None: self.stop.set()
        return np.stack([np.full((8,3), x.record['seq'], dtype=np.float16) for x in items])
    def synchronize(self): pass


class GpuPipelineTests(PipelineTests):
    def args(self, engine):
        return SimpleNamespace(pano_batch=2, embed_batch=16, checkpoint_panos=3,
            decode_workers=2, prefetch_panos=3, failure_policy=FailurePolicy(), cuda_engine=engine)

    def test_optimized_shard_boundaries_and_resume(self):
        state=self.make_state(7);self.inventory(state)
        engine=FakeEngine();args=self.args(engine)
        process_city(state,'rome',0,self.panos,None,None,args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':7})
        self.assertEqual(engine.order, list(range(1,8)))
        self.assertLessEqual(engine.peak,2)
        markers=[json.loads(p.read_text()) for p in sorted((state.root/'checkpoints').rglob('*.json'))]
        self.assertEqual([len(m['record_ids']) for m in markers],[3,3,1])
        next_shards=state.recover()
        process_city(state,'rome',next_shards['rome'],self.panos,None,None,args,self.stats,self.stop)
        self.assertEqual(engine.order,list(range(1,8)))

    def test_stop_keeps_completed_and_resumes_remaining(self):
        state=self.make_state(9);self.inventory(state)
        engine=FakeEngine(self.stop);args=self.args(engine)
        process_city(state,'rome',0,self.panos,None,None,args,self.stats,self.stop)
        done=state.counts(True)['rome']
        self.assertEqual(done,4)
        self.stop.clear();engine.stop=None
        process_city(state,'rome',state.recover()['rome'],self.panos,None,None,args,self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':9})
        self.assertEqual(engine.order,list(range(1,10)))

    def test_failed_decode_does_not_shift_shard_identity(self):
        state=self.make_state(7,invalid=2);self.inventory(state)
        engine=FakeEngine()
        process_city(state,'rome',0,self.panos,None,None,self.args(engine),self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':6})
        self.assertEqual(engine.order,[1,2,4,5,6,7])
        markers=[json.loads(p.read_text()) for p in sorted((state.root/'checkpoints').rglob('*.json'))]
        self.assertEqual([len(m['record_ids']) for m in markers],[3,3])

    def test_prepare_failure_uses_existing_resilient_fallback(self):
        state=self.make_state(5);self.inventory(state)
        engine=FakeEngine();original=engine.prepare
        def fail_once(items):
            if items[0].record['seq']==1: raise RuntimeError('simulated GPU preparation OOM')
            return original(items)
        engine.prepare=fail_once
        projector=SimpleNamespace(gpu_timer=None,stats=None)
        def fallback(items,*unused):
            values=np.stack([np.full((8,3),x.record['seq'],dtype=np.float16) for x in items])
            close_items(items)
            yield items,values
        with patch('gpu_input_pipeline.resilient_compute',fallback):
            process_city(state,'rome',0,self.panos,projector,None,self.args(engine),self.stats,self.stop)
        self.assertEqual(state.counts(True),{'rome':5})
        state.recover()
