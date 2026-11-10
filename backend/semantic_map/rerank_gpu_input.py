"""Reranker-only bounded decode, CUDA image preparation and metadata reuse.

CPU workers only locate/decode RGB bytes. Model inputs always contain eight
perspective images, including when the source was an equirectangular panorama.
No projected or normalized image pixels return to the host in this pipeline.
"""
from __future__ import annotations

import json
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

from .ai_verification_projection import PROFILE, YAWS, sampling_coordinates
from .pano_service import (AmbiguousPanoIdError, PanoCoordinateMismatchError,
    NEW_YORK_SCORING_DATASET_ID, NEW_YORK_MANHATTAN_PANO_DATASET_ID,
    NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID)
from .tile_index import safe_segment

PIPELINE = 'cuda-eight-view-prefetch-position-v1'


@dataclass(frozen=True)
class ImageSource:
    kind: str
    paths: tuple[Path, ...]

    def __post_init__(self):
        if (self.kind == 'views' and len(self.paths) != 8) or (self.kind == 'panorama' and len(self.paths) != 1):
            raise ValueError('Reranking requires eight reprojected perspective views per candidate.')
        if self.kind not in ('views', 'panorama'):
            raise ValueError('Unsupported reranker image source')


class RerankerImageReader:
    """Small immutable RGB LRU, keyed by complete source path/size/mtime."""
    def __init__(self, registry, cache_root, workers=4, cache_mib=256):
        self.registry, self.cache_root = registry, Path(cache_root) / PROFILE
        self.pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix='reranker-rgb')
        self.limit = max(0, cache_mib) * 1024**2
        self.entries = OrderedDict()
        self.bytes = self.hits = self.misses = 0
        self.lock = threading.RLock()

    def locate(self, question, prefer_views=True):
        dataset = question['dataset_id']
        datasets = [dataset] if dataset != NEW_YORK_SCORING_DATASET_ID else [
            NEW_YORK_MANHATTAN_PANO_DATASET_ID, NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID]
        matches = []
        for candidate in datasets:
            try:
                result = self.registry.service_for(candidate).ensure_pano_image(str(question['pano_id']),
                    lon=question['lon'], lat=question['lat'], capture_date=question.get('date'))
            except PanoCoordinateMismatchError:
                continue
            if result is not None:
                matches.append((candidate, *result))
        if not matches:
            raise FileNotFoundError('The exact panorama is not available in the configured archives')
        if len(matches) != 1:
            raise AmbiguousPanoIdError('More than one image namespace matches the exact panorama; refusing to guess')
        namespace, entry, path = matches[0]
        folder = self.cache_root / safe_segment(namespace) / safe_segment(entry.entry_key)
        views = tuple(folder / f'{i}.png' for i in range(8))
        manifest = folder / 'manifest.json'
        if prefer_views and manifest.is_file() and all(p.is_file() for p in views):
            if json.loads(manifest.read_text())['profile'] == PROFILE:
                return ImageSource('views', views)
        return ImageSource('panorama', (path,))

    def read(self, source):
        import torch
        stamps = []
        for path in source.paths:
            stat = path.stat()
            stamps.append((str(path), stat.st_size, stat.st_mtime_ns))
        key = (source.kind, tuple(stamps))
        with self.lock:
            if key in self.entries:
                self.entries.move_to_end(key)
                self.hits += 1
                return self.entries[key]
        arrays = []
        for path in source.paths:
            with Image.open(path) as image:
                rgb = np.array(image.convert('RGB'), dtype=np.uint8, copy=True, order='C')
            if source.kind == 'views' and rgb.shape != (512, 512, 3):
                raise ValueError('Projected reranker views must be 512 x 512 RGB images')
            arrays.append(rgb)
        array = np.stack(arrays) if source.kind == 'views' else arrays[0]
        # One compact uint8 transfer, no CPU rescale/normalization/patch packing.
        tensor = torch.from_numpy(array).pin_memory() if torch.cuda.is_available() else torch.from_numpy(array)
        with self.lock:
            self.misses += 1
            if tensor.nbytes <= self.limit:
                old = self.entries.pop(key, None)
                if old is not None:
                    self.bytes -= old.nbytes
                while self.entries and self.bytes + tensor.nbytes > self.limit:
                    self.bytes -= self.entries.popitem(last=False)[1].nbytes
                self.entries[key] = tensor
                self.bytes += tensor.nbytes
        return tensor

    def read_batch(self, sources):
        def read_one(source):
            source = self.locate(source) if isinstance(source,dict) else source
            return source,self.read(source)
        futures = [self.pool.submit(read_one, source) for source in sources]
        try:
            return [future.result() for future in futures]
        finally:
            # Even a failed image does not leave background decode work unowned.
            for future in futures:
                try:
                    future.result()
                except Exception:
                    pass

    def close(self):
        self.pool.shutdown(wait=True)
        with self.lock:
            self.entries.clear()
            self.bytes = 0


