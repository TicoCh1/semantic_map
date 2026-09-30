"""Prepare persistent panorama and map caches without importing a GPU model."""
import gc
import json
import os
import sqlite3
import time
from dataclasses import replace
from pathlib import Path

import numpy as np

from backend.semantic_map.backend_config import get_backend_settings
from backend.semantic_map.dataset_loader import locate_dataset, load_pano_records_from_refs
from backend.semantic_map.pano_service import PanoService
from backend.semantic_map.tile_index import load_or_build_tile_index, read_tile_index_if_current

ROOT=Path('/workspace/semantic_backend/cpu_preparation_20260916')
INDEX=Path('/workspace/semantic_backend/pano_index_native_q90_20260916')
LOCAL_INDEX=Path('/tmp/uf-pano-serving-index-20260916')
ROOT.mkdir(exist_ok=True)
started=time.time()
report={'state':'running','datasets':[],'panorama_checks':[]}
def save():
    report['elapsed_seconds']=time.time()-started
    p=ROOT/'report.json';tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(report,indent=2));tmp.replace(p)

try:
    settings=get_backend_settings()
    manifest={'cache_root':'/workspace/semantic_backend/pano_cache_native_q90_20260916','datasets':{}}
    mapping={'london':'london_224_8_45','shanghai':'shanghai_224_8_45_2B','rome':'rome_224_8_45','new_york_manhattan':'new_york_manhattan_224_8_45','new_york_outside_manhattan':'new_york_outside_manhattan_224_8_45'}
    for ns,dataset in mapping.items():
        path=INDEX/(ns+'.sqlite')
        import shutil
        local_path=LOCAL_INDEX/path.name
        if not local_path.exists() or local_path.stat().st_size!=path.stat().st_size:
            LOCAL_INDEX.mkdir(exist_ok=True);shutil.copyfile(path,local_path)
        with sqlite3.connect('file:'+str(local_path)+'?mode=ro',uri=True) as c:
            assert c.execute('PRAGMA quick_check').fetchone()[0]=='ok'
            archives=[]
            for (p,) in c.execute('SELECT DISTINCT tar_id FROM panos'):
                st=Path(p).stat();archives.append({'path':p,'size':st.st_size,'mtime_ns':st.st_mtime_ns})
            manifest['datasets'][dataset]={'namespace':ns,'index_path':str(path),'archives':archives}
        if ns in ['london','shanghai','rome']:
            manifest['datasets'][ns+'_512_8_45_8B']=manifest['datasets'][dataset]
    # A combined index retains both identities; coordinate/entry-key lookup resolves duplicates.
    combined=INDEX/'new_york.sqlite'
    if not combined.exists():
        tmp=Path('/tmp/uf-new-york-serving.sqlite')
        if tmp.exists():tmp.unlink()
        with sqlite3.connect(str(LOCAL_INDEX/'new_york_manhattan.sqlite')) as src, sqlite3.connect(str(tmp)) as dst:
            src.backup(dst)
            dst.execute('ATTACH DATABASE ? AS outside',(str(LOCAL_INDEX/'new_york_outside_manhattan.sqlite'),))
            dst.execute('INSERT INTO panos SELECT * FROM outside.panos')
            dst.execute('INSERT INTO provenance SELECT * FROM outside.provenance')
            dst.execute("UPDATE meta SET value='new_york' WHERE key='namespace'")
            dst.commit()
        import shutil
        shutil.copyfile(tmp,combined)
    ny_archives={a['path']:a for ns in ['new_york_manhattan_224_8_45','new_york_outside_manhattan_224_8_45'] for a in manifest['datasets'][ns]['archives']}
    manifest['datasets']['new_york_512_8_45_8B']={'namespace':'new_york','index_path':str(combined),'archives':list(ny_archives.values())}
    mp=ROOT/'pano_manifest.json';mp.write_text(json.dumps(manifest,indent=2));os.environ['PANO_PREPARED_MANIFEST']=str(mp)
    for dataset in [*mapping.values(),'new_york_512_8_45_8B']:
        service=PanoService(settings,dataset);warm=service.warmup()
        with sqlite3.connect('file:'+str(service.settings.pano_index_path)+'?mode=ro',uri=True) as c:
            row=c.execute('SELECT pano_id,entry_key FROM panos LIMIT 1').fetchone()
        found=service.ensure_pano_image(str(row[0]),entry_key=row[1]);assert found
        assert found[1].read_bytes()[:2]==b'\xff\xd8'
        report['panorama_checks'].append({'dataset':dataset,'warmup':warm,'source_id':found[0].source_id})
        service.close();save()
    roots=[(Path('/workspace/reruns/pano512_8B_q90_20260915_b200/embedding'),[c+'_512_8_45_8B' for c in ['london','shanghai','new_york','rome']])]
    for data_root,datasets in roots:
        for dataset in datasets:
            cfg=replace(settings,data_root=data_root)
            layout=locate_dataset(dataset,cfg)
            records=load_pano_records_from_refs(layout)
            total=0;cred_missing=[];shapes=[]
            for emb,ref in zip(layout.embedding_paths,layout.ref_paths):
                a=np.load(emb,mmap_mode='r');r=np.load(ref,mmap_mode='r')
                assert a.ndim==3 and len(a)==len(r)
                total+=len(a);shapes.append(list(a.shape))
                cp=emb.parent/'credibility_cache'/(emb.stem+'_cred.npy')
                if cp.exists():
                    v=np.load(cp,mmap_mode='r');assert v.shape==(len(a),) and np.isfinite(v).all()
                else:cred_missing.append(cp.name)
            assert total==len(records)
            cached=read_tile_index_if_current(dataset,records,cfg)
            was_cached=cached is not None
            idx=cached if was_cached else load_or_build_tile_index(dataset,records,cfg)
            assert read_tile_index_if_current(dataset,records,cfg) is not None
            report['datasets'].append({'dataset':dataset,'rows':total,'shards':len(shapes),'shape_examples':shapes[:2],'tile_count':len(idx.entries_by_tile),'tile_cache_reused':was_cached,'credibility_missing':cred_missing})
            save();print(json.dumps(report['datasets'][-1]),flush=True)
            del records,idx,cached;gc.collect()
    report['state']='complete';save()
except BaseException as exc:
    report.update(state='failed',error=repr(exc));save();raise
