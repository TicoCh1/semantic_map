"""Display-only, patch-local lightness/saturation enhancement of saved RGB.

No dimensionality reduction or remote calls. Native binaries stay unchanged.
Oklab hue directions are retained; saturation is chroma / hue-specific gamut
limit at each lightness. Robust 2–98% ranges are stretched within each core.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from experiment_affine_colors import rgb_to_lab, lab_to_linear

RECORD=np.dtype([('xy','<f4',(2,)),('rgba','u1',(4,))])
MODES=('contrast','saturation','boost')


def chroma_limit(lightness, direction):
    low, high=np.zeros(len(lightness)),np.ones(len(lightness))
    for _ in range(24):
        mid=(low+high)/2
        lab=np.column_stack([lightness,direction*mid[:,None]])
        linear=lab_to_linear(lab)
        inside=np.all((linear>=0)&(linear<=1),axis=1)
        low=np.where(inside,mid,low)
        high=np.where(inside,high,mid)
    return low


def stretch(values, low, high):
    qlo,qhi=np.quantile(values,[.02,.98])
    if qhi-qlo<=1e-6:
        return values.copy(),[float(qlo),float(qhi)]
    return low+(high-low)*np.clip((values-qlo)/(qhi-qlo),0,1),[float(qlo),float(qhi)]


def encode(lab):
    linear=np.clip(lab_to_linear(lab),0,1)
    rgb=np.where(linear<=.0031308,12.92*linear,1.055*np.power(linear,1/2.4)-.055)
    return np.round(np.clip(rgb,0,1)*255).astype(np.uint8)


def enhance(rgb):
    lab=rgb_to_lab(rgb.astype(np.float64)/255)
    L=lab[:,0]
    C=np.linalg.norm(lab[:,1:],axis=1)
    direction=np.divide(lab[:,1:],C[:,None],out=np.zeros_like(lab[:,1:]),where=C[:,None]>1e-8)
    limit=chroma_limit(L,direction)
    saturation=np.divide(C,limit,out=np.zeros_like(C),where=limit>1e-8)
    saturation=np.clip(saturation,0,1)
    boosted_L,Lrange=stretch(L,.25,.90)
    boosted_S,Srange=stretch(saturation,.10,1.)
    if Srange[1]-Srange[0]<=1e-6:
        boosted_S=np.where(C>=.003,1.,saturation)
    # Do not turn quantized near-neutral RGB noise into strongly colored points.
    boosted_S=np.where(C>=.003,boosted_S,saturation)
    new_limit=chroma_limit(boosted_L,direction)
    labs=dict(contrast=np.column_stack([boosted_L,direction*(saturation*new_limit)[:,None]]),
              saturation=np.column_stack([L,direction*(boosted_S*limit)[:,None]]),
              boost=np.column_stack([boosted_L,direction*(boosted_S*new_limit)[:,None]]))
    result={k:encode(v) for k,v in labs.items()}
    stats=dict(lightness_quantiles=Lrange,saturation_quantiles=Srange,points=len(rgb),modes={})
    for mode,output in result.items():
        after=rgb_to_lab(output.astype(np.float64)/255)
        selected=(C>.02)&(np.linalg.norm(after[:,1:],axis=1)>.02)
        da=np.arctan2(after[:,2],after[:,1])-np.arctan2(lab[:,2],lab[:,1])
        angle=np.abs(np.degrees(np.arctan2(np.sin(da),np.cos(da))))[selected]
        stats['modes'][mode]=dict(oklab_variance=float(np.var(after,axis=0).sum()),
            hue_error_points=int(selected.sum()),
            hue_error_mean_degrees=float(angle.mean()) if len(angle) else None,
            hue_error_max_degrees=float(angle.max()) if len(angle) else None)
    return result,stats


def build(directory):
    manifest=json.loads((directory/'manifest.json').read_text())
    destination=directory/'color_boost'
    destination.mkdir(exist_ok=True)
    info=dict(colorSpace='Oklab / gamut-relative chroma',policy='patch-local-robust-contrast-saturation-v1',
              lightnessRange=[.25,.90],quantiles=[.02,.98],layers={},patches=[])
    for layer in manifest['layers']:
        full=np.fromfile(directory/layer['bin'],dtype=RECORD)
        groups={k:[] for k in MODES}
        center=None
        offset=0
        for p in layer['patches']:
            rows=np.fromfile(directory/layer['id']/p['bin'],dtype=RECORD)
            if not np.array_equal(rows,full[offset:offset+len(rows)]):
                raise ValueError('Grouped order differs from patch records')
            offset+=len(rows)
            enhanced,stats=enhance(rows['rgba'][:,:3])
            info['patches'].append(dict(scale=layer['id'],grid=p['grid'],**stats))
            for mode in MODES:
                groups[mode].append(enhanced[mode])
            if p['grid']==dict(x=0,y=0):
                center=enhanced
        if offset!=layer['count'] or center is None:
            raise ValueError('Invalid patch coverage')
        for kind,colors in [('grid',{k:np.concatenate(v) for k,v in groups.items()}),('center',center)]:
            key=f'{kind}-{layer["id"]}'
            info['layers'][key]={}
            for mode,rgb in colors.items():
                name=f'{key}-{mode}.rgb'
                rgb.tofile(destination/name)
                info['layers'][key][mode]=f'./data/{directory.name}/color_boost/{name}'
    (destination/'manifest.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(dataset=directory.name,patches=len(info['patches']),output=str(destination))))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories',type=Path,nargs='+')
    args=parser.parse_args()
    for directory in args.directories:
        build(directory)
