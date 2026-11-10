"""Offline, verified checkpoint repack. Sources/models are never touched.

Build a sibling run directory first; swap only after all retained rows/JPEGs
are verified. An interrupted publish leaves a journal and the original backup.
"""
import argparse
import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tarfile
from datetime import datetime, timezone

import numpy as np
from pipeline_state import RunState, RunLock, atomic_json, fsync_dir
from pipeline_runtime import Prepared, Stats


def build(source, target, size):
    owner=json.loads((source/'run.json').read_text())
    old=RunState(source,owner['config']);old.recover()
    target.mkdir(exist_ok=False)
    for name in ('run.json','london_selection.csv','inventory_complete.json','inventory_problems.json'):
        if (source/name).exists():shutil.copy2(source/name,target/name)
    with sqlite3.connect(old.db) as src, sqlite3.connect(target/'inventory.sqlite3') as dst:
        src.backup(dst)
    new=RunState(target,owner['config'])
    with new.connect() as con:con.execute('UPDATE records SET shard=NULL,output_row=NULL')
    report={}
    stats=Stats(emit=lambda _:None)
    for city in old.config['cities']:
        count=old.counts(True).get(city,0);keep=count//size*size
        report[city]=dict(previous=count,retained=keep,requeued=count-keep)
        buffered=[];vectors=[];references=[];written=0;next_shard=0

        def flush():
            nonlocal buffered,vectors,references,written,next_shard
            assert len(buffered)==size
            emb=np.stack(vectors);refs=np.stack(references)
            new.write_shard(city,next_shard,written,buffered,emb,stats)
            paths=new.paths(city,next_shard)
            check=np.load(paths['embedding'],mmap_mode='r',allow_pickle=False)
            assert np.array_equal(check,emb),'Embedding changed during repack'
            del check
            check=np.load(paths['reference'],mmap_mode='r',allow_pickle=False)
            assert np.array_equal(check,refs,equal_nan=True),'Metadata changed during repack'
            del check
            identities=[json.loads(l) for l in paths['identities'].read_text().splitlines()]
            assert len(identities)==size
            with tarfile.open(paths['pano'],'r:') as tar:
                for item,identity in zip(buffered,identities):
                    assert identity['seq']==item.record['seq']
                    member=tar.next()
                    assert member and member.name==identity['pano_member']
                    assert tar.extractfile(member).read()==item.jpeg,'JPEG changed during repack'
                assert tar.next() is None,'Unexpected extra TAR members'
            written+=size;next_shard+=1
            print(json.dumps(dict(event='verified_shard',city=city,retained=written,shape=list(emb.shape))),flush=True)
            buffered=[];vectors=[];references=[]

        for shard in range(old.recover()[city]):
            if written+len(buffered)>=keep:break
            paths=old.paths(city,shard)
            marker=json.loads(paths['marker'].read_text())
            identities=[json.loads(l) for l in paths['identities'].read_text().splitlines()]
            emb=np.load(paths['embedding'],mmap_mode='r',allow_pickle=False)
            refs=np.load(paths['reference'],mmap_mode='r',allow_pickle=False)
            assert len(identities)==len(emb)==len(marker['record_ids'])
            with tarfile.open(paths['pano'],'r:') as tar:
                for i,identity in enumerate(identities):
                    if written+len(buffered)>=keep:break
                    assert identity['seq']==marker['record_ids'][i]
                    member=tar.next();assert member and member.name==identity['pano_member']
                    jpeg=tar.extractfile(member).read()
                    buffered.append(Prepared(identity,None,jpeg,tuple(identity['original_size']),identity['geometry']))
                    vectors.append(np.array(emb[i],copy=True));references.append(np.array(refs[i],copy=True))
                    if len(buffered)==size:flush()
            del emb,refs
        assert written==keep and not buffered
    new.recover()
    assert new.counts()==old.counts(),'Input inventory changed'
    for city,counts in report.items():
        assert new.counts(True).get(city,0)==counts['retained']
    new.failure_report()
    atomic_json(target/'repack_8192_report.json',dict(shard_size=size,cities=report,verified='all retained embedding values, metadata values, JPEG bytes and identity order'))
    with new.connect() as con:con.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    return report


def main():
    p=argparse.ArgumentParser();p.add_argument('root');p.add_argument('--size',type=int,default=8192)
    args=p.parse_args();root=Path(args.root).resolve()
    assert root.parent==Path('/workspace/reruns') and root.name=='pano512_8B_q90_20260915_b200'
    assert not Path(args.root).is_symlink() and args.size>0
    for proc in Path('/proc').iterdir():
        if not proc.name.isdigit():continue
        try:cmd=(proc/'cmdline').read_bytes()
        except (FileNotFoundError,PermissionError):continue
        if root.as_posix().encode() in cmd and (b'run_panorama_embedding.py' in cmd or b'run_logged_embedding.py' in cmd):
            raise RuntimeError('Stop the active inference before repacking')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    stage=root.with_name(root.name+'.repack-'+stamp)
    backup=root.with_name(root.name+'.pre-repack-'+stamp)
    journal=root.parent/('repack-'+stamp+'.json')
    with RunLock(root):
        report=build(root,stage,args.size)
        atomic_json(journal,dict(status='verified',source=str(root),stage=str(stage),backup=str(backup),counts=report))
        root.rename(backup);stage.rename(root);fsync_dir(root.parent)
        atomic_json(journal,dict(status='published',source=str(root),backup=str(backup),counts=report))
        state=RunState(root,json.loads((root/'run.json').read_text())['config']);state.recover()
        assert backup.parent==Path('/workspace/reruns') and backup.name==root.name+'.pre-repack-'+stamp
        assert backup.resolve()==backup and not backup.is_symlink()
        shutil.rmtree(backup)
        atomic_json(journal,dict(status='complete',source=str(root),counts=report))
        print(json.dumps(dict(event='repack_complete',counts=report,journal=str(journal))),flush=True)


if __name__=='__main__':main()
