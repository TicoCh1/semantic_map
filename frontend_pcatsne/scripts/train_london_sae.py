"""Train a view-level TopK SAE and explain saved BNG potato components on RunPod.

No backbone rerun, text prompt probing, PCA refit, or geometry mutation. Inputs
are cached native Qwen3-VL-Embedding-8B image vectors. Generation is a separate
vision-grounded labelling stage, not a claim that sparse atoms are monosemantic.
"""
from __future__ import annotations
import argparse, json, math, os, time, traceback, shutil
from pathlib import Path
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

ROOT=Path('/workspace/semantic_notebooks/london_sae_concepts_20261003')
DATA=Path('/workspace/reruns/pano512_8B_q90_20260915_b200/embedding/london_512_8_45_8B')
ATLAS=Path('/workspace/semantic_notebooks/london_4096_pca64_pacmap_neighbor_atlas_v1')
D=4096; H=16384; K=64; SEED=20261003

def save(name,obj):
    p=ROOT/name;p.parent.mkdir(parents=True,exist_ok=True)
    t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n');t.replace(p)

def progress(stage,**kw):
    s=dict(stage=stage,pid=os.getpid(),updated=time.time(),**kw);save('state.json',s);print(json.dumps(s),flush=True)

class SAE(nn.Module):
    def __init__(self,mean,scale):
        super().__init__();self.register_buffer('mean',mean);self.register_buffer('scale',scale)
        self.encoder=nn.Linear(D,H);self.decoder=nn.Linear(H,D,bias=False)
        with torch.no_grad():
            self.decoder.weight.copy_(F.normalize(torch.randn(D,H,device=mean.device),dim=0))
            self.encoder.weight.copy_(self.decoder.weight.T);self.encoder.bias.zero_()
        self.register_buffer('last_active',torch.zeros(H,dtype=torch.long,device=mean.device))
    def encode(self,x,k=K):
        y=(x.float()-self.mean)*self.scale;h=self.encoder(y)
        v,i=torch.topk(F.relu(h),k,dim=-1,sorted=False)
        return y,h,v,i
    def reconstruct(self,y,h,v,i):
        z=torch.zeros_like(h).scatter(-1,i,v);return self.decoder(z)

def sources():
    shards=[];offset=0
    for p in sorted(DATA.glob('views_emb_shard_*.npy')):
        if p.stem.endswith('_ref'):continue
        a=np.load(p,mmap_mode='r');assert a.ndim==3 and a.shape[1:]==(8,D),p
        shards.append(dict(number=int(p.stem.rsplit('_',1)[1]),offset=offset,rows=len(a),path=str(p),bytes=p.stat().st_size))
        offset+=len(a)
    assert offset==156880,(offset,'Unexpected dataset, do not silently switch input')
    return shards,offset

def load_data():
    torch.manual_seed(SEED);np.random.seed(SEED);torch.set_num_threads(8)
    torch.backends.cuda.matmul.allow_tf32=True
    shards,n=sources();a=torch.empty((n*8,D),dtype=torch.float16,device='cuda')
    for s in shards:
        x=np.load(s['path'],mmap_mode='r')
        for start in range(0,len(x),2048):
            block=torch.from_numpy(np.array(x[start:start+2048])).to('cuda').reshape(-1,D)
            block=F.normalize(block.float(),dim=-1).half()
            a[(s['offset']+start)*8:(s['offset']+start)*8+len(block)].copy_(block)
        progress('loading',shard=s['number'],loaded_panoramas=s['offset']+s['rows'],total_panoramas=n)
    from pyproj import Transformer
    ref=np.load(ATLAS/'source_rows.npz')['reference']
    assert len(ref)==n
    x,y=Transformer.from_crs(4326,27700,always_xy=True).transform(ref[:,1],ref[:,2])
    # Reserve entire 1 km BNG blocks, all 8 views of a panorama stay together.
    bx=np.floor(np.asarray(x)/1000).astype(np.int64);by=np.floor(np.asarray(y)/1000).astype(np.int64)
    held=(bx*73856093 ^ by*19349663 ^ SEED)%10==0
    tr=np.flatnonzero(np.repeat(~held,8));va=np.flatnonzero(np.repeat(held,8))
    assert len(tr)>500000 and len(va)>10000
    train=torch.as_tensor(tr,device='cuda');valid=torch.as_tensor(va,device='cuda')
    mean=torch.zeros(D,device='cuda');energy=torch.zeros((),device='cuda')
    for inds in train.split(8192):mean+=a[inds].float().sum(0)
    mean/=len(train)
    for inds in train.split(8192):energy+=((a[inds].float()-mean)**2).sum()
    scale=(energy/len(train)).rsqrt()
    save('input_manifest.json',dict(dataset=DATA.name,shards=shards,panoramas=n,views=n*8,dimension=D,
        training_views=len(tr),validation_views=len(va),split='Deterministic held-out 1 km BNG blocks; all panorama views together',
        hidden=H,k=K,seed=SEED,normalization='L2 view input; subtract training mean; scale mean squared centered norm to one',
        source_atlas=str(ATLAS),root=str(ROOT),device=torch.cuda.get_device_name(),gpu_memory_bytes=torch.cuda.get_device_properties(0).total_memory))
    np.save(ROOT/'heldout_panoramas.npy',held)
    return a,train,valid,mean,scale

