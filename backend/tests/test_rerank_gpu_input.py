import os
import gc
import tempfile
import threading
import unittest
import weakref
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock,patch

import torch
from PIL import Image

from semantic_map.rerank_calibration import sampling_seed
from semantic_map.rerank_gpu_input import (ImageSource,RerankerImageReader,
    RerankerPositionCache,RerankerCudaPipeline)


class InputReuseTests(unittest.TestCase):
    def test_execution_parameters_do_not_change_sampled_candidates(self):
        semantic=dict(version='v1',results=[dict(dataset_id='london',prompt_id='trees',result_revision='rev')],
            model='reranker',projection='eight',instruction='visible',max_pixels=262144)
        seed=sampling_seed(semantic)
        self.assertEqual(seed,sampling_seed(dict(semantic,input_pipeline='cuda',batch_size=4)))
        self.assertEqual(seed,sampling_seed(dict(semantic,input_pipeline='legacy',batch_size=16)))
        self.assertNotEqual(seed,sampling_seed(dict(semantic,results=[dict(dataset_id='rome')])) )

    def test_view_sources_require_eight_images(self):
        for count in (0,1,7,9):
            with self.assertRaisesRegex(ValueError,'eight'):
                ImageSource('views',tuple(Path(str(i)) for i in range(count)))

    def test_decoded_cache_reuses_invalidates_and_evicts_with_a_byte_bound(self):
        with tempfile.TemporaryDirectory() as root,patch.object(torch.cuda,'is_available',return_value=False):
            root=Path(root)
            paths=[root/'first.png',root/'second.png']
            for i,path in enumerate(paths):
                Image.new('RGB',(512,512),(i+1,2,3)).save(path)
            reader=RerankerImageReader(None,root,workers=2,cache_mib=1)
            try:
                first=ImageSource('panorama',(paths[0],)); second=ImageSource('panorama',(paths[1],))
                a=reader.read(first)
                self.assertIs(reader.read(first),a)
                self.assertEqual(reader.hits,1)
                reader.read(second)
                self.assertLessEqual(reader.bytes,1024**2)
                self.assertEqual(len(reader.entries),1)
                self.assertIsNot(reader.read(first),a)
                Image.new('RGB',(512,512),(9,8,7)).save(paths[0])
                stamp=paths[0].stat().st_mtime_ns+1000000000
                os.utime(paths[0],ns=(stamp,stamp))
                self.assertEqual(reader.read(first)[0,0].tolist(),[9,8,7])
                self.assertLessEqual(reader.bytes,1024**2)
            finally:
                reader.close()
            self.assertEqual(reader.bytes,0)

    def test_decode_failure_does_not_leave_other_reader_futures_running(self):
        with tempfile.TemporaryDirectory() as root,patch.object(torch.cuda,'is_available',return_value=False):
            root=Path(root); path=root/'good.png'
            Image.new('RGB',(10,10)).save(path)
            reader=RerankerImageReader(None,root,workers=2)
            try:
                with self.assertRaises(FileNotFoundError):
                    reader.read_batch([ImageSource('panorama',(root/'missing.png',)),ImageSource('panorama',(path,))])
                self.assertEqual(reader.misses,1)
            finally:
                reader.close()

    def test_position_cache_reuses_only_matching_grid_and_full_language_inputs(self):
        visual=SimpleNamespace(fast_pos_embed_interpolate=Mock(side_effect=lambda *a:object()),
            rot_pos_emb=Mock(side_effect=lambda *a:object()))
        rope=Mock(side_effect=lambda *a:object())
        core=SimpleNamespace(visual=visual,get_rope_index=rope)
        original=visual.fast_pos_embed_interpolate
        cache=RerankerPositionCache(core,entries=1)
        try:
            cache.current=('grid-a','query-a')
            image=visual.fast_pos_embed_interpolate(None); language=core.get_rope_index(None)
            cache.current=('grid-a','query-b')
            self.assertIs(visual.fast_pos_embed_interpolate(None),image)
            self.assertIsNot(core.get_rope_index(None),language)
            cache.current=('grid-b','query-b')
            self.assertIsNot(visual.fast_pos_embed_interpolate(None),image)
            self.assertLessEqual(len(cache.entries),3)
            cache.clear()
            self.assertFalse(cache.entries)
        finally:
            cache.close()
        self.assertIs(visual.fast_pos_embed_interpolate,original)


