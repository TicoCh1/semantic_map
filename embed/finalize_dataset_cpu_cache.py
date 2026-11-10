"""Finalize an idle CPU cache with bounded read-ahead on network storage.

Run on the CPU Pod. Default: user-approved stratified sampling and source bounds.
The optional --full-check retains a full integrity check and source-ID scan.
Does not modify the database or its code identity. APSW is required only by this
operational finalizer, not by the GPU inference runtime.
"""
from __future__ import annotations

import argparse
from collections import OrderedDict
from datetime import datetime, timezone
import json
import io
import os
from pathlib import Path
import random
import time
import uuid

import apsw

from dataset_cpu_cache import CPUCache, SCHEMA, identity, publish, read_encoded
from dataset_image_pipeline import file_metadata
from dataset_run_state import RunLock


class ReadAheadFile(apsw.VFSFile):
    def __init__(self, name, flags, owner):
        super().__init__('', name, flags)
        self.owner = owner
        self.size = super().xFileSize()
        self.blocks = OrderedDict()

    def xRead(self, amount, offset):
        if offset < 0 or offset + amount > self.size:
            # Preserve SQLite's own short-read/error semantics.
            return super().xRead(amount, offset)
        parts = []
        remaining = amount
        while remaining:
            start = offset // self.owner.block_size * self.owner.block_size
            block = self.blocks.pop(start, None)
            if block is None:
                length = min(self.owner.block_size, self.size - start)
                block = super().xRead(length, start)
                if len(block) != length:
                    raise IOError('Truncated read-ahead block')
                self.owner.read_calls += 1
                self.owner.read_bytes += length
            self.blocks[start] = block
            while len(self.blocks) > self.owner.max_blocks:
                self.blocks.popitem(last=False)
            begin = offset - start
            take = min(remaining, len(block) - begin)
            parts.append(block[begin:begin + take])
            offset += take
            remaining -= take
        self.owner.sqlite_reads += 1
        if self.owner.on_read:
            self.owner.on_read()
        return b''.join(parts)

    def xWrite(self, data, offset):
        raise apsw.ReadOnlyError('Cache finalization is read-only')

    def xTruncate(self, size):
        raise apsw.ReadOnlyError('Cache finalization is read-only')


class ReadAheadVFS(apsw.VFS):
    def __init__(self, block_size=2 << 20, max_blocks=128, on_read=None):
        if block_size < 4096 or max_blocks < 1:
            raise ValueError('Invalid read-ahead limits')
        self.name = 'cpu-cache-read-ahead-' + uuid.uuid4().hex
        self.block_size, self.max_blocks, self.on_read = block_size, max_blocks, on_read
        self.read_calls = self.read_bytes = self.sqlite_reads = 0
        super().__init__(self.name, '')

    def xOpen(self, name, flags):
        if not flags[0] & apsw.SQLITE_OPEN_READONLY:
            raise apsw.ReadOnlyError('Only read-only database files are allowed')
        return ReadAheadFile(name, flags, self)


