"""Persistent CPU front end. Build on CPU; mount read-only for GPU inference.

SQLite transactions contain geometry, annotation payloads and archive byte
locators together. RGB is never cached. READY is published only after coverage
and integrity checks. GPU workers perform indexed reads, not SQL preparation.
"""
from __future__ import annotations

import io
import json
import os
from pathlib import Path
import shutil
import sqlite3
import struct
import tarfile
import uuid
import zipfile
import zlib

from PIL import Image

from dataset_image_pipeline import (file_metadata, record_from_json,
    transform_metadata)
from dataset_run_state import validate_inventory
from dataset_validation_export import ValidationExporter

SCHEMA = 1
CODE = ('dataset_cpu_cache.py', 'dataset_image_pipeline.py',
        'dataset_validation_export.py', 'validation_projection.py')


def publish(path, value):
    temporary = path.with_suffix('.partial')
    with temporary.open('w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.flush(); os.fsync(handle.fileno())
    os.replace(temporary, path)


def identity(catalog, inventory, summary):
    validate_inventory(catalog, inventory, summary)
    with ValidationExporter(catalog) as labels:
        label_files = labels.source_files
    return {'version': SCHEMA, 'inventory_id': summary['inventory_id'],
        'inventory_file': summary['inventory_file'], 'catalog': summary['catalog_snapshot'],
        'source_files': summary['source_files'], 'label_files': label_files,
        # Compare actual source text; no source-file hashing or mtime dependence.
        'code': {name: Path(__file__).with_name(name).read_text(encoding='utf-8') for name in CODE}}


def read_encoded(locator):
    with Path(locator['path']).open('rb') as handle:
        handle.seek(locator['offset'])
        payload = handle.read(locator['compressed_size'])
    if len(payload) != locator['compressed_size']:
        raise IOError('Truncated indexed image payload')
    if locator['compression'] == zipfile.ZIP_DEFLATED:
        payload = zlib.decompress(payload, -15)
    elif locator['compression'] != zipfile.ZIP_STORED:
        raise ValueError('Unsupported cached image compression')
    if len(payload) != locator['size']:
        raise IOError('Indexed image length mismatch')
    if locator.get('crc') is not None and zlib.crc32(payload) & 0xffffffff != locator['crc']:
        raise IOError('ZIP member CRC mismatch')
    return payload


def zip_payload_offset(path, info, base=0):
    with Path(path).open('rb') as handle:
        handle.seek(base + info.header_offset)
        header = handle.read(30)
    if len(header) != 30 or header[:4] != b'PK\x03\x04':
        raise IOError('Invalid ZIP local header')
    names, extras = struct.unpack_from('<HH', header, 26)
    return base + info.header_offset + 30 + names + extras


class FileSlice(io.RawIOBase):
    """Seekable view of a stored nested ZIP, without copying any RGB bytes."""
    def __init__(self, path, offset, length):
        self.handle = Path(path).open('rb')
        self.offset, self.length, self.position = offset, length, 0

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.position
    def seek(self, offset, whence=0):
        position = offset + (0 if whence == 0 else self.position if whence == 1 else self.length)
        if position < 0: raise ValueError('Negative nested ZIP seek')
        self.position = position
        return position
    def read(self, size=-1):
        remaining = max(0, self.length - self.position)
        size = remaining if size < 0 else min(size, remaining)
        self.handle.seek(self.offset + self.position)
        value = self.handle.read(size); self.position += len(value)
        return value
    def close(self):
        self.handle.close(); super().close()


class ArchiveIndex:
    """Only the CPU builder reads ZIP directories and materializes nested ZIPs."""
    def __init__(self, root, database, storage):
        self.root, self.db, self.storage = Path(root), database, storage
        self.key = self.archive = None
        self.segment = None
        self.source_key = self.location = None

    def close(self):
        if self.archive is not None:
            self.archive.close()
        if self.segment is not None:
            self.segment.close(); self.segment = None
        self.key = self.archive = None

    def locator(self, record):
        path = Path(record.container)
        if not record.member:
            size = path.stat().st_size
            return dict(path=str(path), offset=0, compressed_size=size, size=size, compression=0)
        source_key = (record.container, record.nested_archive)
        base = 0; length = None
        if source_key == self.source_key:
            path, base, length = self.location
        elif record.nested_archive:
            with zipfile.ZipFile(record.container) as outer:
                info = outer.getinfo(record.nested_archive)
                if info.flag_bits & 1:
                    raise ValueError('Encrypted nested ZIP')
                if info.compress_type == zipfile.ZIP_STORED:
                    base = zip_payload_offset(record.container, info)
                    length = info.file_size
        if record.nested_archive and length is None and source_key != self.source_key:
            key = json.dumps([record.container, record.nested_archive])
            name = str(uuid.uuid5(uuid.NAMESPACE_URL, key)) + '.zip'
            path = self.root / 'containers' / name
            cached = self.db.execute('SELECT metadata FROM containers WHERE name=?', (name,)).fetchone()
            if cached:
                if json.loads(cached[0]) != file_metadata(path):
                    raise RuntimeError('Materialized nested archive changed')
            else:
                path.parent.mkdir(exist_ok=True)
                with zipfile.ZipFile(record.container) as outer:
                    self.storage.require(outer.getinfo(record.nested_archive).file_size)
                    temporary = path.with_suffix('.partial')
                    with outer.open(record.nested_archive) as source, temporary.open('wb') as target:
                        shutil.copyfileobj(source, target, 8 << 20)
                        target.flush(); os.fsync(target.fileno())
                    os.replace(temporary, path)
                self.db.execute('INSERT INTO containers VALUES (?, ?)',
                                (name, json.dumps(file_metadata(path))))
        self.source_key, self.location = source_key, (path, base, length)
        archive_key = (str(path), base, length)
        if archive_key != self.key:
            self.close()
            if length is not None:
                self.segment = FileSlice(path, base, length)
                self.archive = zipfile.ZipFile(self.segment)
            elif path.suffix.lower() == '.zip':
                self.archive = zipfile.ZipFile(path)
            else:
                # Compressed TARs must be explicitly unpacked on CPU first.
                # Never defer an expensive archive scan/decompression to GPU time.
                self.archive = tarfile.open(path, 'r:')
            self.key = archive_key
        if isinstance(self.archive, zipfile.ZipFile):
            info = self.archive.getinfo(record.member)
            if info.flag_bits & 1 or info.compress_type not in (0, 8):
                raise ValueError('Encrypted/unsupported ZIP member')
            return dict(path=str(path), offset=zip_payload_offset(path, info, base),
                compressed_size=info.compress_size, size=info.file_size,
                compression=info.compress_type, crc=info.CRC)
        info = self.archive.getmember(record.member)
        if not info.isfile():
            raise ValueError('Image TAR member is not a regular file')
        return dict(path=str(path), offset=info.offset_data, compressed_size=info.size,
                    size=info.size, compression=0)


def build_cache(catalog, inventory, summary, root, storage, checkpoint=256):
    """Resume committed sources; individual bad sources get explicit error rows."""
    root = Path(root).resolve(); root.mkdir(parents=True, exist_ok=True)
    expected = identity(catalog, inventory, summary)
    if (root / 'READY.json').exists():
        return CPUCache(root, catalog, inventory, summary).ready
    storage.require(128 << 20)
    database_path = root / 'prepared.sqlite'
    last_budget_size = database_path.stat().st_size if database_path.exists() else 0
    db = sqlite3.connect(str(database_path), timeout=120)
    archives = ArchiveIndex(root, db, storage)
    try:
        db.execute('PRAGMA synchronous=FULL')
        db.executescript('''CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY, payload TEXT);
            CREATE TABLE IF NOT EXISTS containers (name TEXT PRIMARY KEY, metadata TEXT);
            CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY, record TEXT NOT NULL,
                payload TEXT NOT NULL, labels BLOB NOT NULL, error TEXT);''')
        old = db.execute('SELECT payload FROM metadata WHERE id=1').fetchone()
        if old and json.loads(old[0]) != expected:
            raise RuntimeError('CPU cache inputs/code changed; use a new CPU cache directory')
        if not old:
            db.execute('INSERT INTO metadata VALUES (1, ?)', (json.dumps(expected),)); db.commit()
        # Rows are inserted in contiguous inventory order, including failures,
        # and transactions commit whole prefixes. Avoid a random database read
        # per already committed source when resuming a large network-volume DB.
        last_committed = db.execute('SELECT max(id) FROM sources').fetchone()[0]
        resume_through = -1 if last_committed is None else last_committed
        pending = 0; pending_bytes = 0
        with ValidationExporter(catalog) as labels, Path(inventory).open(encoding='utf-8') as handle:
            for index, line in enumerate(handle):
                record = record_from_json(json.loads(line))
                if record.source_index != index:
                    raise RuntimeError('Inventory indexes are not contiguous')
                if index <= resume_through:
                    continue
                error = None; payload = {}; blob = bytearray()
                try:
                    if record.input_modality == 'satellite' or record.dataset_id == 'omnicity_satellite':
                        raise ValueError('Satellite imagery is excluded from embedding')
                    locator = archives.locator(record)
                    with Image.open(io.BytesIO(read_encoded(locator))) as image:
                        size = list(image.size)
                    record = labels.resolve_record(record, size)
                    transforms = transform_metadata(size, record.projection, record.perspective_mode)
                    exported = labels.export(record, size, transforms)
                    if len(exported) != len(transforms):
                        raise ValueError('Image/validation view count mismatch')
                    rows = []
                    for transform, (metadata, files) in zip(transforms, exported):
                        refs = []
                        for name, data in files:
                            refs.append([name, len(blob), len(data)]); blob.extend(data)
                        rows.append({**record.json(), 'original_size': size, 'transform': transform,
                            'view_id': f"{record.dataset_id}/{index:09d}/view_{transform['view_index']:02d}",
                            'source_views': len(transforms), 'validation': metadata, '_cached_labels': refs})
                    payload = {'locator': locator, 'size': size, 'rows': rows}
                except (OSError, ValueError, KeyError, zipfile.BadZipFile, zlib.error) as exc:
                    # Capacity/I/O failures must stop rather than poison all sources.
                    if isinstance(exc, OSError) and getattr(exc, 'errno', None) in (5, 28, 122):
                        raise
                    if 'Insufficient output-volume capacity' in str(exc):
                        raise
                    error = f'{type(exc).__name__}: {exc}'; blob.clear()
                if len(blob) >= 32 << 20:
                    storage.require(2 * len(blob) + (128 << 20))
                db.execute('INSERT INTO sources VALUES (?, ?, ?, ?, ?)',
                    (index, json.dumps(record.json()), json.dumps(payload), bytes(blob), error))
                pending += 1; pending_bytes += len(blob)
                if pending >= checkpoint or pending_bytes >= 64 << 20:
                    db.commit(); pending = pending_bytes = 0
                    # `du` traverses the entire shared volume. Do not run it at
                    # every tiny source transaction; bound unchecked growth.
                    database_size = database_path.stat().st_size
                    if database_size - last_budget_size >= 64 << 20:
                        storage.require(128 << 20)
                        last_budget_size = database_size
                    publish(root / 'progress.json', {'status': 'building', 'through_source': index,
                        'total_sources': summary['records']})
        db.commit(); storage.require(0)
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('CPU cache integrity check failed')
        count, low, high = db.execute('SELECT count(*), min(id), max(id) FROM sources').fetchone()
        if count != summary['records'] or (count and (low != 0 or high != count-1)):
            raise RuntimeError('CPU cache coverage is incomplete')
        errors = db.execute('SELECT count(*) FROM sources WHERE error IS NOT NULL').fetchone()[0]
        containers = [json.loads(row[0]) for row in db.execute('SELECT metadata FROM containers ORDER BY name')]
        if identity(catalog, inventory, summary) != expected:
            raise RuntimeError('Inputs changed during CPU cache preparation')
        db.close(); db = None
        ready = {'version': SCHEMA, 'identity': expected, 'records': count, 'errors': errors,
            'database': file_metadata(root / 'prepared.sqlite'), 'containers': containers,
            'status': 'ready_with_errors' if errors else 'ready'}
        publish(root / 'READY.json', ready)
        publish(root / 'progress.json', {k: ready[k] for k in ('status', 'records', 'errors')})
        return ready
    finally:
        archives.close()
        if db is not None:
            db.close()


class CPUCache:
    def __init__(self, root, catalog, inventory, summary):
        self.root = Path(root).resolve()
        ready = self.root / 'READY.json'
        if not ready.exists():
            raise RuntimeError('CPU cache is not ready. Run --prepare-cpu-only on the CPU Pod first.')
        self.ready = json.loads(ready.read_text(encoding='utf-8'))
        if self.ready.get('version') != SCHEMA or self.ready['identity'] != identity(catalog, inventory, summary):
            raise RuntimeError('CPU cache is stale; build a new cache on the CPU Pod')
        for metadata in [self.ready['database'], *self.ready['containers']]:
            if metadata != file_metadata(metadata['path']):
                raise RuntimeError('CPU cache file changed after publication')
        if self.ready['database']['path'] != str(self.root / 'prepared.sqlite'):
            raise RuntimeError('Mount the CPU cache at its original /workspace path')
        self.source_files = self.ready['identity']['label_files']

    def connect(self, check_same_thread=True):
        return sqlite3.connect((self.root / 'prepared.sqlite').as_uri()+'?mode=ro&immutable=1',
                               uri=True, check_same_thread=check_same_thread)

    def records(self):
        # The lookahead worker consumes this iterator; main-thread teardown may
        # close it after that worker has drained.
        db = self.connect(check_same_thread=False)
        try:
            for (record,) in db.execute('SELECT record FROM sources ORDER BY id'):
                yield record_from_json(json.loads(record))
        finally:
            db.close()

    def entry(self, db, index):
        entry = db.execute('SELECT payload, labels, error FROM sources WHERE id=?', (index,)).fetchone()
        if entry is None:
            raise RuntimeError('Missing committed CPU cache source')
        payload, blob, error = entry
        return json.loads(payload), blob, error
