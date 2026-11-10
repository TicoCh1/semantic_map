import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from semantic_map.rerank_saved_sources import SavedRerankSources


class SavedSourcesTests(unittest.TestCase):
    def make_catalog(self, root):
        directory = root / 'london_embedding_comparison_20260917'
        directory.mkdir()
        (directory / 'status.json').write_text(json.dumps({'stage': 'complete'}))
        (directory / 'prompts.json').write_text(json.dumps([{'index': 0, 'prompt': 'trees'}, {'index': 1, 'prompt': 'brick'}]))
        np.savez(directory / 'alignment.npz', refs=np.array([[7, -.1, 51, 202509], [9, -.2, 51.1, 202508]]))
        np.save(directory / 'score_new4096.npy', np.array([[.25, .4], [.75, .4]], dtype=np.float32))
        with patch('semantic_map.rerank_saved_sources.active_city_configs', return_value=[{'id': 'london', 'dataset_id': 'london_512'}]):
            return SavedRerankSources(None, root)

    def test_saved_columns_preserve_identity_and_standardize_without_embedding(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog = self.make_catalog(Path(directory))
            refs = list(catalog.references())
            first = catalog.resolve(refs[0][0])
            self.assertEqual([r.pano_id for r in first['records']], ['7', '9'])
            np.testing.assert_array_equal(first['scores'], [.25, .75])
            np.testing.assert_array_equal(first['zscores'], [-1, 1])
            np.testing.assert_array_equal(catalog.resolve(refs[1][0])['zscores'], [0, 0])
            self.assertIs(catalog.resolve(refs[0][0])['scores'], first['scores'])

    def test_refuses_changed_revision_and_noncurrent_embedding(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog = self.make_catalog(Path(directory))
            ref, _ = next(catalog.references())
            for changes in ({'result_revision': 'wrong'}, {'embedding': 'old'}, {'prompt_id': 'saved-99'}):
                with self.assertRaises(ValueError):
                    catalog.resolve(dict(ref, **changes))
