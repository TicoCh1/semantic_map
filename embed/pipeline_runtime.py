"""Bounded CPU preparation, native-resolution GPU projection and progress."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, Future
from collections import deque
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import datetime, timezone
import io
import json
import math
import os
import sqlite3
from pathlib import Path
import threading
import time

import numpy as np
from PIL import Image, ImageChops, ImageStat


GEOMETRY_VERSION = "native-sphere-verified-wrap3328-v1"
YAWS = [45, 90, 135, 180, 225, 270, 315, 0]


class FailurePolicy:
    """No cumulative bad-image cap; stop only sustained stage failure."""
    def __init__(self, consecutive=100, window=1000, fraction=.5):
        self.limit,self.window,self.fraction=consecutive,window,fraction
        self.streaks,self.histories={},{}

    def outcome(self, stage, success):
        history=self.histories.setdefault(stage,deque(maxlen=self.window))
        history.append(not success)
        self.streaks[stage]=0 if success else self.streaks.get(stage,0)+1
        if self.streaks[stage]>=self.limit or (len(history)==self.window and sum(history)/len(history)>=self.fraction):
            raise RuntimeError(f'Sustained {stage} failures: consecutive={self.streaks[stage]}, recent={sum(history)}/{len(history)}')


def spherical_image(image):
    """Correct only the stitching defect verified against original samples.

    3584-wide samples repeat their first 256 columns at x=3328. Validate every
    image, not only its dimensions. Unrecognized geometry must not be guessed.
    The 1665 variant has one extra bottom padding row beyond the 1664 tile area.
    """
    w, h = image.size
    if w == 2 * h:
        return image, {"method": "full_sphere", "crop": [0, 0, w, h]}
    if (w, h) in ((3584, 1664), (3584, 1665)):
        left = image.crop((0, 0, 256, 1664))
        right = image.crop((3328, 0, 3584, 1664))
        mae = sum(ImageStat.Stat(ImageChops.difference(left, right)).mean) / 3
        # A two-pixel displacement is a control against flat/blank strips.
        control = sum(ImageStat.Stat(ImageChops.difference(
            image.crop((0, 0, 254, 1664)), image.crop((3330, 0, 3584, 1664)))).mean) / 3
        if mae <= 2 and control > max(1, 3 * mae):
            return image.crop((0, 0, 3328, 1664)), dict(
                method="verified_horizontal_wrap", crop=[0, 0, 3328, 1664],
                overlap_mae=mae, shifted_control_mae=control, discarded_bottom_rows=h-1664)
    raise ValueError(f"Unverified panorama geometry {w}x{h}; inspect the original before adding a rule")


@dataclass
class Prepared:
    record: dict
    image: object
    jpeg: bytes
    original_size: tuple
    geometry: dict


def prepare(record, payload, quality, stats):
    started = time.monotonic()
    try:
        with Image.open(io.BytesIO(payload)) as source:
            original_size = source.size
            source.load()
            rgb = source.convert("RGB")
            stats.add(jpeg_decode=time.monotonic()-started)
            native, geometry = spherical_image(rgb)
        # resize returns a new image: the GPU receives the untouched native image.
        thumb = native.resize((2048, 1024), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        thumb.save(output, format="JPEG", quality=quality, subsampling=2)
        thumb.close()
        stats.add(decoded_panos=1, cpu_prepare_seconds=time.monotonic()-started)
        return Prepared(record, native, output.getvalue(), original_size, geometry)
    except Exception as exc:
        raise RuntimeError(f"Cannot prepare {record['tar_name']}:{record['member_name']}: {exc}") from exc


class PreparedStream:
    """Reader thread feeds bounded CPU futures while the main thread uses GPU.

    Futures stay in source order, so scheduling never changes reference order.
    The condition also bounds work when the GPU or writer is slower than CPUs.
    """
    def __init__(self, records, root, workers, prefetch, quality, stats, stop, sources=(), on_error=None, policy=None):
        self.records, self.root = records, Path(root)
        self.prefetch, self.quality, self.stats, self.stop = prefetch, quality, stats, stop
        self.sources = {s["name"]:s for s in sources}
        self.on_error,self.policy=on_error,policy
        self.pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="pano-decode")
        self.condition = threading.Condition()
        self.futures = deque()
        self.closed = False
        self.done = False
        self.error = None
        self.reader = threading.Thread(target=self._read, name="pano-reader", daemon=True)

    def _read(self):
        handle, current = None, None
        try:
            for record in self.records:
                with self.condition:
                    wait_put_started = time.monotonic()
                    while len(self.futures) >= self.prefetch and not self.closed and not self.stop.is_set():
                        self.condition.wait(.2)
                    self.stats.add(cpu_wait_put=time.monotonic()-wait_put_started)
                    if self.closed or self.stop.is_set():
                        break
                read_started=time.monotonic()
                try:
                    for attempt in range(3):
                        try:
                            if current != record['tar_name'] or handle is None:
                                if handle:handle.close()
                                current=record['tar_name']
                                handle=(self.root/current).open('rb')
                                if current in self.sources:
                                    st=os.fstat(handle.fileno());spec=self.sources[current]
                                    if (st.st_size,st.st_mtime_ns)!=(spec['size'],spec['mtime_ns']):
                                        raise RuntimeError(f'Source changed since inventory: {current}')
                            handle.seek(record['offset_data'])
                            payload=handle.read(record['byte_size'])
                            if len(payload)!=record['byte_size']:raise IOError('Truncated source member')
                            break
                        except OSError:
                            if handle:handle.close()
                            handle=None
                            if attempt==2:raise
                            if self.stop.wait(.5*(attempt+1)):return
                    read_seconds=time.monotonic()-read_started
                    self.stats.add(source_read_seconds=read_seconds,decode_from_tar=read_seconds,source_bytes_read=len(payload))
                    future=self.pool.submit(prepare,record,payload,self.quality,self.stats)
                except OSError as exc:
                    future=Future();future.set_exception(exc)
                with self.condition:
                    self.futures.append((record,future))
                    self.condition.notify_all()
        except BaseException as exc:
            self.error = exc
        finally:
            if handle:
                handle.close()
            with self.condition:
                self.done = True
                self.condition.notify_all()

    def __enter__(self):
        self.reader.start()
        return self

    def __iter__(self):
        while not self.stop.is_set():
            wait_started=time.monotonic()
            with self.condition:
                while not self.futures and not self.done:
                    self.condition.wait(.2)
                    if self.stop.is_set():
                        return
                if not self.futures:
                    if self.error:
                        raise self.error
                    return
                record,future = self.futures.popleft()
                self.condition.notify_all()
            try:
                item=future.result()
            except Exception as exc:
                if self.on_error is None:raise
                self.on_error(record,'prepare',exc)
                if self.policy:self.policy.outcome('prepare',False)
                continue
            waited=time.monotonic()-wait_started
            self.stats.add(input_wait_seconds=waited,gpu_wait_get=waited)
            if self.policy:self.policy.outcome('prepare',True)
            yield item

    def __exit__(self, *args):
        with self.condition:
            self.closed = True
            self.condition.notify_all()
        self.reader.join()
        self.pool.shutdown(wait=True, cancel_futures=True)
        for _,future in self.futures:
            if not future.cancelled() and future.exception() is None:
                future.result().image.close()


class Stats:
    def __init__(self, interval=30, emit=None):
        self.interval = interval
        self.emit = emit or self.print_report
        self.lock = threading.Lock()
        self.values = dict.fromkeys(('decode_from_tar','jpeg_decode','pil_to_cuda','stack_panos',
                                    'reproject_gpu','qwen_embed','parse_ref','io_write',
                                    'cpu_wait_put','gpu_wait_get','decoded_bad'), 0)
        self.started = time.monotonic()
        self.stage_started = self.started
        self.stage_key = 'startup'
        self.stage_wall_seconds = {}
        self.finished = threading.Event()
        self.thread = threading.Thread(target=self._report, daemon=True, name="progress-clock")

    @staticmethod
    def print_report(row):
        print(json.dumps(row), flush=True)
        if row.get('stage') not in ('embedding','interrupted','complete','complete_with_errors'):
            return
        keys=('decode_from_tar','jpeg_decode','pil_to_cuda','stack_panos',
              'reproject_gpu','qwen_embed','parse_ref','io_write')
        wall=sum(v for k,v in row['stage_wall_seconds'].items() if k.startswith('embedding:'))
        total=sum(row.get(k,0) for k in keys)
        panos=row.get('computed_panos',0)
        lines=['\n=== PERF (async-aware) ===',f"TAR ID: {row.get('archive','indexed input')}",
               f'panos: {panos}  views: {panos*8}',f'wall_total: {wall:.2f}s',
               f'sum_sections (decode+stack+reproject+embed): {total:.2f}s',
               f'overlap_factor (sum_sections / wall): {total/max(wall,1e-9):.2f}x',
               '\n-- section times (accumulated) --']
        lines.extend(f'{key:>18}: {row.get(key,0):8.2f}s' for key in keys)
        lines.extend(['\n-- waiting / backpressure --',
                      f"gpu_wait_get (GPU starved by CPU): {row.get('gpu_wait_get',0):8.2f}s",
                      f"cpu_wait_put (CPU blocked by GPU): {row.get('cpu_wait_put',0):8.2f}s",
                      '\n-- bad jpg --',f"decoded_bad: {row.get('decoded_bad',0)}",'=========================='])
        print('\n'.join(lines),flush=True)

    def set(self, **values):
        with self.lock:
            stage=values.get('stage',self.values.get('stage','startup'))
            city=values.get('city',self.values.get('city')) if stage=='embedding' else None
            key=stage+(':'+city if city else '')
            if key!=self.stage_key:
                now=time.monotonic()
                self.stage_wall_seconds[self.stage_key]=self.stage_wall_seconds.get(self.stage_key,0)+now-self.stage_started
                self.stage_started=now
                self.stage_key=key
            self.values.update(values)

    def add(self, **values):
        with self.lock:
            for key, value in values.items():
                self.values[key] = self.values.get(key, 0) + value

    def snapshot(self):
        with self.lock:
            row = dict(self.values)
            durations=dict(self.stage_wall_seconds)
            durations[self.stage_key]=durations.get(self.stage_key,0)+time.monotonic()-self.stage_started
            row['stage_wall_seconds']={key:round(value,6) for key,value in durations.items()}
        row.update(timestamp=datetime.now(timezone.utc).isoformat(), elapsed_seconds=round(time.monotonic()-self.started, 3))
        self.emit(row)

    def _report(self):
        deadline = self.started + self.interval
        while not self.finished.wait(max(0, deadline-time.monotonic())):
            self.snapshot()
            deadline += self.interval
            if deadline < time.monotonic():
                deadline = time.monotonic() + self.interval

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.finished.set()
        self.thread.join()
        self.snapshot()


class GpuEventTimer:
    """Legacy event boundaries and nonblocking harvest; reporter never uses CUDA."""
    def __init__(self, torch, stats):
        self.torch, self.stats, self.pending = torch, stats, []

    def start(self, key):
        start = self.torch.cuda.Event(enable_timing=True)
        end = self.torch.cuda.Event(enable_timing=True)
        start.record()
        self.pending.append((key, start, end))
        return end

    def end(self, event):
        event.record()

    def harvest(self, block=False):
        keep = []
        for key, start, end in self.pending:
            if block:
                end.synchronize()
            if block or end.query():
                self.stats.add(**{key:start.elapsed_time(end)/1000})
            else:
                keep.append((key,start,end))
        self.pending = keep


class NativeProjector:
    def __init__(self, device="cuda", out_size=512, precision="bf16", yaws=None):
        self.yaws = tuple(YAWS if yaws is None else yaws)
        if len(self.yaws) != 8:
            raise ValueError('Native panorama projection requires eight declared yaw angles')
        import torch
        self.torch, self.device, self.out_size = torch, device, out_size
        self.precision = precision
        self.stats = None
        self.gpu_timer = None
        ys, xs = torch.meshgrid(torch.linspace(-1, 1, out_size, device=device),
                                torch.linspace(-1, 1, out_size, device=device), indexing="ij")
        rays = torch.stack((xs, -ys, torch.full_like(xs, 1/math.tan(math.radians(45)/2))), -1)
        rays /= torch.linalg.vector_norm(rays, dim=-1, keepdim=True)
        rotations = []
        for angle in self.yaws:
            c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
            rotations.append([[c,0,s], [0,1,0], [-s,0,c]])
        rotated = torch.einsum("hwj,kij->khwi", rays, torch.tensor(rotations,device=device))
        self.u = (torch.atan2(rotated[...,0], rotated[...,2])/(2*math.pi)+.5)
        self.v = .5-torch.asin(rotated[...,1].clamp(-1,1))/math.pi

    def project_tensor(self, items):
        """Legacy upload/stack/grid_sample path, adapted only for native sizes.

        Keep the verified seam/crop convention of existing committed shards.
        Return CUDA tensors; PIL conversion happens per embedding microbatch.
        """
        torch = self.torch
        import torch.nn.functional as F
        # Batch equal native sizes together without resampling input panoramas.
        # Restore source order after projection, including mixed-size batches.
        result = None
        groups = {}
        for index,item in enumerate(items):
            groups.setdefault(item.image.size,[]).append(index)
        with torch.inference_mode():
            for indices in groups.values():
                batch_panos = []
                for i in indices:
                    upload_started = time.perf_counter()
                    array = np.array(items[i].image, dtype=np.uint8, copy=True, order="C")
                    tensor_cpu = torch.from_numpy(array).permute(2, 0, 1).contiguous()
                    if str(self.device).startswith("cuda"):
                        tensor_cpu = tensor_cpu.pin_memory()
                    batch_panos.append(tensor_cpu.to(self.device, non_blocking=True).float().div_(255.0))
                    if self.stats:self.stats.add(pil_to_cuda=time.perf_counter()-upload_started)
                stack_started=time.perf_counter()
                pixels = torch.stack(batch_panos, dim=0)
                if self.stats:self.stats.add(stack_panos=time.perf_counter()-stack_started)
                del batch_panos
                h, w = pixels.shape[-2:]
                event=self.gpu_timer.start('reproject_gpu') if self.gpu_timer else None
                padded = torch.cat((pixels[..., -1:], pixels, pixels[..., :1]), dim=-1)
                # Preserve the legacy normalized orientation, with periodic seam
                # padding for sampling at the horizontal boundary.
                x = ((self.u*(w-1)+1)/(w+1))*2-1
                grid = torch.stack((x, self.v*2-1), -1)
                views = torch.empty((len(indices), 8, 3, self.out_size, self.out_size),
                                    device=self.device, dtype=pixels.dtype)
                for k in range(8):
                    views[:, k] = F.grid_sample(padded, grid[k:k+1].expand(len(indices),-1,-1,-1),
                                                mode="bilinear", align_corners=True)
                if event is not None:self.gpu_timer.end(event)
                if len(groups) == 1:
                    result = views
                else:
                    if result is None:
                        result = torch.empty((len(items), 8, 3, self.out_size, self.out_size),
                                             device=self.device, dtype=torch.float32)
                    for local_index,source_index in enumerate(indices):
                        result[source_index].copy_(views[local_index])
                del pixels, padded, views
        return result.reshape(-1, 3, self.out_size, self.out_size)

    def to_pil(self, views):
        # Exact legacy conversion order: interleave RGB on GPU before D2H.
        u8 = views.mul(255).clamp(0, 255).to(self.torch.uint8)
        raw = u8.permute(0, 2, 3, 1).contiguous().cpu().numpy()
        return [Image.fromarray(array) for array in raw]

    def __call__(self, items):
        return self.to_pil(self.project_tensor(items))


def compute_batch(items, projector, embedder, embed_batch, stats):
    started = time.monotonic()
    native = isinstance(projector, NativeProjector)
    if native:
        projector.stats=stats
        if str(projector.device).startswith('cuda') and projector.gpu_timer is None:
            projector.gpu_timer=GpuEventTimer(projector.torch,stats)
    views = projector.project_tensor(items) if native else projector(items)
    # Host timing includes enqueue work; conversion below waits for GPU output.
    stats.add(projection_seconds=time.monotonic()-started)
    try:
        arrays = []
        started = time.monotonic()
        for start in range(0, len(views), embed_batch):
            convert_started = time.monotonic()
            pil_imgs = projector.to_pil(views[start:start+embed_batch]) if native else views[start:start+embed_batch]
            stats.add(views_to_pil_seconds=time.monotonic()-convert_started)
            try:
                import torch
                event=projector.gpu_timer.start('qwen_embed') if native and projector.gpu_timer else None
                context = (torch.autocast("cuda", dtype=getattr(torch, "bfloat16" if projector.precision == "bf16" else "float16"))
                           if native and str(projector.device).startswith("cuda") else nullcontext())
                with context:
                    output = embedder.process([{"image": v} for v in pil_imgs], normalize=True)
            finally:
                if 'event' in locals() and event is not None:projector.gpu_timer.end(event)
                for image in pil_imgs:
                    image.close()
            if hasattr(output, "detach"):
                # FP16 disk format is independent of bf16/fp16 inference.
                import torch
                output = output.detach().to(device="cpu", dtype=torch.float16).numpy()
            arrays.append(np.asarray(output, dtype=np.float16))
        result = np.concatenate(arrays).reshape(len(items), 8, -1)
        stats.add(computed_panos=len(items), embedding_seconds=time.monotonic()-started)
        return result
    finally:
        if native and projector.gpu_timer:projector.gpu_timer.harvest(block=False)
        del views


def close_items(items):
    for item in items:
        if item.image is not None:
            item.image.close()
            item.image=None


def resilient_compute(items, projector, embedder, embed_batch, stats, state, policy):
    error=None
    try:
        values=compute_batch(items,projector,embedder,embed_batch,stats)
        if values.shape!=(len(items),8,state.config['dimension']) or not np.isfinite(values).all():
            raise ValueError('Invalid embedding shape or nonfinite values')
    except Exception as exc:
        error=f'{type(exc).__name__}: {exc}'
    if error is None:
        close_items(items)
        for _ in items:policy.outcome('inference',True)
        yield items,values
        return
    stats.add(batch_retries=1)
    state.event('batch_retry',{'record_ids':[item.record['seq'] for item in items], 'embed_batch':embed_batch},error)
    # The failed call has unwound before clearing cached CUDA allocations.
    import gc
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():torch.cuda.empty_cache()
    except Exception:
        pass
    if len(items)>1:
        split=len(items)//2
        yield from resilient_compute(items[:split],projector,embedder,min(embed_batch,split*8),stats,state,policy)
        yield from resilient_compute(items[split:],projector,embedder,min(embed_batch,split*8),stats,state,policy)
    elif embed_batch>1:
        yield from resilient_compute(items,projector,embedder,1,stats,state,policy)
    else:
        close_items(items)
        state.failure(items[0].record,'inference',error)
        stats.add(failed_panos=1)
        policy.outcome('inference',False)


def write_with_retries(state,city,shard,first_row,items,packed,stats):
    started=time.monotonic()
    try:
        return _write_with_retries(state,city,shard,first_row,items,packed,stats)
    finally:
        duration=time.monotonic()-started
        stats.add(checkpoint_write_seconds=duration,io_write=duration,write_shard=duration)


def _write_with_retries(state,city,shard,first_row,items,packed,stats):
    for attempt in range(3):
        try:
            marker=state.paths(city,shard)['marker']
            if marker.exists():
                state.recover()
                return json.loads(marker.read_text())
            return state.write_shard(city,shard,first_row,items,packed,stats)
        except (OSError,sqlite3.OperationalError) as exc:
            if attempt==2:raise
            state.event('write_retry',dict(city=city,shard=shard,attempt=attempt+1),exc)
            stats.add(write_retries=1)
            time.sleep(attempt+1)


def process_city(state, city, shard, pano_root, projector, embedder, args, stats, stop):
    """One asynchronous disk writer, one current shard, bounded CPU lookahead."""
    first_row = state.counts(committed=True).get(city, 0)
    pending_write = None
    items, arrays, batch = [], [], []
    policy=getattr(args,'failure_policy',None) or FailurePolicy()
    def failed(record,stage,error):
        state.failure(record,stage,error)
        stats.add(failed_panos=1,decoded_bad=1)
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="checkpoint-writer") as writer:
        def flush():
            nonlocal pending_write, items, arrays, shard, first_row
            if not items:
                return
            if pending_write is not None:
                pending_write.result()
            packed = np.concatenate(arrays)
            pending_write = writer.submit(write_with_retries, state, city, shard, first_row, items, packed, stats)
            first_row += len(items)
            shard += 1
            items, arrays = [], []

        def consume():
            nonlocal batch
            for good,values in resilient_compute(batch,projector,embedder,args.embed_batch,stats,state,policy):
                arrays.append(values)
                items.extend(good)
            batch = []
            if len(items) >= args.checkpoint_panos:
                flush()

        try:
            with PreparedStream(state.pending(city), pano_root, args.decode_workers,
                                args.prefetch_panos, state.config["jpeg_quality"], stats, stop, state.config["sources"], failed, policy) as stream:
                for item in stream:
                    batch.append(item)
                    if len(batch) >= min(args.pano_batch, args.checkpoint_panos-len(items)):
                        consume()
                    if pending_write is not None and pending_write.done():
                        pending_write.result()
                if batch:
                    consume()
            flush()
            if pending_write is not None:
                pending_write.result()
        except BaseException:
            # Already completed batches remain useful even if the next JPEG or
            # model batch fails. Commit those, then propagate the original error.
            for item in batch:
                if item.image is not None:
                    item.image.close()
            flush()
            if pending_write is not None:
                pending_write.result()
            raise