class CudaProjector:
    """Reuse the existing CPU geometry, evaluate the bilinear pixels on CUDA.

    Float64 weighted sums preserve the old NumPy -> uint8 truncation for native
    4096x2048 sources. Geometry tensors are bounded and cached, never regenerated
    per panorama. Different native sizes are resized on CUDA before projection.
    """
    def __init__(self):
        self.geometry = None

    def project(self, panorama):
        import torch
        if panorama.device.type != 'cuda' or panorama.dtype != torch.uint8:
            raise ValueError('Projection requires decoded uint8 RGB pixels on CUDA')
        if panorama.shape[-1] != 3:
            raise ValueError('Projection requires three RGB channels')
        if panorama.shape[:2] != (2048, 4096):
            from torchvision.transforms.v2 import functional as F
            from torchvision.transforms import InterpolationMode
            panorama = F.resize(panorama.permute(2,0,1), [2048,4096],
                interpolation=InterpolationMode.BILINEAR, antialias=True).permute(1,2,0).contiguous()
        if self.geometry is None:
            indices, weights = [], []
            for yaw in YAWS:
                u, v = sampling_coordinates(yaw)
                x0 = np.floor(u).astype(np.int32); y0 = np.floor(v).astype(np.int32)
                x1 = np.minimum(x0+1,4095); y1 = np.minimum(y0+1,2047)
                wx = u-x0; wy = v-y0
                indices.append(np.stack((y0*4096+x0,y0*4096+x1,y1*4096+x0,y1*4096+x1)))
                weights.append(np.stack(((1-wx)*(1-wy),wx*(1-wy),(1-wx)*wy,wx*wy)))
            self.geometry = (torch.from_numpy(np.stack(indices)).to(panorama.device),
                             torch.from_numpy(np.stack(weights)).to(panorama.device))
        ids, weights = self.geometry
        flat = panorama.reshape(-1,3)
        rgb = flat[ids[:,0].long()].double() * weights[:,0,None].permute(0,2,3,1)
        for corner in (1,2,3):
            rgb.add_(flat[ids[:,corner].long()].double() * weights[:,corner,None].permute(0,2,3,1))
        return rgb.clamp_(0,255).to(torch.uint8).permute(0,3,1,2).contiguous()

    def clear(self):
        self.geometry = None


class RerankerPositionCache:
    """Per-reranker caches: vision depends on grid; language also on full tokens."""
    def __init__(self, model, entries=4):
        self.limit = entries
        self.entries = OrderedDict()
        self.current = None
        self.hits = self.misses = 0
        self.originals = []
        for obj, name in ((model.visual,'fast_pos_embed_interpolate'),
                          (model.visual,'rot_pos_emb'), (model,'get_rope_index')):
            original = getattr(obj,name)
            def cached(*args, _name=name, _original=original, **kwargs):
                if self.current is None:
                    return _original(*args, **kwargs)
                signature = self.current[1] if _name == 'get_rope_index' else self.current[0]
                key = (_name, signature)
                if key in self.entries:
                    self.hits += 1
                    self.entries.move_to_end(key)
                    return self.entries[key]
                value = _original(*args, **kwargs)
                self.misses += 1
                self.entries[key] = value
                # Three methods and at most four signatures each.
                while len(self.entries) > 3*self.limit:
                    self.entries.popitem(last=False)
                return value
            setattr(obj,name,cached)
            self.originals.append((obj,name,original))

    def clear(self):
        self.current = None
        self.entries.clear()

    def close(self):
        self.clear()
        for obj,name,original in self.originals:
            setattr(obj,name,original)


