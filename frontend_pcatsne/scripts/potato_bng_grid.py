"""Geographic potato density on a fixed, globally aligned EPSG:27700 grid.

All coordinates, bandwidths and areas in this module are meters / square meters.
Longitude and latitude are an export concern, never raster coordinates.
"""
from dataclasses import dataclass
import math
import numpy as np
from scipy.ndimage import gaussian_filter, label, binary_dilation
from skimage.measure import find_contours, approximate_polygon

BNG_CRS = 'EPSG:27700'
CELL_METERS = 50
MIN_REGION_AREA_M2 = 50000


@dataclass(frozen=True)
class BngGrid:
    west: float
    south: float
    columns: int
    rows: int
    cell_meters: float = CELL_METERS

    @classmethod
    def covering(cls, bounds, cell_meters=CELL_METERS, padding_meters=2000):
        if cell_meters <= 0 or padding_meters < 0:
            raise ValueError('Cell size must be positive and padding nonnegative')
        west, south, east, north = map(float, bounds)
        if not np.isfinite(bounds).all() or west >= east or south >= north:
            raise ValueError('Invalid BNG bounds')
        lo = np.floor((np.array([west, south])-padding_meters)/cell_meters)*cell_meters
        hi = np.ceil((np.array([east, north])+padding_meters)/cell_meters)*cell_meters
        cols, rows = np.rint((hi-lo)/cell_meters).astype(int)
        return cls(float(lo[0]), float(lo[1]), int(cols), int(rows), float(cell_meters))

    def metadata(self):
        return dict(crs=BNG_CRS,cellSizeMeters=self.cell_meters,cellAreaMeters2=self.cell_meters**2,
                    originMeters=[self.west,self.south],shape=[self.rows,self.columns],
                    boundsMeters=[self.west,self.south,self.west+self.columns*self.cell_meters,
                                  self.south+self.rows*self.cell_meters],
                    coordinateConvention='Cell edges aligned to BNG multiples; contours at cell centers')


def density_fields(xy_meters, groups, group_count, grid, sigma_meters):
    xy = np.asarray(xy_meters, dtype=np.float64)
    groups = np.asarray(groups)
    if xy.shape != (len(groups),2) or not len(groups) or not np.isfinite(xy).all():
        raise ValueError('Expected nonempty finite BNG points and matching groups')
    if sigma_meters <= 0 or groups.min() < 0 or groups.max() >= group_count:
        raise ValueError('Invalid bandwidth or semantic group')
    pixels = np.floor((xy-[grid.west,grid.south])/grid.cell_meters).astype(int)
    if np.any(pixels < 0) or np.any(pixels >= [grid.columns,grid.rows]):
        raise ValueError('Points outside the fixed BNG grid; do not silently clamp')
    fields = np.zeros((group_count,grid.rows,grid.columns),dtype=np.float64)
    for c in range(group_count):
        own = pixels[groups==c]
        np.add.at(fields[c],(own[:,1],own[:,0]),1.)
        fields[c] = gaussian_filter(fields[c],sigma=sigma_meters/grid.cell_meters,
                                    mode='constant',truncate=4.)
    return fields


def density_support(fields, support_mass):
    if not 0 < support_mass <= 1:
        raise ValueError('Density mass must be in (0,1]')
    total = fields.sum(axis=0)
    if support_mass == 1:
        # A finite 4-sigma Gaussian can be exactly zero away from samples.
        # 100% of density mass does not assign zero-evidence cells to class 0.
        return total > 0, 0., total
    ordered = np.sort(total[total>0])[::-1]
    cumulative = np.cumsum(ordered,dtype=np.float64)
    index = min(int(np.searchsorted(cumulative,support_mass*cumulative[-1])),len(ordered)-1)
    cutoff = float(ordered[index])
    return total >= cutoff, cutoff, total


def partition(fields, support, cell_meters=CELL_METERS, minimum_area_m2=MIN_REGION_AREA_M2,
              reassign=True):
    """Merge small winning islands into adjacent retained classes before contouring.

    Each merge uses the sum of the candidate class's Gaussian evidence on that
    island. Candidates must share a four-neighbor boundary; no remote class can
    invent an isolated replacement. Never expand outside the density support.
    """
    if minimum_area_m2 < 0:
        raise ValueError('Minimum semantic area must be nonnegative')
    winner = fields.argmax(axis=0)
    owner = np.full(support.shape,-1,dtype=np.int16)
    pieces = []
    minimum_cells = math.ceil(minimum_area_m2/cell_meters**2)
    for c in range(len(fields)):
        components,n = label(support & (winner==c))
        sizes = np.bincount(components.ravel())
        for k in range(1,n+1):
            cells = np.flatnonzero(components.ravel()==k)
            if sizes[k] >= minimum_cells:
                owner.ravel()[cells] = c
            else:
                pieces.append((int(sizes[k]),c,cells))
    removed_cells = sum(p[0] for p in pieces)
    reassigned_cells = 0
    if reassign:
        # Stable largest-first passes permit neighboring small islands to merge
        # into the same surviving region without order-by-class favoritism.
        pending = sorted(pieces,key=lambda p:(-p[0],p[1],int(p[2][0])))
        while pending:
            deferred = []; changed = False
            for count,c,cells in pending:
                mask = np.zeros(support.shape,bool);mask.ravel()[cells] = True
                candidates = np.unique(owner[binary_dilation(mask)&~mask])
                candidates = candidates[candidates>=0]
                if not len(candidates):
                    deferred.append((count,c,cells));continue
                scores = fields.reshape(len(fields),-1)[candidates][:,cells].sum(axis=1)
                target = int(candidates[np.argmax(scores)])
                owner.ravel()[cells] = target
                reassigned_cells += count;changed = True
            if not changed:break
            pending = deferred
    return owner,dict(minimumAreaMeters2=minimum_area_m2,minimumCells=minimum_cells,
                      smallComponents=len(pieces),smallComponentCells=removed_cells,
                      reassignedCells=reassigned_cells,
                      isolatedUnassignedCells=int(np.count_nonzero(support & (owner<0))),
                      reassignment='Adjacent retained class with maximum integrated Gaussian density' if reassign else 'Disabled')


def regions_from_fields(fields, grid, colors, sigma_meters, support_mass=.9,
                        minimum_area_m2=MIN_REGION_AREA_M2, reassign=True):
    support,cutoff,total = density_support(fields,support_mass)
    owner,statistics = partition(fields,support,grid.cell_meters,minimum_area_m2,reassign)
    regions = []
    for c in range(len(fields)):
        components,n = label(owner==c)
        for k in range(1,n+1):
            mask = components==k
            for contour in find_contours(np.pad(mask.astype(float),1),.5):
                path = approximate_polygon(contour,tolerance=1.2)-1
                xy = np.array([grid.west,grid.south])+(path[:,::-1]+.5)*grid.cell_meters
                regions.append(dict(cluster=c,areaPixels=int(mask.sum()),xy=np.round(xy,3).tolist(),
                                    color=np.asarray(colors[c]).tolist()))
    stats = dict(statistics,cutoff=cutoff,supportCells=int(support.sum()),
                 retainedDensityMass=float(total[support].sum()/total.sum()),
                 assignedCells=int(np.count_nonzero(owner>=0)),sigmaPixels=sigma_meters/grid.cell_meters)
    return dict(coordinateSystem=BNG_CRS,coordinateUnits='meters',grid=grid.metadata(),
                bandwidthMeters=sigma_meters,supportMass=support_mass,statistics=stats,regions=regions)
