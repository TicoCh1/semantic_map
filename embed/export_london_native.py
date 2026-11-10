#!/usr/bin/env python3
"""Copy selected London JPEG bytes into resumable TAR shards, without decoding.

Default: read-only plan. --execute is required to write anything. Uses only the
Python standard library; no model, CUDA, PIL, resizing or JPEG re-encoding.
"""
import argparse
from contextlib import ExitStack, closing, contextmanager
import datetime
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import subprocess
import tarfile
import time

DEFAULT_RUN = '/workspace/reruns/pano512_8B_q90_20260915_b200'


def emit(**row):
    print(json.dumps(dict(timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(), **row)), flush=True)


def sync_dir(path):
    if os.name == 'posix':
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try: os.fsync(fd)
        finally: os.close(fd)


def atomic_json(path, value):
    temp = path.with_name(path.name + '.partial')
    with temp.open('w', encoding='utf-8') as f:
        json.dump(value, f, indent=2)
        f.flush(); os.fsync(f.fileno())
    os.replace(temp, path)
    sync_dir(path.parent)


@contextmanager
def export_lock(root):
    with (root / '.export.lock').open('a+b') as f:
        if os.name == 'posix':
            import fcntl
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        else:
            import msvcrt
            if f.seek(0, 2) == 0: f.write(b'0'); f.flush()
            f.seek(0); msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        try: yield
        finally:
            if os.name == 'posix': fcntl.flock(f, fcntl.LOCK_UN)
            else:
                f.seek(0); msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)


def load_inventory(run_root, source_root, expected_count):
    owner = json.loads((run_root / 'run.json').read_text())
    if Path(owner['config']['pano_root']).resolve() != source_root:
        raise ValueError('Source root differs from the inventory provenance')
    sources = [s for s in owner['config']['sources'] if s['city'] == 'london']
    specs = {s['name']: s for s in sources}
    uri = (run_root / 'inventory.sqlite3').as_uri() + '?mode=ro'
    with closing(sqlite3.connect(uri, uri=True)) as con:
        con.row_factory = sqlite3.Row
        # Include all selected London records, even failed/uncommitted embeddings.
        rows = [dict(r) for r in con.execute('''SELECT seq,city,namespace,tar_name,
            member_name,offset_data,byte_size,pano_id,lon,lat,capture_date,heading
            FROM records WHERE city='london' ORDER BY seq''')]
    if len(rows) != expected_count:
        raise ValueError(f'Expected {expected_count} selected London records, found {len(rows)}')
    if len({r['seq'] for r in rows}) != len(rows): raise ValueError('Duplicate record IDs')
    for row in rows:
        name = row['tar_name']
        if name not in specs or Path(name).name != name:
            raise ValueError(f'Unexpected source archive {name!r}')
        if row['offset_data'] < 0 or row['byte_size'] <= 0 or row['offset_data'] + row['byte_size'] > specs[name]['size']:
            raise ValueError(f'Invalid byte range for record {row["seq"]}')
        # The seq directory prevents collisions while retaining the original basename.
        row['export_member'] = f"london/{row['seq']:08d}/{PurePosixPath(row['member_name']).name}"
    validate_sources(source_root, sources)
    return owner['run_id'], sources, rows


def validate_sources(source_root, sources):
    for spec in sources:
        p = (source_root / spec['name']).resolve()
        if p.parent != source_root: raise ValueError('Source archive escaped its root')
        st = p.stat()
        if (st.st_size, st.st_mtime_ns) != (spec['size'], spec['mtime_ns']):
            raise ValueError(f'Source archive changed since inventory: {p}')
        with p.open('rb') as f:
            if f.read(2) == b'\x1f\x8b': raise ValueError('Indexed offsets require an uncompressed source TAR')


def shard_paths(output, index):
    stem = f'london_native_{index:05d}'
    return {kind: output / (stem + suffix) for kind, suffix in
            [('tar', '.tar'), ('manifest', '.jsonl'), ('receipt', '.complete.json')]}


def verify_committed(paths, rows):
    receipt = json.loads(paths['receipt'].read_text())
    if receipt['record_ids'] != [r['seq'] for r in rows]: raise ValueError('Shard ownership/order mismatch')
    for kind in ('tar', 'manifest'):
        if paths[kind].stat().st_size != receipt['file_sizes'][kind]:
            raise ValueError(f'Committed {kind} size mismatch')
    manifest = [json.loads(s) for s in paths['manifest'].read_text(encoding='utf-8').splitlines()]
    if manifest != rows: raise ValueError('Committed source/member mapping mismatch')
    with tarfile.open(paths['tar'], 'r:') as archive:
        for row in rows:
            member = archive.next()
            if member is None or not member.isfile() or member.name != row['export_member'] or member.size != row['byte_size']:
                raise ValueError('Committed TAR member mismatch')
        if archive.next() is not None: raise ValueError('Unexpected extra TAR member')
    return receipt


