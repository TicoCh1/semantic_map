#!/usr/bin/env python3
"""Run the legacy Qwen panorama embedding notebook as a parameterised CLI.

This is a direct command-line version of
``urbanfabric/python/streetview_pano_qwen_timers.ipynb``.  It deliberately
keeps the notebook's projection, batching, Qwen ``embedder.process`` call,
shard names, and ``*_ref.npy`` layout so that its output stays compatible with
the existing semantic-map backend.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path


def _comma_separated(value: str) -> list[str]:
    values = [item.strip() for item in value.split(",") if item.strip()]
    if not values:
        raise argparse.ArgumentTypeError("provide at least one comma-separated value")
    return values


def _comma_separated_floats(value: str) -> list[float]:
    try:
        return [float(item) for item in _comma_separated(value)]
    except ValueError as exc:
        raise argparse.ArgumentTypeError("values must be comma-separated numbers") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate panorama-view embeddings with the legacy Qwen notebook logic."
    )
    paths = parser.add_argument_group("paths and input")
    paths.add_argument("--repo-dir", default="/tmp/Qwen3-VL-Embedding")
    paths.add_argument("--model-dir", default="/workspace/models/Qwen3-VL-Embedding-2B")
    paths.add_argument("--tar-dir", default="/workspace/pano")
    paths.add_argument(
        "--tar-ids",
        type=_comma_separated,
        default=["01", "02", "03", "04", "05", "06"],
        metavar="ID[,ID...]",
        help="Tar basenames without .tar (default: 01,02,03,04,05,06).",
    )
    paths.add_argument(
        "--tar-files",
        type=_comma_separated,
        default=None,
        metavar="PATH[,PATH...]",
        help="Explicit TAR paths. When supplied, takes precedence over --tar-dir/--tar-ids.",
    )
    paths.add_argument("--output-dir", default="/workspace/embedding/london_512_8_45_0")

    limits = parser.add_argument_group("resume and output")
    limits.add_argument(
        "--max-panos",
        type=int,
        default=2_147_483_647,
        help="Stop after this many panos across all TARs (not a model setting).",
    )
    limits.add_argument(
        "--skip-first",
        type=int,
        default=0,
        help="Skip this many image members at the start of the first TAR only.",
    )
    limits.add_argument("--start-shard-index", type=int, default=15)
    limits.add_argument("--shard-size-panos", type=int, default=10_000)
    limits.add_argument("--precision", choices=("fp16", "bf16", "fp32"), default="fp16")

    projection = parser.add_argument_group("projection")
    projection.add_argument("--out-size", type=int, default=512)
    projection.add_argument("--oversample", type=int, default=1)
    projection.add_argument("--fov-deg", type=float, default=45.0)
    projection.add_argument(
        "--yaw-degrees",
        type=_comma_separated_floats,
        default=[45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0, 0.0],
        metavar="DEG[,DEG...]",
    )
    projection.add_argument("--target-width", type=int, default=4096)
    projection.add_argument("--target-height", type=int, default=2048)

    throughput = parser.add_argument_group("throughput")
    throughput.add_argument("--embed-batch", type=int, default=512)
    throughput.add_argument("--queue-factor", type=int, default=1)
    throughput.add_argument("--decode-workers", type=int, default=4)
    throughput.add_argument("--disable-timers", action="store_true")

    args = parser.parse_args()
    if args.max_panos < 0 or args.skip_first < 0 or args.start_shard_index < 0:
        parser.error("--max-panos, --skip-first, and --start-shard-index must be non-negative")
    if min(args.shard_size_panos, args.out_size, args.oversample, args.target_width, args.target_height) < 1:
        parser.error("shard size, image sizes, and oversample must be positive")
    if min(args.embed_batch, args.queue_factor, args.decode_workers) < 1:
        parser.error("batch size, queue factor, and decoder workers must be positive")
    if args.embed_batch < len(args.yaw_degrees):
        parser.error("--embed-batch must be at least the number of requested views")
    return args


ARGS = parse_args()

# These names and defaults mirror the old notebook's user-config cell.  Only
# their source changed: command-line arguments now set them.
REPO_DIR = ARGS.repo_dir
MODEL_DIR = ARGS.model_dir
TAR_DIR = ARGS.tar_dir
TAR_IDS = ARGS.tar_ids
TAR_FILES = [Path(path) for path in ARGS.tar_files] if ARGS.tar_files else None
OUT_DIR = ARGS.output_dir
SHARD_SIZE_PANOS = ARGS.shard_size_panos
GLOBAL_PRECISION = ARGS.precision
MAX_PANOS = ARGS.max_panos
SKIP_FIRST = ARGS.skip_first
OUT_SIZE = ARGS.out_size
OVERSAMPLE = ARGS.oversample
FOV_DEG = ARGS.fov_deg
DEG_LIST = ARGS.yaw_degrees
K = int(len(DEG_LIST))
EMBED_BATCH = ARGS.embed_batch
PANO_BATCH = int(EMBED_BATCH / K)
QUEUE_FACTOR = ARGS.queue_factor
DECODE_WORKERS = ARGS.decode_workers
ENABLE_TIMERS = not ARGS.disable_timers
TARGET_W = ARGS.target_width
TARGET_H = ARGS.target_height

os.makedirs(OUT_DIR, exist_ok=True)

print("Config:")
print("  REPO_DIR:", REPO_DIR)
print("  MODEL_DIR:", MODEL_DIR)
if TAR_FILES:
    print("  INPUT_MODE: explicit --tar-files (legacy TAR_IDS are ignored)")
    print("  TAR_FILES:", TAR_FILES)
else:
    print("  INPUT_MODE: legacy --tar-dir/--tar-ids")
    print("  TAR_DIR:", TAR_DIR)
    print("  TAR_IDS:", TAR_IDS)
print("  OUT_DIR:", OUT_DIR)
print("  MAX_PANOS:", MAX_PANOS)
print("  SKIP_FIRST:", SKIP_FIRST)
print("  OUT_SIZE:", OUT_SIZE, "OVERSAMPLE:", OVERSAMPLE, "FOV_DEG:", FOV_DEG)
print("  EMBED_BATCH:", EMBED_BATCH, "QUEUE_FACTOR:", QUEUE_FACTOR)
print("  VIEWS_PER_PANO:", K, "PANO_BATCH:", PANO_BATCH)
print("  START_SHARD_INDEX:", ARGS.start_shard_index)
print("  ENABLE_TIMERS:", ENABLE_TIMERS)


# =========================
# IMPORTS + TIMER UTILS
# =========================
import gc
import io
import math
import sys
import tarfile
import threading
import time
from contextlib import contextmanager
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

try:
    from IPython.display import clear_output
except ImportError:
    def clear_output(*_args, **_kwargs):
        """Keep terminal runs functional when IPython is unavailable."""


class GpuEventTimer:
    def __init__(self):
        self.pending = []
        self.t = {}

    def start(self, key):
        s = torch.cuda.Event(enable_timing=True)
        e = torch.cuda.Event(enable_timing=True)
        s.record()
        self.pending.append((key, s, e))
        return e

    def end(self, end_event):
        end_event.record()

    def harvest(self, block=False):
        keep = []
        for key, s, e in self.pending:
            if block:
                e.synchronize()
                ms = s.elapsed_time(e)
                self.t[key] = self.t.get(key, 0.0) + (ms / 1000.0)
            elif e.query():
                ms = s.elapsed_time(e)
                self.t[key] = self.t.get(key, 0.0) + (ms / 1000.0)
            else:
                keep.append((key, s, e))
        self.pending = keep


if ENABLE_TIMERS:
    gpu_timer = GpuEventTimer()
    _stats_lock = threading.Lock()

    @contextmanager
    def timer(name, stats: dict):
        t0 = time.perf_counter()
        yield
        dt = time.perf_counter() - t0
        with _stats_lock:
            stats[name] = stats.get(name, 0.0) + dt

    def fmt_rate(n, dt):
        return f"{(n / dt):.2f}/s" if dt > 1e-9 else "inf/s"

    def print_stats(stats, pano_count, view_count, t_all0):
        clear_output(wait=True)
        wall = time.perf_counter() - t_all0
        keys_keep = [
            "decode_from_tar", "jpeg_decode", "pil_to_cuda", "stack_panos",
            "reproject_gpu", "qwen_embed", "parse_ref", "io_write",
        ]
        sections = {key: float(stats.get(key, 0.0)) for key in keys_keep}
        sum_sections = sum(sections.values())
        cpu_wait_put = float(stats.get("cpu_wait_put", 0.0))
        gpu_wait_get = float(stats.get("gpu_wait_get", 0.0))
        print("\n=== PERF (async-aware) ===")
        print("TAR ID:", stats.get("TID", 0))
        print(f"panos: {pano_count}  views: {view_count}")
        print(f"wall_total: {wall:.2f}s")
        print(f"sum_sections (decode+stack+reproject+embed): {sum_sections:.2f}s")
        if wall > 1e-9:
            print(f"overlap_factor (sum_sections / wall): {sum_sections / wall:.2f}x")
        print("\n-- section times (accumulated) --")
        for key in keys_keep:
            print(f"{key:>18}: {sections[key]:8.2f}s")
        print("\n-- waiting / backpressure --")
        print(f"{'gpu_wait_get (GPU starved by CPU)':>32}: {gpu_wait_get:8.2f}s")
        print(f"{'cpu_wait_put (CPU blocked by GPU)':>32}: {cpu_wait_put:8.2f}s")
        print("\n-- bad jpg --")
        print("decoded_bad:", stats.get("decoded_bad", 0))
        print("==========================\n")


# =========================
# GEOMETRY: rays + rotations + GPU reprojection (memory-safe)
# =========================
def get_torch_dtype():
    if GLOBAL_PRECISION == "fp16":
        return torch.float16
    if GLOBAL_PRECISION == "bf16":
        return torch.bfloat16
    return torch.float32


def get_numpy_dtype():
    if GLOBAL_PRECISION == "fp16":
        return np.float16
    return np.float32


def _deg2rad(x):
    return torch.as_tensor(x, dtype=torch.float32) * (torch.pi / 180.0)


def make_perspective_rays(size: int, fov_deg: float):
    fov = float(fov_deg) * math.pi / 180.0
    ys, xs = torch.meshgrid(
        torch.linspace(-1, 1, size, dtype=torch.float32),
        torch.linspace(-1, 1, size, dtype=torch.float32),
        indexing="ij",
    )
    focal_length = 1.0 / math.tan(fov / 2.0)
    rays = torch.stack([xs, -ys, torch.full_like(xs, focal_length)], dim=-1)
    return rays / torch.linalg.norm(rays, dim=-1, keepdim=True).clamp_min(1e-8)


def rotation_mats_yaw_pitch_roll(yaw_rad, pitch_rad, roll_rad):
    yaw = torch.as_tensor(yaw_rad, dtype=torch.float32)
    pitch = torch.as_tensor(pitch_rad, dtype=torch.float32)
    roll = torch.as_tensor(roll_rad, dtype=torch.float32)
    cy, sy = torch.cos(yaw), torch.sin(yaw)
    cp, sp = torch.cos(pitch), torch.sin(pitch)
    cr, sr = torch.cos(roll), torch.sin(roll)
    ry = torch.stack([
        torch.stack([cy, torch.zeros_like(cy), sy], dim=-1),
        torch.stack([torch.zeros_like(cy), torch.ones_like(cy), torch.zeros_like(cy)], dim=-1),
        torch.stack([-sy, torch.zeros_like(cy), cy], dim=-1),
    ], dim=-2)
    rx = torch.stack([
        torch.stack([torch.ones_like(cp), torch.zeros_like(cp), torch.zeros_like(cp)], dim=-1),
        torch.stack([torch.zeros_like(cp), cp, -sp], dim=-1),
        torch.stack([torch.zeros_like(cp), sp, cp], dim=-1),
    ], dim=-2)
    rz = torch.stack([
        torch.stack([cr, -sr, torch.zeros_like(cr)], dim=-1),
        torch.stack([sr, cr, torch.zeros_like(cr)], dim=-1),
        torch.stack([torch.zeros_like(cr), torch.zeros_like(cr), torch.ones_like(cr)], dim=-1),
    ], dim=-2)
    return (ry @ rx @ rz).unsqueeze(0)


@torch.inference_mode()
def equirect_to_perspective_gpu(panos_bchw01, rays_hw3, rotations_gk33, wrap=True):
    groups, channels, height, width = panos_bchw01.shape
    size = rays_hw3.shape[0]
    view_count = rotations_gk33.shape[1]
    rays_rot = torch.einsum("hwj,gkij->gkhwi", rays_hw3, rotations_gk33)
    x, y, z = rays_rot[..., 0], rays_rot[..., 1], rays_rot[..., 2]
    lon = torch.atan2(x, z)
    lat = torch.asin(torch.clamp(y, -1, 1))
    u = (lon / (2 * torch.pi) + 0.5) * (width - 1)
    v = (0.5 - lat / torch.pi) * (height - 1)
    u = torch.remainder(u, width) if wrap else u.clamp(0, width - 1)
    v = v.clamp(0, height - 1)
    grid_x = (u / (width - 1)) * 2 - 1
    grid_y = (v / (height - 1)) * 2 - 1
    out = torch.empty((groups, view_count, channels, size, size), device=panos_bchw01.device, dtype=panos_bchw01.dtype)
    for view_index in range(view_count):
        grid_k = torch.stack([grid_x[:, view_index], grid_y[:, view_index]], dim=-1)
        out[:, view_index] = F.grid_sample(
            panos_bchw01, grid_k, mode="bilinear", padding_mode="zeros", align_corners=True
        )
    return out


# =========================
# QWEN (the same embedder.process path as the notebook)
# =========================
repo_path = Path(REPO_DIR)
if str(repo_path) not in sys.path:
    sys.path.insert(0, str(repo_path))

from src.models.qwen3_vl_embedding import Qwen3VLEmbedder

embedder = Qwen3VLEmbedder(model_name_or_path=str(MODEL_DIR), dtype=get_torch_dtype())
print("default_instruction:", repr(getattr(embedder, "default_instruction", None)))


def _views_tensor_to_pil_list(views01_bchw: torch.Tensor):
    u8 = (views01_bchw.mul(255).clamp(0, 255)).to(torch.uint8)
    u8 = u8.permute(0, 2, 3, 1).contiguous().cpu().numpy()
    return [Image.fromarray(arr, mode="RGB") for arr in u8]


@torch.inference_mode()
def qwen_embed_images(views01_bchw: torch.Tensor) -> np.ndarray:
    pil_imgs = _views_tensor_to_pil_list(views01_bchw)
    batch_inputs = [{"image": image} for image in pil_imgs]
    if ENABLE_TIMERS:
        end_evt = gpu_timer.start("qwen_embed")
        with torch.autocast("cuda", dtype=get_torch_dtype()):
            emb = embedder.process(batch_inputs, normalize=True)
        gpu_timer.end(end_evt)
    else:
        with torch.autocast("cuda", dtype=get_torch_dtype()):
            emb = embedder.process(batch_inputs, normalize=True)
    return emb.detach().cpu().numpy().astype(get_numpy_dtype(), copy=False)


# =========================
# TAR reading helpers (async + timed)
# =========================
IMG_EXT = (".jpg", ".jpeg", ".png")


def iter_tar_images_async(tar_path, stats=None, prefetch=256, stats_every=200):
    """Threaded TAR byte reader retained from the original notebook."""
    from queue import Queue

    queue = Queue(maxsize=int(prefetch))
    stop = object()

    def stats_add(key, duration):
        if stats is not None:
            with _stats_lock:
                stats[key] = stats.get(key, 0.0) + float(duration)

    def worker():
        read_time = put_wait = 0.0
        count = 0
        try:
            with tarfile.open(tar_path, "r") as tar:
                for member in tar:
                    if not member.isfile() or not member.name.lower().endswith(IMG_EXT):
                        continue
                    file_obj = tar.extractfile(member)
                    if file_obj is None:
                        continue
                    if ENABLE_TIMERS and stats is not None:
                        started = time.perf_counter()
                        raw_bytes = file_obj.read()
                        read_time += time.perf_counter() - started
                        started = time.perf_counter()
                        queue.put((member.name, raw_bytes), block=True)
                        put_wait += time.perf_counter() - started
                    else:
                        queue.put((member.name, file_obj.read()), block=True)
                    count += 1
                    if count % stats_every == 0:
                        if ENABLE_TIMERS and stats is not None:
                            stats_add("decode_from_tar", read_time)
                            stats_add("cpu_wait_put", put_wait)
                            with _stats_lock:
                                stats["decoded_imgs"] = stats.get("decoded_imgs", 0) + count
                        read_time = put_wait = 0.0
                        count = 0
        finally:
            if ENABLE_TIMERS and stats is not None and count:
                stats_add("decode_from_tar", read_time)
                stats_add("cpu_wait_put", put_wait)
                with _stats_lock:
                    stats["decoded_imgs"] = stats.get("decoded_imgs", 0) + count
            queue.put(stop)

    threading.Thread(target=worker, daemon=True).start()
    while True:
        if ENABLE_TIMERS and stats is not None:
            started = time.perf_counter()
            item = queue.get()
            stats_add("gpu_wait_get", time.perf_counter() - started)
        else:
            item = queue.get()
        if item is stop:
            break
        yield item


def bytes_to_pil_rgb(raw_bytes: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(raw_bytes))
    return image.convert("RGB")


def iter_tar_pil_async(tar_path, stats=None, prefetch_bytes=512, prefetch_pil=64, decode_workers=4, skip_first=0, bad_streak_threshold=5):
    """The notebook's two-stage TAR-to-PIL reader, including bad-image handling."""
    from queue import Queue

    pil_queue = Queue(maxsize=int(prefetch_pil))
    job_queue = Queue(maxsize=int(prefetch_bytes))
    stop = object()
    source_iter = iter_tar_images_async(tar_path, stats=stats, prefetch=prefetch_bytes)
    streak_lock = threading.Lock()
    bad_streak = {"count": 0, "start": None, "last_bad": None}

    def stats_inc(key, value=1):
        if stats is not None:
            with _stats_lock:
                stats[key] = stats.get(key, 0) + value

    def stats_add(key, duration):
        if stats is not None:
            with _stats_lock:
                stats[key] = stats.get(key, 0.0) + float(duration)

    def mark_bad(name):
        with streak_lock:
            if bad_streak["count"] == 0:
                bad_streak["start"] = (str(tar_path), name)
            bad_streak["count"] += 1
            bad_streak["last_bad"] = (str(tar_path), name)
            return bad_streak["count"] == bad_streak_threshold + 1, bad_streak["start"], bad_streak["last_bad"]

    def mark_good(name):
        with streak_lock:
            if bad_streak["count"] == 0:
                return False, None, None, None, 0
            start, last_bad, count = bad_streak["start"], bad_streak["last_bad"], bad_streak["count"]
            bad_streak.update(count=0, start=None, last_bad=None)
            return True, start, last_bad, (str(tar_path), name), count

    def feeder():
        skipped = 0
        try:
            for name, raw_bytes in source_iter:
                if skip_first and skipped < int(skip_first):
                    skipped += 1
                    continue
                job_queue.put((name, raw_bytes), block=True)
        finally:
            for _ in range(int(decode_workers)):
                job_queue.put(stop, block=True)

    def decoder_worker():
        while True:
            item = job_queue.get()
            if item is stop:
                pil_queue.put(stop, block=True)
                break
            name, raw_bytes = item
            try:
                if ENABLE_TIMERS and stats is not None:
                    started = time.perf_counter()
                    image = bytes_to_pil_rgb(raw_bytes)
                    stats_add("jpeg_decode", time.perf_counter() - started)
                else:
                    image = bytes_to_pil_rgb(raw_bytes)
                had_streak, start, last_bad, end_good, streak_len = mark_good(name)
                if had_streak and streak_len > bad_streak_threshold:
                    print(f"[BAD JPEG STREAK ended] len={streak_len} from {start[0]}/{start[1]} .. {last_bad[0]}/{last_bad[1]} ; first good: {end_good[0]}/{end_good[1]}")
                pil_queue.put((name, image), block=True)
                stats_inc("decoded_ok")
            except Exception as exc:
                stats_inc("decoded_bad")
                should_print, start, last_bad = mark_bad(name)
                if should_print:
                    print(f"[BAD JPEG STREAK ongoing] len>={bad_streak_threshold + 1} starting at {start[0]}/{start[1]} ; latest bad: {last_bad[0]}/{last_bad[1]} ; last_err={exc!r}")

    threading.Thread(target=feeder, daemon=True).start()
    for _ in range(int(decode_workers)):
        threading.Thread(target=decoder_worker, daemon=True).start()

    stop_seen = 0
    while True:
        item = pil_queue.get()
        if item is stop:
            stop_seen += 1
            if stop_seen >= int(decode_workers):
                with streak_lock:
                    if bad_streak["count"] > bad_streak_threshold:
                        start, last_bad = bad_streak["start"], bad_streak["last_bad"]
                        print(f"[BAD JPEG STREAK ended at EOF] len={bad_streak['count']} from {start[0]}/{start[1]} .. {last_bad[0]}/{last_bad[1]} ; no subsequent good file.")
                break
            continue
        yield item


