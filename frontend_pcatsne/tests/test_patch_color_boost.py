"""Check perceptual hue and degenerate colors, not production embeddings."""
from pathlib import Path
import sys
import unittest

import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_patch_color_boost import enhance, rgb_to_lab, lab_to_linear


class ColorBoostTests(unittest.TestCase):
    def test_hue_preserved_and_rgb_in_gamut(self):
        rgb=np.random.default_rng(42).integers(15,240,size=(500,3),dtype=np.uint8)
        results,stats=enhance(rgb)
        for mode,out in results.items():
            self.assertEqual(out.shape,rgb.shape)
            self.assertEqual(out.dtype,np.uint8)
            self.assertLess(stats['modes'][mode]['hue_error_max_degrees'],3.)
            linear=lab_to_linear(rgb_to_lab(out.astype(float)/255))
            self.assertTrue(np.all((linear>=-1e-6)&(linear<=1+1e-6)))

    def test_neutral_points_do_not_acquire_a_hue(self):
        levels=np.arange(20,230,dtype=np.uint8)
        rgb=np.repeat(levels[:,None],3,axis=1)
        results,_=enhance(rgb)
        for output in results.values():
            self.assertTrue(np.all(output.max(1)-output.min(1)<=1))

    def test_constant_patch_does_not_invent_internal_differences(self):
        rgb=np.tile(np.array([90,130,145],np.uint8),(25,1))
        results,_=enhance(rgb)
        for output in results.values():
            self.assertTrue(np.all(output==output[0]))


if __name__=='__main__':
    unittest.main()