def write_shard(paths, rows, source_root, specs):
    partial_tar = paths['tar'].with_suffix('.tar.partial')
    partial_manifest = paths['manifest'].with_suffix('.jsonl.partial')
    started = time.monotonic()
    with ExitStack() as stack:
        sources = {name: stack.enter_context((source_root / name).open('rb', buffering=1024*1024)) for name in {r['tar_name'] for r in rows}}
        with partial_tar.open('wb', buffering=4*1024*1024) as raw, partial_manifest.open('w', encoding='utf-8') as mf:
            with tarfile.open(fileobj=raw, mode='w', format=tarfile.PAX_FORMAT, copybufsize=1024*1024) as target:
                for index, row in enumerate(rows):
                    source = sources[row['tar_name']]
                    source.seek(row['offset_data'])
                    member = tarfile.TarInfo(row['export_member'])
                    member.size = row['byte_size']
                    member.mode = 0o644
                    member.mtime = 0  # Archive metadata only; JPEG bytes are unchanged.
                    target.addfile(member, source)
                    if source.tell() != row['offset_data'] + row['byte_size']:
                        raise IOError('Incomplete source payload copy')
                    mf.write(json.dumps(row, ensure_ascii=True) + '\n')
                    if (index + 1) % 512 == 0:
                        emit(stage='copy', shard=paths['tar'].name, images=index+1, seconds=time.monotonic()-started)
            raw.flush(); os.fsync(raw.fileno())
            mf.flush(); os.fsync(mf.fileno())
    validate_sources(source_root, specs)
    os.replace(partial_tar, paths['tar'])
    os.replace(partial_manifest, paths['manifest'])
    sync_dir(paths['tar'].parent)
    receipt = dict(record_ids=[r['seq'] for r in rows], count=len(rows),
        payload_bytes=sum(r['byte_size'] for r in rows),
        file_sizes={kind: paths[kind].stat().st_size for kind in ('tar', 'manifest')},
        preservation='Original JPEG payload bytes; no decode, crop, resize or re-encode',
        seconds=time.monotonic()-started)
    atomic_json(paths['receipt'], receipt)
    return receipt


def filesystem_type(path):
    if os.name != 'posix': return 'non-posix'
    result = subprocess.run(['findmnt', '-n', '-o', 'FSTYPE', '-T', str(path)], text=True, capture_output=True, check=True)
    return result.stdout.strip()


def run(args):
    run_root = Path(args.run_root).resolve()
    source_root = Path(args.source_root).resolve()
    output = Path(args.output_dir).resolve()
    for protected in (run_root, source_root):
        if output == protected or output in protected.parents or protected in output.parents:
            raise ValueError('Output must be separate from source data and inference outputs')
    run_id, sources, rows = load_inventory(run_root, source_root, args.expected_count)
    chunks = [rows[i:i+args.shard_panos] for i in range(0, len(rows), args.shard_panos)]
    plan = dict(version=1, source_run_id=run_id, source_root=str(source_root), city='london',
                count=len(rows), payload_bytes=sum(r['byte_size'] for r in rows),
                sources=sources, shard_panos=args.shard_panos, shards=len(chunks),
                include_failed_embedding_inputs=True, preserve_original_bytes=True)
    if not args.execute:
        emit(stage='plan_only', output_dir=str(output), **plan,
             payload_only_minutes_at_MBps={str(rate):plan['payload_bytes']/(rate*1e6)/60 for rate in (50,100,200)})
        return plan
    if output.exists() and not args.resume:
        raise ValueError('Output already exists; use --resume to validate and continue')
    output.mkdir(parents=True, exist_ok=True)
    with export_lock(output):
        owner = output / 'export-plan.json'
        if owner.exists():
            if json.loads(owner.read_text()) != plan: raise ValueError('Export settings/provenance changed')
        else:
            if set(p.name for p in output.iterdir()) - {'.export.lock', 'export-plan.json.partial'}:
                raise ValueError('Refusing an unowned nonempty output directory')
            atomic_json(owner, plan)
        completed = set()
        for index, chunk in enumerate(chunks):
            paths = shard_paths(output, index)
            if paths['receipt'].exists():
                verify_committed(paths, chunk)
                completed.add(index)
        remaining = sum(r['byte_size'] for i,chunk in enumerate(chunks) if i not in completed for r in chunk)
        # Includes TAR framing, JSONL, filesystem allocation and one partial-shard rewrite.
        required = int(remaining * 1.01) + (1024**3 if remaining else 0)
        free = shutil.disk_usage(output).free
        fs_type = filesystem_type(output)
        if 'fuse' in fs_type.lower() and args.available_output_gb is None:
            raise ValueError('FUSE free space may be shared-pool capacity. Pass verified remaining quota with --available-output-gb')
        if args.available_output_gb is not None: free = min(free, args.available_output_gb * 1e9)
        if free < required: raise ValueError(f'Insufficient output capacity: need {required/1e9:.2f} GB, available {free/1e9:.2f} GB')
        emit(stage='export_start', completed_shards=len(completed), required_bytes=required)
        for index, chunk in enumerate(chunks):
            if index in completed: continue
            receipt = write_shard(shard_paths(output,index), chunk, source_root, sources)
            emit(stage='shard_committed', shard=index, count=receipt['count'], payload_bytes=receipt['payload_bytes'], seconds=receipt['seconds'])
        atomic_json(output/'complete.json', dict(source_run_id=run_id,count=len(rows),shards=len(chunks),payload_bytes=plan['payload_bytes'],preserve_original_bytes=True))
    emit(stage='complete', count=len(rows), output_dir=str(output))
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-root', default=DEFAULT_RUN)
    parser.add_argument('--source-root', default='/workspace/pano')
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--expected-count', type=int, default=156895)
    parser.add_argument('--shard-panos', type=int, default=8192)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--available-output-gb', type=float, help='Verified REMAINING destination quota in decimal GB, not total volume size')
    args = parser.parse_args()
    if args.expected_count <= 0 or args.shard_panos <= 0: parser.error('Counts must be positive')
    if args.available_output_gb is not None and args.available_output_gb < 0: parser.error('Remaining quota cannot be negative')
    run(args)


if __name__ == '__main__': main()
