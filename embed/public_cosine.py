#!/usr/bin/env python3
"""Statement cosine scores over committed public-dataset embeddings.

Never modifies embedding packages. All artifacts and locks belong to output.
"""
import argparse
import collections
import datetime
import fcntl
import gc
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import time
import traceback

import numpy as np

VERSION = 'public-statement-cosine-v1'
CITY_CLASSES = 'road,sidewalk,building,wall,fence,pole,traffic light,traffic sign,vegetation,terrain,sky,person,rider,car,truck,bus,train,motorcycle,bicycle'.split(',')

def atomic_json(path, obj):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n')
    os.replace(tmp, path)

def atomic_npy(path, array):
    path = Path(path)
    tmp = path.with_suffix('.tmp')
    with tmp.open('wb') as f:
        np.save(f, array, allow_pickle=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)

def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

class Progress:
    def __init__(self, output):
        self.output = output
        self.started = time.time()
        self.data = {'version': VERSION, 'started_utc': now(), 'pid': os.getpid()}
    def update(self, stage, **kw):
        self.data.update(stage=stage, updated_utc=now(), elapsed_seconds=time.time()-self.started, **kw)
        atomic_json(self.output/'status.json', self.data)
        print(json.dumps(self.data), flush=True)

def annotations(path):
    # Seek past rasters; do not decode RGB, resample labels, or scan image archives.
    with tarfile.open(path, 'r:') as t:
        for member in t:
            if member.name.endswith('/annotations.json'):
                yield json.load(t.extractfile(member))
            # TarFile otherwise retains millions of TarInfo objects.
            t.members.clear()

def statement(label, kind):
    if kind == 'traffic_sign':
        words = label.split('--')
        if len(words) > 1:
            words = words[1:]
        words = [w for w in words if not re.fullmatch(r'g\d+', w)]
        clean = ' '.join(words).replace('-', ' ')
        return f'The image contains a traffic sign indicating {clean}.'
    if kind.startswith('attribute:'):
        field = kind.split(':', 1)[1]
        if field == 'weather':
            return f'The weather in the image is {label}.'
        if field == 'timeofday':
            return f'The image was taken at {label}.'
        return f'The image shows a {label} scene.'
    if kind == 'landuse':
        clean = re.sub(r'^\d+:\s*', '', label)
        return f'The image shows {clean.lower()}.'
    clean = label.replace('--', ' ').replace('-', ' ').replace('_', ' ').replace('/', ' ')
    if clean.startswith('lane '):
        return f'The image contains {clean[5:]} lane markings.'
    if clean == 'area drivable':
        return 'The image contains a drivable road area.'
    return f'The image contains {clean}.'

def make_bank(packages, progress):
    entries = {}
    def add(ds, label, kind='presence', scope='derived_view', prompt=None, metadata=None):
        key = (ds, kind, str(label))
        entries[key] = {'dataset_id': ds, 'label': str(label), 'kind': kind, 'scope': scope,
                        'statement': prompt or statement(str(label), kind), 'metadata': metadata or {}}
    for ds in ['cityscapes', 'bdd100k_10k']:
        for name in CITY_CLASSES:
            add(ds, name, metadata={'taxonomy':'standard_19_semantic_classes', 'void_ignored':True})
    for name, text in [('day','The image was taken during the day.'),('night','The image was taken at night.'),
                       ('Forward','The image shows the street ahead.'),('Sideways','The image shows the street from a side-facing camera.'),
                       ('Backward','The image shows the street behind the camera.'),
                       ('control_panel','The image contains the vehicle dashboard.')]:
        add('mapillary_msls',name,'source_tag','source',text)
    completed = collections.Counter()
    for p in packages:
        ds = p['identity']['dataset_id']
        if ds not in {'mapillary_mtsd','mapillary_vistas','bdd100k_100k','omnicity_mono','omnicity_panorama'}:
            continue
        if ds in {'mapillary_vistas','omnicity_mono','omnicity_panorama'} and completed[ds]:
            continue
        count = 0
        for doc in annotations(Path(p['path'])/'validation.tar'):
            count += 1
            if ds == 'mapillary_vistas':
                schema = doc.get('label_schema')
                if not schema:
                    continue
                for label in schema['labels']:
                    if label['name'].startswith('void'):
                        continue
                    readable = label.get('readable', label['name'])
                    add(ds,label['name'],prompt=statement(readable,'presence'),metadata={'schema_label':label})
                break
            elif ds.startswith('omnicity'):
                for t in doc['targets']:
                    for cat in t.get('categories',[]):
                        add(ds,cat['name'], 'landuse' if t['kind']=='landuse' else 'presence')
                if doc['targets']:
                    break
            elif ds == 'mapillary_mtsd':
                for t in doc['targets']:
                    for obj in t.get('objects',[]):
                        add(ds,obj['label'],'traffic_sign')
            elif ds == 'bdd100k_100k':
                for t in doc['targets']:
                    for obj in t.get('objects',[]):
                        add(ds,obj['category'])
                for k,v in doc.get('source_tags',{}).items():
                    if str(v).lower() not in {'undefined','unknown','other','none',''}:
                        add(ds,v,'attribute:'+k,'source')
            if count % 20000 == 0:
                progress.update('catalog', package=p['package_id'], annotations_scanned=count, prompts=len(entries))
        completed[ds] += count
        progress.update('catalog',package=p['package_id'],annotations_scanned=count,prompts=len(entries))
    # Cross-view targets are exploratory scene association, not visible truth.
    for e in list(entries.values()):
        if e['dataset_id']=='omnicity_panorama' and e['kind']=='landuse':
            add('omnicity_v2_svi',e['label'],'landuse','associated_cross_view',
                metadata={'evaluation':'exploratory_satellite_landuse_association_only'})
    result = []
    for i,(_,e) in enumerate(sorted(entries.items())):
        result.append(dict(prompt_id=f'p{i:04d}',**e))
    return result

