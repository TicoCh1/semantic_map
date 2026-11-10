"""Opt-in fixed-geometry CUDA images, bounded position cache and one-batch lookahead.

Only image tensors are prefetched. Model forward stays on the calling thread.
The existing checkpoint writer, identity ordering and failure policy are reused.
"""
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
import time
import numpy as np
from pipeline_runtime import PreparedStream, close_items, resilient_compute, write_with_retries


def cuda_inputs(embedder, views):
    import torch
    pixels = views if views.dtype == torch.uint8 else views.mul(255).clamp(0, 255).to(torch.uint8)
    conversation = [
        {'role': 'system', 'content': [{'type': 'text', 'text': embedder.default_instruction}]},
        {'role': 'user', 'content': [{'type': 'image', 'image': None,
            'min_pixels': embedder.min_pixels, 'max_pixels': embedder.max_pixels}]}]
    text = embedder.processor.apply_chat_template(
        [conversation for _ in range(len(views))], add_generation_prompt=True, tokenize=False)
    data = embedder.processor(text=text, images=list(pixels.unbind(0)),
        truncation=True, max_length=embedder.max_length, padding=True,
        do_resize=False, return_tensors='pt')
    if data['pixel_values'].device.type != 'cuda':
        raise RuntimeError('The installed image processor did not preserve CUDA inputs')
    return data


class PositionCache:
    """Two complete metadata signatures per fixed model instance, never pixel data."""
    def __init__(self, embedder):
        self.current = None
        self.entries = OrderedDict()
        self.hits = self.misses = 0
        core = embedder.model.model
        for obj, name in [(core.visual, 'fast_pos_embed_interpolate'),
                          (core.visual, 'rot_pos_emb'), (core, 'get_rope_index')]:
            original = getattr(obj, name)
            def cached(*args, _name=name, _original=original, **kwargs):
                if self.current is None:
                    return _original(*args, **kwargs)
                entry = self.entries[self.current]
                if _name not in entry:
                    entry[_name] = _original(*args, **kwargs)
                    self.misses += 1
                else:
                    self.hits += 1
                return entry[_name]
            setattr(obj, name, cached)

    @staticmethod
    def key(data):
        names = ('input_ids', 'attention_mask', 'image_grid_thw')
        if set(data) != set(names) | {'pixel_values'}:
            raise ValueError('Only the validated image-only Qwen input schema is supported')
        if any(data[k].device.type != 'cpu' for k in names):
            raise ValueError('Cache signatures must be formed before metadata upload')
        return tuple((k, str(data[k].dtype), tuple(data[k].shape),
                      data[k].numpy().tobytes()) for k in names)

    def select(self, key):
        if key not in self.entries:
            while len(self.entries) >= 2:
                self.entries.popitem(last=False)
            self.entries[key] = {}
        self.entries.move_to_end(key)
        self.current = key


class CudaEngine:
    def __init__(self, embedder, projector, stats, chunk_panos=8):
        import torch
        self.torch, self.e, self.p, self.stats = torch, embedder, projector, stats
        self.cache = PositionCache(embedder)
        self.chunk_panos = chunk_panos
        self.stream = torch.cuda.Stream()
        self.stream.wait_stream(torch.cuda.current_stream())
        # Projection event bookkeeping belongs to one thread only.
        self.p.stats = None
        self.p.gpu_timer = None

    def prepare(self, items):
        torch = self.torch
        started = time.monotonic()
        with torch.inference_mode(), torch.cuda.stream(self.stream):
            metadata = []
            packed = None
            offset = 0
            for start in range(0, len(items), self.chunk_panos):
                chunk = items[start:start+self.chunk_panos]
                views = self.p.project_tensor(chunk)
                with torch.autocast('cuda', dtype=getattr(torch, 'bfloat16' if self.p.precision == 'bf16' else 'float16')):
                    data = cuda_inputs(self.e, views)
                del views
                pixels = data.pop('pixel_values')
                # Allocate the final buffer once; native projection temporaries are bounded.
                rows_per_pano, remainder = divmod(len(pixels), len(chunk))
                if remainder:
                    raise ValueError('Unexpected visual patch layout')
                if packed is None:
                    packed = torch.empty((len(items)*rows_per_pano, *pixels.shape[1:]),
                                         device=pixels.device, dtype=pixels.dtype)
                packed[offset:offset+len(pixels)].copy_(pixels)
                offset += len(pixels)
                metadata.append(data)
                del pixels, data
            data = {k: torch.cat([part[k] for part in metadata], dim=0) for k in metadata[0]}
            data['pixel_values'] = packed
            key = self.cache.key(data)
            data = {k: v.to(self.e.model.device, non_blocking=True) for k,v in data.items()}
            ready = torch.cuda.Event()
            ready.record(self.stream)
        self.stats.add(gpu_prepare_host_seconds=time.monotonic()-started)
        return data, key, ready

    def forward(self, prepared, count):
        torch = self.torch
        data, key, ready = prepared
        started = time.monotonic()
        with torch.inference_mode():
            current = torch.cuda.current_stream()
            current.wait_event(ready)
            for value in data.values():
                if value.device.type == 'cuda': value.record_stream(current)
            self.cache.select(key)
            try:
                with torch.autocast('cuda', dtype=getattr(torch, 'bfloat16' if self.p.precision == 'bf16' else 'float16')):
                    result = self.e.forward(data)
                    values = self.e._pooling_last(result['last_hidden_state'], result['attention_mask'])
                    values = torch.nn.functional.normalize(values, p=2, dim=-1)
                values = values.to(device='cpu', dtype=torch.float16).numpy().reshape(count, 8, -1)
            finally:
                self.cache.current = None
        if values.shape != (count, 8, 4096) or not np.isfinite(values).all():
            raise ValueError('Invalid optimized embeddings')
        self.stats.add(computed_panos=count, embedding_seconds=time.monotonic()-started)
        self.stats.set(position_cache_hits=self.cache.hits, position_cache_misses=self.cache.misses,
                       gpu_allocated_bytes=torch.cuda.memory_allocated(),
                       gpu_reserved_bytes=torch.cuda.memory_reserved(),
                       gpu_peak_allocated_bytes=torch.cuda.max_memory_allocated())
        return values

    def synchronize(self):
        self.stream.synchronize()


