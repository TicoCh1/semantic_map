"""Compare semantic/geographic layouts and Gaussian region envelopes on cached PCA64.

Run into a new destination with --execute. Never changes atlas coordinates.
The historical BNG test covers a central 20 x 20 km square (5 x 4 km cores).
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import time

for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMBA_NUM_THREADS'):
    os.environ.setdefault(key,'6')
import numpy as np
from numba import njit
from scipy.ndimage import gaussian_filter, label as connected_labels
from scipy.spatial import cKDTree
from pyproj import Transformer
from sklearn.cluster import MiniBatchKMeans
from skimage.measure import find_contours, approximate_polygon
import pca64_pacmap_neighbor_atlas as atlas
atlas.numpy()


def rms(x):
    return float(np.sqrt(np.mean(np.sum(x*x,axis=1))))


def align_to_geography(y, g):
    """Center, use one uniform RMS scale, and rotate/reflect; never shear axes."""
    a=np.asarray(y,dtype=np.float64)-np.mean(y,axis=0)
    b=np.asarray(g,dtype=np.float64)-np.mean(g,axis=0)
    u,_,vt=np.linalg.svd(a.T@b)
    return (a@(u@vt)*rms(b)/max(rms(a),1e-12)+g.mean(axis=0)).astype(np.float32)


def geo_graph(g, neighbors=8, sigma=.3, radius=.6):
    d, j=cKDTree(g).query(g,k=neighbors+1,workers=6)
    i=np.repeat(np.arange(len(g)),neighbors)
    j=j[:,1:].ravel()
    d=d[:,1:].ravel()
    keep=(d>1e-9)&(d<=radius)
    edges=np.sort(np.column_stack((i[keep],j[keep])),axis=1)
    edges=np.unique(edges,axis=0).astype(np.int32)
    d=np.linalg.norm(g[edges[:,0]]-g[edges[:,1]],axis=1)
    return edges, np.exp(-.5*(d/sigma)**2).astype(np.float32)


@njit(cache=True)
def geo_gradient(y,g,edges,w,beta=.1):
    """Gradient of N*(weighted edge displacement MSE + beta*position MSE)."""
    grad=np.zeros_like(y)
    weight_sum=max(w.sum(),1e-12)
    coefficient=len(y)/weight_sum
    loss=0.
    for k in range(len(edges)):
        i,j=edges[k]
        for axis in range(2):
            delta=(y[i,axis]-y[j,axis])-(g[i,axis]-g[j,axis])
            loss+=coefficient*w[k]*delta*delta
            force=2*coefficient*w[k]*delta
            grad[i,axis]+=force
            grad[j,axis]-=force
    for i in range(len(y)):
        for axis in range(2):
            delta=y[i,axis]-g[i,axis]
            loss+=beta*delta*delta
            grad[i,axis]+=2*beta*delta
    return grad,loss


def optimize(impl,initial,pairs,g=None,edges=None,weights=None,geo_weight=0.,calibration=1.,progress=None):
    y=initial.astype(np.float32).copy()
    m=np.zeros_like(y);v=np.zeros_like(y)
    phases=(100,100,250)
    losses=[]
    for step in range(sum(phases)):
        wm,wn,wf=impl.find_weight(1000.,step,num_iters=phases)
        raw=impl.pacmap_grad(y,*pairs,wn,wm,wf)
        gradient=raw[:-1].copy()
        geo_loss=0.
        if geo_weight:
            gg,geo_loss=geo_gradient(y,g,edges,weights)
            gradient+=geo_weight*calibration*gg
        if not np.isfinite(gradient).all():
            raise RuntimeError('Non-finite layout gradient')
        m=.9*m+.1*gradient;v=.999*v+.001*gradient*gradient
        rate=np.sqrt(1-.999**(step+1))/(1-.9**(step+1))
        y-=rate*m/(np.sqrt(v)+1e-7)
        if step%50==0 or step==449:
            losses.append(dict(step=step,semantic=float(raw[-1,0])/len(y),geographic=float(geo_loss)/len(y)))
            if progress: progress(step)
    return y,losses


def gaussian_regions(xy,clusters,colors,bandwidth=.3,size=384):
    """Legacy envelope for the semantic/displaced layout comparison.

    One Gaussian over all points would show sampling density, not neighborhoods.
    Geographic outputs use the fixed meter grid in potato_bng_grid instead.
    Saved historical diagnostics can still reproduce this older raster.
    """
    low=xy.min(axis=0)-bandwidth*4
    high=xy.max(axis=0)+bandwidth*4
    span=high-low
    pixel=np.clip(((xy-low)/span*(size-1)).astype(int),0,size-1)
    count=int(clusters.max())+1
    fields=np.zeros((count,size,size),np.float32)
    for c in range(count):
        mask=clusters==c
        np.add.at(fields[c],(pixel[mask,1],pixel[mask,0]),1.)
        fields[c]=gaussian_filter(fields[c],sigma=bandwidth/(span[::-1]/(size-1)),mode='constant')
    total=fields.sum(axis=0)
    sorted_density=np.sort(total.ravel())[::-1]
    cutoff=sorted_density[np.searchsorted(np.cumsum(sorted_density),.9*sorted_density.sum())]
    support=total>=cutoff
    winner=fields.argmax(axis=0)
    polygons=[]
    for c in range(count):
        pieces,num=connected_labels(support&(winner==c))
        for p in range(1,num+1):
            mask=pieces==p
            if mask.sum()<20: continue
            paths=find_contours(np.pad(mask.astype(float),1),.5)
            for path in paths:
                path=approximate_polygon(path,tolerance=1.2)-1
                position=low+path[:,::-1]/(size-1)*span
                polygons.append(dict(cluster=c,areaPixels=int(mask.sum()),xy=np.round(position,3).tolist(),
                                     color=colors[c].tolist()))
    return dict(bandwidth=bandwidth,bounds=np.concatenate((low,high)).astype(float).tolist(),regions=polygons,
                components=sum(1 for c in range(count) for _ in [c] if (winner[support]==c).any()),
                supportMass=.9)


def metrics(y,g,feature_neighbors,queries,geo_neighbors):
    nn=cKDTree(y).query(y[queries],k=11,workers=6)[1][:,1:]
    recall=np.mean([len(set(a)&set(b))/10 for a,b in zip(nn,feature_neighbors)])
    geographic_recall=np.mean([len(set(a)&set(b))/10 for a,b in zip(nn,geo_neighbors)])
    delta=np.linalg.norm(y-g,axis=1)
    return dict(semanticRecall10=float(recall),geographicRecall10=float(geographic_recall),
                geographyDisplacementRmsKm=rms(y-g),geographyDisplacementMedianKm=float(np.median(delta)),
                geographyDisplacementP95Km=float(np.quantile(delta,.95)))


def render_saved_comparison(out):
    """Re-render completed numeric results without fitting or smoothing again."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    manifest=json.loads((out/'manifest.json').read_text())
    rgb=np.fromfile(out/'colors.rgb',np.uint8).reshape(-1,3)
    chosen=['geography','semantic','linear_0.75','joint_4','previous3d_projected']
    layouts={key:np.fromfile(out/f'{key}.bin','<f4').reshape(-1,2) for key in chosen}
    total=np.concatenate(list(layouts.values()))
    low=total.min(axis=0);high=total.max(axis=0)
    span=max(high-low)*1.08;center=(low+high)/2
    low=center-span/2;high=center+span/2
    fig,axes=plt.subplots(2,len(chosen),figsize=(20,9.5),layout='constrained')
    for col,key in enumerate(chosen):
        y=layouts[key]
        axes[0,col].scatter(y[:,0],y[:,1],s=.12,c=rgb/255,linewidths=0,rasterized=True)
        axes[0,col].set_title(key.replace('_',' '))
        region=json.loads((out/f'{key}-regions-0.3.json').read_text())
        for p in region['regions']:
            polygon=np.asarray(p['xy'])
            axes[1,col].fill(polygon[:,0],polygon[:,1],color=np.array(p['color'])/255,alpha=.7,linewidth=.3,edgecolor='#26313c')
        axes[1,col].set_title('Gaussian semantic envelopes / 0.30 km')
        for ax in axes[:,col]:
            ax.set_aspect('equal');ax.set_xlim(low[0],high[0]);ax.set_ylim(low[1],high[1])
            ax.set_xlabel('Layout x / km-equivalent');ax.set_ylabel('Layout y / km-equivalent');ax.grid(alpha=.12)
    fig.suptitle(f"London central BNG square — {manifest['rows']:,} panoramas — shared axes / fixed point colors",fontsize=16)
    fig.savefig(out/'comparison.png',dpi=180);fig.savefig(out/'comparison.pdf');plt.close(fig)


