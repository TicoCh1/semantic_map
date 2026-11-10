"""Durable run identity and checkpoint validation for heterogeneous embeddings."""
from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import tarfile

import numpy as np

from dataset_image_pipeline import file_metadata, load_catalog, source_snapshot


class StorageBudget:
    """Honor the individual volume quota; shared-pool df is not its free space."""
    def __init__(self, volume_root, output_root, capacity_gb=0, reserve_gb=10):
        self.root = Path(volume_root).resolve()
        output = Path(output_root).resolve()
        if self.root != output and self.root not in output.parents:
            raise ValueError('Output root must be inside the configured output volume root')
        self.capacity = int(capacity_gb * 1_000_000_000)
        self.reserve = int(reserve_gb * 1_000_000_000)

    def require(self, payload_bytes):
        available = shutil.disk_usage(self.root).free
        if self.capacity:
            result = subprocess.run(['du', '-sx', '-B1', str(self.root)],
                                    capture_output=True, text=True, check=True)
            allocated = int(result.stdout.split()[0])
            available = min(available, self.capacity - allocated)
        if available < payload_bytes + self.reserve:
            raise OSError(f'Insufficient output-volume capacity: need {payload_bytes} bytes plus '
                          f'{self.reserve} reserve; available {available}. Use a larger output volume.')


class RunLock:
    """A kernel lock prevents two launchers from publishing the same shard."""
    def __init__(self, root):
        self.path = Path(root) / '.embedding.lock'

    def __enter__(self):
        import fcntl
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = self.path.open('a')
        try:
            fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise RuntimeError(f'Another embedding/inventory process owns {self.path}')
        return self

    def __exit__(self, *_):
        self.handle.close()


def validate_inventory(catalog, inventory, summary):
    if not summary.get('inventory_id'):
        raise RuntimeError('Legacy inventory: rebuild in an unused output root')
    raw, rules = load_catalog(catalog)
    if summary.get('catalog_snapshot') != raw:
        raise RuntimeError('Catalog changed; use a new output root or rebuild an unused inventory')
    if summary.get('inventory_file') != file_metadata(inventory):
        raise RuntimeError('Inventory file changed after publication')
    if summary.get('source_files') != source_snapshot(rules):
        raise RuntimeError('Source files or wildcard expansion changed; build a fresh inventory')


def configuration(args, summary, label_files):
    model = Path(args.model_dir).resolve()
    repo = Path(args.repo_dir).resolve()
    def snapshot(root, pattern):
        return [file_metadata(p) for p in sorted(root.glob(pattern)) if p.is_file()]
    return {'version': 4, 'pipeline_version': 'heterogeneous-cuda-native-packages-v4',
            'inventory_id': summary['inventory_id'], 'model_dir': str(model),
            'model_files': snapshot(model, '**/*'), 'repo_dir': str(repo),
            'model_code': snapshot(repo / 'src', '**/*.py'),
            'precision': args.precision, 'rgb_storage': 'source_reference', 'output_size': [512, 512],
            'rgb_preprocessing': 'native_transform_pixels_no_codec_roundtrip',
            'raster_export': 'geometry_changes_only_lossless',
            'input_pipeline': 'cuda-flat-rgb-position-cache-lookahead1',
            'output_layout': 'dataset_container_nested_archive',
            'embed_batch': args.embed_batch,
            'pipeline_code': [file_metadata(Path(__file__).with_name(name)) for name in [
                'run_dataset_embedding.py', 'dataset_image_pipeline.py', 'dataset_run_state.py',
                'dataset_validation_export.py', 'validation_projection.py', 'pipeline_runtime.py',
                'dataset_async_pipeline.py', 'dataset_package_store.py', 'gpu_input_pipeline.py', 'dataset_cpu_cache.py']],
            'label_files': label_files}


def committed_sources(root: Path, inventory_id=None) -> set[int]:
    """Validate every durable shard before trusting any committed source IDs.

    Check payload existence/size, NPY schema, complete source view groups, and TAR
    membership against the mapping. No full image decode or SHA hashing on resume.
    """
    committed = set()
    dimension = None
    for index, path in enumerate(sorted(root.glob('checkpoint_*.json'))):
        marker = json.loads(path.read_text())
        if marker['shard'] != index:
            raise RuntimeError('Checkpoint sequence gap')
        if marker.get('version') != 3:
            raise RuntimeError('Legacy checkpoint: use a new output root; automatic mixing is prohibited')
        if inventory_id is not None and marker.get('inventory_id') != inventory_id:
            raise RuntimeError('Checkpoint belongs to another inventory')
        files = {}
        for kind in ('embedding', 'mapping', 'validation'):
            entry = marker['files'][kind]
            name = entry['name']
            if Path(name).name != name:
                raise RuntimeError('Invalid checkpoint file path')
            file = root / name
            if not file.is_file() or file.stat().st_size != entry['bytes']:
                raise RuntimeError(f'Missing or changed committed file: {file}')
            files[kind] = file
        vectors = np.load(files['embedding'], mmap_mode='r', allow_pickle=False)
        if vectors.ndim != 2 or list(vectors.shape) != marker['shape'] or \
                vectors.shape[0] != marker['rows'] or vectors.dtype != np.float16:
            raise RuntimeError(f'Invalid embedding schema: {files["embedding"]}')
        if dimension is not None and dimension != vectors.shape[1]:
            raise RuntimeError('Embedding dimension changed across shards')
        dimension = vectors.shape[1]
        del vectors
        with files['mapping'].open(encoding='utf-8') as handle:
            rows = [json.loads(line) for line in handle]
        if len(rows) != marker['rows']:
            raise RuntimeError('Mapping row count mismatch')
        groups = {}
        image_names, validation_names = [], []
        for offset, row in enumerate(rows):
            if row['shard'] != index or row['embedding_row'] != offset:
                raise RuntimeError('Mapping row alignment mismatch')
            source = int(row['source_index'])
            if source in committed:
                raise RuntimeError('Duplicate committed source across shards')
            groups.setdefault(source, []).append(row)
            expected_id = f"{row['dataset_id']}/{source:09d}/view_{row['transform']['view_index']:02d}"
            if row['view_id'] != expected_id or not row.get('source_uri'):
                raise RuntimeError('Derived view/source identity mismatch')
            image_names.append(row['view_id'])
            validation_names.extend(row['validation']['members'])
        if len(set(image_names)) != len(image_names):
            raise RuntimeError('Duplicate derived image member')
        for source_rows in groups.values():
            expected = source_rows[0]['source_views']
            if len(source_rows) != expected or any(r['source_views'] != expected for r in source_rows) or \
                    sorted(r['transform']['view_index'] for r in source_rows) != list(range(expected)):
                raise RuntimeError('Incomplete or duplicated source view group')
        for kind, expected in [('validation', validation_names)]:
            with tarfile.open(files[kind]) as archive:
                members = archive.getmembers()
            if [m.name for m in members] != expected or any(not m.isfile() or m.size <= 0 for m in members):
                raise RuntimeError(f'{kind} TAR/mapping alignment mismatch')
        if marker['source_indexes'] != list(groups):
            raise RuntimeError('Checkpoint source identity mismatch')
        committed.update(groups)
    return committed
