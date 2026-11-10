#!/usr/bin/env python3
"""Project validation targets with the exact image transform metadata.

Raster targets use nearest-neighbour sampling. Boxes/polygons support affine
perspective crops/tiles. Equirectangular vector annotations must first be
rasterized in source coordinates, then projected as a raster target.
"""
from __future__ import annotations

import math
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw


AFFINE_METHODS = {"center_crop_resize", "horizontal_square_tile"}


def _restore_mode(array: np.ndarray, source: Image.Image) -> Image.Image:
    if source.mode == "P":
        output = Image.fromarray(array.astype(np.uint8), mode="P")
        palette = source.getpalette()
        if palette:
            output.putpalette(palette)
        return output
    if source.mode == "F":
        return Image.fromarray(array.astype(np.float32), mode="F")
    return Image.fromarray(array)


def equirectangular_source_pixels(source_size, transform):
    """Source integer coordinates used by nearest-neighbour label projection."""
    width, height = source_size
    if abs(width / height - 2.0) > 0.03:
        raise ValueError(f"Equirectangular target is not 2:1: {width}x{height}")
    size = int(transform["output_size"][0])
    fov = float(transform["fov_degrees"])
    yaw = math.radians(float(transform["yaw_degrees"]))
    pitch = math.radians(float(transform.get("pitch_degrees", 0.0)))
    axis = np.linspace(-1.0, 1.0, size, dtype=np.float32)
    xx, yy = np.meshgrid(axis, axis)
    focal = 1.0 / math.tan(math.radians(fov) / 2.0)
    rays = np.stack((xx, -yy, np.full_like(xx, focal)), axis=-1)
    rays /= np.linalg.norm(rays, axis=-1, keepdims=True)
    cp, sp = math.cos(pitch), math.sin(pitch)
    rays = rays @ np.asarray([[1, 0, 0], [0, cp, -sp], [0, sp, cp]], dtype=np.float32).T
    cy, sy = math.cos(yaw), math.sin(yaw)
    rays = rays @ np.asarray([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], dtype=np.float32).T
    longitude = np.arctan2(rays[..., 0], rays[..., 2])
    latitude = np.arcsin(np.clip(rays[..., 1], -1, 1))
    # Same native-source coordinate convention as pipeline_runtime.NativeProjector.
    x = np.rint((longitude / (2 * math.pi) + 0.5) * (width - 1)).astype(np.int64) % width
    y = np.rint((0.5 - latitude / math.pi) * (height - 1)).astype(np.int64)
    y = np.clip(y, 0, height - 1)
    return x, y


def _project_equirectangular_nearest(target: Image.Image, transform: dict) -> Image.Image:
    x, y = equirectangular_source_pixels(target.size, transform)
    return _restore_mode(np.asarray(target)[y, x], target)


def transform_raster_target(target: Image.Image, transform: dict) -> Image.Image:
    """Apply image transform metadata to class/instance/height rasters."""
    method = transform["method"]
    if method in AFFINE_METHODS:
        crop = tuple(int(value) for value in transform["crop_box"])
        size = tuple(int(value) for value in transform["output_size"])
        return target.crop(crop).resize(size, Image.Resampling.NEAREST)
    if method == "equirectangular_to_perspective":
        return _project_equirectangular_nearest(target, transform)
    raise ValueError(f"Unsupported target transform {method!r}")


def _crop_geometry(transform: dict):
    if transform["method"] not in AFFINE_METHODS:
        raise ValueError("Vector targets for equirectangular views must be rasterized first")
    left, top, right, bottom = map(float, transform["crop_box"])
    out_w, out_h = map(float, transform["output_size"])
    return left, top, right, bottom, out_w / (right - left), out_h / (bottom - top)


def transform_bbox_xywh(box: Iterable[float], transform: dict):
    left, top, right, bottom, sx, sy = _crop_geometry(transform)
    x, y, width, height = map(float, box)
    x0, y0, x1, y1 = max(x, left), max(y, top), min(x + width, right), min(y + height, bottom)
    if x1 <= x0 or y1 <= y0:
        return None
    return [(x0 - left) * sx, (y0 - top) * sy, (x1 - x0) * sx, (y1 - y0) * sy]


def transform_bbox_xyxy(box: dict | Iterable[float], transform: dict):
    """Transform MTSD/BDD-style xmin,ymin,xmax,ymax and retain that format."""
    if isinstance(box, dict):
        values = [box[key] for key in ("xmin", "ymin", "xmax", "ymax")]
    else:
        values = list(box)
    x0, y0, x1, y1 = map(float, values)
    projected = transform_bbox_xywh([x0, y0, x1 - x0, y1 - y0], transform)
    if projected is None:
        return None
    x, y, width, height = projected
    result = [x, y, x + width, y + height]
    return dict(zip(("xmin", "ymin", "xmax", "ymax"), result)) if isinstance(box, dict) else result