def validate_database(path, expected_records, expected_identity, skipped_path,
                      progress=lambda *args, **kwargs: None, block_size=2 << 20):
    """Caller must own both pipeline locks; no writer may use this database."""
    path = Path(path).resolve()
    for suffix in ('-journal', '-wal'):
        if Path(str(path) + suffix).exists():
            raise RuntimeError('Journal/WAL present; recover with the original builder first')
    before = file_metadata(path)
    vfs = ReadAheadVFS(block_size=block_size)
    connection = None
    phase = 'opening'
    rows_checked = 0
    started = time.monotonic()
    last_report = 0.0

    def report(force=False):
        nonlocal last_report
        now = time.monotonic()
        if force or now - last_report >= 5:
            progress(phase, rows_checked=rows_checked, total_sources=expected_records,
                     read_bytes=vfs.read_bytes, read_calls=vfs.read_calls,
                     sqlite_reads=vfs.sqlite_reads, elapsed_seconds=now - started)
            last_report = now

    vfs.on_read = report
    try:
        connection = apsw.Connection(path.as_uri() + '?immutable=1',
            flags=apsw.SQLITE_OPEN_READONLY | apsw.SQLITE_OPEN_URI, vfs=vfs.name)
        connection.execute('PRAGMA mmap_size=0')
        connection.execute('PRAGMA cache_size=-32768')
        connection.execute('PRAGMA query_only=ON')
        metadata = connection.execute('SELECT payload FROM metadata WHERE id=1').fetchone()
        if not metadata or json.loads(metadata[0]) != expected_identity:
            raise RuntimeError('CPU cache identity mismatch')

        phase = 'integrity_check'; report(True)
        if list(connection.execute('PRAGMA integrity_check')) != [('ok',)]:
            raise RuntimeError('CPU cache integrity check failed')

        phase = 'coverage_and_errors'; report(True)
        errors = views = 0
        datasets = {}
        # Combining coverage, error and view counts avoids separate table scans.
        with Path(skipped_path).open('w', encoding='utf-8') as skipped:
            for index, record_text, payload_text, error in connection.execute(
                    'SELECT id, record, payload, error FROM sources ORDER BY id'):
                if index != rows_checked:
                    raise RuntimeError('CPU cache source IDs are not contiguous')
                record = json.loads(record_text)
                if record.get('source_index') != index:
                    raise RuntimeError('CPU cache source identity is misaligned')
                dataset = record['dataset_id']
                counts = datasets.setdefault(dataset, {'records': 0, 'errors': 0, 'views': 0})
                counts['records'] += 1
                if error is not None:
                    errors += 1; counts['errors'] += 1
                    skipped.write(json.dumps({'source_index': index, 'dataset_id': dataset,
                        'member': record.get('member'), 'container': record.get('container'),
                        'error': error, 'policy': 'skip_inference'}) + '\n')
                else:
                    rows = json.loads(payload_text)['rows']
                    if not rows or any(row.get('source_index') != index for row in rows):
                        raise RuntimeError('CPU cache view identity is misaligned')
                    views += len(rows); counts['views'] += len(rows)
                rows_checked += 1
                if rows_checked % 2048 == 0:
                    report()
            skipped.flush(); os.fsync(skipped.fileno())
        if rows_checked != expected_records:
            raise RuntimeError('CPU cache coverage is incomplete')
        containers = [json.loads(row[0]) for row in connection.execute(
            'SELECT metadata FROM containers ORDER BY name')]
        for metadata in containers:
            if metadata != file_metadata(metadata['path']):
                raise RuntimeError('Materialized nested archive changed')
        if before != file_metadata(path):
            raise RuntimeError('Database changed during read-only finalization')
        phase = 'validated'; report(True)
        return {'records': rows_checked, 'errors': errors, 'views': views,
                'datasets': datasets, 'containers': containers, 'database': before,
                'validation': {'method': 'full_integrity_check_with_bounded_read_ahead',
                    'block_bytes': block_size, 'read_calls': vfs.read_calls,
                    'read_bytes': vfs.read_bytes, 'elapsed_seconds': time.monotonic() - started}}
    finally:
        if connection is not None:
            connection.close()
        vfs.unregister()


def select_samples(inventory, expected_records, per_dataset=8):
    """Reservoir sample the immutable inventory, never scan cache payloads."""
    rng = random.Random(20260921)
    groups = {}
    total = 0
    with Path(inventory).open(encoding='utf-8') as handle:
        for index, line in enumerate(handle):
            record = json.loads(line)
            if record['source_index'] != index:
                raise RuntimeError('Inventory IDs are not contiguous')
            group = groups.setdefault(record['dataset_id'], {'count': 0, 'sample': [],
                                                             'first': index, 'last': index})
            group['count'] += 1; group['last'] = index
            if len(group['sample']) < per_dataset:
                group['sample'].append(index)
            else:
                slot = rng.randrange(group['count'])
                if slot < per_dataset: group['sample'][slot] = index
            total += 1
    if total != expected_records:
        raise RuntimeError('Inventory count differs from summary')
    selected = {i for group in groups.values() for i in
                [group['first'], group['last'], *group['sample']]}
    selected.update(range(max(0, total - 16), total))
    return sorted(selected), {name: g['count'] for name, g in groups.items()}


