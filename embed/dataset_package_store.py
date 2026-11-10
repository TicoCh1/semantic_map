"""Append-only native source packages with recoverable, source-atomic commits.

One package per dataset/container/nested archive (a directory for loose files).
Checkpoints are byte offsets, not output shards. No package-sized RAM buffer.
"""
from __future__ import annotations

import io
from contextlib import ExitStack
import json
import os
from pathlib import Path
import struct
import tarfile
import uuid

import numpy as np

HEADER_SIZE = 4096
FILES = {'embedding': 'embeddings.npy', 'mapping': 'image_map.jsonl',
         'validation': 'validation.tar'}


def package_identity(row):
    return {'dataset_id': row['dataset_id'],
            'container': row['container'] if row.get('member') else str(Path(row['container']).parent),
            'nested_archive': row.get('nested_archive')}


def package_id(identity):
    # UUID names identify locators; no source payload hashing or verification.
    return uuid.uuid5(uuid.NAMESPACE_URL, json.dumps(identity, sort_keys=True)).hex


def npy_header(rows, dimension):
    text = repr({'descr': '<f2', 'fortran_order': False, 'shape': (rows, dimension)})
    payload = (text + ' ' * (HEADER_SIZE - 12 - len(text) - 1) + '\n').encode('ascii')
    if len(payload) != HEADER_SIZE - 12:
        raise ValueError('NPY header exceeds reserved space')
    return b'\x93NUMPY\x02\x00' + struct.pack('<I', len(payload)) + payload


