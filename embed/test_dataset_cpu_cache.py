"""Persistent preparation contracts; execute on the RunPod CPU host."""
import io
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import numpy as np
from PIL import Image

from dataset_async_pipeline import CachedCPUPreparation
from dataset_cpu_cache import CPUCache, build_cache, read_encoded
from dataset_image_pipeline import write_inventory, transform_image, transform_metadata
from dataset_run_state import StorageBudget
from dataset_validation_export import ValidationExporter
import run_dataset_embedding as runner


class CPUCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.catalog = self.root/'catalog.json'
        self.inventory = self.root/'inventory.jsonl'
        self.cache_root = self.root/'cache'
        self.storage = StorageBudget(self.root, self.cache_root, 0, 0)
        self.pixels = np.random.default_rng(42).integers(0, 256, (20, 32, 3), dtype=np.uint8)
        image = io.BytesIO(); Image.fromarray(self.pixels).save(image, 'PNG')
        with zipfile.ZipFile(self.root/'images.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('a.png', image.getvalue()); archive.writestr('b.png', image.getvalue())
        self.catalog.write_text(json.dumps({'version': 1, 'sources': [{
            'dataset_id': 'fixture', 'projection': 'perspective', 'container': str(self.root/'images.zip')}]}))
        self.summary = self.make_inventory()

    def tearDown(self):
        self.temp.cleanup()

    def make_inventory(self):
        summary = write_inventory(self.catalog, self.inventory)
        summary['catalog_snapshot'] = json.loads(self.catalog.read_text())
        return summary

    def build(self, **kwargs):
        return build_cache(self.catalog, self.inventory, self.summary, self.cache_root, self.storage, **kwargs)

    def cache(self):
        return CPUCache(self.cache_root, self.catalog, self.inventory, self.summary)

    def test_requires_ready_and_does_not_prepare_on_gpu_start(self):
        with self.assertRaisesRegex(RuntimeError, 'not ready'):
            self.cache()
        with patch.object(runner, 'write_inventory', side_effect=AssertionError('GPU built inventory')):
            with self.assertRaisesRegex(RuntimeError, 'CPU Pod first'):
                runner.main(['--catalog', str(self.catalog), '--output-root', str(self.root/'out')])

    def test_readonly_gpu_path_never_reopens_zip_or_exports_labels(self):
        self.assertEqual(self.build()['errors'], 0)
        cache = self.cache()
        preparation = CachedCPUPreparation(cache, 2, 2)
        with patch('zipfile.ZipFile', side_effect=AssertionError('Parsed ZIP directory on GPU')), \
                patch.object(ValidationExporter, 'export', side_effect=AssertionError('Projected GPU-time labels')):
            sources = list(preparation.iterate(cache.records()))
        self.assertEqual(len(sources), 2)
        self.assertTrue(all(source.error is None for source in sources))
        expected = transform_image(Image.fromarray(self.pixels), 'perspective')
        np.testing.assert_array_equal(np.array(sources[0].images[0]), np.array(expected[0][0]))
        expected[0][0].close()
        self.assertTrue(sources[0].rows[0]['_validation_files'])
        for source in sources: source.close()
        db = cache.connect()
        with self.assertRaises(sqlite3.OperationalError):
            db.execute('DELETE FROM sources')
        db.close()

    def test_partial_transaction_resumes_without_reexport(self):
        original = ValidationExporter.export
        def interrupted(labels, record, size, transforms):
            if record.source_index == 1: raise KeyboardInterrupt()
            return original(labels, record, size, transforms)
        with patch.object(ValidationExporter, 'export', interrupted), self.assertRaises(KeyboardInterrupt):
            self.build(checkpoint=1)
        self.assertFalse((self.cache_root/'READY.json').exists())
        called = []
        def resume(labels, record, size, transforms):
            called.append(record.source_index)
            return original(labels, record, size, transforms)
        with patch.object(ValidationExporter, 'export', resume):
            self.build(checkpoint=1)
        self.assertEqual(called, [1])
        self.assertEqual(self.cache().ready['records'], 2)

    def test_published_database_change_rejected(self):
        self.build()
        with (self.cache_root/'prepared.sqlite').open('ab') as handle: handle.write(b'x')
        with self.assertRaisesRegex(RuntimeError, 'file changed'):
            self.cache()

    def test_nested_archive_survives_builder_exit(self):
        inner = (self.root/'images.zip').read_bytes()
        with zipfile.ZipFile(self.root/'outer.zip', 'w', zipfile.ZIP_DEFLATED) as outer:
            outer.writestr('inner.zip', inner)
        data = json.loads(self.catalog.read_text())
        data['sources'][0].update(container=str(self.root/'outer.zip'), nested_archive_globs=['*.zip'])
        self.catalog.write_text(json.dumps(data)); self.summary = self.make_inventory()
        ready = self.build()
        self.assertEqual(len(ready['containers']), 1)
        cache = self.cache(); db = cache.connect()
        payload, _, _ = cache.entry(db, 0); db.close()
        with patch('zipfile.ZipFile', side_effect=AssertionError('ZIP reopened')):
            encoded = read_encoded(payload['locator'])
        with Image.open(io.BytesIO(encoded)) as image:
            np.testing.assert_array_equal(np.array(image), self.pixels)

    def test_geometry_metadata_matches_actual_transforms(self):
        for size, projection, mode in [((32, 20), 'perspective', 'center_crop'),
                ((40, 20), 'perspective', 'horizontal_halves_if_2_to_1'),
                ((40, 20), 'equirectangular', 'center_crop')]:
            image = Image.new('RGB', size)
            outputs = transform_image(image, projection, perspective_mode=mode)
            self.assertEqual(transform_metadata(size, projection, mode), [t for _, t in outputs])
            for output, _ in outputs: output.close()
            image.close()

    def test_stored_nested_zip_uses_original_bytes_without_copy(self):
        inner = (self.root/'images.zip').read_bytes()
        with zipfile.ZipFile(self.root/'outer.zip', 'w', zipfile.ZIP_STORED) as outer:
            outer.writestr('inner.zip', inner)
        data = json.loads(self.catalog.read_text())
        data['sources'][0].update(container=str(self.root/'outer.zip'), nested_archive_globs=['*.zip'])
        self.catalog.write_text(json.dumps(data)); self.summary = self.make_inventory()
        self.assertEqual(self.build()['containers'], [])
        cache = self.cache(); db = cache.connect()
        for index in (0, 1):
            payload, _, error = cache.entry(db, index)
            self.assertIsNone(error)
            self.assertEqual(payload['locator']['path'], str(self.root/'outer.zip'))
            with Image.open(io.BytesIO(read_encoded(payload['locator']))) as image:
                np.testing.assert_array_equal(np.array(image), self.pixels)
        db.close()

    def test_lookahead_reader_can_close_on_main_thread(self):
        self.build(); records = self.cache().records()
        with ThreadPoolExecutor(max_workers=1) as worker:
            self.assertEqual(worker.submit(next, records).result().source_index, 0)
        records.close()

    def test_bad_source_record_is_explicit_and_consumable(self):
        with zipfile.ZipFile(self.root/'images.zip', 'a') as archive:
            archive.writestr('bad.png', b'not an image')
        self.summary = self.make_inventory()
        self.assertEqual(self.build()['errors'], 1)
        cache = self.cache(); preparation = CachedCPUPreparation(cache, 1, 1)
        sources = list(preparation.iterate(cache.records()))
        self.assertEqual(sum(source.error is not None for source in sources), 1)
        for source in sources: source.close()


if __name__ == '__main__':
    unittest.main()
