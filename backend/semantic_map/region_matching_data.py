"""Read-only native embedding shards and complete geographic membership."""
from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Callable

import numpy as np

from .dataset_loader import shard_index_from_name


@dataclass(frozen=True)
class DatasetSpec:
    city: str
    metric_crs: str
    signature: str = "qwen8b-native512-8views-fov45-20260915"


DEFAULT_DATASETS = {
    "rome_512_8_45_8B": DatasetSpec("rome", "EPSG:32633"),
    "london_512_8_45_8B": DatasetSpec("london", "EPSG:32630"),
    "shanghai_512_8_45_8B": DatasetSpec("shanghai", "EPSG:32651"),
    "new_york_512_8_45_8B": DatasetSpec("new_york", "EPSG:32618"),
}


def spatial_weights(xy, cell_m):
    if not np.isfinite(cell_m) or cell_m <= 0:
        raise ValueError("Spatial cell size must be positive")
    cells = np.floor(np.asarray(xy) / cell_m).astype(np.int64)
    unique, labels, counts = np.unique(cells, axis=0, return_inverse=True, return_counts=True)
    if not len(unique):
        raise ValueError("No occupied spatial cells")
    weights = 1.0 / (len(unique) * counts[labels])
    return weights, labels, len(unique)


def validate_geometry(raw, maximum_vertices=10_000):
    from shapely.geometry import shape
    if raw.get("type") not in {"Polygon", "MultiPolygon"}:
        raise ValueError("Source geometry must be a Polygon or MultiPolygon")
    geometry = shape(raw)
    if geometry.is_empty or not geometry.is_valid:
        raise ValueError("Source polygon is empty or invalid")
    polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
    coordinates = []
    for polygon in polygons:
        coordinates.extend(polygon.exterior.coords)
        for ring in polygon.interiors:
            coordinates.extend(ring.coords)
    points = np.asarray(coordinates)
    if points.ndim != 2 or points.shape[1] != 2 or len(points) > maximum_vertices:
        raise ValueError("Use a bounded two-dimensional longitude/latitude polygon")
    if not np.isfinite(points).all() or np.any(np.abs(points[:, 0]) > 180) or np.any(np.abs(points[:, 1]) > 90):
        raise ValueError("Polygon coordinates are outside WGS84")
    if np.ptp(points[:, 0]) > 180:
        raise ValueError("Antimeridian-crossing polygons are not supported")
    return geometry


@dataclass
class Shard:
    embedding: Path
    reference: Path
    identity: Path
    start: int
    end: int
    shape: tuple[int, int, int]


