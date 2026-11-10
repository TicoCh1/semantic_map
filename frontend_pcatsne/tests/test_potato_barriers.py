import sys
from pathlib import Path
import unittest
from shapely.geometry import box
from shapely.strtree import STRtree
from shapely.ops import unary_union
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import build_potato_barriers as barriers
from export_potato_gis import polygon_parts

def member(xy,role):
    return dict(type='way',role=role,geometry=[dict(lon=x,lat=y) for x,y in xy])

class BarrierTests(unittest.TestCase):
    def test_river_splits_bubble_and_park_creates_hole(self):
        bubble=box(0,0,1000,1000);river=box(450,-100,550,1100)
        cut=barriers.cut_bubble(bubble,river)
        self.assertEqual(len(list(polygon_parts(cut))),2)
        self.assertEqual(cut.intersection(river).area,0)
        park=box(200,200,400,400)
        cut=barriers.cut_bubble(bubble,park)
        self.assertTrue(cut.is_valid)
        self.assertEqual(len(cut.interiors),1)
        self.assertEqual(cut.area,bubble.area-park.area)

    def test_multipolygon_joins_outer_segments_and_preserves_inner_island(self):
        element=dict(type='relation',members=[
            member([(0,0),(10,0),(10,10)],'outer'),
            member([(10,10),(0,10),(0,0)],'outer'),
            member([(3,3),(7,3),(7,7),(3,7),(3,3)],'inner')])
        area=barriers.osm_area(element)
        self.assertTrue(area.is_valid)
        self.assertEqual(area.area,84)
        self.assertEqual(len(area.interiors),1)

    def test_incomplete_osm_boundary_is_not_closed_with_fabricated_edge(self):
        element=dict(type='relation',members=[member([(0,0),(10,0),(10,10)],'outer')])
        self.assertTrue(barriers.osm_area(element).is_empty)
        self.assertEqual(barriers.width_meters({'waterway':'canal','width':'8 m'}),(8,False))
        self.assertEqual(barriers.width_meters({'waterway':'canal'}),(12,True))

    def test_spatially_clipped_mask_matches_full_mask_with_holes(self):
        bubble=box(0,0,1000,1000)
        parts=[box(450,-50000,550,50000),box(200,200,400,400).difference(box(250,250,350,350)),box(5000,5000,6000,6000)]
        local=barriers.nearby_mask(bubble,parts,STRtree(parts))
        self.assertTrue(barriers.cut_bubble(bubble,local).equals(barriers.cut_bubble(bubble,unary_union(parts))))

if __name__=='__main__': unittest.main()
