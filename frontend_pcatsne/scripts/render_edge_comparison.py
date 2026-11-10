"""Plot identical central core points in three saved color frames."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'outputs/pcatsne-runpod-20261001'
report=json.loads((ART/'edge_experiment_report.json').read_text())
compare=report['central_comparison']
W,H=620,740
canvas=Image.new('RGB',(W*3, H+158),'#10161b')
draw=ImageDraw.Draw(canvas)
def font(n):
    return ImageFont.truetype('C:/Windows/Fonts/arial.ttf',n)
draw.text((24,16),'Same 3,029 central (0, 0) points | Original vs edge-root propagation',font=font(27),fill='white')
draw.text((24,57),'Shared PCA64, seed 42, same 2 km patches and hard overlap anchors. No scale adjustment in panel C.',font=font(18),fill='#b2bec8')
with np.load(ART/'edge_central_comparison.npz') as a:
    xy=a['xy']
    low,high=xy.min(0),xy.max(0)
    scale=min((W-60)/(high[0]-low[0]),(H-135)/(high[1]-low[1]))
    px=(xy-(low+high)/2)*scale
    px[:,0]+=W/2
    px[:,1]=(high[1]-xy[:,1])*scale+175
    panels=[('A  Original: start at (0, 0)','original_rgb','original'),
            ('B  Start at edge (5, 0)','edge_rgb','edge_root_native'),
            ('C  B aligned to original frame','aligned_rgb','edge_root_rigid_aligned')]
    for j,(title,key,metric) in enumerate(panels):
        left=j*W
        draw.rectangle((left+8,96,left+W-8,H+118),fill='#080d12',outline='#33404a')
        draw.text((left+24,110),title,font=font(22),fill='white')
        if j==2:
            draw.text((left+24,140),'Rotation / reflection + translation only',font=font(16),fill='#b2bec8')
        for (x,y),rgb in zip(px,a[key]):
            x+=left
            draw.ellipse((x-2.1,y-2.1,x+2.1,y+2.1),fill=tuple(map(int,rgb)))
        m=compare[metric]
        draw.text((left+24,H+52),f"Coordinate variance {m['coordinate_variance']:.2f} | Effective dimensions {m['effective_dimensions']:.2f}",font=font(17),fill='#d2dbe3')
        draw.text((left+24,H+81),f"Oklab variance {m['oklab_variance']:.5f} | 10-NN recall {m['recall']['mean_recall']:.3f}",font=font(17),fill='#d2dbe3')
draw.text((24,H+135),'Same geographic extent and point size; colors encode the embeddings, not land-use labels.',font=font(16),fill='#b2bec8')
canvas.save(ART/'edge-central-comparison.png')
print(ART/'edge-central-comparison.png')