def cosine_gate(torch):
    gen = np.random.default_rng(42)
    x = gen.normal(size=(31,4096)).astype(np.float16).astype(np.float32)
    y = gen.normal(size=(17,4096)).astype(np.float32)
    x[0] = 0
    def norm(a):
        return a / np.maximum(np.linalg.norm(a,axis=1,keepdims=True),1e-12)
    expected = norm(x) @ norm(y).T
    a = torch.from_numpy(x).cuda(); b = torch.from_numpy(y).cuda()
    a = torch.nn.functional.normalize(a,dim=1); b = torch.nn.functional.normalize(b,dim=1)
    got = torch.cat([a[i:i+7] @ b.T for i in range(0,len(a),7)]).cpu().numpy()
    err = float(np.max(np.abs(expected-got)))
    if not np.isfinite(got).all() or err > 2e-5:
        raise RuntimeError(f'GPU cosine gate failed: {err}')
    return {'max_abs_error':err,'rows':31,'columns':17,'dimension':4096,'zero_vector_checked':True}

def run(args):
    out = Path(args.output); out.mkdir(parents=True,exist_ok=True)
    lock = (out/'.lock').open('a'); fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    progress = Progress(out)
    root = Path(args.input)
    packages = []
    for p in sorted((root/'packages').glob('*/checkpoint.json')):
        c = json.loads(p.read_text()); c['path'] = str(p.parent); packages.append(c)
    signature = [{'id':c['package_id'],'rows':c['rows'],'bytes':c['bytes']} for c in packages]
    config = {'version':VERSION,'input':str(root),'package_signature':signature,
              'row_block':args.row_block,'output_dtype':'float32','normalization':'float32_l2_both_sides',
              'model':args.model,'instruction':"Represent the user's input.",
              'source_rows':sum(p['rows'] for p in packages)}
    if (out/'config.json').exists() and json.loads((out/'config.json').read_text()) != config:
        raise RuntimeError('Resume configuration or input checkpoint mismatch')
    atomic_json(out/'config.json',config)
    try:
        progress.update('catalog',total_rows=config['source_rows'])
        bank_path=out/'prompts.json'
        bank=json.loads(bank_path.read_text()) if bank_path.exists() else make_bank(packages,progress)
        if not bank_path.exists(): atomic_json(bank_path,bank)
        import torch
        torch.set_num_threads(8)
        torch.backends.cuda.matmul.allow_tf32=False
        torch.backends.cudnn.allow_tf32=False
        if not torch.cuda.is_available(): raise RuntimeError('CUDA required')
        gate=cosine_gate(torch); atomic_json(out/'numerical_gate.json',gate)
        vec_path=out/'text_embeddings.npy'
        if not vec_path.exists():
            progress.update('text_model_loading',prompts=len(bank))
            sys.path.insert(0,args.repo)
            from src.models.qwen3_vl_embedding import Qwen3VLEmbedder
            model=Qwen3VLEmbedder(model_name_or_path=args.model,dtype=torch.bfloat16,
                                 attn_implementation='sdpa',max_length=256)
            chunks=[]
            for i in range(0,len(bank),args.text_batch):
                v=model.process([{'text':e['statement']} for e in bank[i:i+args.text_batch]],normalize=True)
                v=v.detach().float().cpu().numpy()
                if v.shape[1]!=4096 or not np.isfinite(v).all(): raise RuntimeError('Invalid text vectors')
                chunks.append(v)
                progress.update('text_embedding',prompts_done=min(i+args.text_batch,len(bank)),prompts=len(bank))
            atomic_npy(vec_path,np.concatenate(chunks))
            del model,chunks;gc.collect();torch.cuda.empty_cache()
        text=np.load(vec_path,allow_pickle=False)
        if text.shape!=(len(bank),4096):raise RuntimeError('Text-bank shape mismatch')
        by_ds={ds:[i for i,e in enumerate(bank) if e['dataset_id']==ds]
               for ds in {p['identity']['dataset_id'] for p in packages}}
        if any(not v for v in by_ds.values()):raise RuntimeError('Uncovered dataset')
        total_values=sum(p['rows']*len(by_ds[p['identity']['dataset_id']]) for p in packages)
        # Reserve is against the real 500 GB quota, never the shared filesystem df.
        estimated_bytes=total_values*4+text.nbytes
        if estimated_bytes > args.output_budget_gb*1e9:raise RuntimeError('Output storage budget exceeded')
        atomic_json(out/'score_plan.json',{'total_values':total_values,'output_bytes':estimated_bytes,
                    'prompts_by_dataset':{k:len(v) for k,v in by_ds.items()},'datasets':len(by_ds)})
        done_rows=0;done_values=0;began=time.time();actual_rows=0
        for p in packages:
            ds=p['identity']['dataset_id']; ids=by_ds[ds]
            dest=out/'scores'/p['package_id'];dest.mkdir(parents=True,exist_ok=True)
            atomic_json(dest/'columns.json',[bank[i]['prompt_id'] for i in ids])
            atomic_json(dest/'rows.json',{'package_id':p['package_id'],'image_map':str(Path(p['path'])/'image_map.jsonl'),
                        'rows':p['rows'],'index':'embedding_row','dataset_id':ds})
            a=np.load(Path(p['path'])/'embeddings.npy',mmap_mode='r',allow_pickle=False)
            if a.shape!=(p['rows'],4096) or a.dtype!=np.float16:raise RuntimeError('Invalid input array')
            b=torch.nn.functional.normalize(torch.from_numpy(text[ids]).cuda(),dim=1)
            for lo in range(0,len(a),args.row_block):
                hi=min(lo+args.row_block,len(a)); file=dest/f'{lo:09d}_{hi:09d}.npy'
                if file.exists():
                    old=np.load(file,mmap_mode='r',allow_pickle=False)
                    if old.shape!=(hi-lo,len(ids)) or old.dtype!=np.float32:raise RuntimeError('Invalid saved shard')
                    del old
                else:
                    x=torch.from_numpy(np.array(a[lo:hi],dtype=np.float32)).cuda()
                    if not bool(torch.isfinite(x).all()) or bool((x.norm(dim=1)<1e-8).any()):
                        raise RuntimeError('Invalid input vector')
                    x=torch.nn.functional.normalize(x,dim=1)
                    with torch.inference_mode(): score=(x @ b.T).cpu().numpy()
                    if not np.isfinite(score).all() or np.max(np.abs(score))>1.0001:raise RuntimeError('Invalid cosine')
                    atomic_npy(file,score);actual_rows+=hi-lo
                    del x,score
                done_rows+=hi-lo;done_values+=(hi-lo)*len(ids)
                elapsed=time.time()-began
                progress.update('scoring',dataset=ds,package=p['package_id'],done_rows=done_rows,
                    done_values=done_values,total_values=total_values,scoring_elapsed=elapsed,
                    fresh_rows_per_second=actual_rows/max(elapsed,.001),
                    gpu_peak_gib=torch.cuda.max_memory_allocated()/2**30)
            del a,b
        progress.update('complete',done_rows=done_rows,done_values=done_values,completed_utc=now())
    except BaseException as e:
        progress.update('failed',error=repr(e));traceback.print_exc();raise

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--input',default='/workspace/reruns/public_datasets_512_qwen8b')
    ap.add_argument('--output',required=True)
    ap.add_argument('--repo',default='/workspace/Qwen3-VL-Embedding')
    ap.add_argument('--model',default='/workspace/models/Qwen3-VL-Embedding-8B')
    ap.add_argument('--row-block',type=int,default=16384)
    ap.add_argument('--text-batch',type=int,default=16)
    ap.add_argument('--output-budget-gb',type=float,default=5)
    run(ap.parse_args())

if __name__=='__main__':main()