def run(args):
    started=time.time()
    out=args.output
    if (out/'manifest.json').exists(): raise RuntimeError('Use a new output directory')
    out.mkdir(parents=True,exist_ok=True)
    config=dict(version=1,halfSideMeters=args.half_side,
                sources=[atlas.stamp(args.cache/name) for name in ('pca64.npy','source_rows.npz','0_0.npz')],
                colors=atlas.stamp(args.native_points),seed=42,phases=[100,100,250])
    config_path=out/'experiment_config.json'
    if config_path.exists() and json.loads(config_path.read_text())!=config:
        raise RuntimeError('Experiment configuration/source provenance changed; use a new output')
    atlas.atomic_json(config_path,config)
    state=dict(status='running',stage='load',startedEpoch=started)
    def save(stage,**kw):
        state.update(stage=stage,**kw)
        atlas.atomic_json(out/'state.json',state)
        print(json.dumps(dict(stage=stage,**kw)),flush=True)
    save('load')
    xall=np.load(args.cache/'pca64.npy',mmap_mode='r')
    with np.load(args.cache/'source_rows.npz') as source:
        reference=source['reference'].copy()
    to_bng=Transformer.from_crs(4326,27700,always_xy=True)
    e,n=to_bng.transform(reference[:,1],reference[:,2])
    center=np.array(to_bng.transform(-.11559,51.51024))
    g=np.column_stack((e,n))-center
    ids=np.flatnonzero(np.all((g>=-args.half_side)&(g<args.half_side),axis=1))
    g=(g[ids]/1000).astype(np.float32)
    x=np.asarray(xall[ids],np.float32)
    with np.load(args.cache/'0_0.npz') as saved:
        assert np.array_equal(saved['ids'],np.arange(len(reference))) and saved['core'].all()
        old_y=saved['y'][ids].copy()
    records=np.fromfile(args.native_points,dtype=np.dtype([('xy','<f4',(2,)),('rgba','u1',(4,))]))
    assert len(records)==len(reference)
    rgb=records['rgba'][ids,:3].copy()
    np.savez_compressed(out/'source.npz',ids=ids,geography_km=g,pca64=x,previous3d=old_y,colors=rgb)
    save('prepare_pairs',rows=len(ids))
    c=json.loads(atlas.DEFAULT_CONFIG.read_text())
    impl=atlas.pacmap_backend(c)
    import faiss
    faiss.omp_set_num_threads(6)
    model=impl.PaCMAP(n_components=2,n_neighbors=10,MN_ratio=.5,FP_ratio=2.,apply_pca=False,random_state=42,knn_backend='faiss')
    model.decide_num_pairs(len(x))
    model.sample_pairs(np.ascontiguousarray(x/max(np.std(x),1e-12)),save_tree=False)
    pairs=[np.ascontiguousarray(p,dtype=np.int32) for p in (model.pair_neighbors,model.pair_MN,model.pair_FP)]
    edges,w=geo_graph(g)
    initial=x[:,:2]-x[:,:2].mean(axis=0)
    initial*=.01/max(np.std(initial),1e-12)
    save('pure_semantic_fit')
    checkpoint=out/'semantic_checkpoint.npz'
    if checkpoint.exists():
        with np.load(checkpoint) as saved:
            np.testing.assert_array_equal(saved['ids'],ids)
            raw_sem=saved['y'].copy()
        loss=json.loads((out/'semantic_trace.json').read_text())
    else:
        raw_sem,loss=optimize(impl,initial,pairs,progress=lambda s:save('pure_semantic_fit',iteration=s))
        atlas.atomic_npz(checkpoint,ids=ids,y=raw_sem)
        atlas.atomic_json(out/'semantic_trace.json',loss)
    sem=align_to_geography(raw_sem,g)
    # Preserve PaCMAP's scale inside the optimizer; map final outputs with one fixed scalar.
    factor=rms(raw_sem-raw_sem.mean(axis=0))/rms(g-g.mean(axis=0))
    target=(g-g.mean(axis=0))*factor
    semantic_optimizer=(sem-g.mean(axis=0))*factor
    joint_initial=(semantic_optimizer+target)/2
    final_raw=impl.pacmap_grad(joint_initial,*pairs,1.,0.,1.)[:-1]
    geo_raw,_=geo_gradient(joint_initial,target,edges,w)
    calibration=rms(final_raw)/max(rms(geo_raw),1e-12)
    layouts={'geography':g,'semantic':sem}
    for alpha in (.25,.5,.75): layouts[f'linear_{alpha:g}']=((1-alpha)*sem+alpha*g).astype(np.float32)
    optimization={'semantic':loss}
    for weight in (.25,1.,4.):
        key=f'joint_{weight:g}'
        save(key)
        checkpoint=out/f'{key}_checkpoint.npz'
        if checkpoint.exists():
            with np.load(checkpoint) as saved:
                np.testing.assert_array_equal(saved['ids'],ids)
                y=saved['y'].copy()
            trace=json.loads((out/f'{key}_trace.json').read_text())
        else:
            y,trace=optimize(impl,joint_initial,pairs,target,edges,w,weight,calibration,
                             progress=lambda s:save(key,iteration=s))
            atlas.atomic_npz(checkpoint,ids=ids,y=y)
            atlas.atomic_json(out/f'{key}_trace.json',trace)
        layouts[key]=(y/factor+g.mean(axis=0)).astype(np.float32)
        optimization[key]=trace
    u,s,vt=np.linalg.svd(old_y-old_y.mean(axis=0),full_matrices=False)
    layouts['previous3d_projected']=align_to_geography((old_y-old_y.mean(axis=0))@vt[:2].T,g)
    projection_variance=float((s[:2]**2).sum()/(s**2).sum())
    save('diagnostics_and_regions')
    queries=np.sort(np.random.default_rng(20261002).choice(len(x),size=min(256,len(x)),replace=False))
    index=faiss.IndexFlatL2(64);index.add(x)
    feature_neighbors=index.search(x[queries],11)[1][:,1:]
    geo_neighbors=cKDTree(g).query(g[queries],k=11,workers=6)[1][:,1:]
    labels=MiniBatchKMeans(n_clusters=18,random_state=42,batch_size=4096,n_init=3).fit_predict(x).astype(np.int32)
    cluster_colors=np.array([np.median(rgb[labels==k],axis=0) for k in range(18)],dtype=np.uint8)
    # Deliberate categorical colors distinguish density ownership, not embedding distance.
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    palette=(plt.get_cmap('tab20')(np.arange(18))[:,:3]*255).astype(np.uint8)
    rgb.tofile(out/'colors.rgb');labels.astype('<u2').tofile(out/'clusters.bin');ids.astype('<u4').tofile(out/'source_ids.bin')
    result=[]
    for key,y in layouts.items():
        y.astype('<f4').tofile(out/f'{key}.bin')
        atlas.atomic_json(out/f'{key}-metrics.json',metrics(y,g,feature_neighbors,queries,geo_neighbors))
        region_paths={}
        for bandwidth in (.15,.3,.6):
            path=f'{key}-regions-{bandwidth:g}.json'
            if key=='geography':
                from potato_bng_grid import BngGrid,density_fields,regions_from_fields
                bng_grid=BngGrid.covering([*(center-args.half_side),*(center+args.half_side)],padding_meters=2400)
                density=regions_from_fields(density_fields(y.astype(float)*1000+center,labels,len(palette),bng_grid,bandwidth*1000),
                                            bng_grid,palette,bandwidth*1000)
                # This research viewer uses local km for all panel axes. Keep
                # that serialization while rasterizing on absolute BNG meters.
                for region in density['regions']:
                    region['xy']=((np.asarray(region['xy'])-center)/1000).tolist()
                density['coordinateUnits']='kilometers relative to BNG center'
                density['coordinateOriginMeters']=center.tolist()
                density['bandwidth']=bandwidth
            else:
                density=gaussian_regions(y,labels,palette,bandwidth)
            atlas.atomic_json(out/path,density)
            region_paths[str(bandwidth)]=path
        result.append(dict(id=key,bin=f'{key}.bin',metrics=metrics(y,g,feature_neighbors,queries,geo_neighbors),regions=region_paths))
    manifest=dict(dataset='london_512_8_45_8B',sourceRows=len(xall),rows=len(x),centerLonLat=[-.11559,51.51024],
                  selection=dict(crs='EPSG:27700',halfSideMeters=args.half_side,precedent='BNG 2 km radius, central 5x5 grid'),
                  pairCounts=[len(p) for p in pairs],geoGraph=dict(edges=len(edges),neighbors=8,sigmaKm=.3,maxRadiusKm=.6,positionPenalty=.1),
                  jointCalibration=calibration,projection3dTo2dVariance=projection_variance,diagnosticQueries=len(queries),
                  clusters=18,clusterColors=palette.tolist(),nativeClusterColors=cluster_colors.tolist(),layouts=result,
                  semanticLoss='Pinned PaCMAP 0.9.1 neighbor / mid-near / far-pair objective',
                  geographicLoss='N * (weighted geographic edge displacement MSE + 0.1 absolute position MSE)',
                  units='Ground km on geography; RMS-scaled km-equivalent on semantic/displaced layouts',
                  optimization=optimization)
    atlas.atomic_json(out/'manifest.json',manifest)
    render_saved_comparison(out)
    save('complete',status='complete',seconds=time.time()-started)


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--cache',type=Path,required=True)
    p.add_argument('--native-points',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--half-side',type=float,default=10000)
    p.add_argument('--execute',action='store_true')
    p.add_argument('--render-existing',action='store_true',help='Render saved results only; never fit')
    args=p.parse_args()
    if not args.execute: print('Plan only; add --execute to compute')
    elif args.render_existing: render_saved_comparison(args.output)
    else: run(args)
