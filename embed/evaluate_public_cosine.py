#!/usr/bin/env python3
"""Read-only dataset evaluation; writes only to a new evaluation directory.

Execute on RunPod. Unknown labels are -1, never implicit negatives.
"""
import argparse
import collections
import concurrent.futures
import io
import json
import os
from pathlib import Path
import re
import tarfile
import time
import zipfile

import numpy as np
from PIL import Image

ROOT = Path('/workspace/reruns/public_datasets_512_qwen8b/packages')
EXP = Path('/workspace/experiments/public_cosine_20260926')
OUT = EXP / 'evaluation'
CITY_NAMES = 'road,sidewalk,building,wall,fence,pole,traffic light,traffic sign,vegetation,terrain,sky,person,rider,car,truck,bus,train,motorcycle,bicycle'.split(',')
CITY_IDS = [7,8,11,12,13,17,19,20,21,22,23,24,25,26,27,28,31,32,33]


def dump(p, x):
    p = Path(p); p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(x, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    tmp.replace(p)


def split_of(m, ds):
    s = m['source_uri'].replace('::','/')
    if ds == 'mapillary_msls':
        parts = m['member'].split('/')
        return 'val' if parts[1] in ('cph','sf') else ('train' if parts[0]=='train_val' else 'test')
    if '/train_extra/' in s: return 'coarse'
    if re.search(r'[/\-](test|testing)[/.\-]', s): return 'test'
    if re.search(r'/(val|validation)/', s): return 'val'
    if re.search(r'[/\-](train|training)[/.\-]', s): return 'train'
    return 'unknown'


class Reader:
    def __init__(self): self.zips = {}; self.splits = {}; self.last_v2 = None
    def read(self, archive, member):
        if archive not in self.zips: self.zips[archive] = zipfile.ZipFile(archive)
        return self.zips[archive].read(member)
    def mask(self, target, buffered):
        if target.get('storage') == 'source_reference':
            b = self.read(target['source']['archive'], target['source']['member'])
        else: b = buffered[target['member']]
        return np.asarray(Image.open(io.BytesIO(b)))
    def mtsd_split(self, target, key):
        archive = target['source']['archive']
        if archive not in self.splits:
            if archive not in self.zips: self.zips[archive] = zipfile.ZipFile(archive)
            lookup = {}
            for n in self.zips[archive].namelist():
                if '/splits/' in n and n.endswith('.txt'):
                    lookup.update({x:Path(n).stem for x in self.read(archive,n).decode().splitlines()})
            self.splits[archive] = lookup
        return self.splits[archive].get(key,'unknown')


def extract(package):
    p = ROOT/package; checkpoint = json.loads((p/'checkpoint.json').read_text())
    ds = checkpoint['identity']['dataset_id']; n = checkpoint['rows']
    target = OUT/'truth'/f'{package}.npz'
    if target.exists(): return {'package':package,'cached':True}
    prompts = [x for x in json.loads((EXP/'statements/prompts.json').read_text()) if x['dataset_id']==ds]
    names = {x['label']:j for j,x in enumerate(prompts)}; k = len(prompts)
    y = np.full((n,k),-1,np.int8); area=np.full((n,k),np.nan,np.float32)
    source=np.zeros(n,np.int64); split=np.full(n,'unknown','U8'); group=np.full(n,'','U110')
    quality=np.full(n,'','U24'); pano=np.zeros(n,bool); raw=np.zeros((n,9),np.float32)
    counter=collections.Counter(); reader=Reader(); buffer={}; row=0; started=time.time()
    with open(p/'image_map.jsonl') as maps, tarfile.open(p/'validation.tar','r:') as t:
        for member in t:
            if member.name.endswith('.png') and (any(member.name.endswith('/'+v) for v in ['labels.png','semantic_ids.png','gtFine_labelIds.png','gtCoarse_labelIds.png'])):
                buffer[member.name]=t.extractfile(member).read()
            elif member.name.endswith('/annotations.json'):
                a=json.load(t.extractfile(member)); m=json.loads(next(maps))
                assert a['source_index']==m['source_index'] and m['embedding_row']==row
                assert member.name==m['view_id']+'/annotations.json'
                source[row]=m['source_index']; split[row]=split_of(m,ds); group[row]=str(m['source_index'])
                pano[row]=m['projection']=='equirectangular'; quality[row]=a['status']; counter[a['status']]+=1
                if ds=='mapillary_mtsd' and a['status']=='unavailable_test_labels':split[row]='test'
                ts=a.get('targets',[]); bykind={z['kind']:z for z in ts}
                if ds in ('cityscapes','bdd100k_10k','mapillary_vistas'):
                    kind = ('gtFine_labelIds' if 'gtFine_labelIds' in bykind else 'gtCoarse_labelIds') if ds=='cityscapes' else ('semantic_ids' if ds=='bdd100k_10k' else 'labels')
                    if kind in bykind:
                        mask=reader.mask(bykind[kind],buffer)
                        assert mask.ndim==2
                        ids = dict(zip(CITY_NAMES,CITY_IDS if ds=='cityscapes' else range(19)))
                        if ds=='mapillary_vistas': ids={z['name']:i for i,z in enumerate(a['label_schema']['labels']) if z.get('evaluate',False)}
                        counts=np.bincount(mask.ravel().astype(np.int64),minlength=256)
                        if sum(counts[v] for v in ids.values())>0:
                            for name,j in names.items():
                                if name in ids: area[row,j]=counts[ids[name]]/mask.size; y[row,j]=counts[ids[name]]>0
                        quality[row]='coarse' if kind.startswith('gtCoarse') else 'dense'
                elif ds=='mapillary_mtsd' and 'traffic_sign_boxes' in bykind:
                    z=bykind['traffic_sign_boxes']; split[row]=reader.mtsd_split(z,Path(m['member']).stem)
                    quality[row]=a.get('annotation_coverage','unknown')
                    if quality[row]=='fully': y[row]=0;area[row]=0
                    for obj in z['objects']:
                        j=names[obj['label']];y[row,j]=1;b=obj['bbox']
                        size=max(0,b['xmax']-b['xmin'])*max(0,b['ymax']-b['ymin'])/512**2
                        area[row,j]=max(float(np.nan_to_num(area[row,j])),size)
                elif ds=='bdd100k_100k':
                    if 'objects_and_lanes' in bykind:
                        for j,e in enumerate(prompts):
                            if e['kind']=='presence': y[row,j]=0
                        for obj in bykind['objects_and_lanes']['objects']:
                            j=names[obj['category']];y[row,j]=1
                            b=obj.get('box2d')
                            if b: area[row,j]=max(float(np.nan_to_num(area[row,j])),max(0,b['x2']-b['x1'])*max(0,b['y2']-b['y1'])/512**2)
                    for field,val in a.get('source_tags',{}).items():
                        ix=[j for j,e in enumerate(prompts) if e['kind']=='attribute:'+field]
                        if val in [prompts[j]['label'] for j in ix]:
                            y[row,ix]=0;y[row,names[val]]=1
                elif ds in ('omnicity_mono','omnicity_panorama'):
                    for kind in ('instance','landuse'):
                        if kind not in bykind: continue
                        z=bykind[kind]; cats={c['id']:c['name'] for c in z['categories']}
                        for name in cats.values():
                            if name in names: y[row,names[name]]=0;area[row,names[name]]=0
                        for obj in z['objects']:
                            j=names[cats[obj['category_id']]]
                            if obj['area']>0: y[row,j]=1;area[row,j]+=obj['area']/512**2
                    area[row]=np.minimum(area[row],1)
                    coords=Path(m['member']).name.split('_')[0]
                    group[row]=coords
                elif ds=='omnicity_v2_svi':
                    z=next(z for z in a['source_annotations'] if z['kind']=='gt-landuse')
                    if reader.last_v2 is None or reader.last_v2[0]!=source[row]:
                        mask=np.asarray(Image.open(io.BytesIO(reader.read(z['archive'],z['member']))))
                        assert mask.ndim==2 and int(mask.min())>=1 and int(mask.max())<=8
                        counts=np.bincount(mask.ravel(),minlength=9)/mask.size
                        reader.last_v2=(source[row],counts)
                    raw[row]=reader.last_v2[1]
                    # Original OmniCity raster uses Table 5 IDs: 1 background,
                    # 2 family, 3 walk-up, 4 elevator, 5 mixed, 6 office, 7 industrial, 8 other.
                    for name,j in names.items():
                        code=int(name.split(':')[0])+1
                        area[row,j]=raw[row,code];y[row,j]=raw[row,code]>0
                    group[row]=Path(m['member']).name.split('_')[0]
                elif ds=='mapillary_msls':
                    tags=a.get('source_tags',{}); pp=tags.get('postprocessed.csv',{}); rr=tags.get('raw.csv',{})
                    group[row]=m['member'].split('/')[1]+':'+tags.get('seq_info.csv',{}).get('sequence_key',str(source[row]))
                    if not pano[row]:
                        if pp.get('night') in ('True','False'):
                            y[row,names['night']]=pp['night']=='True'; y[row,names['day']]=pp['night']=='False'
                        if pp.get('control_panel') in ('True','False'):y[row,names['control_panel']]=pp['control_panel']=='True'
                        if pp.get('view_direction') in ('Forward','Sideways','Backward'):
                            for name in ('Forward','Sideways','Backward'):y[row,names[name]]=name==pp['view_direction']
                row+=1;buffer.clear()
                if row%20000==0: print(json.dumps({'stage':'extract','dataset':ds,'package':package,'rows':row,'total':n,'seconds':round(time.time()-started)}),flush=True)
            t.members.clear()
        assert row==n and next(maps,None) is None
    target.parent.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(target,y=y,area=area,source=source,split=split,group=group,quality=quality,pano=pano,raw=raw)
    result={'package':package,'dataset':ds,'rows':n,'status_counts':dict(counter),'splits':dict(collections.Counter(split.tolist())),'seconds':time.time()-started}
    dump(OUT/'truth'/f'{package}.json',result);print(json.dumps(result),flush=True)
    return result


def finite(x):
    return float(x) if np.isfinite(x) else None


def metric(y,s,caly,cals,area=None):
    from sklearn.metrics import average_precision_score,roc_auc_score,precision_recall_curve
    from scipy.stats import spearmanr
    known=y>=0;y=y[known];s=s[known]
    ck=caly>=0;caly=caly[ck];cals=cals[ck]
    n=len(y);pos=int(y.sum());neg=n-pos
    r={'n':n,'positives':pos,'negatives':neg,'prevalence':pos/n if n else None,'cal_n':len(caly),'cal_positives':int(caly.sum())}
    if n: r.update(score_min=float(s.min()),score_max=float(s.max()),score_mean=float(s.mean()))
    if pos and neg:
        r.update(ap=float(average_precision_score(y,s)),auc=float(roc_auc_score(y,s)))
        r['ap_lift']=r['ap']/r['prevalence']
        order=np.argsort(-s,kind='stable');r['precision_at_100']=float(y[order[:min(100,n)]].mean());r['precision_at_100_k']=min(100,n)
    else: r['unavailable_reason']='no_known_labels' if not n else ('no_positive' if not pos else 'no_negative')
    cp=int(caly.sum());cn=len(caly)-cp
    if cp>=5 and cn>=5:
        precision,recall,th=precision_recall_curve(caly,cals)
        fs=2*precision[:-1]*recall[:-1]/np.maximum(precision[:-1]+recall[:-1],1e-12)
        # Tie break toward the highest threshold (conservative).
        idx=np.flatnonzero(fs==fs.max())[-1];threshold=float(th[idx]);r['threshold']=threshold;r['cal_f1']=float(fs[idx])
        if n:
            pred=s>=threshold;tp=int(((y==1)&pred).sum());fp=int(((y==0)&pred).sum());fn=int(((y==1)&~pred).sum())
            r.update(tp=tp,fp=fp,fn=fn,tn=neg-fp,precision=tp/(tp+fp) if tp+fp else 0.,recall=tp/(tp+fn) if tp+fn else 0.,f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0.)
    else:r['threshold_unavailable']='calibration requires >=5 positives and >=5 negatives'
    if area is not None:
        a=area[known];valid=np.isfinite(a)
        if valid.sum()>2 and np.ptp(a[valid])>0 and np.ptp(s[valid])>0:r['spearman_area']=finite(spearmanr(a[valid],s[valid]).statistic)
        for cutoff in (.001,.01):
            # Exclude tiny positives from this sensitivity set; never relabel them negative.
            keep=valid&((y==0)|(a>=cutoff))
            yy=y[keep];ss=s[keep]
            r['area_'+str(cutoff)]={'n':len(yy),'positives':int(yy.sum()),'ap':float(average_precision_score(yy,ss)) if yy.sum() and (yy==0).any() else None}
    return r


def macro(rows,key):
    v=[r[key] for r in rows if r.get(key) is not None]
    return float(np.mean(v)) if v else None


def evaluate(ds):
    from sklearn.metrics import accuracy_score,balanced_accuracy_score,f1_score,confusion_matrix,precision_recall_curve
    prompts=[x for x in json.loads((EXP/'statements/prompts.json').read_text()) if x['dataset_id']==ds]
    packs=[];parts=[];scores=[];rowrefs=[]
    for p in sorted(ROOT.iterdir()):
        c=json.loads((p/'checkpoint.json').read_text())
        if c['identity']['dataset_id']!=ds:continue
        z=np.load(OUT/'truth'/f'{p.name}.npz',allow_pickle=False);part={key:z[key] for key in z.files}
        if part['raw'].shape[1]<9:part['raw']=np.pad(part['raw'],((0,0),(0,9-part['raw'].shape[1])))
        parts.append(part);packs.append(p.name)
        scorepath=EXP/'statements/scores'/p.name
        columns=json.loads((scorepath/'columns.json').read_text())
        assert columns==[x['prompt_id'] for x in prompts]
        ss=[];expected=0
        for f in sorted(scorepath.glob('*.npy')):
            lo,hi=map(int,f.stem.split('_'));a=np.load(f);assert lo==expected and a.shape==(hi-lo,len(prompts));ss.append(a);expected=hi
        assert expected==c['rows'];scores.append(np.concatenate(ss));rowrefs.extend((p.name,i) for i in range(expected))
    data={k:np.concatenate([z[k] for z in parts]) for k in parts[0]};s=np.concatenate(scores)
    y=data['y'];area=data['area'];group=data['group'];split=data['split'];source=data['source'];quality=data['quality']
    assert np.isfinite(s).all()
    # Semantically identical MTSD statements cannot distinguish original variants.
    aliases=[]
    if ds=='mapillary_mtsd':
        buckets=collections.OrderedDict()
        for j,e in enumerate(prompts):buckets.setdefault(e['statement'],[]).append(j)
        new=[];ys=[];ss=[];aa=[]
        for text,ix in buckets.items():
            e=dict(prompts[ix[0]]);e['aliases']=[prompts[j]['label'] for j in ix];new.append(e);aliases.append(e['aliases'])
            ys.append(y[:,ix].max(axis=1));ss.append(s[:,ix].mean(axis=1));aa.append(np.nan_to_num(area[:,ix],nan=-1).max(axis=1))
        prompts=new;y=np.stack(ys,1);s=np.stack(ss,1);area=np.stack(aa,1);area[area<0]=np.nan
    valname='test' if ds in ('omnicity_mono','omnicity_panorama') else 'val'
    ev=split==valname;cal=split=='train'
    if ds=='mapillary_mtsd':ev&=quality=='fully';cal&=quality=='fully'
    if ds=='mapillary_msls':ev&=~data['pano'];cal&=~data['pano']
    assert ev.any() and cal.any(), f'{ds}: empty official evaluation or calibration split'
    assert (y[ev]>=0).any(), f'{ds}: no known held-out labels'
    overlap=np.intersect1d(np.unique(group[cal]),np.unique(group[ev]));before=int(cal.sum());cal&=~np.isin(group,overlap)
    audit={'dataset':ds,'all_rows':len(y),'sources':len(np.unique(source)),'columns_before':len([x for x in json.loads((EXP/'statements/prompts.json').read_text()) if x['dataset_id']==ds]),'columns_after':len(prompts),'eval_split':valname,'eval_rows':int(ev.sum()),'eval_sources':len(np.unique(source[ev])),'cal_rows':int(cal.sum()),'cal_overlap_rows_removed':before-int(cal.sum()),'overlapping_groups':len(overlap),'split_counts':dict(collections.Counter(split.tolist())),'quality_counts':dict(collections.Counter(quality.tolist())),'pano_rows':int(data['pano'].sum()),'packages':packs}
    assert not set(source[cal])&set(source[ev])
    if ds=='omnicity_v2_svi':
        # Eight street views correspond to one satellite footprint: evaluate one
        # source, using predeclared mean pooling as the primary association score.
        order=np.argsort(source,kind='stable');starts=np.r_[0,np.flatnonzero(np.diff(source[order]))+1];counts=np.diff(np.r_[starts,len(source)])
        np.savez_compressed(OUT/'truth'/'v2_association.npz',scores=s,raw=data['raw'],source=source,split=split,group=group)
        v2_max=np.maximum.reduceat(s[order],starts)
        s=np.add.reduceat(s[order],starts)/counts[:,None];y=y[order][starts];area=area[order][starts];group=group[order][starts];source=source[order][starts];ev=ev[order][starts];cal=cal[order][starts]
        audit.update(eval_rows=int(ev.sum()),cal_rows=int(cal.sum()),unit='source_mean_of_eight_views',raw_code_mapping={'1':'Background',**{str(int(e['label'].split(':')[0])+1):e['label'] for e in prompts}})
    rows=[];curves={};examples=[]
    for j,e in enumerate(prompts):
        r=metric(y[ev,j],s[ev,j],y[cal,j],s[cal,j],area[ev,j]);r.update(label=e['label'],statement=e['statement'],kind=e['kind'],aliases=e.get('aliases',[]));rows.append(r)
        if r.get('ap') is not None:
            keep=ev&(y[:,j]>=0);pr,rc,_=precision_recall_curve(y[keep,j],s[keep,j]);ix=np.unique(np.linspace(0,len(pr)-1,min(300,len(pr))).astype(int));curves[e['label']]={'precision':pr[ix].tolist(),'recall':rc[ix].tolist()}
    summary={'mAP':macro(rows,'ap'),'macro_auc':macro(rows,'auc'),'macro_f1':macro([r for r in rows if r.get('ap') is not None],'f1'),'macro_baseline_prevalence':macro([r for r in rows if r.get('ap') is not None],'prevalence'),'evaluable_classes':sum('ap' in r for r in rows),'threshold_classes':sum('threshold' in r for r in rows)}
    groups={}
    for kind in sorted(set(x['kind'] for x in prompts)):
        rr=[r for r in rows if r['kind']==kind];groups[kind]={'mAP':macro(rr,'ap'),'macro_f1':macro([r for r in rr if 'ap' in r],'f1'),'classes':sum('ap' in r for r in rr)}
    categorical={}
    attrs={k:[j for j,e in enumerate(prompts) if e['kind']==k] for k in groups if k.startswith('attribute:')}
    if ds=='mapillary_msls':attrs={'day_night':[j for j,e in enumerate(prompts) if e['label'] in ('day','night')],'direction':[j for j,e in enumerate(prompts) if e['label'] in ('Forward','Sideways','Backward')]}
    for kind,ix in attrs.items():
        keep=ev&(y[:,ix]>=0).all(1)&(y[:,ix].sum(1)==1);gt=y[keep][:,ix].argmax(1);pred=s[keep][:,ix].argmax(1)
        if len(gt):categorical[kind]={'n':len(gt),'labels':[prompts[j]['label'] for j in ix],'accuracy':float(accuracy_score(gt,pred)),'balanced_accuracy':float(balanced_accuracy_score(gt,pred)),'macro_f1':float(f1_score(gt,pred,average='macro',zero_division=0)),'confusion':confusion_matrix(gt,pred,labels=np.arange(len(ix))).tolist(),'majority_baseline':float(np.bincount(gt,minlength=len(ix)).max()/len(gt))}
    pooled={}
    if ds in ('cityscapes','omnicity_mono','omnicity_panorama'):
        unique,starts,counts=np.unique(source,return_index=True,return_counts=True)
        assert np.all(source[np.repeat(starts,counts)]==np.repeat(unique,counts)) if np.all(np.diff(source)>=0) else True
        # Sort once: source rows need not be in numeric order across packages.
        order=np.argsort(source,kind='stable');src=source[order];starts=np.r_[0,np.flatnonzero(np.diff(src))+1];counts=np.diff(np.r_[starts,len(src)])
        py=np.maximum.reduceat(y[order],starts);pa=np.maximum.reduceat(np.nan_to_num(area[order],nan=-1),starts);pa[pa<0]=np.nan
        pec=ev[order][starts];pcal=cal[order][starts]
        for method in ('max','mean'):
            ps=np.maximum.reduceat(s[order],starts) if method=='max' else np.add.reduceat(s[order],starts)/counts[:,None]
            rr=[metric(py[pec,j],ps[pec,j],py[pcal,j],ps[pcal,j],pa[pec,j]) for j in range(y.shape[1])]
            pooled[method]={'mAP':macro(rr,'ap'),'macro_f1':macro([r for r in rr if 'ap' in r],'f1'),'eval_sources':int(pec.sum()),'classes':[{**r,'label':prompts[j]['label']} for j,r in enumerate(rr)]}
    supplements={}
    if ds=='omnicity_v2_svi':
        rr=[metric(y[ev,j],v2_max[ev,j],y[cal,j],v2_max[cal,j],area[ev,j]) for j in range(y.shape[1])]
        pooled['max']={'mAP':macro(rr,'ap'),'macro_f1':macro(rr,'f1'),'eval_sources':int(ev.sum()),'classes':[{**r,'label':prompts[j]['label']} for j,r in enumerate(rr)]}
        good=ev&(area.sum(1)>0);gt=area[good].argmax(1);pred=s[good].argmax(1)
        categorical['dominant_landuse']={'n':len(gt),'labels':[e['label'] for e in prompts],'accuracy':float(accuracy_score(gt,pred)),'balanced_accuracy':float(balanced_accuracy_score(gt,pred)),'macro_f1':float(f1_score(gt,pred,average='macro',zero_division=0)),'confusion':confusion_matrix(gt,pred,labels=np.arange(len(prompts))).tolist(),'majority_baseline':float(np.bincount(gt,minlength=len(prompts)).max()/len(gt))}
    if ds=='cityscapes':
        co=(quality=='coarse')&(split=='coarse');rr=[metric(y[co,j],s[co,j],y[cal,j],s[cal,j],area[co,j]) for j in range(y.shape[1])]
        supplements['coarse_train_extra_diagnostic']={'rows':int(co.sum()),'mAP':macro(rr,'ap'),'not_heldout':True,'classes':[{**r,'label':prompts[j]['label']} for j,r in enumerate(rr)]}
    if ds=='mapillary_mtsd':
        partial=quality=='partially';supplements['partial_positive_only']={'rows':int(partial.sum()),'known_positive_pairs':int((y[partial]==1).sum()),'negative_pairs_used':0}
        with_thresh=[(j,r['threshold']) for j,r in enumerate(rows) if 'threshold' in r]
        for size,lo,hi in [('tiny',0,.001),('small',.001,.01),('large',.01,2)]:
            hit=total=0
            for j,th in with_thresh:
                mask=ev&(y[:,j]==1)&(area[:,j]>=lo)&(area[:,j]<hi);total+=int(mask.sum());hit+=int((s[mask,j]>=th).sum())
            supplements[size]={'positive_pairs':total,'recall_at_calibrated_threshold':hit/total if total else None}
    # Reproducible diagnostic examples, selected by errors for predefined concepts.
    wanted={'cityscapes':'car','bdd100k_10k':'person','mapillary_vistas':'object--traffic-light--general-upright','bdd100k_100k':'car','mapillary_mtsd':None}
    if ds in wanted:
        j=next((j for j,e in enumerate(prompts) if e['label']==wanted[ds]),None)
        if j is None:j=max(range(len(rows)),key=lambda j:rows[j]['positives'])
        if 'threshold' in rows[j]:
            th=rows[j]['threshold']
            for tag,mask,descending in [('FP',ev&(y[:,j]==0)&(s[:,j]>=th),True),('FN',ev&(y[:,j]==1)&(s[:,j]<th),False),('TP',ev&(y[:,j]==1)&(s[:,j]>=th),True)]:
                ids=np.flatnonzero(mask);ids=ids[np.argsort(s[ids,j])];ids=ids[::-1] if descending else ids
                for idx in ids[:2]:examples.append({'package':rowrefs[idx][0],'row':int(rowrefs[idx][1]),'label':prompts[j]['label'],'type':tag,'score':float(s[idx,j]),'threshold':th,'area':finite(area[idx,j]),'source':int(source[idx])})
    # Save held-out known labels/scores for group bootstrap and visualizations, no image embeddings.
    np.savez_compressed(OUT/'results'/f'{ds}_heldout.npz',y=y[ev],scores=s[ev],group=group[ev],source=source[ev],area=area[ev])
    result={'audit':audit,'summary':summary,'groups':groups,'classes':rows,'categorical':categorical,'pooled':pooled,'supplements':supplements,'curves':curves,'examples':examples}
    dump(OUT/'results'/f'{ds}.json',result);print(json.dumps({'stage':'metrics','dataset':ds,**summary}),flush=True)
    return audit


def self_test():
    r=metric(np.array([1,0,-1,1]),np.array([.9,.2,100,.8]),np.array([1]*5+[0]*5),np.array([.8]*5+[.2]*5))
    assert r['n']==3 and r['ap']==1 and r['f1']==1 and r['threshold']==.8
    r=metric(np.zeros(8,dtype=int),np.arange(8),np.zeros(10,dtype=int),np.arange(10))
    assert 'ap' not in r and 'threshold' not in r
    r=metric(np.array([1,1,0]),np.array([.1,.9,.2]),np.array([],int),np.array([]),np.array([.0001,.1,0]))
    assert r['area_0.001']['n']==2 and r['area_0.001']['ap']==1
    assert split_of({'source_uri':'a::image-mono-test/x.jpg'},'omnicity_mono')=='test'
    print('SELF_TEST_PASSED',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--stage',choices=['extract','metrics','all','test'],default='all');parser.add_argument('--workers',type=int,default=4);parser.add_argument('--dataset');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'results').mkdir(exist_ok=True)
    self_test()
    if args.stage=='test':raise SystemExit
    packages=[p.name for p in sorted(ROOT.iterdir()) if (p/'checkpoint.json').exists()]
    if args.dataset:packages=[p for p in packages if json.loads((ROOT/p/'checkpoint.json').read_text())['identity']['dataset_id']==args.dataset]
    if args.stage in ('extract','all'):
        with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
            result=list(pool.map(extract,packages))
        dump(OUT/'extraction.json',result)
    if args.stage in ('metrics','all'):
        datasets=sorted(set(json.loads((ROOT/p/'checkpoint.json').read_text())['identity']['dataset_id'] for p in packages))
        for ds in datasets:evaluate(ds)
    dump(OUT/'status.json',{'stage':'complete','requested_stage':args.stage,'time':time.time()})