@torch.no_grad()
def evaluate(model,data,indices):
    total=err=cos=basecos=0.;counts=torch.zeros(H,device='cuda',dtype=torch.long)
    chosen=indices[torch.linspace(0,len(indices)-1,min(8192,len(indices)),device='cuda').long()]
    for ids in chosen.split(512):
        x=data[ids].float()
        with torch.autocast('cuda',dtype=torch.bfloat16):
            y,h,v,i=model.encode(x);rec=model.reconstruct(y,h,v,i)
        rec=rec.float();total+=float(y.square().sum());err+=float((y-rec).square().sum())
        cos+=float(F.cosine_similarity(x,rec/model.scale+model.mean).sum())
        basecos+=float(F.cosine_similarity(x,model.mean[None].expand_as(x)).sum())
        counts.scatter_add_(0,i[v>0],torch.ones_like(i[v>0]))
    return dict(fvu=err/total,explained_variance=1-err/total,cosine=cos/len(chosen),mean_baseline_cosine=basecos/len(chosen),
        positive_features=int((counts>0).sum()),evaluated_views=len(chosen))

def train(steps=6000):
    started=time.time();data,tr,va,mean,scale=load_data();model=SAE(mean,scale).cuda()
    opt=torch.optim.Adam(model.parameters(),lr=2e-4,betas=(.9,.999),eps=1e-8,fused=True)
    history=[];best=math.inf
    initial=evaluate(model,data,va);save('initial_evaluation.json',initial)
    torch.cuda.reset_peak_memory_stats();training_start=time.time()
    for step in range(1,steps+1):
        idx=tr[torch.randint(len(tr),(512,),device='cuda')];x=data[idx].float()
        k=round(128-64*min(1,step/600));opt.zero_grad(set_to_none=True)
        with torch.autocast('cuda',dtype=torch.bfloat16):
            y,h,v,i=model.encode(x,k);rec=model.reconstruct(y,h,v,i)
            main=(y-rec.float()).square().sum(-1).mean()
            cos=(1-F.cosine_similarity(x,rec.float()/scale+mean)).mean()
            dead=(step-model.last_active)>250
            aux=torch.zeros((),device='cuda')
            if step>250 and bool(dead.any()):
                ah=F.softplus(h.float()).masked_fill(~dead,0)
                av,ai=torch.topk(ah,min(32,int(dead.sum())),dim=-1)
                az=torch.zeros_like(h).scatter(-1,ai,av.to(h.dtype))
                ar=model.decoder(az).float()
                aux=((y-rec.float()).detach()-ar).square().sum(-1).mean()
            loss=main+.05*cos+.02*aux
        if not torch.isfinite(loss):raise RuntimeError(f'Non-finite loss at {step}')
        loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1.0);opt.step()
        with torch.no_grad():
            model.last_active[i[v>0]]=step
            model.decoder.weight.copy_(F.normalize(model.decoder.weight,dim=0))
        if step%100==0:
            elapsed=time.time()-training_start
            progress('training',step=step,steps=steps,k=k,loss=float(loss),reconstruction_loss=float(main),
                seconds_per_step=elapsed/step,eta_seconds=(steps-step)*elapsed/step,
                dead_last_250_steps=int((step-model.last_active>250).sum()),peak_gpu_gb=torch.cuda.max_memory_allocated()/1e9)
        if step%500==0 or step==steps:
            ev=evaluate(model,data,va);tv=evaluate(model,data,tr)
            entry=dict(step=step,validation=ev,training=tv,seconds=time.time()-started);history.append(entry);save('training_history.json',history)
            print('evaluation',json.dumps(entry),flush=True)
            if ev['fvu']<best:
                best=ev['fvu'];torch.save(dict(state=model.state_dict(),step=step,metrics=ev,hidden=H,k=K),ROOT/'best.pt')
    ck=torch.load(ROOT/'best.pt',weights_only=False,map_location='cuda');model.load_state_dict(ck['state'])
    final=evaluate(model,data,va)
    save('training_summary.json',dict(status='complete',best_step=ck['step'],initial=initial,final=final,
        total_seconds=time.time()-started,train_seconds=time.time()-training_start,steps=steps,batch_size=512,
        checkpoint_bytes=(ROOT/'best.pt').stat().st_size,peak_gpu_gb=torch.cuda.max_memory_allocated()/1e9,
        limitations=['Unsupervised reconstruction SAE, not full retrieval-trained PUMA.',
        'Feature names are candidate visual interpretations; reconstruction alone does not prove monosemanticity.',
        'Spatial holdout tests reconstruction transfer, not semantic naming accuracy.']))
    export(model,data)

