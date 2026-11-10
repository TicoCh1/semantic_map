"""CPU-only ownership, overlap, flat batching and native-package regressions."""
import io
import json
from pathlib import Path
import tempfile
import threading
from types import SimpleNamespace
import unittest

import numpy as np

from dataset_async_pipeline import PreparedSource, SourceResults, CudaImageEngine, flat_batches, lookahead_batches
from dataset_image_pipeline import ImageRecord
from dataset_package_store import (PackageWriter, atomic_json, committed_packages,
                                   package_id, package_identity, scan_package)
from gpu_input_pipeline import PositionCache


def source(index, count=1, container='/original/train.zip', nested=None, labels=True):
    record = ImageRecord(index, 'dataset', 'perspective', container, f'images/{index}.jpg', nested)
    result = PreparedSource(record)
    for view in range(count):
        name = f'dataset/{index:09d}/view_{view:02d}/annotations.json'
        result.rows.append({**record.json(), 'original_size': [800, 600], 'source_views': count,
            'transform': {'method': 'center_crop_resize', 'crop_box': [100, 0, 700, 600],
                          'output_size': [512, 512], 'view_index': view},
            'view_id': f'dataset/{index:09d}/view_{view:02d}',
            'validation': {'members': [name] if labels else []},
            '_validation_files': [(name, b'{"status":"test"}')] if labels else []})
    return result


class AsyncTests(unittest.TestCase):
    def test_legacy_rotated_yaw_order_cannot_misalign_labels(self):
        projector = SimpleNamespace(yaws=(45, 90, 135, 180, 225, 270, 315, 0))
        with self.assertRaisesRegex(ValueError, 'yaw order'):
            CudaImageEngine(None, projector)

    def test_mixed_1_2_8_sources_use_exact_rgb_batch_limit(self):
        sources = [source(0, 1), source(1, 2), source(2, 8), source(3, 1)]
        batches = list(flat_batches(sources, 5, self.fail))
        self.assertEqual([len(batch) for batch in batches], [5, 5, 2])
        results = SourceResults(self.fail)
        completed = []
        for batch in batches:
            vectors = np.array([[s.record.source_index, view, 0, 1] for s, view in batch], dtype=np.float16)
            completed.extend(results.add(batch, vectors, None))
        self.assertEqual([len(rows) for _, rows in completed], [1, 2, 8, 1])
        np.testing.assert_array_equal(completed[2][0][:, 1], np.arange(8))
        self.assertFalse(results.pending)

    def test_failed_middle_slice_discards_whole_source_only(self):
        events = []
        results = SourceResults(lambda record, stage, error: events.append(record.source_index))
        batches = list(flat_batches([source(0, 8), source(1)], 3, self.fail))
        completed = []
        for index, batch in enumerate(batches):
            completed.extend(results.add(batch, np.ones((len(batch), 4)), 'failure' if index == 1 else None))
        self.assertEqual(events, [0])
        self.assertEqual([rows[0]['source_index'] for _, rows in completed], [1])
        self.assertFalse(results.pending)

    def test_next_prepare_overlaps_forward_and_forward_stays_on_caller(self):
        ready = threading.Event(); caller = threading.get_ident(); calls = []
        class Engine:
            def prepare(self, batch):
                calls.append(('prepare', threading.get_ident()))
                if batch == [2]: ready.set()
                return batch
            def forward(self, batch, count):
                calls.append(('forward', threading.get_ident()))
                if batch == [1] and not ready.wait(3):
                    raise AssertionError('Next preparation did not overlap current forward')
                return np.ones((count, 4))
            def synchronize(self): pass
        values = list(lookahead_batches([[1], [2]], Engine()))
        self.assertTrue(all(error is None for _, _, error in values))
        self.assertTrue(all(thread != caller for name, thread in calls if name == 'prepare'))
        self.assertTrue(all(thread == caller for name, thread in calls if name == 'forward'))

    def test_prepare_failure_is_explicit_and_next_batch_survives(self):
        class Engine:
            def prepare(self, batch):
                if batch == [1]: raise ValueError('synthetic CUDA preparation failure')
                return batch
            def forward(self, batch, count): return np.ones((count, 4))
            def synchronize(self): pass
        outputs = list(lookahead_batches([[1], [2]], Engine()))
        self.assertIn('CUDA preparation failure', outputs[0][2])
        self.assertIsNone(outputs[0][1])
        self.assertIsNone(outputs[1][2])

    def test_slow_next_cpu_batch_does_not_delay_current_forward(self):
        forwarded = threading.Event()
        def batches():
            yield [1]
            if not forwarded.wait(3):
                raise AssertionError('Forward blocked waiting for next CPU batch')
            yield [2]
        class Engine:
            def prepare(self, batch): return batch
            def forward(self, batch, count):
                forwarded.set(); return np.ones((count, 4))
            def synchronize(self): pass
        outputs = list(lookahead_batches(batches(), Engine()))
        self.assertEqual(len(outputs), 2)
        self.assertTrue(all(error is None for _, _, error in outputs))


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()
    def rows(self):
        return [json.loads(line) for p in self.root.glob('*/image_map.jsonl') for line in p.read_text().splitlines()]

    def test_quota_checks_follow_bytes_not_checkpoint_resets(self):
        class Budget:
            def __init__(self): self.calls = []
            def require(self, size): self.calls.append(size)
        budget = Budget()
        writer = PackageWriter(self.root, 'inventory', storage=budget, checkpoint_sources=1)
        writer.write((np.ones((1, 4)), source(i).rows) for i in range(5))
        self.assertEqual(budget.calls, [2 << 30])
        self.assertGreater(writer.unchecked_bytes, 0)
        writer.unchecked_bytes = 1 << 30
        writer.write([(np.ones((1, 4)), source(5).rows)])
        self.assertEqual(budget.calls, [2 << 30, 2 << 30])
        writer.close()
        self.assertEqual(committed_packages(self.root), set(range(6)))

    def test_15000_datapoints_remain_one_package_with_many_checkpoints(self):
        writer = PackageWriter(self.root, 'inventory', checkpoint_sources=256)
        writer.write((np.ones((1, 4)), source(i, labels=False).rows) for i in range(15000))
        writer.close()
        self.assertEqual(len(list(self.root.glob('*/embeddings.npy'))), 1)
        array = np.load(next(self.root.glob('*/embeddings.npy')), mmap_mode='r')
        self.assertEqual(array.shape, (15000, 4))
        self.assertEqual(committed_packages(self.root, 'inventory'), set(range(15000)))

    def test_original_archive_and_nested_boundaries_are_preserved(self):
        items = [source(0, 1), source(1, 2), source(2, 8, '/original/other.zip'),
                 source(3, 1, '/original/outer.zip', 'train.zip'),
                 source(4, 1, '/original/outer.zip', 'val.zip')]
        writer = PackageWriter(self.root, 'inventory', checkpoint_sources=1)
        writer.write((np.ones((len(s.rows), 4)), s.rows) for s in items); writer.close()
        self.assertEqual(len(list(self.root.glob('*/checkpoint.json'))), 4)
        first = self.root/package_id(package_identity(items[0].rows[0]))
        self.assertEqual(np.load(first/'embeddings.npy').shape, (3, 4))
        self.assertEqual(committed_packages(self.root), set(range(5)))

    def test_crash_after_new_header_before_checkpoint_recovers_old_offsets(self):
        calls = []
        def publish(path, value):
            calls.append(value)
            if len(calls) == 2: raise OSError('checkpoint failure')
            atomic_json(path, value)
        writer = PackageWriter(self.root, 'inventory', checkpoint_sources=1, publish=publish)
        writer.write([(np.ones((1, 4)), source(0).rows)])
        with self.assertRaisesRegex(OSError, 'checkpoint failure'):
            writer.write([(np.ones((2, 4)), source(1, 2).rows)])
        writer.close(commit=False)
        # Corrupt uncommitted tails are irrelevant, even if TAR parsing would fail.
        with next(self.root.glob('*/validation.tar')).open('ab') as handle: handle.write(b'bad tail')
        self.assertEqual(committed_packages(self.root), {0})
        writer = PackageWriter(self.root, 'inventory', checkpoint_sources=1)
        writer.write([(np.full((2, 4), 7), source(1, 2).rows)]); writer.close()
        self.assertEqual(committed_packages(self.root), {0, 1})
        array = np.load(next(self.root.glob('*/embeddings.npy')))
        np.testing.assert_array_equal(array[1:], np.full((2, 4), 7))
        self.assertEqual([r['source_index'] for r in self.rows()], [0, 1, 1])

    def test_retry_appends_to_existing_native_package_without_splitting(self):
        for index in (0, 2, 1):
            writer = PackageWriter(self.root, 'inventory', checkpoint_sources=1)
            writer.write([(np.full((1, 4), index), source(index).rows)]); writer.close()
        self.assertEqual(len(list(self.root.glob('*/embeddings.npy'))), 1)
        self.assertEqual(committed_packages(self.root), {0, 1, 2})
        self.assertEqual([r['embedding_row'] for r in self.rows()], [0, 1, 2])

    def test_incomplete_source_and_wrong_dimension_cannot_commit(self):
        writer = PackageWriter(self.root, 'inventory', checkpoint_sources=1)
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            writer.write([(np.ones((1, 4)), source(0, 2).rows[:1])])
        writer.write([(np.ones((1, 4)), source(0).rows)])
        with self.assertRaisesRegex(RuntimeError, 'dimension'):
            writer.write([(np.ones((1, 5)), source(1, container='/other.zip').rows)])
        writer.close(commit=False)
        self.assertEqual(committed_packages(self.root), {0})


