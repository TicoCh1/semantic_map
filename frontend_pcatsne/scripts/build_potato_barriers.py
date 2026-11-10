"""Cache OSM water/park geometry and clip existing GIS bubbles, without refitting."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

import numpy as np
from pyproj import Transformer
from shapely import contains_xy,make_valid
from shapely.geometry import LineString,Polygon,shape,mapping
from shapely.geometry.polygon import orient
from shapely.ops import clip_by_rect,polygonize,transform,unary_union
from shapely.strtree import STRtree

from export_potato_gis import polygon_parts

ENDPOINTS=['https://overpass.private.coffee/api/interpreter',
           'https://overpass-api.de/api/interpreter']
PARK_TAGS=('park','garden','nature_reserve','recreation_ground')

def query_for(bounds):
    b=bounds
    bbox=f"({b['south']-.01},{b['west']-.015},{b['north']+.01},{b['east']+.015})"
    clauses=[f'wr["natural"="water"]{bbox};',f'wr["waterway"="riverbank"]{bbox};',
             f'wr["leisure"~"^(park|garden|nature_reserve|recreation_ground)$"]{bbox};',
             f'wr["landuse"="recreation_ground"]{bbox};',
             f'way["waterway"~"^(river|canal)$"]{bbox};']
    return '[out:json][timeout:180];('+''.join(clauses)+');out geom;'

def fetch(query,cache):
    errors=[]
    for endpoint in ENDPOINTS:
        try:
            request=urllib.request.Request(endpoint,urllib.parse.urlencode({'data':query}).encode(),
                headers={'User-Agent':'UrbanFabric-geographic-bubbles/1.0','Content-Type':'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(request,timeout=210) as response:
                data=json.load(response)
            if data.get('remark'): raise RuntimeError(data['remark'])
            if not data.get('elements'): raise RuntimeError('Empty OSM response')
            data['urbanfabricSource']={'endpoint':endpoint,'retrievedAt':datetime.now(timezone.utc).isoformat(),'query':query}
            cache.parent.mkdir(parents=True,exist_ok=True)
            cache.write_text(json.dumps(data),encoding='utf-8')
            print(f"Cached {len(data['elements'])} OSM objects from {endpoint}",flush=True)
            return data
        except Exception as error:
            errors.append(f'{endpoint}: {error}')
            print(errors[-1],flush=True)
    raise RuntimeError('; '.join(errors))

def ring_coordinates(geometry):
    return [(p['lon'],p['lat']) for p in geometry if p is not None]

def osm_area(element):
    if element['type']=='way':
        xy=ring_coordinates(element.get('geometry',[]))
        return make_valid(Polygon(xy)) if len(xy)>=4 and xy[0]==xy[-1] else Polygon()
    outer=[];inner=[]
    for member in element.get('members',[]):
        if member['type']!='way': continue
        xy=ring_coordinates(member.get('geometry',[]))
        if len(xy)<2: continue
        (inner if member.get('role')=='inner' else outer).append(LineString(xy))
    # Full member geometry is fetched; do not close missing segments with chords.
    shells=unary_union(list(polygonize(unary_union(outer))))
    holes=unary_union(list(polygonize(unary_union(inner))))
    return make_valid(shells.difference(holes))

def width_meters(tags):
    value=tags.get('width',tags.get('est_width',''))
    if re.fullmatch(r'\s*\d+(?:\.\d+)?\s*(?:m)?\s*',value):
        return max(2,min(200,float(re.findall(r'\d+(?:\.\d+)?',value)[0]))),False
    return (20 if tags.get('waterway')=='river' else 12),True

def cut_bubble(geometry,mask):
    """Final boolean subtraction: no smoothing afterwards can refill barriers."""
    return make_valid(geometry.difference(mask))

def nearby_mask(geometry,parts,tree,padding=.1):
    """Use only barrier fragments near this bubble; retain exact mask edges."""
    west,south,east,north=geometry.bounds
    bounds=(west-padding,south-padding,east+padding,north+padding)
    return unary_union([make_valid(clip_by_rect(parts[int(i)],*bounds)) for i in tree.query(geometry)])

def clipped_features(originals,mask,project,inverse,positions,clusters,mode):
    parts=list(polygon_parts(mask));tree=STRtree(parts)
    geographic_mask=make_valid(transform(inverse,mask))
    geo_parts=list(polygon_parts(geographic_mask));geo_tree=STRtree(geo_parts)
    features=[]
    for original in originals:
        original_metric=transform(project,shape(original['geometry']))
        cut=cut_bubble(original_metric,nearby_mask(original_metric,parts,tree))
        props=original['properties'];group=props['group'];own=positions[clusters==group-1]
        for part,p in enumerate(polygon_parts(cut)):
            if p.area<25: continue
            geographic=make_valid(transform(inverse,orient(p)))
            final_mask=nearby_mask(geographic,geo_parts,geo_tree,padding=1e-8)
            geographic=cut_bubble(geographic,final_mask)
            for suffix,wgs in enumerate(polygon_parts(geographic)):
                metric_piece=make_valid(transform(project,wgs))
                if metric_piece.area<25: continue
                features.append(dict(type='Feature',id=f"{original['id']}-{part}-{suffix}",
                    properties={**props,'areaKm2':round(metric_piece.area/1e6,3),
                        'labelPoint':list(wgs.representative_point().coords[0]),
                        'showLabel':False,'barriers':mode,
                        'matchingPoints':int(contains_xy(metric_piece,own[:,0],own[:,1]).sum())},
                    geometry=mapping(orient(wgs))))
    for group in set(f['properties']['group'] for f in features):
        own=[f for f in features if f['properties']['group']==group]
        max(own,key=lambda f:shape(f['geometry']).area)['properties']['showLabel']=True
    return features

def build(base,source,cache,allow_fetch=False,vector_cache=None):
    manifest=json.loads((base/'manifest.json').read_text())
    if vector_cache: data=json.loads(vector_cache.read_text());data['elements']=[]
    elif cache.exists(): data=json.loads(cache.read_text())
    elif allow_fetch: data=fetch(query_for(manifest['bounds']),cache)
    else: raise FileNotFoundError('OSM cache missing: use --fetch to retrieve it')
    project=Transformer.from_crs(4326,27700,always_xy=True).transform
    inverse=Transformer.from_crs(27700,4326,always_xy=True).transform
    extent=transform(project,shape(json.loads((base/'extent.geojson').read_text())['features'][0]['geometry']))
    source_features=[];water=[];parks=[];lines=[];skipped=[]
    for feature in data.get('features',[]):
        props=feature['properties'];geometry=transform(project,make_valid(shape(feature['geometry'])))
        if props.get('centerlineSupplement'):
            lines.append((geometry.buffer(props['widthMeters']/2),props))
            continue
        geometry=make_valid(geometry.intersection(extent))
        if geometry.is_empty: continue
        (water if props['kind']=='water' else parks).append(geometry)
        source_features.append(dict(type='Feature',geometry=mapping(transform(inverse,geometry)),properties=props))
    for element in data['elements']:
        tags=element.get('tags',{})
        kind='water' if tags.get('natural')=='water' or tags.get('waterway')=='riverbank' else 'park'
        is_area=kind=='water' or tags.get('leisure') in PARK_TAGS or tags.get('landuse')=='recreation_ground'
        if is_area:
            geometry=osm_area(element)
            if geometry.is_empty:
                skipped.append(f"{element['type']}/{element['id']}");continue
            geometry=make_valid(transform(project,geometry).intersection(extent))
            if geometry.is_empty: continue
            (water if kind=='water' else parks).append(geometry)
            source_features.append(dict(type='Feature',geometry=mapping(transform(inverse,geometry)),
                properties=dict(kind=kind,name=tags.get('name',''),osmType=element['type'],osmId=element['id'],
                                estimated=False)))
        elif element['type']=='way' and tags.get('waterway') in ('river','canal'):
            # Covered/tunnelled waterways are not visible landcover barriers.
            if tags.get('tunnel') not in (None,'no') or tags.get('covered')=='yes': continue
            xy=ring_coordinates(element.get('geometry',[]))
            if len(xy)<2: continue
            width,estimated=width_meters(tags)
            line=transform(project,LineString(xy))
            lines.append((line.buffer(width/2),dict(kind='water',name=tags.get('name',''),osmType='way',
                osmId=element['id'],widthMeters=width,estimated=estimated,centerlineSupplement=True)))
    water_area=unary_union(water)
    for geometry,properties in lines:
        supplement=make_valid(geometry.difference(water_area).intersection(extent))
        if supplement.is_empty: continue
        water.append(supplement)
        source_features.append(dict(type='Feature',geometry=mapping(transform(inverse,supplement)),
            properties=properties))
    masks={'water':unary_union(water),'parks':unary_union(water+parks)}
    mask_parts={mode:list(polygon_parts(mask)) for mode,mask in masks.items()}
    mask_trees={mode:STRtree(parts) for mode,parts in mask_parts.items()}
    geographic_masks={mode:make_valid(transform(inverse,mask)) for mode,mask in masks.items()}
    geographic_parts={mode:list(polygon_parts(mask)) for mode,mask in geographic_masks.items()}
    geographic_trees={mode:STRtree(parts) for mode,parts in geographic_parts.items()}
    print(f'GIS masks ready: {len(source_features)} source polygons/supplements',flush=True)
    if masks['water'].is_empty or not parks: raise RuntimeError('Missing water or park polygons')
    (base/'gis-landcover-source.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=source_features)),encoding='utf-8')
    # Dissolve tile overlap and seams to avoid repeated translucent fills.
    context=[dict(type='Feature',properties=dict(kind=kind),geometry=mapping(transform(inverse,geometry)))
             for kind,geometry in [('park',unary_union(parks)),('water',masks['water'])]]
    (base/'gis-landcover.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=context)),encoding='utf-8')
    mask_features=[dict(type='Feature',properties=dict(mode=mode),geometry=mapping(mask))
                   for mode,mask in geographic_masks.items()]
    (base/'gis-masks.geojson').write_text(json.dumps(dict(type='FeatureCollection',features=mask_features)),encoding='utf-8')
    with np.load(source/'source.npz') as source_data:
        # Geographic source is relative to the true BNG center.
        center=project(*manifest['centerLonLat'])
        positions=source_data['geography_km']*1000+np.asarray(center)
    clusters=np.fromfile(source/'clusters.bin','<u2')
    clipped_layers=[]
    for layer in manifest['bubbleLayers']:
        originals=json.loads((base/layer['regions']).read_text())['features']
        for mode,mask in masks.items():
            features=[]
            for original in originals:
                original_metric=transform(project,shape(original['geometry']))
                local=nearby_mask(original_metric,mask_parts[mode],mask_trees[mode])
                cut=cut_bubble(original_metric,local)
                props=original['properties'];group=props['group'];own=positions[clusters==group-1]
                for part,p in enumerate(polygon_parts(cut)):
                    if p.area<25: continue
                    # Reprojection can turn near-touching cut edges into bowties.
                    # Repair in the exported CRS, split repaired pieces, and label
                    # those actual exported polygons rather than the metric input.
                    geographic=make_valid(transform(inverse,orient(p)))
                    # Enforce the same boundary in the final GIS CRS as well:
                    # straight edges curve slightly when projected between CRSs.
                    final_mask=nearby_mask(geographic,geographic_parts[mode],geographic_trees[mode],padding=1e-8)
                    geographic=cut_bubble(geographic,final_mask)
                    for suffix,wgs in enumerate(polygon_parts(geographic)):
                        metric_piece=make_valid(transform(project,wgs))
                        if metric_piece.area<25: continue
                        label=list(wgs.representative_point().coords[0])
                        features.append(dict(type='Feature',id=f"{original['id']}-{part}-{suffix}",
                            properties={**props,'areaKm2':round(metric_piece.area/1e6,3),'labelPoint':label,
                                'showLabel':False,'barriers':mode,
                                'matchingPoints':int(contains_xy(metric_piece,own[:,0],own[:,1]).sum())},
                            geometry=mapping(orient(wgs))))
            for group in range(1,manifest['groups']+1):
                own=[f for f in features if f['properties']['group']==group]
                if own: max(own,key=lambda f:shape(f['geometry']).area)['properties']['showLabel']=True
            stem=Path(layer['regions']).stem+f'-{mode}'
            geojson=stem+'.geojson';label_file=stem+'-labels.geojson'
            (base/geojson).write_text(json.dumps(dict(type='FeatureCollection',features=features)),encoding='utf-8')
            labels=[dict(type='Feature',properties=f['properties'],geometry=dict(type='Point',coordinates=f['properties']['labelPoint']))
                    for f in features if f['properties']['showLabel']]
            (base/label_file).write_text(json.dumps(dict(type='FeatureCollection',features=labels)),encoding='utf-8')
            clipped_layers.append({**layer,'regions':geojson,'labels':label_file,'features':len(features),'barriers':mode})
            print(f'{stem}: {len(features)} pieces',flush=True)
    manifest['barrierLayers']=clipped_layers
    manifest['gisBarriers']={'landcover':'gis-landcover.geojson','masks':'gis-masks.geojson',
        'source':'OpenStreetMap contributors / Overpass API','license':'ODbL 1.0',
        'copyrightUrl':'https://www.openstreetmap.org/copyright',
        **data.get('urbanfabricSource',{}),'osmTimestamp':data.get('osm3s',{}).get('timestamp_osm_base'),
        'sourceGeometry':'gis-landcover-source.geojson','features':len(source_features),'waterAreaKm2':masks['water'].area/1e6,
        'parkAreaKm2':unary_union(parks).area/1e6,'skippedAreaObjects':skipped,
        'policy':'Final geographic polygon subtraction; mapped water and parks plus river/canal centerline supplements. No semantic refit.'}
    (base/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in manifest['gisBarriers'].items() if k!='query'},indent=2),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base',type=Path,required=True)
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--cache',type=Path,required=True)
    parser.add_argument('--fetch',action='store_true')
    parser.add_argument('--vector-cache',type=Path,help='Use the basemap vector-tile GeoJSON cache instead of Overpass')
    a=parser.parse_args();build(a.base,a.source,a.cache,a.fetch,a.vector_cache)
