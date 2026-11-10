"""Encode compatible cached 8B view embeddings with a frozen SAE on RunPod.

No training, new centering fit or backbone call. For a new analysis region of
the existing ULEV corpus, reuse sparse_indices.npy/sparse_values.npy directly.
"""
import argparse,json,time
from pathlib import Path
import numpy as np
import torch
from torch.nn import functional as F
from train_london_sae import SAE,D,K

def main():
    p=argparse.ArgumentParser();p.add_argument('--checkpoint',type=Path,required=True);p.add_argument('--input-dir',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True);p.add_argument('--batch-panoramas',type=int,default=128);args=p.parse_args()
    if args.output_dir.exists():raise FileExistsError('Use a new output directory; never overwrite an existing sparse cache')
    ck=torch.load(args.checkpoint,map_location='cuda',weights_only=False);state=ck['state']
    model=SAE(state['mean'],state['scale']).cuda();model.load_state_dict(state);model.eval()
    shards=[];total=0
    for path in sorted(args.input_dir.glob('views_emb_shard_*.npy')):
        if path.stem.endswith('_ref'):continue
        a=np.load(path,mmap_mode='r');assert a.ndim==3 and a.shape[1:]==(8,D)
        shards.append((path,total,len(a)));total+=len(a)
    assert total>0 and args.batch_panoramas>0
    args.output_dir.mkdir(parents=True);started=time.time()
    ii=np.lib.format.open_memmap(args.output_dir/'sparse_indices.npy',mode='w+',dtype=np.uint16,shape=(total*8,K))
    vv=np.lib.format.open_memmap(args.output_dir/'sparse_values.npy',mode='w+',dtype=np.float16,shape=(total*8,K))
    with torch.inference_mode():
        for path,offset,count in shards:
            a=np.load(path,mmap_mode='r')
            for start in range(0,count,args.batch_panoramas):
                x=torch.from_numpy(np.array(a[start:start+args.batch_panoramas])).to('cuda').reshape(-1,D).float()
                assert bool(torch.isfinite(x).all())
                x=F.normalize(x,dim=-1).half().float()
                with torch.autocast('cuda',dtype=torch.bfloat16):y,h,v,i=model.encode(x,K)
                lo=(offset+start)*8;ii[lo:lo+len(x)]=i.cpu().numpy();vv[lo:lo+len(x)]=v.float().cpu().numpy()
            print(json.dumps(dict(encoded_panoramas=offset+count,total_panoramas=total)),flush=True)
    ii.flush();vv.flush()
    (args.output_dir/'encoding_manifest.json').write_text(json.dumps(dict(checkpoint=str(args.checkpoint),model_step=ck['step'],training_performed=False,centering_refitted=False,
        panoramas=total,views=total*8,dimensions=D,k=K,input_dir=str(args.input_dir),seconds=time.time()-started,shards=[dict(path=str(path),offset=offset,rows=count,bytes=path.stat().st_size) for path,offset,count in shards]),indent=2))

if __name__=='__main__':main()
