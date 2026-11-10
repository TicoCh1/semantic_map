"""Refit only 2 km patches from an edge root, reusing committed global PCA64.

All outputs are isolated. Default invocation only prints a plan. A root-centered
Manhattan traversal retains the existing fit, halo and hard shared-row policy.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import time

import pca64_pacmap_neighbor_atlas as atlas


def ordered_patches(patches, root):
    if root not in {(p[0], p[1]) for p in patches}:
        raise ValueError("Experimental root is not an occupied patch")
    return sorted(patches, key=lambda p: (abs(p[0]-root[0])+abs(p[1]-root[1]), -p[0], -p[1]))


def metrics(x, y, rgb, palette, seed):
    np = atlas.numpy()
    from experiment_affine_colors import rgb_to_lab
    eig = np.linalg.eigvalsh(np.cov(y.astype(np.float64), rowvar=False))
    lab = rgb_to_lab(rgb.astype(np.float64)/255)
    prelab = (y-palette['coordinate_origin'])*palette['uniform_scale']+palette['oklab_origin']
    return dict(rows=len(y), coordinate_variance=float(eig.sum()), eigenvalues=eig.tolist(),
                effective_dimensions=float(eig.sum()**2 / max(float(eig@eig), 1e-20)),
                coordinate_mean=y.mean(0).tolist(), mean_oklab=lab.mean(0).tolist(),
                oklab_variance=float(np.var(lab, axis=0, ddof=1).sum()),
                before_gamut_oklab_variance=float(np.var(prelab, axis=0, ddof=1).sum()),
                mean_chroma=float(np.linalg.norm(lab[:,1:],axis=1).mean()),
                recall=atlas.neighborhood_recall(x, y, seed))


def run(c, source, out, root):
    np = atlas.numpy()
    impl = atlas.pacmap_backend(c)
    if source == out or source in out.parents or out in source.parents:
        raise ValueError("Experiment must use a separate non-nested output tree")
    original = json.loads((source/'patches/2km/complete.json').read_text())
    if original['core_rows'] != original['rows']:
        raise ValueError("Original 2 km atlas is not complete")
    x = np.load(source/'pca64.npy', mmap_mode='r', allow_pickle=False)
    with np.load(source/'source_rows.npz', allow_pickle=False) as a:
        xy = a['xy'].copy()
    center = atlas.mercator(np.asarray([c['center_lon_lat']]))[0]
    patches = ordered_patches(atlas.grid_patches(xy, center, 2000, c['halo_meters']), root)
    report = dict(root_grid=list(root), source=str(source), output=str(out),
                  pca_recomputed=False, scales_km=[2], patches=[])
    started = time.monotonic()
    with atlas.writer_lock(out):
        if (out/'run_config.json').exists():
            raise RuntimeError("Use a fresh experiment directory; do not mix traversals")
        atlas.atomic_json(out/'run_config.json', dict(c, root_grid=list(root), source_output=str(source)))
        # Export reads these caches; links avoid copying or fitting the shared PCA.
        for name in ('pca64.npy', 'source_rows.npz', 'prepared.json'):
            os.link(source/name, out/name)
        directory = out/'patches/2km'
        directory.mkdir(parents=True)
        registry = np.full((len(x),3), np.nan, np.float32)
        owner = np.full(len(x), -1, np.int32)
        root_ref = None
        for sequence, (gx, gy, ids, core) in enumerate(patches):
            begin = time.monotonic()
            shared = np.isfinite(registry[ids,0])
            if sequence and not shared.any():
                raise RuntimeError(f"Disconnected traversal at {(gx,gy)}")
            print(f"Fitting edge-root 2 km ({gx},{gy}): {len(ids)} rows, {shared.sum()} anchors", flush=True)
            y, stats = atlas.fit_patch(np.asarray(x[ids]), shared, registry[ids], c, impl, root_ref)
            atlas.merge_registry(registry, ids, y)
            stats.update(rows=len(ids), core_rows=int(core.sum()), anchors=int(shared.sum()),
                         anchor_owner_sequences=sorted(set(map(int,owner[ids[shared]]))),
                         max_shared_coordinate_drift=0.,
                         sampled_neighborhood_recall=atlas.neighborhood_recall(np.asarray(x[ids]),y,c['seed']),
                         seconds=time.monotonic()-begin)
            path=directory/f'{gx}_{gy}.npz'
            atlas.atomic_npz(path, ids=ids, core=core, y=y)
            atlas.atomic_json(path.with_suffix('.json'), stats)
            owner[ids[~shared]]=sequence
            if sequence==0:
                palette=atlas.palette_for_root(y,c['root_gamut_tail'])
                atlas.atomic_json(out/'palette.json',palette)
                root_ref=(x[ids],y)
            rgb,gamut=atlas.colors(y[core],palette)
            record=dict(grid=[gx,gy],sequence=sequence,file=str(path.relative_to(out)),**stats)
            record['core_metrics']=metrics(np.asarray(x[ids[core]]),y[core],rgb,palette,c['seed']) if core.sum()>1 else None
            record['core_gamut_fraction']=gamut
            report['patches'].append(record)
            atlas.atomic_json(out/'experiment_progress.json',dict(status='running',completed=sequence+1,
                               total=len(patches),last_grid=[gx,gy],elapsed_seconds=time.monotonic()-started))
        if not np.isfinite(registry).all():
            raise RuntimeError("Incomplete coordinate coverage")
        atlas.atomic_json(directory/'complete.json',dict(scale_km=2,rows=len(x),core_rows=sum(p['core_rows'] for p in report['patches']),patches=report['patches']))
        atlas.export_scales(c,out,[2])
        manifest_path=out/'viewer_data/manifest.json'
        manifest=json.loads(manifest_path.read_text())
        manifest['experiment']=dict(rootGrid=list(root),traversal='root-centered Manhattan',pcaReusedFrom=str(source))
        atlas.atomic_json(manifest_path,manifest)
        with np.load(source/'patches/2km/0_0.npz') as old, np.load(directory/'0_0.npz') as new:
            if not np.array_equal(old['ids'],new['ids']) or not np.array_equal(old['core'],new['core']):
                raise RuntimeError("Central comparison membership mismatch")
            ids=old['ids'][old['core']]
            a,b=old['y'][old['core']],new['y'][new['core']]
        old_palette=json.loads((source/'palette.json').read_text())
        old_rgb,old_gamut=atlas.colors(a,old_palette)
        new_rgb,new_gamut=atlas.colors(b,palette)
        # Orthogonal alignment removes frame/translation only; no scale adjustment.
        ac,bc=a-a.mean(0),b-b.mean(0)
        u,_,vt=np.linalg.svd(bc.T@ac)
        aligned=bc@(u@vt)+a.mean(0)
        aligned_rgb,aligned_gamut=atlas.colors(aligned,old_palette)
        report['central_comparison']=dict(original=metrics(np.asarray(x[ids]),a,old_rgb,old_palette,c['seed']),
            edge_root_native=metrics(np.asarray(x[ids]),b,new_rgb,palette,c['seed']),
            edge_root_rigid_aligned=metrics(np.asarray(x[ids]),aligned,aligned_rgb,old_palette,c['seed']),
            gamut_fractions=[old_gamut,new_gamut,aligned_gamut],
            coordinate_variance_ratio=float(np.var(b,axis=0,ddof=1).sum()/np.var(a,axis=0,ddof=1).sum()),
            alignment='orthogonal rotation/reflection plus translation; scale unchanged')
        atlas.atomic_npz(out/'central_comparison.npz',ids=ids,xy=xy[ids],original_y=a,edge_y=b,
                         aligned_y=aligned,original_rgb=old_rgb,edge_rgb=new_rgb,aligned_rgb=aligned_rgb)
        report['seconds']=time.monotonic()-started
        atlas.atomic_json(out/'experiment_report.json',report)
        atlas.atomic_json(out/'experiment_progress.json',dict(status='complete',completed=len(patches),total=len(patches),elapsed_seconds=report['seconds']))
        print(json.dumps(report['central_comparison'],indent=2),flush=True)
    x._mmap.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-output',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--root',type=int,nargs=2,default=[5,0])
    parser.add_argument('--config',type=Path,default=atlas.DEFAULT_CONFIG)
    parser.add_argument('--execute',action='store_true')
    args=parser.parse_args()
    c=json.loads(args.config.read_text())
    atlas.validate_config(c)
    if not args.execute:
        print(json.dumps(dict(mode='plan_only',source=str(args.source_output),output=str(args.output),
                             root=args.root,scales=[2],pca_recomputed=False)))
        return
    run(c,args.source_output.resolve(),args.output.resolve(),tuple(args.root))


if __name__=='__main__':
    main()
