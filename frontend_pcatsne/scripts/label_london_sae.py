"""Ground candidate SAE labels in native view images; resume every completed item.

Run after train_london_sae.py on the same RunPod. No paid external model API.
All prompts explicitly forbid socioeconomic inference and identifying people.
"""
from pathlib import Path
import gc,io,json,math,os,re,shutil,sqlite3,tarfile,time,traceback,threading,argparse
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import torch
from train_london_sae import ROOT,DATA,ATLAS,save,progress,sources
from dataset_image_pipeline import EquirectangularProjector
YAWS=tuple(json.loads((DATA.parents[1]/'run.json').read_text())['config']['yaw_degrees'])
assert YAWS==(45,90,135,180,225,270,315,0),'Do not silently substitute newer dataset view ordering'

class Pictures:
    def __init__(self,wanted,receipt_name='image_receipts.json'):
        self.identities={};self.open_files={};self.projectors={};self.ref=np.load(ATLAS/'source_rows.npz')['reference']
        self.archive_locks={};self.db_lock=threading.Lock()
        self.receipt_name=receipt_name;receipts=ROOT/receipt_name
        self.receipts=json.loads(receipts.read_text()) if receipts.exists() else {}
        shards,_=sources()
        for s in shards:
            selected={p-s['offset'] for p in wanted if s['offset']<=p<s['offset']+s['rows']}
            if not selected:continue
            ip=Path(s['path']).with_name(Path(s['path']).stem+'_identity.jsonl')
            with ip.open() as f:
                for row,line in enumerate(f):
                    if row in selected:
                        item=json.loads(line);item['shard_number']=s['number'];gid=row+s['offset']
                        assert abs(item['lon']-self.ref[gid,1])<1e-5 and abs(item['lat']-self.ref[gid,2])<1e-5
                        assert int(item['pano_id'])==int(self.ref[gid,0])
                        self.identities[gid]=item
            assert selected.issubset({g-s['offset'] for g in self.identities}),s['number']
        assert wanted.issubset(self.identities)
        # Finished service index is immutable; copy before random queries on NFS.
        idx=Path('/tmp/london-native-q90-sae.sqlite')
        if not idx.exists():shutil.copyfile('/workspace/semantic_backend/pano_index_native_q90_20260916/london.sqlite',idx)
        self.db=sqlite3.connect(idx.as_uri()+'?mode=ro&immutable=1',uri=True,check_same_thread=False)
        self.projectors={v:EquirectangularProjector(size=512,yaws=[YAWS[v]]) for v in range(8)}
        (ROOT/'viewer/images').mkdir(parents=True,exist_ok=True)
    def view(self,vi):
        p=ROOT/f'viewer/images/view-{vi}.jpg'
        if p.exists() and str(vi) in self.receipts and self.receipts[str(vi)]['yaw_degrees']==YAWS[vi%8]:return Image.open(p).convert('RGB')
        gid,v=divmod(vi,8);ident=self.identities[gid]
        archive=DATA.parents[1]/'pano'/DATA.name/f"panos_shard_{ident['shard_number']:05d}.tar"
        with self.db_lock:row=self.db.execute('SELECT offset_data,byte_size,lon,lat,pano_id FROM panos WHERE tar_id=? AND member_name=?',(str(archive),ident['pano_member'])).fetchone()
        if row is None:raise RuntimeError(f'Missing exact native image {gid} {ident["pano_member"]}')
        off,size,lon,lat,pano_id=row;assert abs(lon-ident['lon'])<1e-7 and abs(lat-ident['lat'])<1e-7 and pano_id==ident['pano_id']
        with self.archive_locks.setdefault(archive,threading.Lock()):
            if archive not in self.open_files:self.open_files[archive]=archive.open('rb')
            f=self.open_files[archive];f.seek(off-512)
            header=tarfile.TarInfo.frombuf(f.read(512),'utf-8','surrogateescape')
            assert header.name==ident['pano_member'] and header.size==size
            payload=f.read(size);assert len(payload)==size
        panorama=Image.open(io.BytesIO(payload)).convert('RGB')
        # Some native migration archives retain original, variable resolutions;
        # old identity size fields describe the encoder's planned resize. Identity
        # and actual TAR header are authoritative for the corresponding image.
        assert ident['geometry']['method'] in ('full_sphere','verified_horizontal_wrap')
        actual_size=list(panorama.size)
        if abs(panorama.width/panorama.height-2)>=.03:
            assert actual_size==ident['original_size'] and ident['geometry']['method']=='verified_horizontal_wrap'
            panorama=panorama.crop(ident['geometry']['crop'])
        assert abs(panorama.width/panorama.height-2)<.03 and panorama.width>=512
        if v not in self.projectors:self.projectors[v]=EquirectangularProjector(size=512,yaws=[YAWS[v]])
        image=self.projectors[v].project(panorama)[0][0]
        tmp=p.with_name(f'view-{vi}-{os.getpid()}-{threading.get_ident()}.jpg');image.save(tmp,quality=88);tmp.replace(p)
        self.receipts[str(vi)]=dict(source_row=gid,pano_id=pano_id,member=header.name,archive=str(archive),offset=off,bytes=size,
            actual_size=actual_size,spherical_size=list(panorama.size),geometry=ident['geometry'],declared_pano_size=ident['pano_size'],view_index=v,yaw_degrees=YAWS[v],fov_degrees=45,
            header_and_identity_verified=True)
        return image

