"""Bounded CPU preparation, flat RGB batches and one-batch CUDA lookahead."""
from __future__ import annotations

from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
import tempfile
import threading
import time
from types import SimpleNamespace

import numpy as np

from dataset_image_pipeline import DEFAULT_YAWS, ImageReader, transform_image
from dataset_validation_export import ValidationExporter


@dataclass
class PreparedSource:
    record: object
    image: object = None
    images: list = field(default_factory=list)
    rows: list = field(default_factory=list)
    error: str = None
    on_close: object = None

    def close(self):
        if self.image is not None:
            self.image.close(); self.image = None
        for image in self.images:
            image.close()
        self.images.clear()
        if self.on_close is not None:
            callback, self.on_close = self.on_close, None
            callback()


class CPUPreparation:
    """Each worker owns its reader, annotation caches and nested ZIP directory."""
    def __init__(self, catalog, cache_root, workers=4, prefetch=16):
        self.catalog, self.cache_root = catalog, Path(cache_root)
        self.workers, self.prefetch = workers, prefetch
        self.local = threading.local()
        self.contexts = []
        self.context_lock = threading.Lock()
        self.live = {}

    def _context(self):
        if not hasattr(self.local, 'context'):
            self.cache_root.mkdir(parents=True, exist_ok=True)
            temp = tempfile.TemporaryDirectory(prefix='worker-', dir=self.cache_root)
            reader = ImageReader(temp.name)
            try:
                labels = ValidationExporter(self.catalog)
            except BaseException:
                reader.close(); temp.cleanup(); raise
            self.local.context = reader, labels
            with self.context_lock:
                self.contexts.append((reader, labels, temp))
        return self.local.context

    def prepare(self, record):
        prepared = PreparedSource(record)
        try:
            if record.input_modality == 'satellite' or record.dataset_id == 'omnicity_satellite':
                raise ValueError('Satellite imagery is excluded from embedding')
            reader, labels = self._context()
            source = prepared.image = reader.read(record)
            size = list(source.size)
            record = prepared.record = labels.resolve_record(record, size)
            if record.projection == 'equirectangular':
                if abs(size[0] / size[1] - 2.0) > 0.03:
                    raise ValueError(f'Equirectangular source is not 2:1: {size}')
                transforms = [{'method': 'equirectangular_to_perspective', 'view_index': i,
                    'yaw_degrees': yaw, 'pitch_degrees': 0.0, 'fov_degrees': 45.0,
                    'output_size': [512, 512]} for i, yaw in enumerate(DEFAULT_YAWS)]
            else:
                outputs = transform_image(source, record.projection, perspective_mode=record.perspective_mode)
                prepared.images = [image for image, _ in outputs]
                transforms = [meta for _, meta in outputs]
                source.close(); prepared.image = None
            exported = labels.export(record, size, transforms)
            if len(exported) != len(transforms):
                raise ValueError('Image/validation view count mismatch')
            for transform, (metadata, files) in zip(transforms, exported):
                prepared.rows.append({**record.json(), 'original_size': size, 'transform': transform,
                    'view_id': f"{record.dataset_id}/{record.source_index:09d}/view_{transform['view_index']:02d}",
                    'source_views': len(transforms), 'validation': metadata, '_validation_files': files})
        except Exception as exc:
            prepared.close(); prepared.error = f'{type(exc).__name__}: {exc}'
        return prepared

    def iterate(self, records):
        futures = deque()
        iterator = iter(records)
        try:
            with ThreadPoolExecutor(max_workers=self.workers, thread_name_prefix='dataset-cpu') as pool:
                try:
                    exhausted = False
                    while True:
                        while not exhausted and len(futures) < self.prefetch:
                            try:
                                record = next(iterator)
                            except StopIteration:
                                exhausted = True; break
                            futures.append(pool.submit(self.prepare, record))
                        if not futures:
                            break
                        source = futures.popleft().result()
                        self.live[source.record.source_index] = source
                        source.on_close = lambda key=source.record.source_index: self.live.pop(key, None)
                        yield source
                finally:
                    for future in futures:
                        if not future.cancel():
                            future.result().close()
        finally:
            self._close_contexts()

    def _close_contexts(self):
        for reader, labels, temp in self.contexts:
            reader.close(); labels.close(); temp.cleanup()
        self.contexts.clear()

    def close(self):
        # Iterator exhaustion can precede the last GPU batch. Its images remain
        # owned by the consumer until forward (or pipeline teardown) finishes.
        for source in list(self.live.values()):
            source.close()