def pil_to_cuda01(pil_img: Image.Image) -> torch.Tensor:
    if pil_img.size != (TARGET_W, TARGET_H):
        pil_img = pil_img.resize((TARGET_W, TARGET_H), resample=Image.BILINEAR)
    array = np.asarray(pil_img, dtype=np.uint8)
    if not array.flags["C_CONTIGUOUS"] or not array.flags["WRITEABLE"]:
        array = np.array(array, copy=True, order="C")
    tensor_cpu = torch.from_numpy(array).permute(2, 0, 1).contiguous().pin_memory()
    return tensor_cpu.to("cuda", non_blocking=True).float().div_(255.0)


def parse_pano_numeric(name: str):
    parts = Path(name).stem.split("_")
    if len(parts) < 4:
        raise ValueError(
            f"Expected at least ID_lon_lat_date in panorama filename, got: {name}"
        )
    pano_id, lon, lat, date = parts[:4]
    heading = float("nan")
    for suffix in parts[4:]:
        if suffix.lower().startswith("heading"):
            heading_value = suffix[len("heading"):]
            if not heading_value:
                raise ValueError(f"Missing heading value in panorama filename: {name}")
            heading = float(heading_value)
            break
    # The reference array now stores [id, lon, lat, date, heading]. Existing
    # backend readers intentionally use only its first four columns.
    return int(pano_id), float(lon), float(lat), int(date), heading