def board(pictures,examples,path,controls=None):
    rows=2;columns=3 if controls is None else 4;size=320
    canvas=Image.new('RGB',(columns*size,rows*(size+26)),(15,19,20));draw=ImageDraw.Draw(canvas)
    items=list(enumerate(examples[:6])) if controls is None else list(enumerate(examples[:4]))+[(4+j,e) for j,e in enumerate(controls[:4])]
    for i,e in items:
        x=(i%columns)*size;y=(i//columns)*(size+26);image=pictures.view(e['view_id']).resize((size,size))
        canvas.paste(image,(x,y+26))
        label=(f'EXAMPLE {i+1}' if controls is None else ('TOP ' if i<4 else 'CONTROL ')+str(i%4+1))
        draw.text((x+8,y+6),f'{label} | row {e["source_row"]} | yaw {YAWS[e["view_index"]]}',fill=(232,240,240))
    canvas.save(ROOT/'viewer'/path,quality=87);return canvas

def parse_reply(raw):
    match=re.search(r'\{.*\}',raw,re.S)
    if match:
        try:
            obj=json.loads(match.group())
            if all(k in obj for k in ('title','description','evidence','uncertainty')):
                return obj
        except json.JSONDecodeError:pass
    return dict(title='Visual description — unstructured output',description=raw,evidence=[],uncertainty='Model output did not follow the requested schema.',parse_failed=True)

def main(bubble_only=False):
    started=time.time();stats=json.loads((ROOT/'bubble_statistics.json').read_text());naming_path=ROOT/'naming.json'
    naming=json.loads(naming_path.read_text()) if naming_path.exists() else dict(concepts={},bubbles={})
    rng=np.random.default_rng(20261003);roi=np.load(ROOT/'roi_ids.npy')
    for c in ([] if bubble_only else stats['concepts']):
        controls=rng.choice(roi,4,replace=False)*8+rng.integers(0,8,4)
        c['controls']=[dict(view_id=int(v),source_row=int(v)//8,view_index=int(v)%8) for v in controls]
    wanted={e['source_row'] for c in ([] if bubble_only else stats['concepts']) for e in c['examples']+c['controls']}
    wanted.update(e['source_row'] for b in stats['bubbles'] for e in b['representatives'])
    # Keep the feature-review preparation state separate from this generation job.
    print(json.dumps(dict(stage='preparing_bubble_images',unique_panoramas=len(wanted))),flush=True)
    pictures=Pictures(wanted,receipt_name='image_receipts_bubbles.json' if bubble_only else 'image_receipts.json')
    # Ground every code exemplar in the exact cached image / yaw convention.
    for c in ([] if bubble_only else stats['concepts']):
        c['board']=f'images/concept-{c["feature_id"]}.jpg'
        board(pictures,c['examples'],c['board'],c['controls'])
    for b in stats['bubbles']:
        if b['representatives']:
            b['board']=f'images/bubble-{b["id"]}.jpg'
            board(pictures,b['representatives'],b['board'])
        for e in b['representatives']:e['image']=f'images/view-{e["view_id"]}.jpg'
    save(pictures.receipt_name,pictures.receipts)
    print(json.dumps(dict(stage='loading_vision_model',concepts=len(stats['concepts']),bubbles=len(stats['bubbles']))),flush=True)
    from transformers import Qwen3VLForConditionalGeneration,AutoProcessor
    model_path=json.loads((ROOT/'vision_model.json').read_text())['path']
    model=Qwen3VLForConditionalGeneration.from_pretrained(model_path,dtype=torch.bfloat16,device_map='cuda',attn_implementation='sdpa',local_files_only=True).eval()
    processor=AutoProcessor.from_pretrained(model_path,local_files_only=True,min_pixels=256*32*32,max_pixels=1024*32*32)
    @torch.inference_mode()
    def caption(image_path,prompt):
        messages=[dict(role='user',content=[dict(type='image',image=str(ROOT/'viewer'/image_path)),dict(type='text',text=prompt)])]
        inputs=processor.apply_chat_template(messages,tokenize=True,add_generation_prompt=True,return_dict=True,return_tensors='pt').to('cuda')
        out=model.generate(**inputs,max_new_tokens=220,do_sample=False)
        text=processor.batch_decode(out[:,inputs.input_ids.shape[1]:],skip_special_tokens=True)[0]
        del inputs,out;return parse_reply(text)
    common=('Return ONLY valid JSON with keys title (short English phrase), description (1-2 sentences), '
        'evidence (list of up to 3 directly visible observations), uncertainty (one short sentence). '
        'Describe built form, road/street layout, greenery and visible objects. Do not infer wealth, deprivation, '
        'ethnicity, safety, walkability ratings or identify people. Do not guess a location. '
        'These are candidate image-grounded labels, not proven meanings of a neural feature. ')
    total=(0 if bubble_only else len(stats['concepts']))+len(stats['bubbles']);done=0;generation_started=time.time()
    if bubble_only:
        for c in stats['concepts']:
            naming['concepts'].setdefault(str(c['feature_id']),dict(title=f'F{c["feature_id"]} — independent review pending',description='Candidate visual meaning will be supplied by independent image-review agents.',evidence=[],uncertainty='Not yet reviewed.',status='pending'))
    for c in ([] if bubble_only else stats['concepts']):
        key=str(c['feature_id'])
        if key not in naming['concepts']:
            prompt=common+('The top row has four high-activation examples of one learned sparse feature. '
                'The bottom row has four random control views. Find a specific visual theme common to at least three '
                'top views and less evident in the controls. It may be architecture, vegetation, surface texture, '
                'weather, darkness, vehicles or view obstruction. If no clear theme exists, title it Mixed visual feature '
                'and explicitly say it is ambiguous. Mention contrasting controls where visible. Do not claim statistical significance.')
            naming['concepts'][key]=caption(c['board'],prompt);save('naming.json',naming)
        c['interpretation']=naming['concepts'][key];done+=1
        progress('naming_concepts',completed=done,total=total,feature_id=c['feature_id'],generation_seconds=time.time()-generation_started)
    for b in stats['bubbles']:
        key=b['id']
        if key not in naming['bubbles']:
            if not b['representatives']:
                naming['bubbles'][key]=dict(title='Gaussian extension — no interior samples',description='This displayed component contains no source panoramas. No SAE or street-view evidence supports a local semantic label.',evidence=[],uncertainty='The polygon is a smoothed display footprint, not a measured neighbourhood.')
            else:
                features=[dict(feature_id=f['feature_id'],label=naming['concepts'][str(f['feature_id'])]['title'],enrichment=round(f['activation_enrichment'],2),prevalence=round(f['view_prevalence'],3)) for f in b['features']]
                prompt=common+('This board shows up to six distinct panorama locations INSIDE one geographic bubble, selected '
                    'from its strongest sparse features. Describe common built/landscape character visible here and any mixture. '
                    'Blank tiles mean fewer examples, not missing buildings. Samples are selective views, not coverage of the whole region. '
                    f'The bubble has {b["inside_panoramas"]} interior panoramas, {b["matching_panoramas"]} in its semantic group. '
                    'These additional candidate feature labels may be wrong: '+json.dumps(features)+'. '
                    'Use the images to support or reject those labels. Be cautious when fewer than 10 panoramas support the analysis.')
                naming['bubbles'][key]=caption(b['board'],prompt)
            save('naming.json',naming)
        b['interpretation']=naming['bubbles'][key];done+=1
        for f in b['features']:
            f['interpretation']=naming['concepts'][str(f['feature_id'])];f['board']=f'images/concept-{f["feature_id"]}.jpg'
        line=dict(stage='naming_bubbles',completed=done,total=total,bubble_id=key,generation_seconds=time.time()-generation_started)
        save('bubble_label_state.json',line);print(json.dumps(line),flush=True)
    stats.update(training=json.loads((ROOT/'training_summary.json').read_text()),input=json.loads((ROOT/'input_manifest.json').read_text()),
        vision_model=json.loads((ROOT/'vision_model.json').read_text()),interpretation_status='candidate visual descriptions; not human validated',
        naming_seconds=time.time()-generation_started,total_labelling_seconds=time.time()-started)
    save('viewer/interpretations.json',stats)
    lines=['# London SAE concept and geographic bubble interpretations','',
        'Central 20 × 20 km; 500 m smoothing; 100% density; 80 m separation; parks ≥ 3 ha. Thames remains uncovered.',
        '',f'{len(stats["bubbles"])} independent semantic pieces; {len(stats["concepts"])} candidate sparse features named from images.',
        '', 'These labels are automatically generated visual hypotheses. SAE feature IDs and image evidence are retained for review.','']
    for b in stats['bubbles']:
        it=b['interpretation'];lines.extend([f'## {b["id"]} · S{b["group"]} · {it["title"]}',
            f'{b["area_km2"]:.3f} km²; {b["inside_panoramas"]} interior panoramas; {b["matching_panoramas"]} matching group; {b["status"]}.','',it['description'],'',
            'Evidence: '+json.dumps(it['evidence'],ensure_ascii=False), 'Uncertainty: '+str(it['uncertainty']), '',
            f'![Representative views]({b.get("board", "")})' if b.get('board') else 'No interior image evidence.', ''])
        for f in b['features']:
            lines.append(f'- Feature {f["feature_id"]}: {f["interpretation"]["title"]}; {f["activation_enrichment"]:.2f}× global mean; {f["view_prevalence"]:.1%} of analysed views.')
        lines.append('')
    (ROOT/'viewer/report.md').write_text('\n'.join(lines),encoding='utf-8')
    result=dict(stage='bubble_labels_complete' if bubble_only else 'complete',bubbles=len(stats['bubbles']),concepts=len(stats['concepts']),total_labelling_seconds=time.time()-started,
        peak_vision_gpu_gb=torch.cuda.max_memory_allocated()/1e9,output=str(ROOT/'viewer'))
    save('bubble_label_state.json',result);print(json.dumps(result),flush=True)

if __name__=='__main__':
    torch.set_num_threads(8)
    parser=argparse.ArgumentParser();parser.add_argument('--bubble-only',action='store_true');args=parser.parse_args()
    try:main(args.bubble_only)
    except Exception as e:progress('labelling_failed',error=str(e),traceback=traceback.format_exc());raise