def validate_sampled_database(path, expected_records, expected_identity, skipped_path,
                              sample_ids, progress=lambda *args, **kwargs: None):
    """User-approved sampling: explicitly does not certify every SQLite page."""
    from PIL import Image
    path = Path(path).resolve()
    for suffix in ('-journal', '-wal'):
        if Path(str(path) + suffix).exists():
            raise RuntimeError('Journal/WAL present; recover with original builder first')
    before = file_metadata(path)
    started = time.monotonic()
    vfs = ReadAheadVFS()
    db = None
    try:
        db = apsw.Connection(path.as_uri() + '?immutable=1',
            flags=apsw.SQLITE_OPEN_READONLY | apsw.SQLITE_OPEN_URI, vfs=vfs.name)
        db.execute('PRAGMA mmap_size=0')
        db.execute('PRAGMA query_only=ON')
        metadata = db.execute('SELECT payload FROM metadata WHERE id=1').fetchone()
        if not metadata or json.loads(metadata[0]) != expected_identity:
            raise RuntimeError('CPU cache identity mismatch')
        first = db.execute('SELECT id FROM sources ORDER BY id LIMIT 1').fetchone()
        last = db.execute('SELECT id FROM sources ORDER BY id DESC LIMIT 1').fetchone()
        if ((expected_records and (first != (0,) or last != (expected_records - 1,))) or
                (not expected_records and (first is not None or last is not None))):
            raise RuntimeError('CPU cache source bounds are incomplete')
        errors = []
        decoded_datasets = set()
        successful_samples = 0
        for ordinal, index in enumerate(sample_ids):
            entry = db.execute('SELECT record,payload,labels,error FROM sources WHERE id=?',
                               (index,)).fetchone()
            if entry is None: raise RuntimeError(f'Missing sampled source {index}')
            record_text, payload_text, blob, error = entry
            record = json.loads(record_text)
            if record['source_index'] != index:
                raise RuntimeError('Sampled source identity is misaligned')
            if error is not None:
                errors.append({'source_index': index, 'dataset_id': record['dataset_id'],
                    'member': record.get('member'), 'error': error, 'policy': 'skip_inference'})
                continue
            payload = json.loads(payload_text)
            if not payload['rows']: raise RuntimeError('Sampled source has no views')
            for row in payload['rows']:
                if row['source_index'] != index: raise RuntimeError('Sampled view misaligned')
                for name, offset, length in row['_cached_labels']:
                    if offset < 0 or length < 0 or offset + length > len(blob):
                        raise RuntimeError('Sampled annotation lies outside its BLOB')
                    value = blob[offset:offset + length]
                    if name.endswith('.json'):
                        json.loads(value)
                    elif name.lower().endswith(('.png', '.tif', '.tiff')):
                        with Image.open(io.BytesIO(value)) as image: image.verify()
            dataset = record['dataset_id']
            if dataset not in decoded_datasets:
                with Image.open(io.BytesIO(read_encoded(payload['locator']))) as image:
                    image.load()
                    if list(image.size) != payload['size']:
                        raise RuntimeError('Sampled source dimensions differ from cache')
                decoded_datasets.add(dataset)
            successful_samples += 1
            progress('sampling', samples_checked=ordinal + 1, samples_total=len(sample_ids),
                     read_bytes=vfs.read_bytes, elapsed_seconds=time.monotonic() - started)
        containers = [json.loads(row[0]) for row in db.execute(
            'SELECT metadata FROM containers ORDER BY name')]
        for metadata in containers:
            if metadata != file_metadata(metadata['path']):
                raise RuntimeError('Materialized nested archive changed')
        if before != file_metadata(path): raise RuntimeError('Database changed during sampling')
        with Path(skipped_path).open('w', encoding='utf-8') as handle:
            for error in errors: handle.write(json.dumps(error) + '\n')
            handle.flush(); os.fsync(handle.fileno())
        return {'records': expected_records, 'errors': None, 'views': None,
            'containers': containers, 'database': before,
            'validation': {'method': 'source_bounds_and_stratified_samples',
                'full_integrity_check': False, 'exact_cache_row_count_checked': False,
                'coverage_basis': 'source_bounds_and_builder_contiguous_commit_contract',
                'sample_ids': sample_ids, 'samples': len(sample_ids),
                'successful_samples': successful_samples, 'sample_errors': len(errors),
                'decoded_datasets': sorted(decoded_datasets),
                'read_bytes': vfs.read_bytes, 'elapsed_seconds': time.monotonic() - started},
            'datasets': {}}
    finally:
        if db is not None: db.close()
        vfs.unregister()