class LookaheadTests(unittest.TestCase):
    def engine(self):
        engine=RerankerCudaPipeline.__new__(RerankerCudaPipeline)
        engine.stream=SimpleNamespace(synchronize=Mock())
        engine.positions=SimpleNamespace(clear=Mock(),hits=0,misses=0)
        engine.reader=SimpleNamespace(hits=0,misses=0,bytes=0)
        engine.tokens={}
        engine.prepare=lambda pairs,sources: list(pairs)
        engine.forward=lambda prepared:(list(prepared),dict(size=len(prepared)))
        return engine

    def test_future_prepare_overlaps_current_forward_and_tail_stays_ordered(self):
        engine=self.engine(); event=threading.Event(); observed=[]
        def prepare(pairs,sources):
            if pairs[0]==4:
                event.set()
            return list(pairs)
        def forward(prepared):
            if prepared[0]==0:
                self.assertTrue(event.wait(2),'Next input preparation did not overlap forward')
            return prepared,dict(size=len(prepared))
        engine.prepare=prepare; engine.forward=forward
        with patch.object(torch.cuda,'reset_peak_memory_stats'):
            values,batches=engine.run(list(range(9)),list(range(9)),4,on_batch=observed.append)
        self.assertEqual(values,list(range(9)))
        self.assertEqual([b['size'] for b in batches],[4,4,1])
        self.assertEqual(observed,[4,8,9])
        engine.stream.synchronize.assert_called()

    def test_forward_oom_drains_lookahead_and_retries_without_lost_rows(self):
        engine=self.engine()
        def forward(prepared):
            if len(prepared)>2:
                raise torch.cuda.OutOfMemoryError('injected forward pressure')
            return prepared,dict(size=len(prepared))
        engine.forward=forward
        with patch.object(torch.cuda,'reset_peak_memory_stats'),patch.object(torch.cuda,'empty_cache'):
            values,batches=engine.run(list(range(9)),list(range(9)),4)
        self.assertEqual(values,list(range(9)))
        self.assertEqual(batches[0]['oom_batch_sizes'],[4])
        self.assertTrue(all(b['size']<=2 for b in batches))
        engine.positions.clear.assert_called()

    def test_speculative_prepare_oom_preserves_already_completed_batch(self):
        engine=self.engine()
        def prepare(pairs,sources):
            if pairs[0]==4 and len(pairs)>2:
                raise torch.cuda.OutOfMemoryError('injected input pressure')
            return list(pairs)
        engine.prepare=prepare
        with patch.object(torch.cuda,'reset_peak_memory_stats'),patch.object(torch.cuda,'empty_cache'):
            values,batches=engine.run(list(range(10)),list(range(10)),4)
        self.assertEqual(values,list(range(10)))
        self.assertEqual(batches[0]['size'],4)
        self.assertEqual(batches[1]['oom_batch_sizes'],[4])

    def test_unfit_single_candidate_fails_after_releasing_speculative_work(self):
        engine=self.engine()
        engine.forward=Mock(side_effect=torch.cuda.OutOfMemoryError('injected one-candidate failure'))
        with patch.object(torch.cuda,'reset_peak_memory_stats'),patch.object(torch.cuda,'empty_cache'):
            with self.assertRaisesRegex(torch.cuda.OutOfMemoryError,'one candidate'):
                engine.run([0],[0],1)
        engine.stream.synchronize.assert_called()

    def test_prepare_oom_tracebacks_release_payloads_before_retry(self):
        engine=self.engine(); references=[]
        class Payload:
            pass
        def prepare(pairs,sources):
            if len(pairs)>2:
                payload=Payload()
                references.append(weakref.ref(payload))
                raise torch.cuda.OutOfMemoryError('failure holds an input allocation in its traceback')
            return list(pairs)
        def forward(prepared):
            self.assertTrue(all(ref() is None for ref in references),
                'Failed Future tracebacks still retain allocations during retry')
            return prepared,dict(size=len(prepared))
        engine.prepare=prepare; engine.forward=forward
        enabled=gc.isenabled(); gc.disable()
        try:
            with patch.object(torch.cuda,'reset_peak_memory_stats'),patch.object(torch.cuda,'empty_cache'):
                values,_=engine.run(list(range(4)),list(range(4)),4)
            self.assertEqual(values,list(range(4)))
        finally:
            if enabled: gc.enable()
            gc.collect()


if __name__=='__main__':
    unittest.main()
