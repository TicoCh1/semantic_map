import sys,unittest
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from potato_bng_grid import BngGrid,density_fields,density_support,partition

class BngGridTests(unittest.TestCase):
    def test_exact_square_cells_and_global_alignment(self):
        grid=BngGrid.covering((530012.7,180017.3,550012.7,200017.3))
        self.assertEqual(grid.cell_meters,50)
        self.assertEqual(grid.west%50,0);self.assertEqual(grid.south%50,0)
        self.assertEqual(grid.metadata()['cellAreaMeters2'],2500)
        points=np.array([[531025.,181025.],[531075.,181025.]])
        fields=density_fields(points,np.array([0,0]),1,grid,100)
        self.assertAlmostEqual(fields.sum(),2)
        self.assertAlmostEqual(grid.cell_meters*(100/grid.cell_meters),100)

    def test_100_percent_keeps_positive_density_but_no_zero_evidence(self):
        fields=np.array([[[4.,1.,0.],[2.,3.,0.]]])
        support,cutoff,total=density_support(fields,1)
        self.assertEqual(cutoff,0)
        np.testing.assert_array_equal(support,total>0)
        self.assertEqual(total[support].sum(),total.sum())
        support90,_,_=density_support(fields,.9)
        self.assertGreaterEqual(total[support90].sum()/total.sum(),.9)

    def test_removed_enclosed_island_is_reassigned_without_a_hole(self):
        fields=np.ones((2,10,10));fields[0]*=2
        fields[1,4:6,4:6]=3
        support=np.ones((10,10),bool)
        old,oldstats=partition(fields,support,reassign=False)
        self.assertEqual(np.count_nonzero(old<0),4)
        owner,stats=partition(fields,support)
        self.assertTrue((owner==0).all())
        self.assertEqual(stats['reassignedCells'],4)
        self.assertEqual(stats['isolatedUnassignedCells'],0)

    def test_reassignment_uses_adjacent_class_density_and_never_leaves_support(self):
        fields=np.zeros((3,10,12));fields[0,:,:6]=5;fields[1,:,6:]=5
        fields[0,4:6,5:7]=1;fields[1,4:6,5:7]=3;fields[2,4:6,5:7]=8
        support=np.ones((10,12),bool);support[0,0]=False
        owner,stats=partition(fields,support)
        self.assertTrue((owner[4:6,5:7]==1).all())
        self.assertEqual(owner[0,0],-1)
        self.assertEqual(stats['minimumCells'],20)
        self.assertEqual(stats['minimumAreaMeters2'],50000)

    def test_points_outside_grid_fail_instead_of_being_clamped(self):
        grid=BngGrid.covering((0,0,100,100),padding_meters=0)
        with self.assertRaises(ValueError):
            density_fields(np.array([[100.,100.]]),np.array([0]),1,grid,100)

if __name__=='__main__':unittest.main()