class CachedCPUPreparation(CPUPreparation):
    """GPU-time workers only decode RGB and read already prepared annotations."""
    def __init__(self, cache, workers=4, prefetch=16):
        super().__init__(None, cache.root, workers, prefetch)
        self.cache = cache

    def _context(self):
        if not hasattr(self.local, 'context'):
            database = self.cache.connect(check_same_thread=False)
            self.local.context = database
            with self.context_lock:
                self.contexts.append(database)
        return self.local.context

    def _close_contexts(self):
        # The executor has drained; no query can race connection teardown.
        for database in self.contexts:
            database.close()
        self.contexts.clear()

    def prepare(self, record):
        import io
        from PIL import Image
        from dataset_cpu_cache import read_encoded
        prepared = PreparedSource(record)
        try:
            payload, blob, error = self.cache.entry(self._context(), record.source_index)
            if error:
                prepared.error = 'CPU preparation: ' + error
                return prepared
            with Image.open(io.BytesIO(read_encoded(payload['locator']))) as image:
                prepared.image = image.convert('RGB')
            if list(prepared.image.size) != payload['size']:
                raise ValueError('Decoded RGB dimensions differ from CPU cache')
            for row in payload['rows']:
                row['_validation_files'] = [(name, blob[offset:offset+length])
                    for name, offset, length in row.pop('_cached_labels')]
                prepared.rows.append(row)
                if record.projection != 'equirectangular':
                    transform = row['transform']
                    with prepared.image.crop(transform['crop_box']) as crop:
                        prepared.images.append(crop.resize(transform['output_size'], Image.Resampling.LANCZOS))
            if record.projection != 'equirectangular':
                prepared.image.close(); prepared.image = None
        except Exception as exc:
            prepared.close(); prepared.error = f'{type(exc).__name__}: {exc}'
        return prepared


def flat_batches(sources, limit, on_error):
    """Exact RGB-image limit, even if one source straddles multiple batches."""
    batch = []
    for source in sources:
        if source.error:
            on_error(source.record, 'read_transform_or_validation', source.error)
            source.close()
            continue
        for view_index in range(len(source.rows)):
            batch.append((source, view_index))
            if len(batch) == limit:
                yield batch
                batch = []
    if batch:
        yield batch


