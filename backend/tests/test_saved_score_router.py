import unittest
from types import SimpleNamespace
from pathlib import Path
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from semantic_map.saved_score_router import create_saved_score_router


@dataclass
class Settings:
    workspace_root: Path = Path('/tmp/saved-score-router-test')
    result_root: Path = Path('/tmp/native-results')
    tile_index_root: Path = Path('/tmp/native-index')
    tile_zooms: tuple = (12,)


class Catalog:
    def job(self, query):
        if query.prompt != 'trees' or query.force_override:
            raise HTTPException(403, 'Not saved')
        return dict(status='ready', results=[self.result_ref('london', 0)])

    def result_ref(self, dataset, column):
        base=f'/api/scoring/results/{dataset}/saved-{column}/revisions/rev'
        return dict(dataset_id=dataset, prompt_id=f'saved-{column}', result_revision='rev',
                    manifest_url=base+'/manifest', tile_url_template=base+'/tiles/{z}/{x}/{y}.geojson')

    def resolve(self, dataset, prompt_id):
        return dict(revision='rev', lookup={'trees':0}, index=SimpleNamespace(density_rule='none',density_base_zoom=12)), 0


class SavedRouterTests(unittest.TestCase):
    def setUp(self):
        self.created=0
        def factory():
            self.created+=1
            return Catalog()
        app=FastAPI()
        app.include_router(create_saved_score_router(Settings(),factory))
        self.client=TestClient(app)

    def test_saved_cohort_refs_keep_identity_and_route_to_saved_tiles(self):
        self.assertEqual(self.created,0)
        for _ in range(2):
            response=self.client.post('/api/scoring/saved/jobs/batch',json={'queries':[{'prompt':'trees'}]})
            self.assertEqual(response.status_code,200)
            job=response.json()['queries'][0]['job']
            self.assertEqual(job['status'],'ready')
            self.assertEqual(job['results'][0]['prompt_id'],'saved-0')
            self.assertEqual(job['results'][0]['result_revision'],'rev')
            self.assertTrue(job['tile_url_template'].startswith('/api/scoring/saved/results/'))
            self.assertEqual(job['manifest_url'],job['results'][0]['manifest_url'])
        self.assertEqual(self.created,1)

    def test_unknown_and_forced_prompts_rejected_for_native_fallback(self):
        result=self.client.post('/api/scoring/saved/jobs/batch',json={'queries':[
            {'prompt':'new'}, {'prompt':'trees','force_override':True}]}).json()
        self.assertEqual([item['status'] for item in result['queries']],['rejected','rejected'])

    def test_changed_revision_cannot_read_another_cohort(self):
        response=self.client.get('/api/scoring/saved/results/london/saved-0/revisions/stale/manifest')
        self.assertEqual(response.status_code,404)


if __name__ == '__main__':
    unittest.main()