def transform_polyline(points: Iterable[float], transform: dict):
    """Clip source-pixel x/y lane points and scale them into the output crop."""
    values = list(map(float, points))
    if len(values) < 4 or len(values) % 2:
        return []
    left, top, right, bottom, sx, sy = _crop_geometry(transform)

    def clip_segment(a, b):
        x0, y0 = a; dx, dy = b[0] - x0, b[1] - y0
        low, high = 0.0, 1.0
        for p, q in ((-dx, x0 - left), (dx, right - x0),
                     (-dy, y0 - top), (dy, bottom - y0)):
            if p == 0:
                if q < 0:
                    return None
                continue
            ratio = q / p
            if p < 0:
                low = max(low, ratio)
            else:
                high = min(high, ratio)
            if low > high:
                return None
        return ((x0 + low * dx, y0 + low * dy), (x0 + high * dx, y0 + high * dy))

    clipped = []
    points = list(zip(values[::2], values[1::2]))
    for a, b in zip(points, points[1:]):
        segment = clip_segment(a, b)
        if segment is None:
            continue
        for point in segment:
            scaled = ((point[0] - left) * sx, (point[1] - top) * sy)
            if not clipped or scaled != clipped[-1]:
                clipped.append(scaled)
    return [coordinate for point in clipped for coordinate in point]


def transform_polyline_segments(points: Iterable[float], transform: dict):
    """Retain disconnected clipped fragments without inventing connecting lines."""
    values = list(points)
    segments = []
    for index in range(0, len(values) - 2, 2):
        segment = transform_polyline(values[index:index + 4], transform)
        if not segment:
            continue
        if segments and segments[-1][-2:] == segment[:2]:
            segments[-1].extend(segment[2:])
        else:
            segments.append(segment)
    return segments


def _clip_edge(points, inside, intersect):
    if not points:
        return []
    output = []
    previous = points[-1]
    for current in points:
        if inside(current):
            if not inside(previous):
                output.append(intersect(previous, current))
            output.append(current)
        elif inside(previous):
            output.append(intersect(previous, current))
        previous = current
    return output


def transform_polygon(points: Iterable[float], transform: dict):
    values = list(map(float, points))
    if len(values) < 6 or len(values) % 2:
        return None
    left, top, right, bottom, sx, sy = _crop_geometry(transform)
    polygon = list(zip(values[::2], values[1::2]))
    def x_at(boundary, a, b):
        return (boundary, a[1] + (b[1] - a[1]) * (boundary - a[0]) / (b[0] - a[0]))
    def y_at(boundary, a, b):
        return (a[0] + (b[0] - a[0]) * (boundary - a[1]) / (b[1] - a[1]), boundary)
    polygon = _clip_edge(polygon, lambda p: p[0] >= left, lambda a, b: x_at(left, a, b))
    polygon = _clip_edge(polygon, lambda p: p[0] <= right, lambda a, b: x_at(right, a, b))
    polygon = _clip_edge(polygon, lambda p: p[1] >= top, lambda a, b: y_at(top, a, b))
    polygon = _clip_edge(polygon, lambda p: p[1] <= bottom, lambda a, b: y_at(bottom, a, b))
    if len(polygon) < 3:
        return None
    return [coordinate for x, y in polygon
            for coordinate in ((x - left) * sx, (y - top) * sy)]


def rasterize_coco_polygons(size: tuple[int, int], annotations: Iterable[dict],
                            value_key: str = "category_id") -> Image.Image:
    """Rasterize uncompressed COCO polygon lists; RLE needs a COCO decoder."""
    output = Image.new("I", size, 0)
    draw = ImageDraw.Draw(output)
    for annotation in annotations:
        value = int(annotation[value_key])
        segmentation = annotation.get("segmentation", [])
        if isinstance(segmentation, dict):
            raise ValueError("COCO RLE segmentation requires a dedicated RLE decoder")
        for flat in segmentation:
            if len(flat) >= 6:
                draw.polygon(list(zip(flat[::2], flat[1::2])), fill=value)
    return output


def partition_source_tags(tags: dict, view_specific_fields: Iterable[str] = ()) -> dict:
    """Keep ambiguous tags at source scope instead of inventing per-view truth."""
    view_specific = set(view_specific_fields)
    return {"output_tags": {key: value for key, value in tags.items() if key not in view_specific},
            "source_only_tags": {key: value for key, value in tags.items() if key in view_specific}}