class RerankerCudaPipeline:
    def __init__(self, model, reader):
        import torch
        self.model, self.reader = model, reader
        if not type(model.processor.image_processor).__name__.endswith('Fast'):
            raise RuntimeError('CUDA reranking requires the installed Qwen fast image processor')
        self.stream = torch.cuda.Stream()
        self.stream.wait_stream(torch.cuda.current_stream())
        self.projector = CudaProjector()
        self.positions = RerankerPositionCache(model.model)
        self.tokens = OrderedDict()
        self.stats = {}

    def prepare(self, pairs, sources):
        import torch
        started = time.perf_counter()
        resolved = self.reader.read_batch(sources)
        decoded = [pixels for _,pixels in resolved]
        read_seconds = time.perf_counter()-started
        prepare_started = time.perf_counter()
        with torch.inference_mode(), torch.cuda.stream(self.stream):
            start,end = torch.cuda.Event(enable_timing=True),torch.cuda.Event(enable_timing=True)
            start.record(self.stream)
            images = []
            for source, pixels in resolved:
                uploaded = pixels.to(self.model.model.device, non_blocking=True)
                views = (uploaded.permute(0,3,1,2).contiguous() if source.kind == 'views'
                         else self.projector.project(uploaded))
                if views.shape != (8,3,512,512):
                    raise ValueError('The reranker must receive eight perspective views, never a raw panorama')
                images.extend(views.unbind(0))
            image_data = self.model.processor.image_processor(images=images, do_resize=False, return_tensors='pt')
            if image_data['pixel_values'].device.type != 'cuda':
                raise RuntimeError('Image preprocessing moved pixels off CUDA')
            grid = image_data['image_grid_thw']
            if grid.device.type != 'cpu':
                raise RuntimeError('Expected small CPU grid metadata from the fast image processor')
            if not self.model.min_pixels <= 512*512 <= self.model.max_pixels:
                raise ValueError('The CUDA pipeline requires the configured 512px image profile')
            texts = tuple(self.model.processor.apply_chat_template(pairs, tokenize=False, add_generation_prompt=True))
            grid_key = (tuple(grid.shape),grid.numpy().tobytes())
            token_key = (texts,grid_key,self.model.max_length)
            if token_key not in self.tokens:
                merge = self.model.processor.image_processor.merge_size**2
                expanded = list(texts)
                index = 0
                for i,text in enumerate(expanded):
                    while self.model.processor.image_token in text:
                        n = int(grid[index].prod())//merge
                        text = text.replace(self.model.processor.image_token,'<|placeholder|>'*n,1)
                        index += 1
                    expanded[i] = text.replace('<|placeholder|>',self.model.processor.image_token)
                if index != 8*len(pairs):
                    raise ValueError('Image placeholders do not match eight views per candidate')
                ids = self.model.processor.tokenizer(expanded, truncation=False, padding=False)['input_ids']
                ids = [self.model.truncate_tokens_optimized(row[:-5],self.model.max_length,
                    self.model.processor.tokenizer.all_special_ids)+row[-5:] for row in ids]
                metadata = dict(self.model.processor.tokenizer.pad({'input_ids':ids},padding=True,
                    return_tensors='pt',max_length=self.model.max_length))
                language_key = tuple((k,tuple(v.shape),v.numpy().tobytes()) for k,v in metadata.items())+(grid_key,)
                self.tokens[token_key] = (metadata,language_key)
                while len(self.tokens)>8:
                    self.tokens.popitem(last=False)
            else:
                self.tokens.move_to_end(token_key)
            metadata,language_key = self.tokens[token_key]
            data = {k:v.to(self.model.model.device,non_blocking=True) for k,v in metadata.items()}
            data['image_grid_thw'] = grid.to(self.model.model.device,non_blocking=True)
            data['pixel_values'] = image_data['pixel_values']
            end.record(self.stream)
        # Keep pinned source tensors alive until their asynchronous copies finish.
        return dict(data=data, key=(grid_key,language_key), start=start, ready=end, decoded=decoded,
            read_seconds=read_seconds, prepare_host_seconds=time.perf_counter()-prepare_started)

    def forward(self, prepared):
        import torch
        data = prepared['data']
        current = torch.cuda.current_stream()
        current.wait_event(prepared['ready'])
        for value in data.values():
            value.record_stream(current)
        self.positions.current = prepared['key']
        start,end = torch.cuda.Event(enable_timing=True),torch.cuda.Event(enable_timing=True)
        started = time.perf_counter()
        try:
            with torch.inference_mode():
                start.record()
                hidden = self.model.model(**data,use_cache=False).last_hidden_state[:,-1]
                scores = self.model.score_linear(hidden).float().squeeze(-1)
                end.record()
                values = scores.cpu().tolist()
        finally:
            self.positions.current = None
        return values, dict(size=len(values),tokens_per_pair=int(data['input_ids'].shape[1]),
            decode_seconds=round(prepared['read_seconds'],4),
            prepare_host_seconds=round(prepared['prepare_host_seconds'],4),
            gpu_prepare_seconds=round(prepared['start'].elapsed_time(prepared['ready'])/1000,4),
            forward_wall_seconds=round(time.perf_counter()-started,4),
            gpu_forward_seconds=round(start.elapsed_time(end)/1000,4),
            peak_allocated_mib=round(torch.cuda.max_memory_allocated()/1024**2,2))

    def run(self,pairs,sources,size,on_batch=None):
        """Current input plus one future input; forwards remain on one thread."""
        import torch
        if len(pairs)!=len(sources):
            raise ValueError('Pair and source counts must match')
        torch.cuda.reset_peak_memory_stats()
        logits,batches = [],[]
        offset = 0
        # An OOM drains speculative work before an isolated smaller retry.
        with ThreadPoolExecutor(max_workers=1,thread_name_prefix='reranker-cuda-prepare') as pool:
            future = None
            try:
                if pairs:
                    future = pool.submit(self.prepare,pairs[:size],sources[:size])
                while offset<len(pairs):
                    count=min(size,len(pairs)-offset)
                    prepared=None
                    oom_sizes=[]
                    wait_started=time.perf_counter()
                    failed=False
                    try:
                        prepared=future.result()
                        future=None
                        next_offset=offset+count
                        if next_offset<len(pairs):
                            future=pool.submit(self.prepare,pairs[next_offset:next_offset+size],sources[next_offset:next_offset+size])
                        wait_seconds=time.perf_counter()-wait_started
                        values,record=self.forward(prepared)
                    except torch.cuda.OutOfMemoryError:
                        failed=True
                    # Exit the exception scope before retrying, so traceback
                    # frames no longer retain failed allocations.
                    if failed:
                        if future is not None:
                            try: future.result()
                            except Exception: pass
                        future=None
                        self.stream.synchronize()
                        prepared=None
                        self.positions.clear()
                        torch.cuda.empty_cache()
                        oom_sizes.append(count)
                        count=max(1,count//2)
                        while True:
                            size=count
                            failed=False
                            try:
                                prepared=self.prepare(pairs[offset:offset+count],sources[offset:offset+count])
                                values,record=self.forward(prepared)
                                break
                            except torch.cuda.OutOfMemoryError:
                                failed=True
                            if not failed:
                                break
                            if failed:
                                oom_sizes.append(count)
                                self.stream.synchronize()
                                prepared=None
                                self.positions.clear()
                                torch.cuda.empty_cache()
                                if count<=1:
                                    raise torch.cuda.OutOfMemoryError('Reranker CUDA input/forward cannot fit one candidate')
                                count=max(1,count//2)
                        wait_seconds=time.perf_counter()-wait_started
                        next_offset=offset+count
                        if next_offset<len(pairs):
                            future=pool.submit(self.prepare,pairs[next_offset:next_offset+size],sources[next_offset:next_offset+size])
                    record.update(input_pipeline=PIPELINE,input_wait_seconds=round(wait_seconds,4),oom_batch_sizes=oom_sizes)
                    logits.extend(values)
                    batches.append(record)
                    offset+=count
                    if on_batch:
                        on_batch(offset)
                    prepared=None
            finally:
                if future is not None:
                    try: future.result()
                    except Exception: pass
                self.stream.synchronize()
        self.stats=dict(position_cache_hits=self.positions.hits,position_cache_misses=self.positions.misses,
            decoded_cache_hits=self.reader.hits,decoded_cache_misses=self.reader.misses,
            decoded_cache_bytes=self.reader.bytes,token_cache_entries=len(self.tokens))
        return logits,batches

    def release_cuda(self):
        self.stream.synchronize()
        self.positions.clear()
        self.projector.clear()

    def close(self):
        self.release_cuda()
        self.positions.close()
