import sys
from pathlib import Path
import unittest
import numpy as np
from shapely.geometry import box,shape
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import export_potato_gis as gis

class GisTests(unittest.TestCase):
    def test_contour_holes_and_islands_stay_geographic(self):
        outer=[[0,0],[4,0],[4,4],[0,4],[0,0]]
        hole=[[1,1],[1,2],[2,2],[2,1],[1,1]]
        island=[[6,0],[7,0],[7,1],[6,1],[6,0]]
        geometry=gis.rings_to_geometry([dict(xy=p) for p in [outer,hole,island]],box(-1,-1,10000,10000))
        self.assertTrue(geometry.is_valid)
        self.assertEqual(len(list(gis.polygon_parts(geometry))),2)
        self.assertAlmostEqual(geometry.area,16*1e6)

    def test_roi_clips_density_spill_without_filling_holes(self):
        outer=[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]]
        geometry=gis.rings_to_geometry([dict(xy=outer)],box(-1000,-1000,1000,1000))
        self.assertEqual(geometry.bounds,(-1000,-1000,1000,1000))
        self.assertAlmostEqual(geometry.area,4e6)

    def test_rounded_neighbors_have_metric_gap_and_do_not_expand(self):
        left=box(0,0,1000,1000);right=box(1000,0,2000,1000)
        a=gis.rounded_bubble(left,80,60);b=gis.rounded_bubble(right,80,60)
        self.assertTrue(a.is_valid and b.is_valid)
        self.assertTrue(left.covers(a) and right.covers(b))
        self.assertGreaterEqual(a.distance(b),80-1e-6)
        self.assertLess(a.area,box(40,40,960,960).area)
        self.assertTrue(a.contains(box(200,200,800,800)))

    def test_rounding_keeps_holes_and_removes_too_thin_islands(self):
        original=box(0,0,2000,2000).difference(box(700,700,1300,1300))
        softened=gis.soften_boundary(original)
        self.assertTrue(softened.is_valid)
        self.assertEqual(len(softened.interiors),1)
        self.assertGreater(softened.area,original.area*.8)
        rounded=gis.rounded_bubble(original,80,60)
        self.assertTrue(rounded.is_valid)
        self.assertEqual(len(rounded.interiors),1)
        self.assertTrue(original.covers(rounded))
        self.assertTrue(gis.rounded_bubble(box(0,0,50,1000),80,60).is_empty)

    def test_simplified_overlap_is_removed_symmetrically_before_inset(self):
        inputs=[box(0,0,1020,1000),box(1000,0,2000,1000)]
        exclusive=gis.disjoint_regions(inputs)
        self.assertEqual(exclusive[0].bounds[2],1000)
        self.assertEqual(exclusive[1].bounds[0],1020)
        bubbles=[gis.rounded_bubble(p,80,60) for p in exclusive]
        self.assertGreaterEqual(bubbles[0].distance(bubbles[1]),80)

if __name__=='__main__': unittest.main()
