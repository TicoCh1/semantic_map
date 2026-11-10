"""State-transition regression tests. CPU-only; fake model; temporary outputs."""
import io
import json
from pathlib import Path
import signal
import sys
import tarfile
import tempfile
import threading
import types
import unittest
from unittest.mock import patch
import zipfile

import numpy as np
from PIL import Image

import run_dataset_embedding as runner
from dataset_image_pipeline import ImageReader, ImageRecord, write_inventory, load_catalog
from dataset_run_state import RunLock, StorageBudget
from dataset_package_store import committed_packages as committed_sources
from dataset_package_store import PackageWriter
from dataset_cpu_cache import CPUCache
from dataset_validation_export import ValidationExporter, raster_bytes, flatten_bdd_path
from validation_projection import transform_polyline_segments
from dataset_image_pipeline import transform_image


class FakeModel:
    inputs = []
    fail = False
    hook = None
    def __init__(self, **kwargs):
        pass
    def process(self, items, normalize=True):
        if self.fail:
            raise RuntimeError('Synthetic model failure')
        self.inputs.extend(np.array(item['image']) for item in items)
        if self.hook:
            self.hook()
        return np.ones((len(items), 4), dtype=np.float32) / 2


class FakeImageEngine:
    batch_sizes = []
    def __init__(self, model, args):
        self.model = model
        self.stats = {}
    def prepare(self, batch):
        arrays = []
        for source, index in batch:
            if source.record.projection == 'equirectangular':
                views = transform_image(source.image, 'equirectangular')
                arrays.append(np.array(views[index][0]))
                for image, _ in views: image.close()
            else:
                arrays.append(np.array(source.images[index]))
        return arrays
    def forward(self, arrays, count):
        self.batch_sizes.append(count)
        images = [Image.fromarray(array) for array in arrays]
        try:
            return self.model.process([{'image': image} for image in images])
        finally:
            for image in images: image.close()
    def synchronize(self):
        pass


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.images = self.root / 'images'
        self.images.mkdir()
        for i in range(3):
            Image.new('RGB', (16, 16), (i * 40, 40, 100)).save(self.images / f'{i+1}.png')
        self.catalog = self.root / 'catalog.json'
        self.catalog.write_text(json.dumps({'version': 1, 'sources': [{
            'dataset_id': 'synthetic', 'projection': 'perspective',
            'container': str(self.images / '*.png')}]}))
        self.output = self.root / 'output'
        FakeModel.inputs, FakeModel.fail, FakeModel.hook = [], False, None
        FakeImageEngine.batch_sizes = []
        self.signals = {s: signal.getsignal(s) for s in (signal.SIGINT, signal.SIGTERM)}

    def tearDown(self):
        for s, handler in self.signals.items():
            signal.signal(s, handler)
        self.temp.cleanup()

    def run_model(self, *extra, fail_index=None):
        torch = types.ModuleType('torch')
        torch.cuda = types.SimpleNamespace(is_available=lambda: True,
            is_bf16_supported=lambda: True, empty_cache=lambda: None)
        torch.bfloat16, torch.float16 = 'bf16', 'fp16'
        qwen = types.ModuleType('src.models.qwen3_vl_embedding')
        qwen.Qwen3VLEmbedder = FakeModel
        runtime = types.ModuleType('pipeline_runtime')
        runtime.NativeProjector = lambda **kwargs: None
        common = ['--catalog', str(self.catalog), '--output-root', str(self.output),
            '--cache-root', str(self.root/'cache'), '--model-dir', str(self.root/'model'),
            '--repo-dir', str(self.root/'repo'), '--volume-root', str(self.root),
            '--volume-capacity-gb', '0', '--storage-reserve-gb', '0']
        if not (self.output/'source_inventory.jsonl').exists():
            runner.main([*common, '--prepare-cpu-only'])
        read = CPUCache.entry
        def read_image(cache, database, index):
            if index == fail_index:
                raise ValueError('Synthetic read failure')
            return read(cache, database, index)
        with patch.dict(sys.modules, {'torch': torch, 'src.models.qwen3_vl_embedding': qwen,
                                     'pipeline_runtime': runtime}), patch.object(CPUCache, 'entry', read_image), \
                patch.object(runner, 'create_engine', FakeImageEngine):
            return runner.main(['--catalog', str(self.catalog), '--output-root', str(self.output),
                '--cache-root', str(self.root/'cache'), '--model-dir', str(self.root/'model'),
                '--repo-dir', str(self.root/'repo'), '--volume-root', str(self.root),
                '--volume-capacity-gb', '0', '--storage-reserve-gb', '0',
                '--embed-batch', '2', '--checkpoint-sources', '2', '--decode-workers', '2', '--prefetch-sources', '2', *extra])

    def status(self):
        return json.loads((self.output/'run_status.json').read_text())

    def rows(self):
        return [json.loads(line) for p in sorted((self.output/'packages').glob('*/image_map.jsonl'))
                for line in p.read_text().splitlines()]

    def test_retry_interior_hole_and_reconcile(self):
        self.run_model(fail_index=1)
        self.run_model('--retry-errors')
        self.assertEqual(sorted(r['source_index'] for r in self.rows()), [0, 1, 2])
        self.assertEqual(self.status()['status'], 'complete')
        self.assertEqual(self.status()['known_error_sources'], 0)
        self.run_model('--retry-errors')
        self.assertEqual(len(self.rows()), 3)

    def test_retry_only_does_not_process_unattempted_sources(self):
        self.run_model('--max-sources', '2', fail_index=0)
        self.run_model('--retry-errors')
        self.assertEqual(sorted(r['source_index'] for r in self.rows()), [0, 1])
        self.assertEqual(self.status()['remaining_sources'], 1)
        self.assertEqual(self.status()['status'], 'partial')
        self.run_model()
        self.assertEqual(self.status()['status'], 'complete')

    def test_tail_error_resolves(self):
        self.run_model(fail_index=2)
        self.run_model('--retry-errors')
        self.assertEqual(self.status()['status'], 'complete')

    def test_limit_is_partial_and_can_resume(self):
        self.run_model('--max-sources', '1')
        self.assertEqual(self.status()['status'], 'partial')
        self.assertEqual(self.status()['remaining_sources'], 2)
        self.run_model()
        self.assertEqual(len(self.rows()), 3)

    def test_rebuild_refused_before_changing_inventory(self):
        self.run_model()
        before = (self.output/'source_inventory.jsonl').read_bytes()
        Image.new('RGB', (16, 16), 'red').save(self.images/'0.png')
        with self.assertRaisesRegex(RuntimeError, 'populated'):
            self.run_model('--rebuild-inventory')
        self.assertEqual((self.output/'source_inventory.jsonl').read_bytes(), before)
        with self.assertRaisesRegex(RuntimeError, 'Source files'):
            self.run_model()

    def test_missing_and_truncated_payload_rejected(self):
        self.run_model()
        shard = next((self.output/'packages').glob('*/embeddings.npy'))
        original = shard.read_bytes()
        shard.write_bytes(original[:-1])
        with self.assertRaisesRegex(RuntimeError, 'Missing or shortened'):
            self.run_model()
        shard.unlink()
        with self.assertRaisesRegex(RuntimeError, 'Missing or shortened'):
            committed_sources(self.output/'packages')

    def test_native_pixels_feed_model_without_exporting_rgb(self):
        pixels = np.random.default_rng(7).integers(0, 256, (512, 512, 3), dtype=np.uint8)
        Image.fromarray(pixels).save(self.images/'1.png')
        self.run_model('--max-sources', '1')
        row = self.rows()[0]
        self.assertEqual(row['view_id'], 'synthetic/000000000/view_00')
        self.assertNotIn('output_member', row)
        self.assertFalse(list((self.output/'packages').glob('*_images.tar')))
        np.testing.assert_array_equal(pixels, FakeModel.inputs[0])
        self.assertEqual(row['transform']['crop_box'], [0, 0, 512, 512])
        self.assertIn('1.png', row['source_uri'])
        self.assertEqual(committed_sources(self.output/'packages'), {0})

    def test_zero_match_fails(self):
        data = json.loads(self.catalog.read_text())
        data['sources'][0]['member_globs'] = ['missing/*.jpg']
        self.catalog.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'zero images'):
            write_inventory(self.catalog, self.root/'inventory.jsonl')

    def test_allow_empty_is_reported_explicitly(self):
        data = json.loads(self.catalog.read_text())
        data['sources'][0].update(member_globs=['missing/*.jpg'], allow_empty=True)
        self.catalog.write_text(json.dumps(data))
        report = write_inventory(self.catalog, self.root/'inventory.jsonl')
        self.assertEqual(report['datasets'], {'synthetic': 0})

    def test_changed_model_or_precision_rejected(self):
        self.run_model('--max-sources', '1')
        with self.assertRaisesRegex(RuntimeError, 'Model, precision'):
            self.run_model('--precision', 'fp16')
        (self.root/'model').mkdir()
        (self.root/'model/config.json').write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Model, precision'):
            self.run_model()

    def test_model_failure_can_retry_all_sources(self):
        FakeModel.fail = True
        self.run_model()
        self.assertEqual(self.status()['known_error_sources'], 3)
        FakeModel.fail = False
        self.run_model('--retry-errors')
        self.assertEqual(self.status()['status'], 'complete')
        self.assertEqual(len(self.rows()), 3)

    def test_publish_failure_does_not_resolve_error(self):
        self.run_model(fail_index=2)
        original = runner.atomic_json
        def fail_marker(path, value):
            if path.name == 'checkpoint.json':
                raise OSError('Synthetic durable write failure')
            original(path, value)
        with patch.object(runner, 'atomic_json', fail_marker), self.assertRaises(OSError):
            self.run_model('--retry-errors')
        with runner.ErrorLedger(self.output/'embedding_errors.jsonl') as errors:
            self.assertEqual(errors.skipped_sources, {2})
        self.run_model('--retry-errors')
        self.assertEqual(len(self.rows()), 3)
        self.assertEqual(self.status()['status'], 'complete')

    def test_lock_prevents_second_writer(self):
        with RunLock(self.output):
            with self.assertRaisesRegex(RuntimeError, 'Another embedding'):
                self.run_model()

    def test_duplicate_archive_precedence(self):
        for name, color in [('base.zip', 'red'), ('patch.zip', 'blue')]:
            buffer = io.BytesIO()
            Image.new('RGB', (16, 16), color).save(buffer, 'PNG')
            with zipfile.ZipFile(self.root/name, 'w') as archive:
                archive.writestr('images/one.png', buffer.getvalue())
        data = json.loads(self.catalog.read_text())
        data['sources'][0].update(container=str(self.root/'*.zip'))
        self.catalog.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, 'Duplicate source'):
            write_inventory(self.catalog, self.root/'inventory.jsonl')
        data['sources'][0]['duplicate_policy'] = 'last'
        self.catalog.write_text(json.dumps(data))
        report = write_inventory(self.catalog, self.root/'inventory.jsonl')
        row = json.loads((self.root/'inventory.jsonl').read_text())
        self.assertTrue(row['container'].endswith('patch.zip'))
        self.assertEqual(report['records'], 1)
        self.assertEqual(report['duplicates_removed'], {'synthetic': 1})

    def test_panorama_source_views_commit_together(self):
        data = json.loads(self.catalog.read_text())
        data['sources'][0]['projection'] = 'equirectangular'
        self.catalog.write_text(json.dumps(data))
        for path in self.images.glob('*.png'):
            Image.new('RGB', (32, 16), 'green').save(path)
        self.run_model('--max-sources', '1', '--embed-batch', '3', '--checkpoint-sources', '3')
        self.assertEqual(len(self.rows()), 8)
        self.assertEqual(FakeImageEngine.batch_sizes, [3, 3, 2])
        self.assertEqual(committed_sources(self.output/'packages'), {0})

    def test_high_bit_raster_is_lossless(self):
        values = np.array([[0, 123456789], [65536, 42]], dtype=np.int32)
        extension, payload = raster_bytes(Image.fromarray(values))
        self.assertEqual(extension, '.npy')
        np.testing.assert_array_equal(np.load(io.BytesIO(payload)), values)

    def test_polyline_does_not_bridge_outside_crop(self):
        transform = {'method': 'center_crop_resize', 'crop_box': [0, 0, 10, 10], 'output_size': [10, 10]}
        segments = transform_polyline_segments([1, 1, 20, 1, 20, 9, 1, 9], transform)
        self.assertEqual(segments, [[1., 1., 10., 1.], [10., 9., 1., 9.]])

    def test_storage_guard_uses_quota_not_shared_pool(self):
        storage = StorageBudget(self.root, self.output, capacity_gb=1, reserve_gb=0.1)
        with patch('dataset_run_state.shutil.disk_usage', return_value=types.SimpleNamespace(free=10**15)), \
                patch('dataset_run_state.subprocess.run', return_value=types.SimpleNamespace(stdout='950000000\t/root')):
            with self.assertRaisesRegex(OSError, 'Insufficient'):
                storage.require(1)

    def test_sigterm_commits_whole_sources_and_resumes(self):
        FakeModel.hook = staticmethod(lambda: signal.raise_signal(signal.SIGTERM))
        self.assertEqual(self.run_model(), 130)
        self.assertEqual(self.status()['status'], 'interrupted')
        self.assertTrue({0, 1}.issubset(committed_sources(self.output/'packages')))
        FakeModel.hook = None
        self.run_model()
        self.assertEqual(len(self.rows()), 3)

    def test_corrupt_view_identity_rejected(self):
        self.run_model()
        p = next((self.output/'packages').glob('*/image_map.jsonl'))
        original = p.read_text()
        # Same byte count deliberately avoids the size check.
        p.write_text(original.replace('view_00', 'view_99'))
        with self.assertRaisesRegex(RuntimeError, 'identity mismatch'):
            committed_sources(self.output/'packages')

    def test_old_rgb_checkpoint_cannot_resume(self):
        self.run_model()
        p = next((self.output/'packages').glob('*/checkpoint.json'))
        marker = json.loads(p.read_text())
        marker['version'] = 2
        p.write_text(json.dumps(marker))
        with self.assertRaisesRegex(RuntimeError, 'Invalid native package checkpoint'):
            committed_sources(self.output/'packages')

    def test_no_second_run_with_changed_labels(self):
        # Config identity pins labels as well as model files, even if image
        # catalog paths stay unchanged.
        archive = self.root/'labels.zip'
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('metadata.txt', 'first')
        data = json.loads(self.catalog.read_text())
        data['sources'][0]['validation'] = {'adapter': 'none', 'archives': [str(archive)]}
        self.catalog.write_text(json.dumps(data))
        self.run_model('--max-sources', '1')
        with zipfile.ZipFile(archive, 'a') as z:
            z.writestr('extra.txt', 'changed')
        with self.assertRaisesRegex(RuntimeError, 'CPU cache is stale'):
            self.run_model()

    def test_disk_writer_overlaps_next_model_forward(self):
        entered = threading.Event(); forwarded = threading.Event()
        original = PackageWriter.write
        calls = []
        def write(writer, complete):
            entered.set()
            if not forwarded.wait(3):
                raise AssertionError('Disk writer prevented the next forward')
            return original(writer, complete)
        def hook():
            calls.append(1)
            if len(calls) == 2:
                if not entered.wait(3):
                    raise AssertionError('Writer was not running during next forward')
                forwarded.set()
        FakeModel.hook = staticmethod(hook)
        with patch.object(PackageWriter, 'write', write):
            self.run_model('--embed-batch', '1')
        self.assertEqual(self.status()['status'], 'complete')


class LabelExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.archive_path = self.root/'labels.zip'
        self.transform = {'method': 'center_crop_resize', 'crop_box': [4, 0, 12, 8],
                          'output_size': [4, 4], 'view_index': 0}

    def tearDown(self):
        self.temp.cleanup()

    def exporter(self, dataset, adapter):
        path = self.root/'catalog.json'
        path.write_text(json.dumps({'version': 1, 'sources': [{'dataset_id': dataset,
            'validation': {'adapter': adapter, 'archives': [str(self.archive_path)]}}]}))
        return ValidationExporter(path)

    def test_worker_metadata_caches_do_not_evict_each_other(self):
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('mtsd_v2_fully_annotated/splits/test.txt', 'one\ntwo\n')
        paths = (str(self.archive_path),)
        with self.exporter('mtsd', 'mtsd') as first, self.exporter('mtsd', 'mtsd') as second:
            first.mtsd_test_keys(paths)
            second.mtsd_test_keys(paths)
            first.mtsd_test_keys(paths)
            self.assertEqual(first.mtsd_test_keys.cache_info().hits, 1)
            self.assertEqual(second.mtsd_test_keys.cache_info().hits, 0)

    def test_mtsd_clips_boxes_preserves_attributes_and_hidden_test(self):
        data = {'width': 16, 'height': 8, 'ispano': False, 'objects': [
            {'bbox': {'xmin': 2, 'ymin': 2, 'xmax': 8, 'ymax': 6}, 'label': 'stop', 'properties': {'occluded': True}},
            {'bbox': {'xmin': 13, 'ymin': 0, 'xmax': 15, 'ymax': 2}, 'label': 'outside'}]}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('mtsd_v2_fully_annotated/annotations/example.json', json.dumps(data))
            z.writestr('mtsd_v2_fully_annotated/splits/test.txt', 'test-image\n')
        record = ImageRecord(0, 'mtsd', 'perspective', '/images.zip', 'images/example.jpg')
        with self.exporter('mtsd', 'mtsd') as exporter:
            meta, files = exporter.export(record, [16, 8], [self.transform])[0]
            doc = json.loads(files[-1][1])
            obj = doc['targets'][0]['objects']
            self.assertEqual(len(obj), 1)
            self.assertEqual(obj[0]['bbox'], {'xmin': 0., 'ymin': 1., 'xmax': 2., 'ymax': 3.})
            self.assertTrue(obj[0]['properties']['occluded'])
            hidden = ImageRecord(1, 'mtsd', 'perspective', '/images.zip', 'images/test-image.jpg')
            self.assertEqual(exporter.export(hidden, [16,8], [self.transform])[0][0]['status'], 'unavailable_test_labels')
            absent = ImageRecord(2, 'mtsd', 'perspective', '/images.zip', 'images/absent.jpg')
            with self.assertRaisesRegex(ValueError, 'exactly one'):
                exporter.export(absent, [16,8], [self.transform])

    def test_bdd_masks_and_source_tags_align(self):
        mask = io.BytesIO()
        Image.fromarray(np.tile(np.arange(16, dtype=np.uint8), (8,1))).save(mask, 'PNG')
        data = {'name': 'example', 'attributes': {'weather': 'clear'}, 'frames': [{'objects': [
            {'id': 1, 'category': 'car', 'box2d': {'x1': 2, 'y1': 2, 'x2': 8, 'y2': 6}},
            {'id': 2, 'category': 'lane/road curb', 'poly2d': [[0,4,'C'],[4,3,'C'],[12,3,'C'],[16,4,'L']]}]}]}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('100k/train/example.json', json.dumps(data))
            z.writestr('labels/train/example_drivable_id.png', mask.getvalue())
        record = ImageRecord(0, 'bdd100k_100k', 'perspective', '/images.zip', '100k/train/example.jpg')
        with self.exporter('bdd100k_100k', 'bdd') as exporter:
            _, files = exporter.export(record, [16,8], [self.transform])[0]
            doc = json.loads(files[-1][1])
            self.assertEqual(doc['source_tags'], {'weather': 'clear'})
            self.assertEqual(len(doc['targets'][1]['objects']), 2)
            with Image.open(io.BytesIO(files[0][1])) as image:
                np.testing.assert_array_equal(np.asarray(image)[0], [5,7,9,11])

    def test_cropped_edge_poles_disappear_and_label_precision_is_preserved(self):
        pixels = np.zeros((600, 800), dtype=np.uint16)
        pixels[:, :80] = 301
        pixels[:, 720:] = 302
        pixels[200:400, 350:450] = 4097
        buffer = io.BytesIO()
        Image.fromarray(pixels).save(buffer, 'PNG')
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('labels/train/example_train_id.png', buffer.getvalue())
        record = ImageRecord(0, 'bdd100k_10k', 'perspective', '/images.zip', '10k/train/example.jpg')
        transform = {'method': 'center_crop_resize', 'crop_box': [100, 0, 700, 600],
                     'output_size': [512, 512], 'view_index': 0}
        with self.exporter('bdd100k_10k', 'bdd') as exporter:
            _, files = exporter.export(record, [800, 600], [transform])[0]
            with Image.open(io.BytesIO(files[0][1])) as saved:
                self.assertEqual(saved.size, (512, 512))
                self.assertEqual(set(np.unique(np.asarray(saved))), {0, 4097})
            doc = json.loads(files[-1][1])
            self.assertTrue(doc['targets'][0]['geometry_changed'])

    def test_unchanged_raster_uses_original_reference(self):
        buffer = io.BytesIO()
        Image.new('L', (8, 8), 7).save(buffer, 'PNG')
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('labels/train/example_train_id.png', buffer.getvalue())
        record = ImageRecord(0, 'bdd100k_10k', 'perspective', '/images.zip', '10k/train/example.jpg')
        transform = {'method': 'center_crop_resize', 'crop_box': [0, 0, 8, 8],
                     'output_size': [8, 8], 'view_index': 0}
        with self.exporter('bdd100k_10k', 'bdd') as exporter:
            _, files = exporter.export(record, [8, 8], [transform])[0]
            self.assertEqual(len(files), 1)
            target = json.loads(files[0][1])['targets'][0]
            self.assertEqual(target['storage'], 'source_reference')
            self.assertNotIn('member', target)

    def test_omni_preserves_instance_id_zero_separately_from_background(self):
        data = {'images': [{'id': 0, 'file_name': 'image.jpg', 'width': 16, 'height': 8}],
                'annotations': [{'id': 0, 'image_id': 0, 'category_id': 7, 'segmentation': [[4,0,11,0,11,7,4,7]]}],
                'categories': [{'id': 7, 'name': 'building'}]}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            for task in ['instance', 'landuse', 'plane']:
                z.writestr(f'OmniCity-dataset/street-level/annotation-mono/annotation-mono-{task}/annotation-mono-{task}-train.json', json.dumps(data))
        record = ImageRecord(0, 'omni', 'perspective', str(self.archive_path), 'image.jpg', 'image-mono-train.zip')
        with self.exporter('omni', 'omni_coco') as exporter:
            _, files = exporter.export(record, [16,8], [self.transform])[0]
            doc = json.loads(files[-1][1])
            obj = doc['targets'][0]['objects'][0]
            self.assertEqual((obj['mask_id'], obj['annotation_id'], obj['category_id']), (1,0,7))
            with Image.open(io.BytesIO(files[0][1])) as image:
                self.assertEqual(np.asarray(image).min(), 1)

    def test_bdd_legacy_curve_endpoint_marked_line(self):
        points = flatten_bdd_path([[0,0,'C'],[0,10,'C'],[10,10,'C'],[10,0,'L']])
        self.assertEqual(points[:2], [0.,0.])
        self.assertEqual(points[-2:], [10.,0.])
        self.assertGreater(len(points), 8)

    def test_annotation_dimension_mismatch_is_an_error(self):
        data = {'width': 32, 'height': 8, 'ispano': False, 'objects': []}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('mtsd_v2_fully_annotated/annotations/example.json', json.dumps(data))
            z.writestr('mtsd_v2_fully_annotated/splits/test.txt', '')
        record = ImageRecord(0, 'mtsd', 'perspective', '/images.zip', 'images/example.jpg')
        with self.exporter('mtsd', 'mtsd') as exporter:
            with self.assertRaisesRegex(ValueError, 'geometry disagrees'):
                exporter.export(record, [16,8], [self.transform])

    def test_projection_uses_metadata_not_aspect_ratio(self):
        data = {'width': 16, 'height': 8, 'ispano': False, 'objects': []}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('mtsd_v2_fully_annotated/annotations/perspective.json', json.dumps(data))
            z.writestr('mtsd_v2_fully_annotated/annotations/pano.json', json.dumps({**data,'ispano':True}))
            z.writestr('mtsd_v2_fully_annotated/splits/test.txt', '')
        with self.exporter('mtsd', 'mtsd') as exporter:
            exporter.rules['mtsd']['projection_policy'] = 'metadata_with_catalog_test_fallback'
            ordinary = ImageRecord(0, 'mtsd', 'perspective', '/images.zip', 'images/perspective.jpg')
            pano = ImageRecord(1, 'mtsd', 'perspective', '/images.zip', 'images/pano.jpg')
            self.assertEqual(exporter.resolve_record(ordinary, [16,8]).projection, 'perspective')
            self.assertEqual(exporter.resolve_record(pano, [16,8]).projection, 'equirectangular')

    def test_mtsd_panorama_projects_boxes_into_view(self):
        data = {'width': 128, 'height': 64, 'ispano': True,
                'objects': [{'bbox': {'xmin':48,'ymin':24,'xmax':80,'ymax':40},'label':'stop'}]}
        with zipfile.ZipFile(self.archive_path, 'w') as z:
            z.writestr('mtsd_v2_fully_annotated/annotations/pano.json', json.dumps(data))
            z.writestr('mtsd_v2_fully_annotated/splits/test.txt', '')
        transform = {'method':'equirectangular_to_perspective','view_index':0,
                     'yaw_degrees':0,'pitch_degrees':0,'fov_degrees':45,'output_size':[32,32]}
        record = ImageRecord(0,'mtsd','equirectangular','/images.zip','images/pano.jpg')
        with self.exporter('mtsd','mtsd') as exporter:
            _,files=exporter.export(record,[128,64],[transform])[0]
            obj=json.loads(files[-1][1])['targets'][0]['objects'][0]
            self.assertEqual(obj['bbox'], {'xmin':0,'ymin':0,'xmax':32,'ymax':32})


if __name__ == '__main__':
    unittest.main()
