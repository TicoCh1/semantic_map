"""Filter small green spaces and style geographic water/park polygons as blobs."""
import argparse
import json
from pathlib import Path
import numpy as np
from pyproj import Transformer
from shapely import make_valid,segmentize
from shapely.geometry import Polygon,shape,mapping
from shapely.geometry.polygon import orient
from shapely.ops import transform,unary_union
from export_potato_gis import polygon_parts,soften_boundary
from build_potato_barriers import clipped_features

def filter_green(geometry,minimum):
    """Filter dissolved geographic components, never tile fragments."""
    return unary_union([p for p in polygon_parts(geometry) if p.area>=minimum])

def major_water(geometry):
    """Keep the largest broad channel; remove narrow canal links and ponds."""
    # Generalized water polygons pinch or break at bridge decks. Reconnect
    # those short gaps before removing long, narrow canal connections.
    connected=geometry.buffer(75,quad_segs=8).buffer(-75,quad_segs=8)
    opened=make_valid(connected.buffer(-35,quad_segs=8).buffer(35,quad_segs=8))
    parts=list(polygon_parts(opened))
    if not parts: raise ValueError('No major water channel survives the width filter')
    return max(parts,key=lambda p:p.area)

def landcover_blob(geometry,kind):
    results=[]
    for p in polygon_parts(geometry):
        if p.area<25: continue
        # Closing smooths small notches/holes. Water avoids erosion so narrow
        # canals survive; green spaces receive rounded exterior corners too.
        radius=12 if kind=='water' else 25
        rounded=p.buffer(radius,quad_segs=8).buffer(-radius,quad_segs=8)
        if kind=='park': rounded=rounded.buffer(-15,quad_segs=8).buffer(15,quad_segs=8)
        rounded=segmentize(rounded.simplify(6,preserve_topology=True),60)
        results.append(soften_boundary(rounded,iterations=2))
    return make_valid(unary_union(results))

def write_json(path,value):
    path.write_text(json.dumps(value,allow_nan=False),encoding='utf-8')

def build(base,source):
    manifest=json.loads((base/'manifest.json').read_text())
    project=Transformer.from_crs(4326,27700,always_xy=True).transform
    inverse=Transformer.from_crs(27700,4326,always_xy=True).transform
    context=json.loads((base/'gis-landcover.geojson').read_text())['features']
    original={f['properties']['kind']:make_valid(transform(project,shape(f['geometry']))) for f in context}
    # Water takes precedence inside park outlines. Filtering is based on the
    # full park component's area before water holes or display rounding.
    retained_water=major_water(original['water'])
    water=landcover_blob(retained_water,'water')
    extent=transform(project,shape(json.loads((base/'extent.geojson').read_text())['features'][0]['geometry']))
    water=make_valid(water.intersection(extent))
    with np.load(source/'source.npz') as data:
        positions=data['geography_km']*1000+np.asarray(project(*manifest['centerLonLat']))
    clusters=np.fromfile(source/'clusters.bin','<u2')
    landcovers=[];layers=[]
    for minimum in (5000,10000,30000):
        kept=filter_green(original['park'],minimum)
        park=landcover_blob(kept,'park').difference(water.buffer(10)).intersection(extent)
        features=[]
        for kind,geometry,color in [('water',water,'#3a91bd'),('park',park,'#56a76b')]:
            for i,p in enumerate(polygon_parts(make_valid(transform(inverse,geometry)))):
                metric=transform(project,p)
                if metric.area<25: continue
                features.append(dict(type='Feature',id=f'{kind}-{i}',geometry=mapping(orient(p)),
                    properties=dict(kind=kind,color=color,areaKm2=metric.area/1e6,display='Geographic blob')))
        file=f'landcover-blobs-{minimum}.geojson'
        write_json(base/file,dict(type='FeatureCollection',features=features))
        landcovers.append(dict(minGreenAreaMeters2=minimum,landcover=file,
            greenComponentsKept=len(list(polygon_parts(kept))),
            greenComponentsIgnored=len(list(polygon_parts(original['park'])))-len(list(polygon_parts(kept))),
            greenAreaKm2=kept.area/1e6))
        for layer in manifest['bubbleLayers']:
            originals=json.loads((base/layer['regions']).read_text())['features']
            # Reserve the true retained barrier AND its stylized shape. Give
            # water half the semantic gap; parks receive 60 m more clearance.
            clearance=layer['gapMeters']/2
            water_mask=unary_union([retained_water,water]).buffer(clearance)
            masks={'water':water_mask,
                   'parks':unary_union([water_mask,unary_union([kept,park]).buffer(clearance+60)])}
            for mode,mask in masks.items():
                if mode=='water' and minimum!=10000: continue
                clipped=clipped_features(originals,mask,project,inverse,positions,clusters,mode)
                stem=Path(layer['regions']).stem+f'-blob-{mode}-{minimum}'
                regions=stem+'.geojson';labels=stem+'-labels.geojson';maskfile=stem+'-mask.geojson'
                write_json(base/regions,dict(type='FeatureCollection',features=clipped))
                label_features=[dict(type='Feature',properties=f['properties'],
                    geometry=dict(type='Point',coordinates=f['properties']['labelPoint']))
                    for f in clipped if f['properties']['showLabel']]
                write_json(base/labels,dict(type='FeatureCollection',features=label_features))
                write_json(base/maskfile,dict(type='FeatureCollection',features=[dict(type='Feature',
                    properties={},geometry=mapping(make_valid(transform(inverse,mask))))]))
                layers.append({**layer,'regions':regions,'labels':labels,'features':len(clipped),
                    'barriers':mode,'minGreenAreaMeters2':minimum,'mask':maskfile,
                    'greenClearanceMeters':clearance+60})
                print(f'{stem}: {len(clipped)} semantic pieces',flush=True)
        print(f"Green area >= {minimum} m2: {landcovers[-1]['greenComponentsKept']} components",flush=True)
    manifest['blobBarrierLayers']=layers;manifest['landcoverBlobs']=landcovers
    manifest['landcoverBlobPolicy']='Area filter on dissolved green components before styling, default 3 ha; largest broad water channel after 75 m bridge closing and 35 m opening (Thames); green clearance is half grid gap plus 60 m; source positions and groups unchanged.'
    write_json(base/'manifest.json',manifest)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base',type=Path,required=True);p.add_argument('--source',type=Path,required=True)
    a=p.parse_args();build(a.base,a.source)
