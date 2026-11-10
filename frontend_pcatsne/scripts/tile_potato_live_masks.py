"""Project cached GIS exclusions to BNG and tile on fixed 1 km boundaries."""
import json,math
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import shape,box,mapping
from shapely.ops import clip_by_rect,unary_union,transform
from shapely.strtree import STRtree
from export_potato_gis import polygon_parts

def tile_masks(base,spec=None):
    publish=spec is None
    if spec is None:spec=json.loads((base/'live-manifest.json').read_text())
    if spec['coordinateSystem']!='EPSG:27700':raise ValueError('Expected BNG live geometry')
    manifest=json.loads((base/'manifest.json').read_text())
    project=Transformer.from_crs(4326,27700,always_xy=True).transform
    b=spec['bounds'];tile_meters=1000;bounds=(b['west'],b['south'],b['east'],b['north'])
    for mask in spec['masks']:
        source=next(l for l in manifest['blobBarrierLayers'] if l['gapMeters']==mask['gapMeters'] and l['barriers']==mask['barriers'] and l['minGreenAreaMeters2']==mask['minGreenAreaMeters2'])
        geometry=make_valid(transform(project,shape(json.loads((base/source['mask']).read_text())['features'][0]['geometry'])))
        parts=list(polygon_parts(geometry));tree=STRtree(parts);tiles=[];pieces=[]
        for ix in range(math.floor(b['west']/tile_meters),math.ceil(b['east']/tile_meters)):
            for iy in range(math.floor(b['south']/tile_meters),math.ceil(b['north']/tile_meters)):
                cell=box(ix*tile_meters,iy*tile_meters,(ix+1)*tile_meters,(iy+1)*tile_meters).intersection(box(*bounds))
                for index in tree.query(cell):
                    cropped=make_valid(clip_by_rect(parts[int(index)],*cell.bounds))
                    for p in polygon_parts(cropped):
                        pieces.append(p);tiles.append(dict(bbox=list(p.bounds),coordinates=mapping(p)['coordinates']))
        expected=geometry.intersection(box(*bounds))
        error=unary_union(pieces).symmetric_difference(expected).area
        assert error<.01,(mask['mask'],error)
        (base/mask['mask']).write_text(json.dumps(tiles,separators=(',',':')),encoding='utf-8')
        print(f"{mask['mask']}: {len(tiles)} BNG parts; seam error {error:.6f} m2",flush=True)
    spec['maskTileMeters']=tile_meters
    if publish:(base/'live-manifest.json').write_text(json.dumps(spec,separators=(',',':')),encoding='utf-8')

if __name__=='__main__':
    import argparse
    from pathlib import Path
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base',type=Path,required=True)
    tile_masks(p.parse_args().base)

