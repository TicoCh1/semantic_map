"""Prepare every used SAE atom for independent image review, without generation."""
from pathlib import Path
import json,time
from concurrent.futures import ThreadPoolExecutor,as_completed
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from train_london_sae import ROOT,DATA,ATLAS,save,progress
from label_london_sae import Pictures,board,YAWS

def main():
    started=time.time();s=np.load(ROOT/'feature_statistics.npz');ref=np.load(ATLAS/'source_rows.npz')['reference']
    counts=s['frequency']*len(ref)*8;active=np.flatnonzero(counts>0);rng=np.random.default_rng(20261003)
    concepts=[]
    for f in active:
        examples=[];seen=set()
        for vi,value in zip(s['top_views'][f],s['top_values'][f]):
            if vi<0 or value<=0:continue
            vi=int(vi);gid=vi//8
            if gid in seen:continue
            seen.add(gid);examples.append(dict(view_id=vi,source_row=gid,view_index=vi%8,yaw_degrees=YAWS[vi%8],activation=float(value),lon=float(ref[gid,1]),lat=float(ref[gid,2])))
            if len(examples)==4:break
        controls=[]
        for _ in range(4):
            gid=int(rng.integers(len(ref)));v=int(rng.integers(8));controls.append(dict(view_id=gid*8+v,source_row=gid,view_index=v,yaw_degrees=YAWS[v],lon=float(ref[gid,1]),lat=float(ref[gid,2])))
        concepts.append(dict(feature_id=int(f),mean_activation=float(s['mean'][f]),view_prevalence=float(s['frequency'][f]),
            active_views=int(round(counts[f])),examples=examples,controls=controls,board=f'images/concept-{f}.jpg'))
    stats=json.loads((ROOT/'bubble_statistics.json').read_text())
    wanted={e['source_row'] for c in concepts for e in c['examples']+c['controls']}
    wanted.update(e['source_row'] for b in stats['bubbles'] for e in b['representatives'])
    progress('preparing_all_feature_review',features=len(concepts),unique_panoramas=len(wanted))
    pictures=Pictures(wanted);out=ROOT/'viewer';font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18)
    completed=[];pages=[]
    # Four feature rows per review sheet. Each row: four high-activation views,
    # then two controls. Full-resolution eight-image boards retained for zoom.
    for start in range(0,len(concepts),4):
        if start%32==0:
            group=concepts[start:start+32]
            needed={e['view_id'] for c in group for e in c['examples']+c['controls']}
            with ThreadPoolExecutor(max_workers=8) as pool:
                futures=[pool.submit(pictures.view,vi) for vi in needed]
                for future in as_completed(futures):future.result().close()
        chunk=concepts[start:start+4];tile=224;rowh=254
        sheet=Image.new('RGB',(6*tile,len(chunk)*rowh),(15,19,20));draw=ImageDraw.Draw(sheet)
        for row,c in enumerate(chunk):
            board(pictures,c['examples'],c['board'],c['controls'])
            draw.text((8,row*rowh+3),f'F{c["feature_id"]} | {c["active_views"]} active views | TOP 1-4 (left) / RANDOM 1-2 (right)',font=font,fill=(240,245,234))
            items=list(enumerate(c['examples']))+[(4+j,e) for j,e in enumerate(c['controls'][:2])]
            for col,e in items:sheet.paste(pictures.view(e['view_id']).resize((tile,tile)),(col*tile,row*rowh+30))
            c['review_page']=f'review/page-{start//4:04d}.jpg';completed.append(c)
        (out/'review').mkdir(exist_ok=True);sheet.save(out/f'review/page-{start//4:04d}.jpg',quality=90)
        pages.append(dict(page=start//4,path=f'review/page-{start//4:04d}.jpg',feature_ids=[c['feature_id'] for c in chunk]))
        if (start+4)%32==0 or start+4>=len(concepts):
            save('image_receipts.json',pictures.receipts)
            save('viewer/review_index.json',dict(status='preparing',features=completed,pages=pages,total_features=len(concepts),yaw_degrees=YAWS))
            progress('preparing_all_feature_review',completed_features=len(completed),total_features=len(concepts),seconds=time.time()-started)
    for b in stats['bubbles']:
        if b['representatives']:
            b['board']=f'images/bubble-{b["id"]}.jpg';board(pictures,b['representatives'],b['board'])
            for e in b['representatives']:e['image']=f'images/view-{e["view_id"]}.jpg';e['yaw_degrees']=YAWS[e['view_index']]
    save('viewer/review_index.json',dict(status='ready',features=concepts,pages=pages,total_features=len(concepts),yaw_degrees=YAWS,
        layout='Four feature rows per page. Columns 1-4 high activation; columns 5-6 random controls. Full boards contain four controls.'))
    save('viewer/bubble_statistics.json',stats);save('image_receipts.json',pictures.receipts)
    progress('all_feature_review_ready',features=len(concepts),pages=len(pages),seconds=time.time()-started)

if __name__=='__main__':main()
