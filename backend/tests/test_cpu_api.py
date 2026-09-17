import json
import os
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient

from semantic_map.backend_config import get_backend_settings
from semantic_map.cpu_api import create_app
from semantic_map.tile_math import latlon_to_tile


class CpuMapTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.env = patch.dict(os.environ, {'CPU_CACHE_ROOT': str(root/'cache'), 'BACKEND_TOKEN': ''})
        self.env.start()
        get_backend_settings.cache_clear()
        self.settings = replace(get_backend_settings(), workspace_root=root, default_dataset_id='london_224_8_45',
                                default_dataset_ids=('london_224_8_45',), active_city_ids=('london',), tile_zooms=(10,11,12,13))
        exp = root/'experiments/london_embedding_comparison_20260917'
        exp.mkdir(parents=True)
        (exp/'status.json').write_text(json.dumps({'stage':'complete'}))
        (exp/'prompts.json').write_text(json.dumps([{'index':0,'prompt':'a brick facade'}]))
        np.savez(exp/'alignment.npz', refs=np.array([[10,-.12,51.5,202001],[11,-.121,51.501,202002]]))
        np.save(exp/'score_new4096.npy', np.array([[.2],[.8]], dtype=np.float32))
        self.client = TestClient(create_app(self.settings, root/'experiments'))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None)
        self.env.stop()
        get_backend_settings.cache_clear()
        self.tmp.cleanup()

    def test_existing_prompt_and_tile_preserve_identity_and_score(self):
        job = self.client.post('/api/scoring/jobs', json={'prompt':'A BRICK FACADE'}).json()
        self.assertEqual(job['status'], 'ready')
        ref = job['results'][0]
        manifest = self.client.get(ref['manifest_url']).json()
        self.assertEqual(manifest['stats']['count'], 2)
        tile = latlon_to_tile(lat_deg=51.5, lon_deg=-.12,z=13)
        url = ref['tile_url_template'].format(z=13,x=tile.x,y=tile.y)
        result = self.client.get(url)
        self.assertEqual(result.status_code,200)
        points = {p['properties']['pano_id']:p for p in result.json()['features']}
        self.assertAlmostEqual(points['10']['properties']['score'], .2)
        self.assertEqual(points['10']['geometry']['coordinates'],[-.12,51.5])
        self.assertEqual(self.client.get(url).content,result.content)

    def test_cpu_rejects_generation_and_missing_city(self):
        for request in ({'prompt':'new unknown prompt'}, {'prompt':'a brick facade','force_override':True},
                        {'prompt':'a brick facade','query_type':'pano_reference'}):
            self.assertEqual(self.client.post('/api/scoring/jobs',json=request).status_code,403)
        self.assertEqual(self.client.post('/api/scoring/jobs',json={'prompt':'a brick facade','dataset_id':'unknown'}).status_code,404)

    def test_search_and_batch(self):
        self.assertEqual(len(self.client.get('/api/scoring/prompts?q=BRICK').json()['prompts']),1)
        self.assertEqual(self.client.get('/api/scoring/prompts?q=missing').json()['prompts'],[])
        response = self.client.post('/api/scoring/jobs/batch',json={'queries':[{'prompt':'a brick facade'},{'prompt':'unknown'}]}).json()
        self.assertEqual([x['status'] for x in response['queries']],['accepted','rejected'])
        self.assertEqual(self.client.get('/api/capabilities').json()['mode'],'cpu')

    def test_invalid_revision_and_tile(self):
        ref = self.client.post('/api/scoring/jobs',json={'prompt':'a brick facade'}).json()['results'][0]
        self.assertEqual(self.client.get(ref['manifest_url'].replace(ref['result_revision'],'stale')).status_code,404)
        self.assertEqual(self.client.get(ref['tile_url_template'].format(z=30,x=0,y=0)).status_code,400)


if __name__ == '__main__':
    unittest.main()