@torch.no_grad()
def export(model,data):
    from shapely.geometry import shape
    from shapely import contains_xy
    inputs=ROOT/'inputs';ids=np.load(inputs/'ids.npy');p=np.fromfile(inputs/'points.bin',dtype=[('xy','<f8',(2,)),('group','<u2')])
    metric=json.loads((inputs/'metric.json').read_text());assert len(metric['features'])==169 and len(ids)==len(p)==134384
    ref=np.load(ATLAS/'source_rows.npz')['reference'];from pyproj import Transformer
    xx,yy=Transformer.from_crs(4326,27700,always_xy=True).transform(ref[ids,1],ref[ids,2])
    drift=float(np.max(np.linalg.norm(p['xy']-np.column_stack((xx,yy)),axis=-1)));assert drift<.1,drift
    np.save(ROOT/'roi_ids.npy',ids)
    # Cache sparse codes; no dense N x H file and no backbone inference.
    n=len(data);ii=np.lib.format.open_memmap(ROOT/'sparse_indices.npy',mode='w+',dtype=np.uint16,shape=(n,K))
    vv=np.lib.format.open_memmap(ROOT/'sparse_values.npy',mode='w+',dtype=np.float16,shape=(n,K))
    sums=np.zeros(H,np.float64);freq=np.zeros(H,np.int64);topval=np.zeros((H,12),np.float32);topid=np.full((H,12),-1,np.int64)
    for start in range(0,n,1024):
        with torch.autocast('cuda',dtype=torch.bfloat16):y,h,v,i=model.encode(data[start:start+1024].float())
        ind=i.cpu().numpy();val=v.float().cpu().numpy();ii[start:start+len(ind)]=ind;vv[start:start+len(ind)]=val
        np.add.at(sums,ind.ravel(),val.ravel());np.add.at(freq,ind[val>0],1)
        # Exact top-12 view exemplars per feature; retain one view per panorama below.
        flat=ind.ravel();vals=val.ravel();views=np.repeat(np.arange(start,start+len(ind)),K)
        order=np.lexsort((-vals,flat));sf=flat[order];sv=vals[order];si=views[order]
        cuts=np.flatnonzero(np.r_[True,sf[1:]!=sf[:-1],True])
        for lo,hi in zip(cuts[:-1],cuts[1:]):
            f=sf[lo];cv=np.r_[topval[f],sv[lo:min(lo+12,hi)]];ci=np.r_[topid[f],si[lo:min(lo+12,hi)]]
            chosen=np.argsort(-cv)[:12];topval[f]=cv[chosen];topid[f]=ci[chosen]
        if start%51200==0:progress('encoding',views=start,total_views=n)
    ii.flush();vv.flush();np.savez_compressed(ROOT/'feature_statistics.npz',mean=sums/n,frequency=freq/n,top_values=topval,top_views=topid)
    baseline=sums/n;frequency=freq/n
    records=[];all_features=set()
    for b,f in enumerate(metric['features']):
        props=f['properties'];mask=contains_xy(shape(f['geometry']),p['xy'][:,0],p['xy'][:,1]);rows=np.flatnonzero(mask)
        matching=rows[p['group'][rows]==props['group']-1]
        used=matching if len(matching)>=4 else rows
        ninside=len(rows);view_ids=(ids[used,None]*8+np.arange(8)).ravel()
        local=np.zeros(H,np.float64);lf=np.zeros(H,np.float64)
        for vs in np.array_split(view_ids,max(1,len(view_ids)//8192+1)):
            ind=ii[vs];val=vv[vs].astype(np.float32);np.add.at(local,ind.ravel(),val.ravel());np.add.at(lf,ind[val>0],1)
        if len(view_ids):local/=len(view_ids);lf/=len(view_ids)
        # Rank by excess activation times enrichment; discourage one-image atoms.
        score=np.maximum(0,local-baseline)*np.log1p(local/(baseline+1e-8))
        score[lf*len(view_ids)<min(3,max(1,len(view_ids)))]=0
        features=np.argsort(-score)[:5] if len(view_ids) else np.array([],dtype=int)
        features=[int(t) for t in features if score[t]>0]
        fs=[];reps=[]
        for feature in features:
            a=np.where(ii[view_ids]==feature,vv[view_ids],0).max(-1)
            picks=np.argsort(-a);distinct=[];panos=set()
            for j in picks:
                if a[j]<=0:break
                vi=int(view_ids[j]);pan=vi//8
                if pan in panos:continue
                panos.add(pan);distinct.append(dict(view_id=vi,source_row=pan,view_index=vi%8,activation=float(a[j]),lon=float(ref[pan,1]),lat=float(ref[pan,2])))
                if len(distinct)==4:break
            fs.append(dict(feature_id=feature,mean_activation=float(local[feature]),global_mean=float(baseline[feature]),
                activation_enrichment=float(local[feature]/(baseline[feature]+1e-8)),view_prevalence=float(lf[feature]),examples=distinct))
            all_features.add(feature)
        # Bubble board: distinct street locations from strongest distinct atoms.
        seen=set()
        for rank in range(4):
            for ff in fs[:3]:
                if rank<len(ff['examples']):
                    e=ff['examples'][rank]
                    if e['source_row'] not in seen:reps.append(e);seen.add(e['source_row'])
                    if len(reps)==6:break
            if len(reps)==6:break
        record=dict(id=str(f['id']),group=int(props['group']),area_km2=props['areaKm2'],inside_panoramas=ninside,
            matching_panoramas=len(matching),analysis_panoramas=len(used),sample_basis='matching semantic group' if len(matching)>=4 else 'all interior points',
            status='supported' if len(used)>=10 else 'limited_evidence' if len(used) else 'no_interior_data',features=fs,representatives=reps)
        records.append(record)
        if b%20==0:progress('bubble_statistics',completed=b+1,total=169)
    # Limit concept naming to atoms actually selected for bubble explanations.
    concepts=[]
    for f in sorted(all_features):
        examples=[];seen=set()
        for vi,value in zip(topid[f],topval[f]):
            if vi<0 or value<=0:continue
            vi=int(vi);pan=vi//8
            if pan in seen:continue
            seen.add(pan);examples.append(dict(view_id=vi,source_row=pan,view_index=vi%8,activation=float(value),lon=float(ref[pan,1]),lat=float(ref[pan,2])))
            if len(examples)==6:break
        concepts.append(dict(feature_id=f,mean_activation=float(baseline[f]),view_prevalence=float(frequency[f]),examples=examples))
    save('bubble_statistics.json',dict(geometry_key='500-80-parks-30000-100',coordinate_system='EPSG:27700',
        alignment_max_meters=drift,bubbles=records,concepts=concepts,positive_features=int((freq>0).sum()),dead_features=int((freq==0).sum())))
    progress('sae_and_statistics_complete',bubbles=len(records),concepts=len(concepts),positive_features=int((freq>0).sum()))

def full_fit(epochs=2):
    """After independent geographic validation, visit every source view exactly.

    Keep the fitted centering transform fixed and archive the independently
    evaluated checkpoint. Metrics after this stage are in-sample diagnostics.
    """
    started=time.time();data,tr,va,mean,scale=load_data();model=SAE(mean,scale).cuda()
    ck=torch.load(ROOT/'best.pt',weights_only=False,map_location='cuda');model.load_state_dict(ck['state'])
    archive=ROOT/'geographic_validation_checkpoint.pt'
    if archive.exists():raise RuntimeError('Full-data finalization already started; inspect instead of repeating')
    shutil.copyfile(ROOT/'best.pt',archive)
    opt=torch.optim.Adam(model.parameters(),lr=2e-5,betas=(.9,.999),fused=True)
    total=math.ceil(len(data)/512)*epochs;step=0
    for epoch in range(epochs):
        order=torch.randperm(len(data),device='cuda')
        for ids in order.split(512):
            step+=1;x=data[ids].float();opt.zero_grad(set_to_none=True)
            with torch.autocast('cuda',dtype=torch.bfloat16):
                y,h,v,i=model.encode(x);rec=model.reconstruct(y,h,v,i)
                loss=(y-rec.float()).square().sum(-1).mean()+.05*(1-F.cosine_similarity(x,rec.float()/model.scale+model.mean)).mean()
            if not torch.isfinite(loss):raise RuntimeError('Non-finite full-fit loss')
            loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1.0);opt.step()
            with torch.no_grad():model.decoder.weight.copy_(F.normalize(model.decoder.weight,dim=0))
            if step%100==0:progress('full_data_finalization',step=step,steps=total,epoch=epoch+1,epochs=epochs,loss=float(loss),eta_seconds=(total-step)*(time.time()-started)/step)
    diag=evaluate(model,data,torch.arange(len(data),device='cuda'))
    torch.save(dict(state=model.state_dict(),step=ck['step']+step,metrics=diag,hidden=H,k=K,full_data_epochs=epochs),ROOT/'best.pt')
    receipt=dict(epochs=epochs,views_per_epoch=len(data),total_view_visits=epochs*len(data),each_view_seen=epochs,steps=step,
        seconds=time.time()-started,diagnostics=diag,metric_scope='In-sample after all-source finalization; independent validation checkpoint archived separately')
    save('full_fit_summary.json',receipt)
    summary=json.loads((ROOT/'training_summary.json').read_text());summary['full_fit']=receipt
    summary['final_metric_scope']='Independent geographic holdout before full-data finalization';save('training_summary.json',summary)
    manifest=json.loads((ROOT/'input_manifest.json').read_text());manifest['initial_training_views']=manifest['training_views'];manifest['initial_validation_views']=manifest['validation_views']
    manifest.update(training_views=len(data),validation_views=0,full_data_epochs=epochs,split='Initial geographic block holdout evaluation, followed by two complete passes over ALL source views')
    save('input_manifest.json',manifest);export(model,data)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--steps',type=int,default=6000);parser.add_argument('--export-only',action='store_true');parser.add_argument('--full-fit',action='store_true');args=parser.parse_args()
    ROOT.mkdir(parents=True,exist_ok=True)
    try:
        if args.full_fit:full_fit()
        elif args.export_only:
            data,tr,va,mean,scale=load_data();model=SAE(mean,scale).cuda();ck=torch.load(ROOT/'best.pt',weights_only=False);model.load_state_dict(ck['state']);export(model,data)
        else:train(args.steps)
    except Exception as e:progress('failed',error=str(e),traceback=traceback.format_exc());raise