# =========================
# MAIN RUN
# =========================
torch.set_grad_enabled(False)
yaw_deg = np.array(DEG_LIST, dtype=np.float32)
pitch_deg = np.zeros_like(yaw_deg)
roll_deg = np.zeros_like(yaw_deg)
size = int(OUT_SIZE)
high_size = int(OUT_SIZE * OVERSAMPLE)
rays_hw3_hi = make_perspective_rays(high_size, fov_deg=FOV_DEG).to("cuda")
rotations_1k33 = rotation_mats_yaw_pitch_roll(_deg2rad(yaw_deg), _deg2rad(pitch_deg), _deg2rad(roll_deg)).to("cuda")

bucket_views = []
shard_idx = ARGS.start_shard_index
bucket_refs = []
total_panos = total_views = 0
stats = {} if ENABLE_TIMERS else None
started_all = time.perf_counter()


def flush_bucket():
    global bucket_views, bucket_refs, shard_idx
    if not bucket_views:
        return
    assert len(bucket_views) == len(bucket_refs), f"Mismatch: views={len(bucket_views)} refs={len(bucket_refs)}"
    embeddings = np.stack(bucket_views, axis=0)
    np.save(Path(OUT_DIR) / f"views_emb_shard_{shard_idx:05d}.npy", embeddings.astype(get_numpy_dtype(), copy=False))
    references = np.asarray(bucket_refs, dtype=np.float32)
    np.save(Path(OUT_DIR) / f"views_emb_shard_{shard_idx:05d}_ref.npy", references)
    print(f"Wrote shard {shard_idx:05d}: emb {embeddings.shape} + ref {references.shape}")
    bucket_views.clear()
    bucket_refs.clear()
    shard_idx += 1


