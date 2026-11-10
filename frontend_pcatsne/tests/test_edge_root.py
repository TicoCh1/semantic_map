"""Synthetic checks for isolated edge-root traversal; no production data."""
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import experiment_edge_root as experiment
import pca64_pacmap_neighbor_atlas as atlas
from test_neighbor_atlas import FakePaCMAP


class EdgeRootTests(unittest.TestCase):
    def test_traversal_reaches_center_from_edge(self):
        items=[(0,0,None,None),(1,0,None,None),(2,0,None,None)]
        self.assertEqual([(p[0],p[1]) for p in experiment.ordered_patches(items,(2,0))],[(2,0),(1,0),(0,0)])

    def test_unoccupied_root_rejected(self):
        with self.assertRaises(ValueError):
            experiment.ordered_patches([(0,0,None,None)],(5,0))

    def test_isolated_fit_export_and_matched_center(self):
        atlas.numpy()
        c=json.loads(atlas.DEFAULT_CONFIG.read_text())
        c['minimum_fit_rows']=4
        c['iterations']=[1,1,1]
        c['halo_meters']=500
        with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
            source,out=Path(tmp)/'source',Path(tmp)/'experiment'
            source.mkdir()
            center=atlas.mercator(np.asarray([c['center_lon_lat']]))[0]
            # Dense samples at both interfaces ensure a connected halo chain.
            offsets=np.concatenate([np.linspace(-1900,1900,20)+4000*gx for gx in range(3)])
            xy=center+np.column_stack([offsets,np.zeros(len(offsets))])
            refs=np.column_stack([np.arange(len(xy)),np.degrees(xy[:,0]/atlas.EARTH_RADIUS),
                                  np.degrees(2*np.arctan(np.exp(xy[:,1]/atlas.EARTH_RADIUS))-np.pi/2)])
            x=np.random.default_rng(7).normal(size=(len(xy),64)).astype(np.float32)
            np.save(source/'pca64.npy',x)
            atlas.atomic_npz(source/'source_rows.npz',xy=xy,reference=refs)
            atlas.atomic_json(source/'prepared.json',dict(rows=len(x)))
            atlas.fit_scales(c,source,[2],FakePaCMAP)
            baseline=(source/'patches/2km/0_0.npz').read_bytes()
            with patch.object(atlas,'pacmap_backend',return_value=FakePaCMAP):
                experiment.run(c,source,out,(2,0))
            self.assertEqual((source/'patches/2km/0_0.npz').read_bytes(),baseline)
            report=json.loads((out/'experiment_report.json').read_text())
            self.assertEqual(report['patches'][0]['grid'],[2,0])
            self.assertEqual(report['patches'][-1]['grid'],[0,0])
            self.assertTrue(all(p['max_shared_coordinate_drift']==0 for p in report['patches']))
            self.assertEqual(report['central_comparison']['original']['rows'],20)
            self.assertTrue((out/'pca64.npy').samefile(source/'pca64.npy'))
            self.assertEqual(json.loads((out/'viewer_data/manifest.json').read_text())['sourceRows'],60)


if __name__=='__main__':
    unittest.main()