class RegionDataset:
    def __init__(self, root: Path, dataset_id: str, spec: DatasetSpec):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", dataset_id):
            raise ValueError("Invalid dataset identifier")
        self.root = Path(root).resolve()
        self.directory = (self.root / dataset_id).resolve()
        if not self.directory.is_relative_to(self.root):
            raise ValueError("Dataset path escapes embedding root")
        self.dataset_id, self.spec = dataset_id, spec
        self.shards: list[Shard] = []
        refs, sequences, namespaces = [], [], []
        self._files = []
        offset = 0
        paths = sorted((p for p in self.directory.glob("views_emb_shard_*.npy")
                        if re.fullmatch(r"views_emb_shard_\d+", p.stem)), key=shard_index_from_name)
        if not paths:
            raise FileNotFoundError(f"No native view shards for {dataset_id}")
        for path in paths:
            reference = path.with_name(path.stem + "_ref.npy")
            identity = path.with_name(path.stem + "_identity.jsonl")
            for file in (path, reference, identity):
                if not file.resolve().is_relative_to(self.root):
                    raise ValueError("Shard path escapes embedding root")
                stat = file.stat()
                self._files.append({"path": str(file.relative_to(self.root)),
                                    "size": stat.st_size, "mtime_ns": stat.st_mtime_ns})
            array = np.load(path, mmap_mode="r", allow_pickle=False)
            ref = np.load(reference, mmap_mode="r", allow_pickle=False)
            if array.ndim != 3 or array.dtype != np.float16 or not len(array):
                raise ValueError(f"Invalid native FP16 shard: {path.name}")
            if ref.ndim != 2 or len(ref) != len(array) or ref.shape[1] < 4:
                raise ValueError(f"Reference alignment mismatch: {reference.name}")
            if not np.isfinite(ref[:, :4]).all():
                raise ValueError(f"Nonfinite reference identity: {reference.name}")
            if np.any(np.abs(ref[:, 1]) > 180) or np.any(np.abs(ref[:, 2]) > 90):
                raise ValueError("Reference coordinates outside WGS84")
            if self.shards and array.shape[1:] != self.shards[0].shape[1:]:
                raise ValueError("Embedding view dimensions differ between shards")
            count = 0
            with identity.open(encoding="utf-8") as handle:
                for line in handle:
                    item = json.loads(line)
                    if count >= len(ref):
                        raise ValueError("Too many identity records")
                    r = ref[count]
                    if (str(int(r[0])) != str(item["pano_id"])
                            or abs(float(r[1]) - float(item["lon"])) > 1e-5
                            or abs(float(r[2]) - float(item["lat"])) > 1e-5
                            or int(r[3]) != int(item["capture_date"])):
                        raise ValueError("Identity sidecar disagrees with reference row")
                    sequences.append(int(item["seq"]))
                    namespaces.append(str(item["namespace"]))
                    count += 1
            if count != len(ref):
                raise ValueError("Identity sidecar row count mismatch")
            shape = tuple(int(v) for v in array.shape)
            self.shards.append(Shard(path, reference, identity, offset, offset + len(array), shape))
            refs.append(np.array(ref[:, :4], dtype=np.float64))
            offset += len(array)
            del array, ref
        self.refs = np.concatenate(refs)
        self.sequences = np.asarray(sequences, dtype=np.int64)
        self.namespaces = np.asarray(namespaces, dtype=str)
        self.count = offset
        self.view_count, self.view_dimension = self.shards[0].shape[1:]
        if len(np.unique(self.sequences)) != self.count:
            raise ValueError("Duplicate committed source sequence identities")
        self.assert_unchanged()

    def snapshot(self):
        return {"dataset_id": self.dataset_id, "signature": self.spec.signature,
                "view_count": self.view_count, "view_dimension": self.view_dimension,
                "count": self.count, "files": self._files}

    def assert_unchanged(self):
        current = sorted(str(p.relative_to(self.root)) for p in self.directory.glob("views_emb_shard_*.npy")
                         if re.fullmatch(r"views_emb_shard_\d+", p.stem))
        original = sorted(item["path"] for item in self._files if item["path"].endswith(".npy")
                          and not item["path"].endswith("_ref.npy"))
        if current != original:
            raise ValueError("Dataset shard list changed during job")
        for item in self._files:
            stat = (self.root / item["path"]).stat()
            if stat.st_size != item["size"] or stat.st_mtime_ns != item["mtime_ns"]:
                raise ValueError("Dataset changed during job; create a new model")

    def dated_rows(self, date_range=None):
        rows = np.arange(self.count, dtype=np.int64)
        if date_range is not None:
            months = np.asarray([int(str(int(d))[:6]) for d in self.refs[:, 3]], dtype=np.int64)
            rows = rows[(months >= int(date_range[0])) & (months <= int(date_range[1]))]
        return rows

    def polygon_rows(self, raw_geometry, date_range=None):
        import shapely
        geometry = validate_geometry(raw_geometry)
        rows = self.dated_rows(date_range)
        coords = self.refs[rows, 1:3]
        west, south, east, north = geometry.bounds
        mask = ((coords[:, 0] >= west) & (coords[:, 0] <= east)
                & (coords[:, 1] >= south) & (coords[:, 1] <= north))
        rows = rows[mask]
        return rows[shapely.covers(geometry, shapely.points(self.refs[rows, 1:3]))]

    def xy(self, rows):
        from pyproj import Transformer
        transformer = Transformer.from_crs("EPSG:4326", self.spec.metric_crs, always_xy=True)
        x, y = transformer.transform(self.refs[rows, 1], self.refs[rows, 2])
        result = np.column_stack((x, y))
        if not np.isfinite(result).all():
            raise ValueError("Coordinates cannot be projected into the city's metric CRS")
        return result

    def polygon_area(self, raw_geometry):
        from pyproj import Transformer
        from shapely.ops import transform
        geometry = validate_geometry(raw_geometry)
        transformer = Transformer.from_crs("EPSG:4326", self.spec.metric_crs, always_xy=True)
        projected = transform(transformer.transform, geometry)
        if not np.isfinite(projected.area) or projected.area <= 0:
            raise ValueError("Source polygon has invalid metric area")
        return float(projected.area)

    def iter_views(self, rows, block_size=512):
        rows = np.asarray(rows, dtype=np.int64)
        if len(rows) and (rows[0] < 0 or rows[-1] >= self.count or np.any(np.diff(rows) <= 0)):
            raise ValueError("Global rows must be unique, sorted, and within dataset bounds")
        for shard in self.shards:
            lo, hi = np.searchsorted(rows, (shard.start, shard.end))
            if lo == hi:
                continue
            array = np.load(shard.embedding, mmap_mode="r", allow_pickle=False)
            for start in range(int(lo), int(hi), block_size):
                stop = min(start + block_size, int(hi))
                local = rows[start:stop] - shard.start
                yield slice(start, stop), np.asarray(array[local])
            del array

    def valid_rows(self, rows, views, block_size=512, check: Callable = lambda: None):
        rows = np.asarray(rows, dtype=np.int64)
        valid, exclusions = [], []
        for positions, block in self.iter_views(rows, block_size):
            check()
            selected = block[:, views, :].astype(np.float32)
            good = (np.isfinite(selected).all(axis=(1, 2))
                    & (np.sum(selected ** 2, axis=2) > 1e-12).all(axis=1))
            valid.extend(rows[positions][good].tolist())
            exclusions.extend({"global_row": int(row), "reason": "nonfinite_or_zero_view"}
                              for row in rows[positions][~good])
        return np.asarray(valid, dtype=np.int64), exclusions

    def identity(self, row):
        ref = self.refs[row]
        return {"dataset_id": self.dataset_id, "global_row": int(row), "source_seq": int(self.sequences[row]),
                "namespace": str(self.namespaces[row]), "pano_id": str(int(ref[0])),
                "lon": float(ref[1]), "lat": float(ref[2]), "capture_date": int(ref[3])}


class AlignedMatrix:
    def __init__(self, dataset: RegionDataset, rows, views, block_size=512, check: Callable = lambda: None):
        self.dataset, self.rows = dataset, np.asarray(rows, dtype=np.int64)
        self.views, self.block_size, self.check = tuple(views), block_size, check
        if not self.views or len(set(self.views)) != len(self.views):
            raise ValueError("Select unique ordered view slots")
        if min(self.views) < 0 or max(self.views) >= dataset.view_count:
            raise ValueError("Selected view slot is unavailable")
        self.count = len(self.rows)
        self.dimension = len(self.views) * dataset.view_dimension

    def blocks(self):
        for positions, views in self.dataset.iter_views(self.rows, self.block_size):
            self.check()
            block = views[:, self.views, :].astype(np.float32).reshape(len(views), -1)
            yield positions, block / np.sqrt(len(self.views))