def finalize(catalog, output, cache_root=None, full_check=False):
    output = Path(output).resolve()
    root = Path(cache_root).resolve() if cache_root else output / 'cpu_cache'
    if root == output:
        raise ValueError('CPU cache must have its own directory')
    with RunLock(output), RunLock(root):
        inventory = output / 'source_inventory.jsonl'
        summary = json.loads((output / 'inventory_summary.json').read_text())
        expected = identity(catalog, inventory, summary)
        if (root / 'READY.json').exists():
            return CPUCache(root, catalog, inventory, summary).ready
        skipped = root / 'skipped_sources.jsonl.partial'

        def progress(phase, **values):
            value = {'status': 'finalizing', 'phase': phase,
                     'utc': datetime.now(timezone.utc).isoformat(), **values}
            publish(root / 'progress.json', value)
            print(json.dumps(value), flush=True)

        try:
            if full_check:
                result = validate_database(root / 'prepared.sqlite', summary['records'],
                                           expected, skipped, progress)
            else:
                progress('selecting_samples')
                samples, dataset_counts = select_samples(inventory, summary['records'])
                result = validate_sampled_database(root / 'prepared.sqlite', summary['records'],
                                                  expected, skipped, samples, progress)
                result['datasets'] = {k: {'inventory_records': v} for k, v in dataset_counts.items()}
            if identity(catalog, inventory, summary) != expected:
                raise RuntimeError('Inputs changed during cache finalization')
            os.replace(skipped, root / 'skipped_sources.jsonl')
            ready = {'version': SCHEMA, 'identity': expected, **result,
                     'status': ('ready_with_errors' if result['errors'] else 'ready')
                               if full_check else 'ready_sampled',
                     'error_policy': 'skip_inference', 'skipped_sources': 'skipped_sources.jsonl',
                     'skipped_sources_complete': full_check}
            publish(root / 'READY.json', ready)
            publish(root / 'progress.json', {k: ready[k] for k in
                ('status', 'records', 'errors', 'views', 'datasets', 'validation')})
            return ready
        except BaseException as exc:
            publish(root / 'finalization_failure.json', {
                'utc': datetime.now(timezone.utc).isoformat(),
                'error': f'{type(exc).__name__}: {exc}'})
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', required=True)
    parser.add_argument('--output-root', required=True)
    parser.add_argument('--cpu-cache-root')
    parser.add_argument('--full-check', action='store_true',
                        help='Opt into full integrity and coverage scans; default is sampling')
    args = parser.parse_args()
    ready = finalize(args.catalog, args.output_root, args.cpu_cache_root, args.full_check)
    print(json.dumps({k: ready[k] for k in ('status', 'records', 'errors')}, indent=2))


if __name__ == '__main__':
    main()
