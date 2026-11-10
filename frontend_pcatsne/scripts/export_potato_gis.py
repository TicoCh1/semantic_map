"""Export geographic Gaussian envelopes as valid WGS84 GIS polygons.

Only geography-regions files are used. Semantic/mixed/joint layout positions
are never interpreted as geographic coordinates. No embedding is recomputed.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely import contains_xy, make_valid
from shapely.geometry import Polygon, box, mapping
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union


def signed_area(ring):
    a=np.asarray(ring)
    return float(np.sum(a[:-1,0]*a[1:,1]-a[1:,0]*a[:-1,1])/2)


def rings_to_geometry(regions, clip, coordinate_scale=1000):
    """Contour orientation distinguishes outer islands from holes."""
    if not regions: return Polygon()
    largest=max(regions,key=lambda r:abs(signed_area(r['xy'])))
    outer_sign=np.sign(signed_area(largest['xy']))
    outers=[];holes=[]
    for r in regions:
        if len(r['xy'])<4: continue
        polygon=make_valid(Polygon(np.asarray(r['xy'])*coordinate_scale))
        if polygon.is_empty: continue
        (outers if np.sign(signed_area(r['xy']))==outer_sign else holes).append(polygon)
    result=unary_union(outers)
    if holes: result=result.difference(unary_union(holes))
    return make_valid(result.intersection(clip))


def polygon_parts(geometry):
    if geometry.geom_type=='Polygon':
        if not geometry.is_empty: yield geometry
    elif hasattr(geometry,'geoms'):
        for child in geometry.geoms: yield from polygon_parts(child)


def soften_boundary(geometry, iterations=3):
    """Chaikin corner cutting on geographic rings, before enforcing separation."""
    def soften(ring):
        coords=np.asarray(ring.coords)[:-1,:2]
        for _ in range(iterations):
            following=np.roll(coords,-1,axis=0)
            q=.8*coords+.2*following;r=.2*coords+.8*following
            coords=np.stack((q,r),axis=1).reshape(-1,2)
        return np.vstack((coords,coords[0]))
    parts=[make_valid(Polygon(soften(p.exterior),[soften(h) for h in p.interiors]))
           for p in polygon_parts(geometry)]
    return make_valid(unary_union(parts))


def disjoint_regions(geometries):
    """Remove shared slivers caused by independently simplified input contours.

    Remove overlaps symmetrically instead of awarding them by cluster order.
    """
    return [make_valid(region.difference(unary_union(
        [other for j,other in enumerate(geometries) if j!=i and region.intersects(other)])))
        for i,region in enumerate(geometries)]


def rounded_bubble(geometry, gap_meters, radius_meters):
    """Round corners inside an inset; never expand into another semantic region.

    Disk opening removes grid stair-steps and narrow tendrils. Intersecting the
    result with the inset guarantees at least gap_meters between adjacent input
    regions, even when a smoothing operation would otherwise overshoot.
    """
    if gap_meters < 0 or radius_meters <= 0:
        raise ValueError('Gap must be nonnegative and rounding radius positive')
    inset=geometry.buffer(-gap_meters/2,quad_segs=12)
    if inset.is_empty: return Polygon()
    rounded=inset.buffer(-radius_meters,quad_segs=12).buffer(radius_meters,quad_segs=12)
    return make_valid(rounded.intersection(inset))


def export(source,native,output):
    output.mkdir(parents=True,exist_ok=True)
    m=json.loads((source/'manifest.json').read_text())
    assert m['selection']['crs']=='EPSG:27700'
    half=m['selection']['halfSideMeters']
    clip=box(-half,-half,half,half)
    forward=Transformer.from_crs(4326,27700,always_xy=True)
    inverse=Transformer.from_crs(27700,4326,always_xy=True)
    ce,cn=forward.transform(*m['centerLonLat'])
    def geographic(e,n,z=None): return inverse.transform(np.asarray(e)+ce,np.asarray(n)+cn)
    roi=mapping(transform(geographic,orient(clip)))
    (output/'extent.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=[dict(type='Feature',properties={},geometry=roi)])),encoding='utf-8')
    with np.load(source/'source.npz') as data:
        ids=data['ids'].copy();g=data['geography_km'].copy()*1000
    clusters=np.fromfile(source/'clusters.bin','<u2')
    assert len(clusters)==len(ids)==m['rows'] and len(np.unique(ids))==len(ids)
    # Original WebMercator coordinates are copied byte-for-byte for the point layer.
    dtype=np.dtype([('xy','<f4',(2,)),('rgba','u1',(4,))])
    full=np.fromfile(native,dtype=dtype)
    selected=full[ids].copy()
    selected.tofile(output/'points-native.bin')
    selected['rgba'][:,:3]=np.asarray(m['clusterColors'],np.uint8)[clusters]
    selected.tofile(output/'points-groups.bin')
    def features_for(geometries):
        features=[]
        for cluster,geometry in enumerate(geometries):
            pieces=list(polygon_parts(geometry))
            biggest=max((p.area for p in pieces),default=0)
            own=g[clusters==cluster]
            for island,p in enumerate(pieces):
                if p.area<1: continue
                wgs=transform(geographic,orient(p,sign=1.))
                assert wgs.is_valid and not wgs.is_empty
                label=geographic(*p.representative_point().coords[0])
                color=m['clusterColors'][cluster]
                feature=dict(type='Feature',id=f'{cluster}-{island}',
                    properties=dict(group=cluster+1,label=f'S{cluster+1}',
                                    color=f'rgb({color[0]},{color[1]},{color[2]})',
                                    areaKm2=round(p.area/1e6,3),
                                    matchingPoints=int(contains_xy(p,own[:,0],own[:,1]).sum()),
                                    labelPoint=list(label),showLabel=p.area==biggest),
                    geometry=mapping(wgs))
                features.append(feature)
        return features

    def write_layer(features,stem,bandwidth,**properties):
        path=f'{stem}.geojson'
        (output/path).write_text(json.dumps(dict(type='FeatureCollection',features=features),allow_nan=False),encoding='utf-8')
        labels=[dict(type='Feature',geometry=dict(type='Point',coordinates=f['properties']['labelPoint']),properties=f['properties'])
                for f in features if f['properties']['showLabel']]
        label_path=f'{stem}-labels.geojson'
        (output/label_path).write_text(json.dumps(dict(type='FeatureCollection',features=labels)),encoding='utf-8')
        return dict(bandwidthMeters=int(bandwidth*1000),regions=path,labels=label_path,features=len(features),**properties)

    layers=[];bubble_layers=[]
    for bandwidth in (.15,.3,.6):
        original=json.loads((source/f'geography-regions-{bandwidth:g}.json').read_text())
        geometries=[rings_to_geometry([r for r in original['regions'] if r['cluster']==cluster],clip)
                    for cluster in range(m['clusters'])]
        layers.append(write_layer(features_for(geometries),f'regions-{bandwidth:g}',bandwidth))
        exclusive=disjoint_regions([soften_boundary(g).intersection(clip) for g in geometries])
        radius=max(30,bandwidth*100)
        for gap in (40,80,120):
            bubbles=[rounded_bubble(gap_region,gap,radius) for gap_region in exclusive]
            bubble_layers.append(write_layer(features_for(bubbles),f'bubbles-{bandwidth:g}-{gap}',bandwidth,
                                             gapMeters=gap,roundingMeters=radius))
    envelope=transform(geographic,clip).bounds
    manifest=dict(dataset=m['dataset'],rows=m['rows'],groups=m['clusters'],centerLonLat=m['centerLonLat'],
                  bounds=dict(west=envelope[0],south=envelope[1],east=envelope[2],north=envelope[3]),
                  sourceSelection=m['selection'],crs='EPSG:4326',layers=layers,bubbleLayers=bubble_layers,
                  pointRecords=dict(recordBytes=12,native='points-native.bin',groups='points-groups.bin'),
                  policy='Fixed geographic XY + PCA64 semantic groups + geographic Gaussian density contours',
                  bubblePolicy='Chaikin ring smoothing (3 passes, 0.2 fraction) + symmetric overlap removal + metric half-gap inset + round disk opening + intersection with inset; display footprints only',
                  layoutDisplacementMeters=0)
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--native',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args();export(a.source,a.native,a.output)
