import sys
from pathlib import Path
import unittest
from shapely.geometry import box
from shapely.ops import unary_union
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_potato_landcover_blobs import filter_green,landcover_blob,major_water

class BlobTests(unittest.TestCase):
    def test_major_water_removes_connected_canal_and_separate_pond(self):
        river=unary_union([box(0,0,475,150),box(525,0,1000,150)])
        canal=box(500,150,512,800)
        pond=box(1500,0,1600,100)
        major=major_water(unary_union([river,canal,pond]))
        self.assertTrue(major.contains(river.centroid))
        self.assertGreater(major.intersection(river).area,river.area*.9)
        self.assertFalse(major.intersects(box(502,400,510,700)))
        self.assertFalse(major.intersects(pond))

    def test_area_filter_keeps_merged_park_but_removes_small_separate_green(self):
        park=unary_union([box(0,0,60,100),box(60,0,120,100)])
        tiny=box(500,0,530,30)
        filtered=filter_green(unary_union([park,tiny]),10000)
        self.assertTrue(filtered.equals(park))

    def test_narrow_waterway_survives_and_green_is_rounded(self):
        canal=landcover_blob(box(0,0,1000,12),'water')
        self.assertTrue(canal.is_valid and canal.area>10000)
        green=landcover_blob(box(0,0,100,100),'park')
        self.assertTrue(green.is_valid and green.area>8000)
        self.assertLess(green.area,10000)

if __name__=='__main__':unittest.main()
