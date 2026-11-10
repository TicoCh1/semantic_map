#!/usr/bin/env python3
"""Complete MSLS validation-city cosine matrix with cross-city negatives.

Official im2im/all membership, panorama exclusion and 25 m positives; existing
center-cropped Qwen vectors define this experiment, not the reference backbone.
"""
import argparse
import csv
import fcntl
import glob
import io
import json
from pathlib import Path
import time
import traceback
import zipfile

import numpy as np
from public_cosine import atomic_json, atomic_npy, now, cosine_gate

CITIES = ('cph','sf')

def run(args):
    out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
    lock=(out/'.lock').open('a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    began=time.time()
    status={'version':'msls-val-im2im-all-cosine-v1','started_utc':now(),'stage':'metadata'}
    def update(stage,**kw):
        status.update(stage=stage,updated_utc=now(),elapsed_seconds=time.time()-began,**kw)
        atomic_json(out/'status.json',status);print(json.dumps(status),flush=True)
    try:
        update('metadata')
        catalog=json.loads(Path(args.catalog).read_text())
        spec=next(x for x in catalog['sources'] if x['dataset_id']=='mapillary_msls')
        files=sorted({f for pattern in spec['validation']['archives'] for f in glob.glob(pattern)})
        tables={}
        with __import__('contextlib').ExitStack() as stack:
            archives=[stack.enter_context(zipfile.ZipFile(p)) for p in files]
            for city in CITIES:
                for role in ['query','database']:
                    tables[city,role]={}
                    for name in ['raw.csv','postprocessed.csv','subtask_index.csv','seq_info.csv']:
                        member=f'train_val/{city}/{role}/{name}'
                        matches=[z for z in archives if member in z.NameToInfo]
                        if not matches:raise RuntimeError('Missing official metadata: '+member)
                        with matches[-1].open(member) as f:
                            rows=list(csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig')))
                        tables[city,role][name]={r['key']:r for r in rows}
        candidates={'query':[],'database':[]};exclusions={}
        root=Path(args.input)
        packages=[]
        for file in sorted((root/'packages').glob('*/checkpoint.json')):
            cp=json.loads(file.read_text())
            if cp['identity']['dataset_id']!='mapillary_msls':continue
            packages.append(cp)
            with (file.parent/'image_map.jsonl').open() as f:
                for line in f:
                    row=json.loads(line);parts=row['member'].split('/')
                    if parts[0]!='train_val' or parts[1] not in CITIES or row['transform']['view_index']!=0:continue
                    city,role=parts[1:3];key=Path(parts[-1]).stem;tab=tables[city,role]
                    raw=tab['raw.csv'][key];post=tab['postprocessed.csv'][key]
                    sub=tab['subtask_index.csv'].get(key)
                    if sub is None or sub.get('all','').lower()!='true':
                        exclusions['not_all_subtask']=exclusions.get('not_all_subtask',0)+1;continue
                    if raw['pano'].lower()=='true':
                        exclusions['panorama']=exclusions.get('panorama',0)+1;continue
                    if key not in tab['seq_info.csv']:raise RuntimeError('Missing sequence identity')
                    if row['source_views']!=1:raise RuntimeError('Non-panorama has multiple views')
                    candidates[role].append({'city':city,'key':key,'source_index':row['source_index'],
                        'package_id':cp['package_id'],'row':row['embedding_row'],
                        'easting':float(post['easting']),'northing':float(post['northing']),
                        'captured_at':raw.get('captured_at'),'night':post.get('night'),
                        'sequence_key':tab['seq_info.csv'][key].get('sequence_key'),
                        'subtask':sub,'member':row['member']})
            update('indexing',package=cp['package_id'],queries=len(candidates['query']),database=len(candidates['database']))
        from scipy.spatial import cKDTree
        db=sorted(candidates['database'],key=lambda x:(x['city'],x['key']))
        queries=sorted(candidates['query'],key=lambda x:(x['city'],x['key']))
        positives=[];q=[];no_match=[]
        for city in CITIES:
            dbidx=np.array([i for i,r in enumerate(db) if r['city']==city])
            tree=cKDTree([[db[i]['easting'],db[i]['northing']] for i in dbidx])
            for row in [r for r in queries if r['city']==city]:
                hits=tree.query_ball_point([row['easting'],row['northing']],25.0)
                if not hits:no_match.append(row);continue
                q.append(row);positives.append(sorted(int(dbidx[i]) for i in hits))
        if not q or not db:raise RuntimeError('Empty official validation membership')
        matrix_bytes=len(q)*len(db)*4
        if matrix_bytes>2e9:raise RuntimeError('Unexpected validation matrix size')
        plan={'cities':CITIES,'query_rows':len(q),'database_rows':len(db),'matrix_bytes':matrix_bytes,
              'pairs':len(q)*len(db),'dtype':'float32','positive_radius_m':25,
              'cross_city_negatives':True,'exclude_panoramas':True,'subtask':'all','task':'im2im',
              'queries_without_positive':len(no_match),'exclusions':exclusions,
              'representation':'Existing Qwen3-VL-Embedding-8B center-cropped 512x512 vectors; no re-embedding.',
              'package_signature':[{'id':c['package_id'],'rows':c['rows'],'bytes':c['bytes']} for c in packages]}
        if (out/'plan.json').exists() and json.loads((out/'plan.json').read_text())!=json.loads(json.dumps(plan)):
            raise RuntimeError('Input or membership changed; use new output directory')
        atomic_json(out/'plan.json',plan)
        atomic_json(out/'queries.json',q);atomic_json(out/'database.json',db)
        atomic_json(out/'positives.json',positives);atomic_json(out/'queries_without_positive.json',no_match)
        def load(rows):
            result=np.empty((len(rows),4096),dtype=np.float32)
            groups={}
            for i,r in enumerate(rows):groups.setdefault(r['package_id'],[]).append((i,r['row']))
            for pid,refs in groups.items():
                src=np.load(root/'packages'/pid/'embeddings.npy',mmap_mode='r',allow_pickle=False)
                target,index=zip(*refs);result[list(target)]=src[list(index)]
            if not np.isfinite(result).all():raise RuntimeError('Nonfinite input vectors')
            norm=np.linalg.norm(result,axis=1,keepdims=True)
            if (norm<1e-8).any():raise RuntimeError('Zero input vector')
            result/=norm
            return result
        update('loading_embeddings',**{k:plan[k] for k in ['query_rows','database_rows','pairs','matrix_bytes']})
        qa=load(q);da=load(db)
        import torch
        torch.set_num_threads(8);torch.backends.cuda.matmul.allow_tf32=False
        atomic_json(out/'numerical_gate.json',cosine_gate(torch))
        dg=torch.from_numpy(da).cuda()
        shards=out/'matrix';shards.mkdir(exist_ok=True)
        pred=[];topscore=[];scoring_started=time.time()
        for lo in range(0,len(q),args.row_block):
            hi=min(lo+args.row_block,len(q));file=shards/f'{lo:09d}_{hi:09d}.npy'
            if file.exists():
                scores=np.load(file,allow_pickle=False)
                if scores.shape!=(hi-lo,len(db)) or scores.dtype!=np.float32:raise RuntimeError('Invalid stored matrix shard')
            else:
                with torch.inference_mode():scores=(torch.from_numpy(qa[lo:hi]).cuda()@dg.T).cpu().numpy()
                # Compare selected real entries to independent CPU FP32 dots.
                error=max(abs(float(scores[i,j])-float(np.dot(qa[lo+i],da[j])))
                          for i in [0,hi-lo-1] for j in [0,len(db)//2,len(db)-1])
                if error>2e-5 or not np.isfinite(scores).all():raise RuntimeError('Real cosine check failed')
                atomic_npy(file,scores)
            k=min(100,len(db));idx=np.argpartition(-scores,k-1,axis=1)[:,:k]
            values=np.take_along_axis(scores,idx,axis=1)
            order=np.argsort(-values,axis=1,kind='stable')
            idx=np.take_along_axis(idx,order,axis=1);values=np.take_along_axis(values,order,axis=1)
            pred.append(idx);topscore.append(values)
            update('scoring',done_queries=hi,done_pairs=hi*len(db),scoring_elapsed=time.time()-scoring_started,
                   gpu_peak_gib=torch.cuda.max_memory_allocated()/2**30)
        pred=np.concatenate(pred);topscore=np.concatenate(topscore)
        atomic_npy(out/'top100_indices.npy',pred);atomic_npy(out/'top100_scores.npy',topscore)
        recalls={str(k):sum(bool(set(pred[i,:k])&set(positives[i])) for i in range(len(q)))/len(q)
                 for k in [1,5,10,20,100]}
        atomic_json(out/'metrics.json',{'recall_at_k':recalls,'queries':len(q),'database':len(db),
                    'no_match_queries_excluded':len(no_match),'positive_radius_m':25,
                    'ground_truth':'MSLS publisher all subtask, non-panorama, same-city UTM distance',
                    'not_a_temporal_only_subset':True,
                    'same_date_pairs_not_removed':True})
        update('complete',completed_utc=now(),recall_at_k=recalls)
    except BaseException as e:
        update('failed',error=repr(e));traceback.print_exc();raise

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--output',required=True)
    ap.add_argument('--input',default='/workspace/reruns/public_datasets_512_qwen8b')
    ap.add_argument('--catalog',default='/workspace/embed/dataset_catalog_runpod.json')
    ap.add_argument('--row-block',type=int,default=2048)
    run(ap.parse_args())
