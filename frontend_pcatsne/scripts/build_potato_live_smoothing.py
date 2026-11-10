"""Build live geographic potato density on a fixed 50 m British National Grid."""
import argparse,json,time
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely.geometry import box,mapping
from shapely.geometry.polygon import orient
from export_potato_gis import rings_to_geometry,soften_boundary,disjoint_regions,rounded_bubble,polygon_parts
from potato_bng_grid import BngGrid,density_fields,regions_from_fields,BNG_CRS

VERSION='live-bng-50m-v1'
def write(path,data):
    path.write_text(json.dumps(data,separators=(',',':'),allow_nan=False),encoding='utf-8')

def build(base,source,publish=False):
    started=time.perf_counter()
    original=json.loads((source/'manifest.json').read_text())
    manifest=json.loads((base/'manifest.json').read_text())
    if original['selection']['crs']!=BNG_CRS:raise ValueError('Source must be British National Grid')
    output=base/VERSION;output.mkdir(exist_ok=True)
    center=np.array(Transformer.from_crs(4326,27700,always_xy=True).transform(*original['centerLonLat']))
    with np.load(source/'source.npz') as data:
        metric=data['geography_km'].astype(np.float64)*1000+center
    groups=np.fromfile(source/'clusters.bin','<u2')
    palette=np.array(original['clusterColors'],np.uint8)
    half=original['selection']['halfSideMeters'];extent=box(*(center-half),*(center+half))
    grid=BngGrid.covering(extent.bounds,padding_meters=2000)
    points=np.empty(len(groups),dtype=[('xy','<f8',(2,)),('group','<u2')])
    points['xy']=metric;points['group']=groups;points.tofile(output/'points.bin')
    frames=[]
    for meters in range(100,501,10):
        fields=density_fields(metric,groups,len(palette),grid,meters)
        for mass in (.9,1.):
            density=regions_from_fields(fields,grid,palette,meters,support_mass=mass)
            regions=[rings_to_geometry([r for r in density['regions'] if r['cluster']==c],extent,coordinate_scale=1) for c in range(len(palette))]
            exclusive=disjoint_regions([soften_boundary(g).intersection(extent) for g in regions])
            for gap in (40,80,120):
                features=[]
                for c,geometry in enumerate(exclusive):
                    for i,p in enumerate(polygon_parts(rounded_bubble(geometry,gap,max(30,meters/10)))):
                        if p.area<=0:continue
                        features.append(dict(type='Feature',id=f'{c}-{i}',geometry=mapping(orient(p)),
                            properties=dict(group=c+1,label=f'S{c+1}',color='rgb('+','.join(str(int(v)) for v in palette[c])+')')))
                file=f'{VERSION}/bubbles-{meters}-{gap}-{int(mass*100)}.json'
                write(base/file,dict(type='FeatureCollection',coordinateSystem=BNG_CRS,features=features))
                frames.append(dict(bandwidthMeters=meters,gapMeters=gap,supportMass=mass,regions=file,
                                   features=len(features),densityStatistics=density['statistics']))
        print(f'{meters} m: cached 90% / 100%, all three gaps ({time.perf_counter()-started:.1f}s)',flush=True)
    bounds=dict(zip(('west','south','east','north'),extent.bounds))
    masks=[]
    for gap in (40,80,120):
        for mode in ('water','parks'):
            for minimum in ((10000,) if mode=='water' else (5000,10000,30000)):
                file=f'{VERSION}/mask-{mode}-{minimum}-{gap}.json'
                masks.append(dict(barriers=mode,minGreenAreaMeters2=minimum,gapMeters=gap,mask=file,greenClearanceMeters=gap/2+60))
    live=dict(version=VERSION,coordinateSystem=BNG_CRS,displayCoordinateSystem='EPSG:4326',grid=grid.metadata(),
        minMeters=100,maxMeters=500,stepMeters=10,defaultMeters=500,defaultSupportMass=.9,supportMassOptions=[.9,1.],
        minimumRegionAreaMeters2=50000,frames=frames,masks=masks,points=f'{VERSION}/points.bin',
        pointRecordBytes=18,groups=len(palette),rows=len(groups),bounds=bounds,displayBounds=manifest['bounds'],
        policy='Fixed BNG 50 m square grid; Gaussian sigma in meters; 90% or 100% positive density mass; '
               'merge sub-50000 m2 islands by adjacent Gaussian evidence before contouring; '
               'BNG GIS subtraction and area; no final positive-area fragment deletion.')
    from tile_potato_live_masks import tile_masks
    tile_masks(base,live)
    write(output/'manifest.json',live)
    if publish:write(base/'live-manifest.json',live)
    print(f'BNG cache complete: {len(frames)} frames in {time.perf_counter()-started:.1f}s',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base',type=Path,required=True);p.add_argument('--source',type=Path,required=True)
    p.add_argument('--publish',action='store_true',help='Normally validate/cache views before publishing')
    args=p.parse_args();build(args.base,args.source,args.publish)