class CudaImageEngine:
    """No projected pixels return to host; only final normalized vectors do."""
    def __init__(self, embedder, projector, precision='bf16', prepare_sources=4):
        if tuple(projector.yaws) != tuple(DEFAULT_YAWS):
            raise ValueError('CUDA view yaw order must match dataset annotation transforms')
        import torch
        from gpu_input_pipeline import PositionCache
        self.torch, self.embedder, self.projector = torch, embedder, projector
        self.dtype = getattr(torch, 'bfloat16' if precision == 'bf16' else 'float16')
        self.prepare_sources = prepare_sources
        self.cache = PositionCache(embedder)
        self.stream = torch.cuda.Stream()
        self.stream.wait_stream(torch.cuda.current_stream())
        self.stats = {'gpu_prepare_seconds': 0.0, 'forward_seconds': 0.0, 'forward_batches': 0,
                      'rgb_images': 0, 'max_rgb_batch': 0}

    def prepare(self, batch):
        from gpu_input_pipeline import cuda_inputs
        torch = self.torch
        started = time.monotonic()
        with torch.inference_mode(), torch.cuda.stream(self.stream):
            pixels = torch.empty((len(batch), 3, 512, 512), device=self.embedder.model.device, dtype=torch.uint8)
            panoramas = {}
            for offset, (source, view_index) in enumerate(batch):
                if source.record.projection == 'equirectangular':
                    key = source.record.source_index
                    entry = panoramas.setdefault(key, (source, []))
                    entry[1].append((offset, view_index))
                else:
                    array = np.array(source.images[view_index], dtype=np.uint8, copy=True, order='C')
                    host = torch.from_numpy(array).permute(2, 0, 1).contiguous().pin_memory()
                    pixels[offset].copy_(host, non_blocking=True)
            entries = list(panoramas.values())
            for start in range(0, len(entries), self.prepare_sources):
                chunk = entries[start:start + self.prepare_sources]
                views = self.projector.project_tensor([SimpleNamespace(image=source.image) for source, _ in chunk])
                views = views.mul(255).clamp(0, 255).to(torch.uint8)
                for local, (_, selected) in enumerate(chunk):
                    for offset, view_index in selected:
                        pixels[offset].copy_(views[local * len(DEFAULT_YAWS) + view_index])
                del views
            with torch.autocast('cuda', dtype=self.dtype):
                data = cuda_inputs(self.embedder, pixels)
            if data['pixel_values'].device.type != 'cuda':
                raise RuntimeError('Qwen image preprocessing moved pixels off CUDA')
            key = self.cache.key(data)
            data = {name: value.to(self.embedder.model.device, non_blocking=True) for name, value in data.items()}
            ready = torch.cuda.Event(); ready.record(self.stream)
        self.stats['gpu_prepare_seconds'] += time.monotonic() - started
        return data, key, ready

    def forward(self, prepared, count):
        torch = self.torch
        data, key, ready = prepared
        started = time.monotonic()
        with torch.inference_mode():
            current = torch.cuda.current_stream(); current.wait_event(ready)
            for value in data.values():
                if value.device.type == 'cuda':
                    value.record_stream(current)
            self.cache.select(key)
            try:
                with torch.autocast('cuda', dtype=self.dtype):
                    output = self.embedder.forward(data)
                    values = self.embedder._pooling_last(output['last_hidden_state'], output['attention_mask'])
                    values = torch.nn.functional.normalize(values, p=2, dim=-1)
                values = values.to(device='cpu', dtype=torch.float16).numpy()
            finally:
                self.cache.current = None
        if values.shape != (count, 4096) or not np.isfinite(values).all():
            raise ValueError(f'Invalid flat image embeddings: {values.shape}')
        self.stats['forward_seconds'] += time.monotonic() - started
        self.stats['forward_batches'] += 1; self.stats['rgb_images'] += count
        self.stats['max_rgb_batch'] = max(count, self.stats['max_rgb_batch'])
        self.stats.update(position_cache_hits=self.cache.hits, position_cache_misses=self.cache.misses,
                          gpu_peak_allocated_bytes=torch.cuda.max_memory_allocated())
        return values

    def synchronize(self):
        self.stream.synchronize()
        self.torch.cuda.current_stream().synchronize()


def lookahead_batches(batches, engine):
    """One future input; fetching slow CPU work never blocks current forward."""
    iterator = iter(batches)
    def take_and_prepare():
        batch = next(iterator, None)
        if batch is None:
            return None, None, None
        try:
            return batch, engine.prepare(batch), None
        except Exception as exc:
            return batch, None, f'{type(exc).__name__}: {exc}'
    future = None; prepared = None
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix='dataset-cuda-prepare') as pool:
        try:
            future = pool.submit(take_and_prepare)
            while True:
                batch, prepared, error = future.result()
                future = None
                if batch is None:
                    break
                future = pool.submit(take_and_prepare)
                if error is None:
                    try:
                        values = engine.forward(prepared, len(batch))
                    except Exception as exc:
                        error = f'{type(exc).__name__}: {exc}'
                prepared = None
                if error is not None:
                    # Drain before source release; no CPU/PIL inference fallback.
                    future.result()
                    engine.synchronize()
                yield batch, None if error else values, error
        finally:
            prepared = None
            if future is not None:
                try: future.result()
                except Exception: pass
            engine.synchronize()


class SourceResults:
    """A failed slice invalidates the whole source, including earlier successful slices."""
    def __init__(self, on_error):
        self.pending = {}; self.on_error = on_error

    def add(self, batch, values, error):
        completed = []
        for offset, (source, index) in enumerate(batch):
            key = source.record.source_index
            state = self.pending.setdefault(key, {'source': source, 'vectors': [], 'error': None})
            if index != len(state['vectors']):
                raise RuntimeError('Out-of-order RGB view result')
            state['vectors'].append(None if error else values[offset])
            if error:
                state['error'] = error
            if index + 1 == len(source.rows):
                if state['error']:
                    self.on_error(source.record, 'cuda_image_batch', state['error'])
                else:
                    completed.append((np.stack(state['vectors']), source.rows))
                source.close(); del self.pending[key]
        return completed

    def close(self):
        for state in self.pending.values():
            state['source'].close()
        self.pending.clear()