max_panos = int(MAX_PANOS)
tar_inputs = TAR_FILES or [Path(TAR_DIR) / f"{tar_id}.tar" for tar_id in TAR_IDS]
for tar_input in tar_inputs:
    if total_panos >= max_panos:
        break
    tar_path = str(tar_input)
    tar_id = tar_input.stem
    print(f"Reading: {tar_path}")
    batch_panos, batch_refs = [], []
    if ENABLE_TIMERS:
        stats["TID"] = tar_id
    for name, image in iter_tar_pil_async(
        tar_path, stats=stats, prefetch_bytes=QUEUE_FACTOR * PANO_BATCH * 8,
        prefetch_pil=QUEUE_FACTOR * PANO_BATCH, decode_workers=DECODE_WORKERS,
        skip_first=SKIP_FIRST, bad_streak_threshold=5,
    ):
        if SKIP_FIRST > 0:
            SKIP_FIRST = 0
        if total_panos >= max_panos:
            break
        pano_id, lon, lat, date, heading = parse_pano_numeric(name)
        if ENABLE_TIMERS:
            with timer("pil_to_cuda", stats):
                pano_cuda = pil_to_cuda01(image)
        else:
            pano_cuda = pil_to_cuda01(image)
        batch_panos.append(pano_cuda)
        batch_refs.append((pano_id, lon, lat, date, heading))
        if len(batch_panos) < PANO_BATCH:
            continue
        if ENABLE_TIMERS:
            with timer("stack_panos", stats):
                panos = torch.stack(batch_panos, dim=0)
        else:
            panos = torch.stack(batch_panos, dim=0)
        group_size = panos.shape[0]
        rotations_gk33 = rotations_1k33.expand(group_size, -1, -1, -1).contiguous()
        if ENABLE_TIMERS:
            event = gpu_timer.start("reproject_gpu")
            views_hi = equirect_to_perspective_gpu(panos, rays_hw3_hi, rotations_gk33, wrap=True)
            gpu_timer.end(event)
        else:
            views_hi = equirect_to_perspective_gpu(panos, rays_hw3_hi, rotations_gk33, wrap=True)
        if OVERSAMPLE != 1:
            views = F.interpolate(views_hi.view(group_size * K, 3, high_size, high_size), size=(size, size), mode="bilinear", align_corners=False).view(group_size, K, 3, size, size)
        else:
            views = views_hi[:, :, :, :size, :size]
        if ENABLE_TIMERS:
            with timer("prep_views_for_embed", stats):
                views_flat = views.reshape(group_size * K, 3, size, size).contiguous()
        else:
            views_flat = views.reshape(group_size * K, 3, size, size).contiguous()
        embeddings = [qwen_embed_images(views_flat[start:start + EMBED_BATCH]) for start in range(0, group_size * K, EMBED_BATCH)]
        if ENABLE_TIMERS:
            gpu_timer.harvest(block=False)
            stats["qwen_embed"] = gpu_timer.t.get("qwen_embed", 0.0)
        embedding_all = np.concatenate(embeddings, axis=0).reshape(group_size, K, -1)
        bucket_views.extend(embedding_all)
        bucket_refs.extend(batch_refs)
        total_panos += group_size
        total_views += group_size * K
        del panos, views_hi, views, views_flat, rotations_gk33
        batch_panos, batch_refs = [], []
        if len(bucket_views) >= SHARD_SIZE_PANOS:
            if ENABLE_TIMERS:
                with timer("write_shard", stats):
                    flush_bucket()
            else:
                flush_bucket()
        if ENABLE_TIMERS and total_panos % 50 == 0:
            gpu_timer.harvest(block=False)
            stats["reproject_gpu"] = gpu_timer.t.get("reproject_gpu", 0.0)
            stats["qwen_embed"] = gpu_timer.t.get("qwen_embed", 0.0)
            print_stats(stats, total_panos, total_views, started_all)

    if batch_panos and total_panos < max_panos:
        panos = torch.stack(batch_panos, dim=0)
        group_size = panos.shape[0]
        rotations_gk33 = rotations_1k33.expand(group_size, -1, -1, -1).contiguous()
        if ENABLE_TIMERS:
            event = gpu_timer.start("reproject_gpu")
            views_hi = equirect_to_perspective_gpu(panos, rays_hw3_hi, rotations_gk33, wrap=True)
            gpu_timer.end(event)
        else:
            views_hi = equirect_to_perspective_gpu(panos, rays_hw3_hi, rotations_gk33, wrap=True)
        if OVERSAMPLE != 1:
            views = F.interpolate(views_hi.view(group_size * K, 3, high_size, high_size), size=(size, size), mode="bilinear", align_corners=False).view(group_size, K, 3, size, size)
        else:
            views = views_hi[:, :, :, :size, :size]
        views_flat = views.reshape(group_size * K, 3, size, size).contiguous()
        embeddings = [qwen_embed_images(views_flat[start:start + EMBED_BATCH]) for start in range(0, group_size * K, EMBED_BATCH)]
        if ENABLE_TIMERS:
            gpu_timer.harvest(block=False)
        embedding_all = np.concatenate(embeddings, axis=0).reshape(group_size, K, -1)
        bucket_views.extend(embedding_all)
        bucket_refs.extend(batch_refs)
        total_panos += group_size
        total_views += group_size * K
        del panos, views_hi, views, views_flat, rotations_gk33

if ENABLE_TIMERS:
    gpu_timer.harvest(block=True)
    stats["reproject_gpu"] = gpu_timer.t.get("reproject_gpu", 0.0)
    stats["qwen_embed"] = gpu_timer.t.get("qwen_embed", 0.0)
    print_stats(stats, total_panos, total_views, started_all)

print("Flushing remaining buckets...")
flush_bucket()
print(f"Done. Total panos: {total_panos} total views: {total_views}")
