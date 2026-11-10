import sys
from pathlib import Path
import unittest
import json
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import experiment_potato_layout as experiment

class LayoutTests(unittest.TestCase):
    def test_alignment_uses_one_scale_and_preserves_distances(self):
        g=np.random.default_rng(3).normal(size=(20,2))
        rotated=g @ np.array([[0.,1.],[-1.,0.]])*5+9
        np.testing.assert_allclose(experiment.align_to_geography(rotated,g),g,atol=1e-6)

    def test_geographic_gradient_matches_finite_difference(self):
        g=np.array([[0.,0.],[1.,.2],[1.,1.]],np.float64)
        y=g+np.array([[.2,.1],[-.1,.3],[.2,-.2]])
        edges=np.array([[0,1],[1,2]],np.int32);w=np.array([.7,.3])
        grad,_=experiment.geo_gradient(y,g,edges,w)
        for i in range(3):
            for j in range(2):
                plus=y.copy();minus=y.copy();plus[i,j]+=1e-6;minus[i,j]-=1e-6
                numerical=(experiment.geo_gradient(plus,g,edges,w)[1]-experiment.geo_gradient(minus,g,edges,w)[1])/2e-6
                self.assertAlmostEqual(numerical,grad[i,j],places=5)
        _,loss=experiment.geo_gradient(g,g,edges,w)
        self.assertEqual(loss,0.)

    def test_gaussian_support_does_not_fill_gap_between_islands(self):
        rng=np.random.default_rng(4)
        xy=np.vstack([rng.normal(scale=.03,size=(100,2)),rng.normal(scale=.03,size=(100,2))+[4,0]])
        result=experiment.gaussian_regions(xy,np.zeros(200,dtype=int),np.array([[40,100,180]]),bandwidth=.1,size=128)
        json.dumps(result,allow_nan=False)
        self.assertEqual(len(result['regions']),2)
        for region in result['regions']:
            xx=np.array(region['xy'])[:,0]
            self.assertTrue(xx.max()<1 or xx.min()>3)

if __name__=='__main__': unittest.main()
