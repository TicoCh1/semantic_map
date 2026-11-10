#!/usr/bin/env python3
"""Embed heterogeneous datasets with the official CORE 8B checkpoint.

Perspective sources yield one centered 512x512 image. Equirectangular sources
yield eight 512x512, 45-degree perspective views. Embeddings are flat per
derived image and every row maps back to dataset/archive/member and transform.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import io
import json
import os
import queue
from pathlib import Path
import signal
import sys
import threading
import tarfile
from types import SimpleNamespace

import numpy as np

from dataset_image_pipeline import (DEFAULT_YAWS, ImageReader, record_from_json,
                                    transform_image, write_inventory)
from dataset_run_state import RunLock, StorageBudget, committed_sources, configuration, validate_inventory


def arguments(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", default=str(Path(__file__).with_name("dataset_catalog_runpod.json")))
    parser.add_argument("--output-root", default="/workspace/reruns/public_datasets_512_core8b")
    parser.add_argument("--repo-dir", default="/workspace/core-emb")
    parser.add_argument("--model-dir", default="/workspace/models/core-emb-8b")
    parser.add_argument("--cache-root", default="/workspace/dataset_embedding_cache")
    parser.add_argument("--inventory-only", action="store_true")
    parser.add_argument("--prepare-cpu-only", action="store_true")
    parser.add_argument("--check-cpu-cache", action="store_true")
    parser.add_argument("--cpu-cache-root", help="Persistent cache on the shared volume; default OUTPUT/cpu_cache")
    parser.add_argument("--rebuild-inventory", action="store_true")
    parser.add_argument("--retry-errors", action="store_true",
                        help="Retry sources already present in embedding_errors.jsonl")
    parser.add_argument("--max-sources", type=int, default=0)
    parser.add_argument("--embed-batch", type=int, default=8)
    parser.add_argument('--checkpoint-sources', type=int, default=256,
                        help='Commit interval within a native package; does not split output packages')
    parser.add_argument('--decode-workers', type=int, default=4)
    parser.add_argument('--prefetch-sources', type=int, default=16)
    parser.add_argument('--gpu-prepare-sources', type=int, default=4)
    parser.add_argument('--max-consecutive-batch-errors', type=int, default=3,
                        help='Stop on repeated CUDA/model failures instead of failing the entire inventory')
    parser.add_argument("--precision", choices=["bf16", "fp16"], default="bf16")
    parser.add_argument('--volume-root', default='/workspace')
    parser.add_argument('--volume-capacity-gb', type=float, default=500,
                        help='Actual output volume quota in decimal GB; 0 uses filesystem free space only')
    parser.add_argument('--storage-reserve-gb', type=float, default=10)
    args = parser.parse_args(argv)
    if min(args.embed_batch, args.checkpoint_sources, args.decode_workers,
           args.prefetch_sources, args.gpu_prepare_sources, args.max_consecutive_batch_errors) <= 0 or args.max_sources < 0:
        parser.error('Batch, checkpoint and queue sizes must be positive; max-sources must be nonnegative')
    if args.volume_capacity_gb < 0 or args.storage_reserve_gb < 0:
        parser.error('Storage capacity and reserve must be nonnegative')
    return args


def atomic_json(path: Path, value: dict) -> None:
    partial = path.with_suffix(path.suffix + ".partial")
    with partial.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False)
        handle.flush(); os.fsync(handle.fileno())
    os.replace(partial, path)


def catalog_snapshot(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


class ErrorLedger:
    """Durable per-source failures that can be retried explicitly later."""
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.skipped_sources = set()
        if path.exists():
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    if line.strip():
                        event = json.loads(line)
                        source_index = int(event['source_index'])
                        if event.get('event') == 'resolved':
                            self.skipped_sources.discard(source_index)
                        else:
                            self.skipped_sources.add(source_index)
        self.handle = path.open("a", encoding="utf-8")
        self.new_errors = 0

    def record(self, source, stage: str, error, **details):
        row = source.json() if hasattr(source, "json") else dict(source)
        payload = {"recorded_at": datetime.now(timezone.utc).isoformat(),
                   "stage": stage, "error_type": type(error).__name__,
                   "error": str(error), **row, **details}
        self.handle.write(json.dumps(payload, ensure_ascii=False, allow_nan=False) + "\n")
        self.handle.flush(); os.fsync(self.handle.fileno())
        self.skipped_sources.add(int(row["source_index"]))
        self.new_errors += 1

    def close(self):
        self.handle.close()

    def reconcile(self, committed):
        # Only a validated, durably published checkpoint can resolve an error.
        for index in sorted(self.skipped_sources.intersection(committed)):
            self.handle.write(json.dumps({'event': 'resolved', 'source_index': index,
                'recorded_at': datetime.now(timezone.utc).isoformat()}) + '\n')
            self.skipped_sources.remove(index)
        self.handle.flush(); os.fsync(self.handle.fileno())

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class ExcludedModalityError(RuntimeError):
    pass


def source_safe_batches(images, rows, limit):
    """Batch without splitting the derived views of a single source image."""
    groups = []
    start = 0
    while start < len(rows):
        end = start + 1
        while end < len(rows) and rows[end]["source_index"] == rows[start]["source_index"]:
            end += 1
        groups.append((images[start:end], rows[start:end]))
        start = end
    batches = []
    batch_images, batch_rows = [], []
    for group_images, group_rows in groups:
        if batch_images and len(batch_images) + len(group_images) > limit:
            batches.append((batch_images, batch_rows))
            batch_images, batch_rows = [], []
        batch_images.extend(group_images); batch_rows.extend(group_rows)
    if batch_images:
        batches.append((batch_images, batch_rows))
    return batches


class ShardWriter:
    def __init__(self, root: Path, size: int, inventory_id=None, storage=None):
        self.root, self.size = root, size
        self.inventory_id = inventory_id
        self.storage = storage
        self.root.mkdir(parents=True, exist_ok=True)
        self.index = len(list(root.glob("checkpoint_*.json")))
        self.vectors: list[np.ndarray] = []
        self.rows: list[dict] = []
        self.validation_files = []
        self.committed = set()

    def add(self, vector, row):
        row = dict(row)
        self.validation_files.extend(row.pop('_validation_files', []))
        row.setdefault('validation', {'status': 'not_configured', 'members': []})
        row.setdefault('source_views', 1)
        self.vectors.append(np.asarray(vector, dtype=np.float16))
        self.rows.append(row)

    def flush_if_full(self):
        # Called only at a source-image boundary. A panorama's eight views must
        # never straddle checkpoints, otherwise source-index resume could skip
        # the latter views after a crash.
        if len(self.rows) >= self.size:
            self.flush()

    def flush(self):
        if not self.rows:
            return
        if self.storage:
            # Account for TAR padding, mapping, NPY header and allocation slack.
            label_bytes = sum(((len(b) + 511) // 512 + 1) * 512 for _, b in self.validation_files)
            mapping_bytes = sum(len(json.dumps(row, ensure_ascii=False).encode('utf-8')) + 100 for row in self.rows)
            self.storage.require(int((label_bytes + mapping_bytes +
                                      sum(v.nbytes for v in self.vectors)) * 1.1) + 1_048_576)
        stem = f"shard_{self.index:05d}"
        final = {"embedding": self.root / f"{stem}.npy",
                 "mapping": self.root / f"{stem}_image_map.jsonl",
                 "validation": self.root / f"{stem}_validation.tar"}
        partial = {key: path.with_suffix(path.suffix + ".partial") for key, path in final.items()}
        with partial["embedding"].open("wb") as handle:
            np.save(handle, np.stack(self.vectors).astype(np.float16), allow_pickle=False)
            handle.flush(); os.fsync(handle.fileno())
        with partial['validation'].open('wb') as raw:
            with tarfile.open(fileobj=raw, mode='w') as archive:
                for name, payload in self.validation_files:
                    info = tarfile.TarInfo(name)
                    info.size, info.mtime, info.mode = len(payload), 0, 0o644
                    archive.addfile(info, io.BytesIO(payload))
            raw.flush(); os.fsync(raw.fileno())
        with partial["mapping"].open("w", encoding="utf-8") as handle:
            for offset, row in enumerate(self.rows):
                handle.write(json.dumps({**row, "shard": self.index, "embedding_row": offset},
                                        ensure_ascii=False, allow_nan=False) + "\n")
            handle.flush(); os.fsync(handle.fileno())
        for key in final:
            os.replace(partial[key], final[key])
        source_indexes = list(dict.fromkeys(row['source_index'] for row in self.rows))
        marker = {"version": 3, "inventory_id": self.inventory_id,
                  "shard": self.index, "rows": len(self.rows),
                  "source_indexes": source_indexes,
                  "shape": [len(self.rows), int(self.vectors[0].shape[-1])],
                  "last_source_index": self.rows[-1]["source_index"],
                  "files": {key: {"name": path.name, "bytes": path.stat().st_size}
                            for key, path in final.items()}}
        atomic_json(self.root / f"checkpoint_{self.index:05d}.json", marker)
        self.committed.update(source_indexes)
        self.index += 1
        self.vectors.clear(); self.rows.clear()
        self.validation_files.clear()


def completed_source_index(root: Path) -> int:
    return max(committed_sources(root), default=-1)


def embed_batch(embedder, images):
    output = embedder.process([{"image": image} for image in images], normalize=True)
    if hasattr(output, "detach"):
        import torch
        output = output.detach().to(device="cpu", dtype=torch.float16).numpy()
    result = np.asarray(output, dtype=np.float16)
    if result.ndim != 2 or result.shape[0] != len(images) or result.shape[1] == 0 or not np.isfinite(result).all():
        raise ValueError(f"Invalid model output {result.shape}")
    return result


def transform_for_inference(source, projection, perspective_mode="center_crop", gpu_projector=None):
    """Apply the declared transform; aspect ratio never selects projection."""
    if projection != "equirectangular" or gpu_projector is None:
        return transform_image(source, projection, 512, 45, DEFAULT_YAWS, perspective_mode)
    if tuple(gpu_projector.yaws) != tuple(DEFAULT_YAWS):
        raise ValueError('Projector yaw order does not match annotation transforms')
    width, height = source.size
    if abs(width / height - 2.0) > 0.03:
        raise ValueError(f"Equirectangular rule received non-2:1 image {width}x{height}")
    views = gpu_projector([SimpleNamespace(image=source)])
    return [(image, {"method": "equirectangular_to_perspective",
                     "view_index": view_index, "yaw_degrees": yaw,
                     "pitch_degrees": 0.0, "fov_degrees": 45.0,
                     "output_size": [512, 512]})
            for view_index, (yaw, image) in enumerate(zip(DEFAULT_YAWS, views))]


def main(argv=None):
    args = arguments(argv)
    output = Path(args.output_root).resolve()
    from core_embedding_safety import check_output_root
    check_output_root(output, args.model_dir, args.repo_dir)
    output.mkdir(parents=True, exist_ok=True)
    with RunLock(output):
        return run(args, output)


def run(args, output):
    inventory = output / "source_inventory.jsonl"
    populated = (any((output / 'shards').glob('checkpoint_*.json')) or
                 (output / 'run_manifest.json').exists() or
                 ((output / 'embedding_errors.jsonl').exists() and
                  (output / 'embedding_errors.jsonl').stat().st_size > 0))
    if (args.rebuild_inventory or not inventory.exists()) and populated:
        raise RuntimeError('Cannot rebuild a populated output root; use a new output root')
    if (args.rebuild_inventory or not inventory.exists()) and not (args.inventory_only or args.prepare_cpu_only):
        raise RuntimeError("Prepare the inventory/cache with --prepare-cpu-only on the CPU Pod first")
    if args.rebuild_inventory or not inventory.exists():
        report = write_inventory(args.catalog, inventory, args.cache_root)
        report["catalog_snapshot"] = catalog_snapshot(args.catalog)
        atomic_json(output / "inventory_summary.json", report)
    else:
        summary_path = output / "inventory_summary.json"
        if not summary_path.exists():
            raise RuntimeError("Inventory summary missing; rerun with --rebuild-inventory")
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
    summary = json.loads((output / 'inventory_summary.json').read_text(encoding='utf-8'))
    validate_inventory(args.catalog, inventory, summary)
    if args.inventory_only:
        print((output / "inventory_summary.json").read_text())
        return 0

    from dataset_cpu_cache import CPUCache, build_cache
    cache_root = Path(args.cpu_cache_root).resolve() if args.cpu_cache_root else output / 'cpu_cache'
    if cache_root == output:
        raise ValueError('CPU cache must have its own subdirectory')
    with RunLock(cache_root):
        if args.prepare_cpu_only:
            storage = StorageBudget(args.volume_root, cache_root, args.volume_capacity_gb, args.storage_reserve_gb)
            ready = build_cache(args.catalog, inventory, summary, cache_root, storage, args.checkpoint_sources)
            print(json.dumps({key: ready[key] for key in ('status', 'records', 'errors')}, indent=2))
            return 0
        cache = CPUCache(cache_root, args.catalog, inventory, summary)
        if args.check_cpu_cache:
            print(json.dumps({key: cache.ready[key] for key in ('status', 'records', 'errors')}, indent=2))
            return 0
        return run_inference(args, output, inventory, summary, cache)


def create_engine(model, args):
    from pipeline_runtime import NativeProjector
    from dataset_async_pipeline import CudaImageEngine
    projector = NativeProjector(device='cuda', out_size=512, precision=args.precision, yaws=DEFAULT_YAWS)
    return CudaImageEngine(model, projector, args.precision, args.gpu_prepare_sources)


def run_inference(args, output, inventory, summary, cache):
    from dataset_package_store import PackageWriter, committed_packages
    from dataset_async_pipeline import CachedCPUPreparation, SourceResults, flat_batches, lookahead_batches
    storage = StorageBudget(args.volume_root, output, args.volume_capacity_gb, args.storage_reserve_gb)
    storage.require(0)
    if any((output / 'shards').glob('checkpoint_*.json')):
        raise RuntimeError('Legacy image/shard layout: use a new output root')
    committed = committed_packages(output / 'packages', summary['inventory_id'])
    if any(index < 0 or index >= summary['records'] for index in committed):
        raise RuntimeError('Committed source index is outside inventory')
    manifest = configuration(args, summary, cache.source_files)
    from core_embedding_adapter import provenance
    manifest['core'] = provenance(args.repo_dir, args.model_dir)
    manifest['model_code'] = [dict(path=str(path), size=path.stat().st_size, mtime_ns=path.stat().st_mtime_ns) for path in sorted(Path(args.repo_dir).glob('models/**/*.py'))]
    manifest['pipeline_version'] = 'core-heterogeneous-cuda-native-packages-v1'
    manifest['pipeline_code'].extend(dict(path=str(path), size=path.stat().st_size, mtime_ns=path.stat().st_mtime_ns) for path in [Path(__file__), Path(__file__).with_name('core_embedding_adapter.py')])
    manifest_path = output / 'run_manifest.json'
    if manifest_path.exists():
        if json.loads(manifest_path.read_text()) != manifest:
            raise RuntimeError('Model, precision, preprocessing or labels changed; use a new output root')
    elif committed:
        raise RuntimeError('Existing output has no run manifest; use a new output root')
    # A validated complete CORE output must not reload 16 GB of weights on resume.
    if len(committed) == summary['records'] and not args.retry_errors:
        atomic_json(output / 'run_status.json', {'status': 'complete',
            'inventory_id': summary['inventory_id'], 'total_sources': summary['records'],
            'committed_sources': len(committed), 'remaining_sources': 0,
            'output_layout': 'native_source_packages', 'model_loaded': False})
        print(json.dumps({'status': 'already_complete', 'committed_sources': len(committed)}))
        return 0
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA is required for embedding; inventory is complete and unchanged')
    sys.path.insert(0, str(Path(args.repo_dir).resolve()))
    from core_embedding_adapter import CoreEmbedder
    if args.precision == 'bf16' and not torch.cuda.is_bf16_supported():
        raise RuntimeError('GPU does not support bf16; use --precision fp16 with a new output root')
    model = CoreEmbedder(model_name_or_path=str(Path(args.model_dir).resolve()), repo_dir=args.repo_dir,
                           dtype=getattr(torch, 'bfloat16' if args.precision == 'bf16' else 'float16'))
    engine = create_engine(model, args)
    if not manifest_path.exists():
        atomic_json(manifest_path, manifest)
    writer = PackageWriter(output / 'packages', summary['inventory_id'], storage,
                           args.checkpoint_sources, publish=atomic_json)
    stopped = threading.Event()
    def stop(*_):
        stopped.set()
    signal.signal(signal.SIGINT, stop); signal.signal(signal.SIGTERM, stop)
    limited = False
    sources_seen = 0
    with ErrorLedger(output / 'embedding_errors.jsonl') as errors:
        errors.reconcile(committed)
        retry_sources = errors.skipped_sources.copy()
        def records():
            nonlocal sources_seen, limited
            for record in cache.records():
                if record.source_index in committed:
                    continue
                if args.retry_errors and record.source_index not in retry_sources:
                    continue
                if not args.retry_errors and record.source_index in errors.skipped_sources:
                    continue
                if stopped.is_set() or (args.max_sources and sources_seen >= args.max_sources):
                    limited = not stopped.is_set(); break
                sources_seen += 1
                yield record
        def acknowledge(found):
            if not found:
                return
            committed.update(found)
            errors.reconcile(committed)
            atomic_json(output / 'pipeline_metrics.json', dict(engine.stats,
                committed_sources=len(committed), rgb_batch_limit=args.embed_batch,
                cpu_workers=args.decode_workers, prefetch_sources=args.prefetch_sources,
                gpu_lookahead_batches=1, output_layout='native_source_packages'))
        preparation = CachedCPUPreparation(cache, args.decode_workers, args.prefetch_sources)
        sources = preparation.iterate(records())
        preparation_errors = queue.SimpleQueue()
        def prepared_error(record, stage, error):
            preparation_errors.put((record, stage, error))
        def drain_errors():
            while True:
                try: event = preparation_errors.get_nowait()
                except queue.Empty: break
                errors.record(*event)
        batches = flat_batches(sources, args.embed_batch, prepared_error)
        computed = lookahead_batches(batches, engine)
        results = SourceResults(errors.record)
        atomic_json(output / 'run_status.json', {'status': 'running', 'inventory_id': summary['inventory_id']})
        pending_write = None
        consecutive_errors = 0
        try:
            with ThreadPoolExecutor(max_workers=1, thread_name_prefix='dataset-package-writer') as pool:
                try:
                    for batch, values, error in computed:
                        drain_errors()
                        complete = results.add(batch, values, error)
                        consecutive_errors = consecutive_errors + 1 if error else 0
                        if complete:
                            if pending_write is not None:
                                acknowledge(pending_write.result())
                            pending_write = pool.submit(writer.write, complete)
                        if consecutive_errors >= args.max_consecutive_batch_errors:
                            raise RuntimeError(f'{consecutive_errors} consecutive CUDA/model batch failures; last: {error}')
                    if pending_write is not None:
                        acknowledge(pending_write.result())
                    drain_errors()
                    acknowledge(pool.submit(writer.close).result())
                finally:
                    # Drain before closing handles; never publish after a failed writer.
                    if pending_write is not None:
                        try: pending_write.result()
                        except Exception: pass
                    writer.close(commit=False)
        except BaseException as exc:
            atomic_json(output / 'run_status.json', {'status': 'failed',
                'inventory_id': summary['inventory_id'], 'error': f'{type(exc).__name__}: {exc}'})
            raise
        finally:
            computed.close(); batches.close(); results.close(); sources.close(); preparation.close()
        errors.reconcile(committed)
        new_errors = errors.new_errors
        known_error_sources = len(errors.skipped_sources)
    remaining = summary['records'] - len(committed) - known_error_sources
    if remaining < 0:
        raise RuntimeError('Source outcome accounting is inconsistent')
    final_status = ('interrupted' if stopped.is_set() else 'partial' if limited or remaining else
                    'complete_with_errors' if known_error_sources else 'complete')
    atomic_json(output / 'run_status.json', {'status': final_status,
        'inventory_id': summary['inventory_id'], 'total_sources': summary['records'],
        'committed_sources': len(committed), 'remaining_sources': remaining,
        'new_errors': new_errors, 'known_error_sources': known_error_sources,
        'errors_file': 'embedding_errors.jsonl', 'output_layout': 'native_source_packages'})
    return 130 if stopped.is_set() else 0


if __name__ == '__main__':
    raise SystemExit(main())