def atomic_json(path, value):
    partial = path.with_name(path.name + '.partial')
    with partial.open('w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.flush(); os.fsync(handle.fileno())
    os.replace(partial, path)


def scan_package(root, inventory_id=None, recover=False):
    """Trust only the last published offsets; reject shortened committed files."""
    path = root / 'checkpoint.json'
    if not path.exists():
        return set(), None
    marker = json.loads(path.read_text())
    if marker.get('version') != 4 or marker.get('package_id') != root.name:
        raise RuntimeError('Invalid native package checkpoint')
    if marker.get('files') != FILES:
        raise RuntimeError('Invalid native package file layout')
    if package_id(marker['identity']) != root.name:
        raise RuntimeError('Package identity mismatch')
    if inventory_id is not None and marker['inventory_id'] != inventory_id:
        raise RuntimeError('Package belongs to another inventory')
    rows, dim = marker['rows'], marker['dimension']
    if rows <= 0 or dim <= 0 or marker['bytes']['embedding'] != HEADER_SIZE + rows * dim * 2:
        raise RuntimeError('Invalid embedding schema')
    for kind, name in FILES.items():
        file = root / name
        if not file.is_file() or file.stat().st_size < marker['bytes'][kind]:
            raise RuntimeError(f'Missing or shortened committed file: {file}')
    # An interrupted append can have a newer NPY header than the checkpoint.
    with (root / FILES['embedding']).open('rb') as handle:
        header = handle.read(HEADER_SIZE)
    try:
        shape, fortran, dtype = np.lib.format.read_array_header_2_0(io.BytesIO(header[8:]))
    except Exception as exc:
        raise RuntimeError('Invalid NPY header') from exc
    if header[:8] != b'\x93NUMPY\x02\x00' or dtype != np.dtype('<f2') or fortran or \
            len(shape) != 2 or shape[1] != dim or shape[0] < rows:
        raise RuntimeError('Invalid embedding schema')
    committed, current, view_indexes = set(), None, []
    consumed = last_label_end = 0
    with (root / FILES['mapping']).open('rb') as mapping, ExitStack() as stack:
        labels = iter(stack.enter_context(tarfile.open(root / FILES['validation'], 'r:'))) \
            if marker['bytes']['validation'] else iter(())
        for offset in range(rows):
            line = mapping.readline(); consumed += len(line)
            if consumed > marker['bytes']['mapping']:
                raise RuntimeError('Mapping extends beyond committed offset')
            row = json.loads(line)
            source = row['source_index']
            if current != source:
                if current is not None:
                    if view_indexes != list(range(expected)):
                        raise RuntimeError('Incomplete source view group')
                    committed.add(current)
                if source in committed:
                    raise RuntimeError('Duplicate source within package')
                current, expected, view_indexes = source, row['source_views'], []
            if row['source_views'] != expected or row['embedding_row'] != offset or \
                    row['package_id'] != root.name or package_identity(row) != marker['identity']:
                raise RuntimeError('Mapping row/package alignment mismatch')
            view_index = row['transform']['view_index']
            if row['view_id'] != f"{row['dataset_id']}/{source:09d}/view_{view_index:02d}" or not row.get('source_uri'):
                raise RuntimeError('Derived view/source identity mismatch')
            view_indexes.append(view_index)
            for name in row['validation']['members']:
                member = next(labels, None)
                if member is None or member.name != name or not member.isfile() or member.size <= 0 or \
                        member.offset_data + ((member.size + 511) // 512) * 512 > marker['bytes']['validation']:
                    raise RuntimeError('Validation TAR/mapping alignment mismatch')
                last_label_end = member.offset_data + ((member.size + 511) // 512) * 512
        if view_indexes != list(range(expected)) or consumed != marker['bytes']['mapping']:
            raise RuntimeError('Incomplete source group or mapping byte count mismatch')
        committed.add(current)
        if last_label_end != marker['bytes']['validation']:
            raise RuntimeError('Unexpected committed validation bytes')
    if len(committed) != marker['sources']:
        raise RuntimeError('Package source count mismatch')
    if recover:
        for kind, name in FILES.items():
            with (root / name).open('r+b') as handle:
                handle.truncate(marker['bytes'][kind])
                if kind == 'embedding':
                    handle.seek(0); handle.write(npy_header(rows, dim))
                handle.flush(); os.fsync(handle.fileno())
    return committed, marker


def committed_packages(root, inventory_id=None):
    sources, dimension = set(), None
    for path in sorted(Path(root).glob('*/checkpoint.json')):
        found, marker = scan_package(path.parent, inventory_id)
        if found & sources:
            raise RuntimeError('Duplicate committed source across packages')
        if dimension is not None and marker['dimension'] != dimension:
            raise RuntimeError('Embedding dimension changed across packages')
        dimension = marker['dimension']
        sources.update(found)
    return sources


class PackageWriter:
    """Owned by exactly one disk-writer thread. Commit only complete sources."""
    def __init__(self, root, inventory_id, storage=None, checkpoint_sources=256, publish=atomic_json):
        self.root = Path(root); self.root.mkdir(parents=True, exist_ok=True)
        self.inventory_id, self.storage = inventory_id, storage
        self.checkpoint_sources, self.publish = checkpoint_sources, publish
        self.handles, self.active, self.pending = {}, None, []
        self.rows = self.sources = self.dimension = 0
        self.identity = None
        self.global_dimension = None
        for path in self.root.glob('*/checkpoint.json'):
            dim = json.loads(path.read_text())['dimension']
            if self.global_dimension is not None and dim != self.global_dimension:
                raise RuntimeError('Embedding dimension changed across packages')
            self.global_dimension = dim

    def _open(self, identity, dimension):
        self.identity, self.active = identity, self.root / package_id(identity)
        self.active.mkdir(exist_ok=True)
        _, marker = scan_package(self.active, self.inventory_id, recover=True)
        if marker:
            self.rows, self.sources, self.dimension = marker['rows'], marker['sources'], marker['dimension']
            if dimension != self.dimension:
                raise RuntimeError('Embedding dimension changed')
        else:
            self.rows, self.sources, self.dimension = 0, 0, dimension
        for kind, name in FILES.items():
            handle = (self.active / name).open('r+b' if marker else 'w+b')
            if not marker and kind == 'embedding':
                handle.write(npy_header(0, dimension))
            handle.seek(0, 2); self.handles[kind] = handle

    def write(self, completed):
        acknowledged = set()
        for vectors, rows in completed:
            if not rows:
                continue
            count, source = rows[0]['source_views'], rows[0]['source_index']
            if len(rows) != count or [r['transform']['view_index'] for r in rows] != list(range(count)) or \
                    any(r['source_index'] != source or r['source_views'] != count for r in rows):
                raise ValueError('Cannot write an incomplete source')
            vectors = np.asarray(vectors, dtype='<f2')
            if vectors.ndim != 2 or vectors.shape[0] != count or not vectors.shape[1] or not np.isfinite(vectors).all():
                raise ValueError('Invalid source vectors')
            if self.global_dimension is not None and self.global_dimension != vectors.shape[1]:
                raise RuntimeError('Embedding dimension changed across packages')
            self.global_dimension = vectors.shape[1]
            identity = package_identity(rows[0])
            if any(package_identity(row) != identity for row in rows):
                raise ValueError('Mixed package source')
            if self.identity != identity:
                acknowledged.update(self.flush())
                self._close_handles()
                self._open(identity, vectors.shape[1])
            # A network-volume du can take seconds. Amortize it across actual
            # output bytes, independently of frequent durable checkpoints.
            payload_bytes = vectors.nbytes + sum(len(b) + 1024 for r in rows for _, b in r.get('_validation_files', []))
            if self.storage and (not hasattr(self, 'unchecked_bytes') or
                                 self.unchecked_bytes + payload_bytes >= 1 << 30):
                self.storage.require(max(payload_bytes * 2, 2 << 30))
                self.unchecked_bytes = 0
            before_bytes = sum(handle.tell() for handle in self.handles.values())
            self.handles['embedding'].write(vectors.tobytes(order='C'))
            for row in rows:
                row = dict(row)
                files = row.pop('_validation_files', [])
                if [name for name, _ in files] != row['validation']['members']:
                    raise ValueError('Validation payload/mapping mismatch')
                for name, payload in files:
                    info = tarfile.TarInfo(name)
                    info.size, info.mtime, info.mode = len(payload), 0, 0o644
                    self.handles['validation'].write(info.tobuf(format=tarfile.PAX_FORMAT))
                    self.handles['validation'].write(payload)
                    self.handles['validation'].write(b'\0' * ((-len(payload)) % 512))
                row.update(package_id=self.active.name, embedding_row=self.rows)
                self.handles['mapping'].write((json.dumps(row, ensure_ascii=False, allow_nan=False) + '\n').encode())
                self.rows += 1
            written_bytes = sum(handle.tell() for handle in self.handles.values()) - before_bytes
            self.unchecked_bytes = getattr(self, 'unchecked_bytes', 0) + written_bytes
            self.sources += 1; self.pending.append(source)
            if len(self.pending) >= self.checkpoint_sources:
                acknowledged.update(self.flush())
        return acknowledged

    def flush(self):
        if not self.pending:
            return set()
        offsets = {kind: handle.tell() for kind, handle in self.handles.items()}
        embedding = self.handles['embedding']
        embedding.seek(0); embedding.write(npy_header(self.rows, self.dimension))
        embedding.seek(offsets['embedding'])
        for handle in self.handles.values():
            handle.flush(); os.fsync(handle.fileno())
        self.publish(self.active / 'checkpoint.json', {
            'version': 4, 'inventory_id': self.inventory_id, 'package_id': self.active.name,
            'identity': self.identity, 'rows': self.rows, 'sources': self.sources,
            'dimension': self.dimension, 'dtype': 'float16', 'bytes': offsets,
            'files': FILES, 'rgb_storage': 'source_reference'})
        result = set(self.pending); self.pending.clear()
        return result

    def _close_handles(self):
        for handle in self.handles.values():
            handle.close()
        self.handles = {}

    def close(self, commit=True):
        try:
            return self.flush() if commit else set()
        finally:
            self._close_handles()