def optimized_batches(stream, engine, projector, embedder, args, stats, state, policy, stop):
    """At most current prepared input plus one future; source order is unchanged."""
    iterator = iter(stream)
    def take():
        batch = []
        while len(batch) < args.pano_batch and not stop.is_set():
            try: batch.append(next(iterator))
            except StopIteration: break
        return batch

    batch, following, prepared = [], [], None
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix='cuda-prepare') as pool:
        future = None
        try:
            batch = take()
            if batch: future = pool.submit(engine.prepare, batch)
            while batch:
                error = None
                started = time.monotonic()
                try: prepared = future.result()
                except Exception as exc: error = repr(exc)
                future = None  # Do not retain the previous Future's GPU result.
                stats.add(gpu_prepare_wait_seconds=time.monotonic()-started)
                following = take()
                if following: future = pool.submit(engine.prepare, following)
                if error is None:
                    try: values = engine.forward(prepared, len(batch))
                    except Exception as exc: error = repr(exc)
                prepared = None
                if error is None:
                    close_items(batch)
                    for _ in batch: policy.outcome('inference', True)
                    yield batch, values
                else:
                    # Drain preparation before reusing projector / allocator on this thread.
                    if future is not None:
                        try: future.result()
                        except Exception: pass
                    engine.synchronize()
                    state.event('gpu_pipeline_fallback', {'record_ids': [x.record['seq'] for x in batch]}, error)
                    stats.add(gpu_pipeline_fallbacks=1)
                    yield from resilient_compute(batch, projector, embedder, args.embed_batch, stats, state, policy)
                    projector.gpu_timer = None
                    projector.stats = None
                batch, following = following, []
        finally:
            if future is not None:
                try: future.result()
                except Exception: pass
            engine.synchronize()
            close_items(batch)
            close_items(following)


def process_city(state, city, shard, pano_root, projector, embedder, args, stats, stop):
    """Reuse atomic shard commits and split successful batches exactly at boundaries."""
    first_row = state.counts(committed=True).get(city, 0)
    pending_write = None
    items, arrays = [], []
    policy = args.failure_policy
    engine = args.cuda_engine
    def failed(record, stage, error):
        state.failure(record, stage, error)
        stats.add(failed_panos=1, decoded_bad=1)
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix='checkpoint-writer') as writer:
        def flush():
            nonlocal pending_write, items, arrays, shard, first_row
            if not items: return
            if pending_write is not None: pending_write.result()
            packed = np.concatenate(arrays)
            pending_write = writer.submit(write_with_retries, state, city, shard, first_row, items, packed, stats)
            first_row += len(items)
            shard += 1
            items, arrays = [], []
        try:
            with PreparedStream(state.pending(city), pano_root, args.decode_workers,
                                args.prefetch_panos, state.config['jpeg_quality'], stats,
                                stop, state.config['sources'], failed, policy) as stream:
                batches = optimized_batches(stream, engine, projector, embedder, args, stats, state, policy, stop)
                try:
                    for good, values in batches:
                        offset = 0
                        while offset < len(good):
                            count = min(args.checkpoint_panos-len(items), len(good)-offset)
                            items.extend(good[offset:offset+count])
                            arrays.append(values[offset:offset+count])
                            offset += count
                            if len(items) == args.checkpoint_panos: flush()
                        if pending_write is not None and pending_write.done(): pending_write.result()
                finally: batches.close()
        finally:
            flush()
            if pending_write is not None: pending_write.result()