class PositionCacheTests(unittest.TestCase):
    def test_three_position_results_reuse_only_complete_matching_metadata(self):
        calls = []
        def original(name):
            def compute(*args, **kwargs):
                calls.append(name); return object()
            return compute
        visual = SimpleNamespace(fast_pos_embed_interpolate=original('patch'), rot_pos_emb=original('vision_rope'))
        core = SimpleNamespace(visual=visual, get_rope_index=original('multimodal_rope'))
        cache = PositionCache(SimpleNamespace(model=SimpleNamespace(model=core)))
        class Tensor:
            def __init__(self, data):
                self.data = np.asarray(data, dtype=np.int64)
                self.dtype, self.shape, self.device = self.data.dtype, self.data.shape, SimpleNamespace(type='cpu')
            def numpy(self): return self.data
        def key(prompt=1, count=2):
            return cache.key({'input_ids': Tensor([[prompt]*3]*count),
                'attention_mask': Tensor([[1]*3]*count), 'image_grid_thw': Tensor([[1,32,32]]*count),
                'pixel_values': object()})
        def compute():
            return (visual.fast_pos_embed_interpolate(None), visual.rot_pos_emb(None), core.get_rope_index(None))
        cache.select(key()); first = compute()
        cache.select(key()); self.assertEqual(first, compute())
        self.assertEqual((cache.hits, cache.misses), (3, 3))
        cache.select(key(prompt=2)); self.assertNotEqual(first, compute())
        cache.select(key(count=1)); compute()
        self.assertEqual(len(cache.entries), 2)
        cache.select(key()); compute()
        self.assertEqual(cache.misses, 12)


if __name__ == '__main__':
    unittest.main()
