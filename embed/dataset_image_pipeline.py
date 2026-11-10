#!/usr/bin/env python3
"""Dataset-aware image discovery, projection, and source/output mapping.

The legacy runner assumes every source is an equirectangular TAR member whose
filename contains id/lon/lat. Public CV datasets do not share that contract.
Identity is kept in an explicit source locator and projection is declared by a
catalog rule. A 2:1 ratio alone is never proof of an equirectangular image.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from fnmatch import fnmatch
import glob
import hashlib
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import tarfile
import tempfile
from typing import Iterable, Iterator
import zipfile
import uuid

import numpy as np
from PIL import Image, ImageOps

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"}
PROJECTIONS = {"perspective", "equirectangular"}
PERSPECTIVE_MODES = {"center_crop", "horizontal_halves_if_2_to_1"}
DEFAULT_YAWS = (0.0, 45.0, 90.0, 135.0, 180.0, 225.0, 270.0, 315.0)


@dataclass(frozen=True)
class ImageRecord:
    source_index: int
    dataset_id: str
    projection: str
    container: str
    member: str
    nested_archive: str | None = None
    perspective_mode: str = "center_crop"
    validation_kind: str = "none"
    input_modality: str = "street_view"

    @property
    def source_uri(self) -> str:
        parts = [self.container]
        if self.nested_archive:
            parts.append(self.nested_archive)
        if self.member:
            parts.append(self.member)
        return "::".join(parts)

    def json(self) -> dict:
        row = asdict(self)
        row["source_uri"] = self.source_uri
        return row


@dataclass(frozen=True)
class SourceRule:
    dataset_id: str
    projection: str
    containers: tuple[str, ...]
    member_globs: tuple[str, ...] = ("*",)
    exclude_globs: tuple[str, ...] = ()
    nested_archive_globs: tuple[str, ...] = ()
    perspective_mode: str = "center_crop"
    validation_kind: str = "none"
    input_modality: str = "street_view"
    duplicate_policy: str = "error"
    allow_empty: bool = False

    @classmethod
    def from_json(cls, value: dict, catalog_dir: Path) -> "SourceRule":
        projection = value["projection"]
        if projection not in PROJECTIONS:
            raise ValueError(f"Unsupported projection {projection!r}")
        perspective_mode = value.get("perspective_mode", "center_crop")
        if perspective_mode not in PERSPECTIVE_MODES:
            raise ValueError(f"Unsupported perspective mode {perspective_mode!r}")
        raw = value.get("containers") or [value["container"]]
        containers: list[str] = []
        for item in raw:
            path = Path(item)
            if not path.is_absolute():
                path = catalog_dir / path
            if any(token in str(path) for token in ("*", "?", "[")):
                containers.extend(str(Path(match).resolve()) for match in sorted(glob.glob(str(path), recursive=True))
                                  if Path(match).is_file())
            else:
                containers.append(str(path.resolve()))
        if not containers:
            raise ValueError(f"No containers matched for {value['dataset_id']}")
        input_modality = value.get("input_modality", "street_view")
        if input_modality == "satellite":
            raise ValueError("Satellite source rules cannot be enabled for embedding")
        policy = value.get("duplicate_policy", "error")
        if policy not in {"error", "first", "last"}:
            raise ValueError(f"Unsupported duplicate policy {policy!r}")
        return cls(value["dataset_id"], projection, tuple(containers),
                   tuple(value.get("member_globs", ["*"])),
                   tuple(value.get("exclude_globs", [])),
                   tuple(value.get("nested_archive_globs", [])),
                   perspective_mode, value.get("validation_kind", "none"), input_modality,
                   policy, bool(value.get("allow_empty", False)))


def load_catalog(path: str | Path) -> tuple[dict, list[SourceRule]]:
    path = Path(path).resolve()
    raw = json.loads(path.read_text(encoding="utf-8"))
    if raw.get("version") != 1 or not isinstance(raw.get("sources"), list):
        raise ValueError("Catalog must have version=1 and a sources list")
    rules = [SourceRule.from_json(item, path.parent) for item in raw["sources"]
             if item.get("include_in_embedding", True)]
    return raw, rules


def _matches(name: str, includes: tuple[str, ...], excludes: tuple[str, ...]) -> bool:
    posix = str(PurePosixPath(name))
    return (PurePosixPath(posix).suffix.lower() in IMAGE_SUFFIXES
            and any(fnmatch(posix, pattern) for pattern in includes)
            and not any(fnmatch(posix, pattern) for pattern in excludes))


def _copy_zip_member(archive: zipfile.ZipFile, member: str, destination: Path) -> None:
    partial = destination.with_suffix(destination.suffix + ".partial")
    with archive.open(member) as source, partial.open("wb") as target:
        shutil.copyfileobj(source, target, length=8 << 20)
        target.flush(); os.fsync(target.fileno())
    os.replace(partial, destination)


class NestedZipCache:
    """Keep at most one extracted nested ZIP and delete it when switching."""
    def __init__(self, root: str | Path | None = None):
        self.root = Path(root) if root else Path(tempfile.mkdtemp(prefix="urbanfabric-nested-"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.owned_root = root is None
        self.key: tuple[str, str] | None = None
        self.path: Path | None = None

    def materialize(self, outer_path: str, nested_member: str) -> Path:
        key = (outer_path, nested_member)
        if self.key == key and self.path and self.path.exists():
            return self.path
        self.clear()
        digest = hashlib.sha1("::".join(key).encode()).hexdigest()[:16]
        destination = self.root / f"nested-{digest}.zip"
        with zipfile.ZipFile(outer_path) as outer:
            _copy_zip_member(outer, nested_member, destination)
        self.key, self.path = key, destination
        return destination

    def clear(self) -> None:
        if self.path and self.path.exists():
            self.path.unlink()
        self.key = self.path = None

    def close(self) -> None:
        self.clear()
        if self.owned_root:
            self.root.rmdir()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def iter_rule_records(rule: SourceRule, start_index: int = 0,
                      nested_cache: NestedZipCache | None = None) -> Iterator[ImageRecord]:
    def record(container, member, nested_archive=None):
        return ImageRecord(index, rule.dataset_id, rule.projection, container, member,
                           nested_archive, rule.perspective_mode, rule.validation_kind,
                           rule.input_modality)

    index = start_index
    for container in rule.containers:
        path = Path(container)
        if not path.is_file():
            raise FileNotFoundError(path)
        if path.suffix.lower() != ".zip" and not tarfile.is_tarfile(path):
            if _matches(path.name, rule.member_globs, rule.exclude_globs):
                yield record(str(path), "")
                index += 1
            continue
        if path.suffix.lower() != ".zip":
            if rule.nested_archive_globs:
                raise ValueError("Nested archives are currently supported only inside ZIP containers")
            with tarfile.open(path, "r:*") as archive:
                for info in archive:
                    if info.isfile() and _matches(info.name, rule.member_globs, rule.exclude_globs):
                        yield record(str(path), info.name)
                        index += 1
            continue
        with zipfile.ZipFile(path) as archive:
            if not rule.nested_archive_globs:
                for info in archive.infolist():
                    if not info.is_dir() and _matches(info.filename, rule.member_globs, rule.exclude_globs):
                        yield record(str(path), info.filename)
                        index += 1
                continue
            if nested_cache is None:
                raise ValueError("A NestedZipCache is required for nested archive rules")
            nested_names = [info.filename for info in archive.infolist() if not info.is_dir()
                            and any(fnmatch(info.filename, pattern) for pattern in rule.nested_archive_globs)]
        for nested_name in nested_names:
            nested_path = nested_cache.materialize(str(path), nested_name)
            with zipfile.ZipFile(nested_path) as nested:
                for info in nested.infolist():
                    if not info.is_dir() and _matches(info.filename, rule.member_globs, rule.exclude_globs):
                        yield record(str(path), info.filename, nested_name)
                        index += 1


def write_inventory(catalog_path: str | Path, output_path: str | Path,
                    cache_root: str | Path | None = None) -> dict:
    raw, rules = load_catalog(catalog_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    partial = output_path.with_suffix(output_path.suffix + ".partial")
    counts = {rule.dataset_id: 0 for rule in rules}
    duplicates = {rule.dataset_id: 0 for rule in rules}
    inputs = source_snapshot(rules)
    # Keep duplicate discovery bounded in RAM even for multi-million-image catalogs.
    with tempfile.TemporaryDirectory(prefix="inventory-") as temporary, \
            NestedZipCache(cache_root) as cache, partial.open("w", encoding="utf-8") as handle:
        database = sqlite3.connect(str(Path(temporary) / "sources.sqlite"))
        try:
            # Rebuildable local scratch, never the durable inventory. Avoid
            # network-volume SQLite latency and unnecessary journal copies.
            database.execute('PRAGMA journal_mode=OFF')
            database.execute('PRAGMA synchronous=OFF')
            database.execute("CREATE TABLE candidates (identity TEXT PRIMARY KEY, ordinal INTEGER, payload TEXT)")
            ordinal = 0
            for rule in rules:
                matched = 0
                for record in iter_rule_records(rule, nested_cache=cache):
                    matched += 1
                    identity = json.dumps([record.dataset_id, record.nested_archive,
                                           record.member or record.container])
                    payload = json.dumps(record.json(), ensure_ascii=False)
                    cursor = database.execute("INSERT OR IGNORE INTO candidates VALUES (?, ?, ?)",
                                              (identity, ordinal, payload))
                    if not cursor.rowcount:
                        duplicates[rule.dataset_id] += 1
                        if rule.duplicate_policy == "error":
                            raise ValueError(f"Duplicate source identity: {identity}; declare package precedence")
                        if rule.duplicate_policy == "last":
                            database.execute("UPDATE candidates SET payload=? WHERE identity=?", (payload, identity))
                    ordinal += 1
                if not matched and not rule.allow_empty:
                    raise ValueError(f"Enabled dataset rule matched zero images: {rule.dataset_id}")
                database.commit()
            next_index = 0
            for (payload,) in database.execute("SELECT payload FROM candidates ORDER BY ordinal"):
                row = json.loads(payload)
                row["source_index"] = next_index
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
                counts[row["dataset_id"]] += 1
                next_index += 1
            if inputs != source_snapshot(rules):
                raise RuntimeError("Source archives changed while inventory was being built")
            handle.flush(); os.fsync(handle.fileno())
        finally:
            database.close()
    os.replace(partial, output_path)
    excluded = [{"dataset_id": item["dataset_id"],
                 "reason": item.get("exclusion_reason", "disabled by catalog")}
                for item in raw["sources"] if not item.get("include_in_embedding", True)]
    return {"catalog_version": raw["version"], "inventory_id": str(uuid.uuid4()),
            "records": next_index, "source_files": inputs,
            "inventory_file": file_metadata(output_path),
            "datasets": counts, "duplicates_removed": duplicates, "excluded_sources": excluded}


def file_metadata(path: str | Path) -> dict:
    path = Path(path)
    stat = path.stat()
    return {"path": str(path.resolve()), "bytes": stat.st_size, "mtime_ns": stat.st_mtime_ns}


def source_snapshot(rules: list[SourceRule]) -> list[dict]:
    return [file_metadata(path) for path in sorted({p for rule in rules for p in rule.containers})]


class ImageReader:
    def __init__(self, cache_root: str | Path | None = None):
        self.cache = NestedZipCache(cache_root)
        self.archive_key: tuple[str, str | None] | None = None
        self.archive = None

    def _close_archive(self):
        if self.archive is not None:
            self.archive.close()
        self.archive_key = self.archive = None

    def _open_archive(self, record: ImageRecord):
        key = (record.container, record.nested_archive)
        if key == self.archive_key:
            return self.archive
        self._close_archive()
        archive_path = record.container
        if record.nested_archive:
            archive_path = str(self.cache.materialize(record.container, record.nested_archive))
        if Path(archive_path).suffix.lower() == ".zip":
            self.archive = zipfile.ZipFile(archive_path)
        else:
            self.archive = tarfile.open(archive_path, "r:*")
        self.archive_key = key
        return self.archive

    def read(self, record: ImageRecord) -> Image.Image:
        if not record.member:
            with Image.open(record.container) as source:
                # Annotation coordinates refer to encoded source pixels. Do not
                # silently rotate/mirror RGB without transforming its labels.
                return source.convert("RGB")
        archive = self._open_archive(record)
        if isinstance(archive, zipfile.ZipFile):
            payload = archive.open(record.member)
        else:
            payload = archive.extractfile(record.member)
            if payload is None:
                raise FileNotFoundError(record.source_uri)
        with payload:
            with Image.open(payload) as source:
                source.load()
                return source.convert("RGB")

    def close(self):
        self._close_archive()
        self.cache.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


def center_crop_resize(image: Image.Image, size: int = 512) -> tuple[Image.Image, dict]:
    width, height = image.size
    side = min(width, height)
    left, top = (width - side) // 2, (height - side) // 2
    crop = (left, top, left + side, top + side)
    output = image.crop(crop).resize((size, size), Image.Resampling.LANCZOS)
    return output, {"method": "center_crop_resize", "crop_box": list(crop),
                    "output_size": [size, size]}


def transform_metadata(source_size, projection, perspective_mode='center_crop', size=512):
    """Geometry-only CPU preparation; no RGB decode, crop or GPU is needed."""
    width, height = source_size
    if projection == 'equirectangular':
        if abs(width / height - 2.0) > 0.03:
            raise ValueError(f'Equirectangular source is not 2:1: {source_size}')
        return [{'method': 'equirectangular_to_perspective', 'view_index': i,
            'yaw_degrees': yaw, 'pitch_degrees': 0.0, 'fov_degrees': 45.0,
            'output_size': [size, size]} for i, yaw in enumerate(DEFAULT_YAWS)]
    if projection != 'perspective' or perspective_mode not in PERSPECTIVE_MODES:
        raise ValueError('Unsupported declared source geometry')
    if perspective_mode == 'horizontal_halves_if_2_to_1' and width == 2 * height:
        transforms = [{'method': 'horizontal_square_tile', 'tile': name, 'tile_index': i,
            'crop_box': [left, 0, left + height, height], 'output_size': [size, size]}
            for i, (name, left) in enumerate([('left', 0), ('right', height)])]
    else:
        side = min(width, height); left, top = (width-side)//2, (height-side)//2
        transforms = [{'method': 'center_crop_resize', 'crop_box': [left, top, left+side, top+side],
                       'output_size': [size, size]}]
    for i, item in enumerate(transforms):
        item.update(view_index=i, yaw_degrees=None, pitch_degrees=None, fov_degrees=None)
    return transforms


def horizontal_halves_if_2_to_1(image: Image.Image, size: int = 512):
    """Preserve both halves of an exact 2:1 perspective frame as two squares."""
    width, height = image.size
    if width != 2 * height:
        output, metadata = center_crop_resize(image, size)
        return [(output, metadata)]
    outputs = []
    for tile_index, (name, left) in enumerate((("left", 0), ("right", height))):
        crop = (left, 0, left + height, height)
        output = image.crop(crop).resize((size, size), Image.Resampling.LANCZOS)
        outputs.append((output, {"method": "horizontal_square_tile",
                                 "tile": name, "tile_index": tile_index,
                                 "crop_box": list(crop), "output_size": [size, size]}))
    return outputs


class EquirectangularProjector:
    """Deterministic CPU reference projector for QC and portable inference."""
    def __init__(self, size: int = 512, fov_degrees: float = 45.0,
                 yaws: Iterable[float] = DEFAULT_YAWS, pitch_degrees: float = 0.0):
        if size <= 0 or not 0 < fov_degrees < 180:
            raise ValueError("Invalid output geometry")
        self.size, self.fov = int(size), float(fov_degrees)
        self.yaws, self.pitch = tuple(float(value) for value in yaws), float(pitch_degrees)
        axis = np.linspace(-1.0, 1.0, self.size, dtype=np.float32)
        xx, yy = np.meshgrid(axis, axis)
        focal = 1.0 / math.tan(math.radians(self.fov) / 2.0)
        base = np.stack((xx, -yy, np.full_like(xx, focal)), axis=-1)
        base /= np.linalg.norm(base, axis=-1, keepdims=True)
        pitch = math.radians(self.pitch)
        cp, sp = math.cos(pitch), math.sin(pitch)
        self.base = base @ np.asarray([[1, 0, 0], [0, cp, -sp], [0, sp, cp]], dtype=np.float32).T

    @staticmethod
    def _bilinear(pixels: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
        height, width = pixels.shape[:2]
        u, v = np.mod(u, width), np.clip(v, 0, height - 1)
        x0, y0 = np.floor(u).astype(np.int32), np.floor(v).astype(np.int32)
        x1, y1 = (x0 + 1) % width, np.minimum(y0 + 1, height - 1)
        wx, wy = (u - x0)[..., None], (v - y0)[..., None]
        top = pixels[y0, x0] * (1 - wx) + pixels[y0, x1] * wx
        bottom = pixels[y1, x0] * (1 - wx) + pixels[y1, x1] * wx
        return np.clip(top * (1 - wy) + bottom * wy, 0, 255).astype(np.uint8)

    def project(self, image: Image.Image) -> list[tuple[Image.Image, dict]]:
        width, height = image.size
        if abs(width / height - 2.0) > 0.03:
            raise ValueError(f"Equirectangular rule received non-2:1 image {width}x{height}")
        pixels = np.asarray(image.convert("RGB"), dtype=np.float32)
        outputs = []
        for view_index, yaw in enumerate(self.yaws):
            angle = math.radians(yaw); c, s = math.cos(angle), math.sin(angle)
            rays = self.base @ np.asarray([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=np.float32).T
            longitude = np.arctan2(rays[..., 0], rays[..., 2])
            latitude = np.arcsin(np.clip(rays[..., 1], -1, 1))
            # Match NativeProjector's align_corners=True source coordinate.
            u = (longitude / (2 * math.pi) + 0.5) * (width - 1)
            v = (0.5 - latitude / math.pi) * (height - 1)
            output = Image.fromarray(self._bilinear(pixels, u, v), mode="RGB")
            outputs.append((output, {"method": "equirectangular_to_perspective",
                "view_index": view_index, "yaw_degrees": yaw, "pitch_degrees": self.pitch,
                "fov_degrees": self.fov, "output_size": [self.size, self.size]}))
        return outputs


def transform_image(image: Image.Image, projection: str, size: int = 512,
                    fov_degrees: float = 45.0,
                    yaws: Iterable[float] = DEFAULT_YAWS,
                    perspective_mode: str = "center_crop") -> list[tuple[Image.Image, dict]]:
    if projection == "perspective":
        if perspective_mode == "center_crop":
            output, metadata = center_crop_resize(image, size)
            outputs = [(output, metadata)]
        elif perspective_mode == "horizontal_halves_if_2_to_1":
            outputs = horizontal_halves_if_2_to_1(image, size)
        else:
            raise ValueError(f"Unsupported perspective mode {perspective_mode!r}")
        for view_index, (_, metadata) in enumerate(outputs):
            metadata.update(view_index=view_index, yaw_degrees=None,
                            pitch_degrees=None, fov_degrees=None)
        return outputs
    if projection == "equirectangular":
        return EquirectangularProjector(size, fov_degrees, yaws).project(image)
    raise ValueError(f"Unsupported projection {projection!r}")


def record_from_json(row: dict) -> ImageRecord:
    return ImageRecord(int(row["source_index"]), row["dataset_id"], row["projection"],
                       row["container"], row.get("member", ""), row.get("nested_archive"),
                       row.get("perspective_mode", "center_crop"),
                       row.get("validation_kind", "none"),
                       row.get("input_modality", "street_view"))
