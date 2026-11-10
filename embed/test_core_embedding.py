"""CORE namespaces, crash recovery and CPU guard, using shared writer fixtures."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import test_panorama_pipeline as fixtures
from core_panorama_state import RunState as CoreRunState
from core_embedding_safety import check_output_root


class CoreCheckpointTests(unittest.TestCase):
    def setUp(self):
        self.fixture = fixtures.PipelineTests(methodName='test_names_and_selection')
        self.fixture.setUp()

    def tearDown(self):
        self.fixture.tearDown()

    def make_state(self, *args, **kwargs):
        state = self.fixture.make_state(*args, **kwargs)
        return CoreRunState(state.root, state.config)

    def test_core_namespace_does_not_modify_qwen_namespace(self):
        import pipeline_state
        before = dict(pipeline_state.DATASETS)
        state = self.make_state()
        self.fixture.inventory(state)
        path = state.paths('rome', 0)['embedding']
        self.assertEqual(path.parent.name, 'rome_512_8_45_CORE8B')
        self.assertEqual(pipeline_state.DATASETS, before)

    def test_core_crash_publication_and_recovery(self):
        import numpy as np
        state = self.make_state(count=2)
        self.fixture.inventory(state)
        items = self.fixture.items(state)
        values = np.ones((2, 8, 3), dtype=np.float16)
        for phase in ('embedding', 'reference', 'identities', 'pano', 'marker'):
            def fault(actual):
                if actual == phase:
                    raise RuntimeError('simulated crash')
            with self.assertRaisesRegex(RuntimeError, 'simulated crash'):
                state.write_shard('rome', 0, 0, items, values, self.fixture.stats, fault)
            recovered = CoreRunState(state.root, state.config)
            self.assertEqual(recovered.recover(), {'rome': int(phase == 'marker')})
            self.assertEqual(len(list(recovered.pending('rome'))), 0 if phase == 'marker' else 2)
        with self.assertRaisesRegex(RuntimeError, 'overwrite'):
            state.write_shard('rome', 0, 0, items, values, self.fixture.stats)
        for item in items: item.image.close()

    def test_retained_source_keeps_original_namespace_and_heading(self):
        import numpy as np
        from core_retained_sources import source_manifest
        from pipeline_state import RunState as QwenRunState, atomic_json
        source = self.fixture.make_state(count=2)
        self.fixture.inventory(source)
        items = self.fixture.items(source)
        source.write_shard('rome', 0, 0, items, np.ones((2, 8, 3), np.float16), self.fixture.stats)
        atomic_json(source.root / 'complete.json', {'run_id': source.run_id,
            'remaining': 0, 'failed_panos': 0, 'committed_counts': {'rome': 2}})
        pano_root, archives, selection, expected, metadata = source_manifest(source.root, ['rome'])
        config = {'cities': ['rome'], 'sources': archives, 'dimension': 3,
                  'jpeg_quality': 90, 'source_run': metadata}
        core = CoreRunState(self.fixture.root / 'retained-core', config)
        self.assertTrue(core.inventory(pano_root, selection, self.fixture.stats, self.fixture.stop, expected))
        records = list(core.pending('rome'))
        self.assertEqual([row['heading'] for row in records], [45.0, 45.0])
        self.assertEqual([row['namespace'] for row in records], ['rome', 'rome'])
        self.assertEqual(source.counts(True), {'rome': 2})
        for item in items: item.image.close()


class CoreAdapterTests(unittest.TestCase):
    def test_no_cuda_rejects_before_checkpoint_loading(self):
        from core_embedding_adapter import CoreEmbedder
        with patch('torch.cuda.is_available', return_value=False), patch('core_embedding_adapter.official_classes') as load:
            with self.assertRaisesRegex(RuntimeError, 'requires CUDA'):
                CoreEmbedder('/does/not/exist')
            load.assert_not_called()

    def test_last_nonpadding_pooling_for_variable_lengths(self):
        import torch
        from core_embedding_adapter import CoreEmbedder
        hidden = torch.arange(2 * 4 * 3).reshape(2, 4, 3)
        mask = torch.tensor([[1, 1, 0, 0], [1, 1, 1, 1]])
        result = CoreEmbedder._pooling_last(hidden, mask)
        self.assertTrue(torch.equal(result, torch.stack([hidden[0, 1], hidden[1, 3]])))

    def test_output_cannot_overlap_qwen_or_core_weights(self):
        for path in ['/workspace/embedding/core', '/workspace/reruns/pano512_8B_q90_20260915_b200/core',
                     '/workspace/models/core-emb-8b/output', '/workspace']:
            with self.subTest(path=path), self.assertRaisesRegex(ValueError, 'overlaps'):
                check_output_root(path, '/workspace/models/core-emb-8b', '/workspace/core-emb')

    def test_output_rejects_existing_non_core_manifest(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'output'
            root.mkdir()
            (root / 'run_manifest.json').write_text(json.dumps({'model_dir': '/qwen'}))
            with self.assertRaisesRegex(ValueError, 'not a CORE'):
                check_output_root(root, Path(directory) / 'weights', Path(directory) / 'repo')


if __name__ == '__main__':
    unittest.main()
