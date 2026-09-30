"""CPU equivalent of the legacy embedding camera geometry, at 512 px per view."""
from __future__ import annotations

import json
import threading
import uuid
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

from .pano_service import (
    AmbiguousPanoIdError, PanoCoordinateMismatchError, PanoServiceRegistry,
    NEW_YORK_SCORING_DATASET_ID, NEW_YORK_MANHATTAN_PANO_DATASET_ID,
    NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID,
)
from .tile_index import safe_segment

YAWS = (45, 90, 135, 180, 225, 270, 315, 0)
PROFILE = 'legacy-fov45-pitch0-roll0-bilinear-4096x2048-out512-v1'
COLLAGE_FILENAME = 'collage-4x2-v1.png'


@lru_cache(maxsize=8)
def sampling_coordinates(yaw: int) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.meshgrid(np.linspace(-1, 1, 512, dtype=np.float32),
                         np.linspace(-1, 1, 512, dtype=np.float32), indexing='ij')
    rays = np.stack((xs, -ys, np.full_like(xs, 1 / np.tan(np.pi / 8))), axis=-1)
    rays /= np.linalg.norm(rays, axis=-1, keepdims=True)
    angle = np.float32(yaw * np.pi / 180)
    c, s = np.cos(angle), np.sin(angle)
    x = c * rays[..., 0] + s * rays[..., 2]
    y = rays[..., 1]
    z = -s * rays[..., 0] + c * rays[..., 2]
    u = (np.arctan2(x, z) / (2 * np.pi) + .5) * 4095
    v = (.5 - np.arcsin(np.clip(y, -1, 1)) / np.pi) * 2047
    return np.remainder(u, 4096), np.clip(v, 0, 2047)


def project_view(panorama: np.ndarray, yaw: int) -> Image.Image:
    """Bilinear sampling with align_corners=True, matching legacy grid_sample.

    Geometry/order match the embedding script. Pixel-exact equality to CUDA and
    model preprocessing is not claimed; requested output resolution is different.
    """
    if panorama.shape != (2048, 4096, 3):
        raise ValueError('Expected a 4096x2048 RGB panorama')
    u, v = sampling_coordinates(yaw)
    x0 = np.floor(u).astype(np.int32); y0 = np.floor(v).astype(np.int32)
    x1 = np.minimum(x0 + 1, 4095); y1 = np.minimum(y0 + 1, 2047)
    wx = (u - x0)[..., None]; wy = (v - y0)[..., None]
    rgb = ((1 - wx) * (1 - wy) * panorama[y0, x0] + wx * (1 - wy) * panorama[y0, x1]
           + (1 - wx) * wy * panorama[y1, x0] + wx * wy * panorama[y1, x1])
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


class AIProjectionService:
    def __init__(self, registry: PanoServiceRegistry, cache_root: Path):
        self.registry = registry
        self.cache_root = cache_root / PROFILE
        self._lock = threading.RLock()

    def collage(self, question: dict) -> Path:
        """Serve one lossless contact sheet, keeping every 512px view unchanged."""
        paths = self.views(question)
        if len(paths) != 8:
            raise ValueError('Collage requires all eight perspective views')
        target = paths[0].parent / COLLAGE_FILENAME
        with self._lock:
            if target.is_file():
                return target
            sheet = Image.new('RGB', (2048, 1024))
            for index, path in enumerate(paths):
                with Image.open(path) as tile:
                    if tile.size != (512, 512):
                        raise ValueError('Collage source views must be 512 x 512')
                    sheet.paste(tile.convert('RGB'), ((index % 4) * 512, (index // 4) * 512))
            temporary = target.with_name(target.name + '.' + uuid.uuid4().hex + '.tmp')
            try:
                sheet.save(temporary, format='PNG')
                temporary.replace(target)
            finally:
                temporary.unlink(missing_ok=True)
        return target

    def views(self, question: dict) -> list[Path]:
        dataset = question['dataset_id']
        datasets = [dataset] if dataset != NEW_YORK_SCORING_DATASET_ID else [
            NEW_YORK_MANHATTAN_PANO_DATASET_ID, NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID]
        matches = []
        for candidate in datasets:
            service = self.registry.service_for(candidate)
            try:
                result = service.ensure_pano_image(str(question['pano_id']), lon=question['lon'],
                    lat=question['lat'], capture_date=question.get('date'))
            except PanoCoordinateMismatchError:
                continue
            if result is not None:
                matches.append((candidate, *result))
        if not matches:
            raise FileNotFoundError('The exact panorama is not available in the configured archives')
        if len(matches) != 1:
            raise AmbiguousPanoIdError('More than one image namespace matches the exact panorama; refusing to guess')
        namespace, entry, source = matches[0]
        folder = self.cache_root / safe_segment(namespace) / safe_segment(entry.entry_key)
        paths = [folder / f'{i}.png' for i in range(8)]
        manifest = folder / 'manifest.json'
        with self._lock:
            if manifest.exists() and all(p.is_file() for p in paths):
                return paths
            folder.mkdir(parents=True, exist_ok=True)
            with Image.open(source) as original:
                # Same source resize and pixel convention as the embedding pipeline.
                original = original.convert('RGB').resize((4096, 2048), Image.Resampling.BILINEAR)
                panorama = np.asarray(original)
            for yaw, path in zip(YAWS, paths):
                temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
                try:
                    project_view(panorama, yaw).save(temporary, format='PNG')
                    temporary.replace(path)
                finally:
                    temporary.unlink(missing_ok=True)
            metadata = dict(profile=PROFILE, pano_dataset_id=namespace, entry_key=entry.entry_key,
                            member_name=entry.member_name, yaws=YAWS, width=512, height=512)
            temporary = manifest.with_name('manifest.' + uuid.uuid4().hex + '.tmp')
            temporary.write_text(json.dumps(metadata), encoding='utf-8')
            temporary.replace(manifest)
        return paths
