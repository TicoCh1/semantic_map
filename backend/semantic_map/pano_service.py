from __future__ import annotations

import hashlib
import math
import os
import re
import sqlite3
import tarfile
import threading
import uuid
from contextlib import closing
from dataclasses import dataclass, replace
from pathlib import Path
from urllib.parse import urlencode

from .backend_config import BackendSettings
from .tile_index import safe_segment


IMG_EXTENSIONS = {".jpg", ".jpeg", ".png"}
PANO_INDEX_SCHEMA_VERSION = "3"
PANO_COORDINATE_MATCH_MAX_METERS = 5.0
PANO_COORDINATE_TIE_METERS = 0.5
NEW_YORK_SCORING_DATASET_ID = "new_york_224_8_45"
NEW_YORK_MANHATTAN_PANO_DATASET_ID = "new_york_manhattan_224_8_45"
NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID = "new_york_outside_manhattan_224_8_45"
_CHUNK_SUFFIX = re.compile(r"_chunk_\d+$", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class PanoTarRange:
    tar_id: str
    start: int | None
    end: int | None


@dataclass(frozen=True, slots=True)
class PanoIndexEntry:
    entry_key: str
    source_id: str
    pano_id: str
    tar_id: str
    member_name: str
    lon: float | None
    lat: float | None
    capture_date: int | None
    offset_data: int
    byte_size: int


@dataclass(frozen=True, slots=True)
class PanoMemberIdentity:
    pano_id: int
    lon: float | None
    lat: float | None
    capture_date: int | None


class AmbiguousPanoIdError(LookupError):
    pass


class PanoCoordinateMismatchError(LookupError):
    pass


class PanoService:
    def __init__(self, settings: BackendSettings, dataset_id: str | None = None) -> None:
        self.settings = settings
        self.dataset_id = dataset_id
        self._ranges = parse_pano_tar_ranges(settings.pano_tar_ranges)
        self._index_ready = False
        self._lock = threading.RLock()
        self._index_connection: sqlite3.Connection | None = None
        self._index_connection_lock = threading.RLock()

    @property
    def index_ready(self) -> bool:
        return self._index_ready and self.settings.pano_index_path.exists()

    def warmup(self) -> dict[str, float | int | str]:
        import time

        with self._lock:
            started = time.perf_counter()
            if not self.settings.pano_tar_dir.exists():
                return {"pano_index_status": "tar_dir_missing"}

            if self._index_is_current():
                self._index_ready = True
                return {"pano_index_status": "cached", "pano_index_warmup": round(time.perf_counter() - started, 3)}

            row_count = self._build_index()
            self._index_ready = True
            return {
                "pano_index_status": "built",
                "pano_index_rows": row_count,
                "pano_index_warmup": round(time.perf_counter() - started, 3),
            }

    def ensure_pano_image(
        self,
        pano_id: str,
        *,
        lon: float | None = None,
        lat: float | None = None,
        capture_date: int | None = None,
        entry_key: str | None = None,
    ) -> tuple[PanoIndexEntry, Path] | None:
        if not self.index_ready:
            self.warmup()
        if not self.index_ready:
            return None

        entry = self.lookup(
            pano_id,
            lon=lon,
            lat=lat,
            capture_date=capture_date,
            entry_key=entry_key,
        )
        if entry is None:
            return None

        image_path = self.image_path(entry)
        if image_path.exists():
            return entry, image_path

        with self._lock:
            if image_path.exists():
                return entry, image_path
            image_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = image_path.with_name(f"{image_path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
            tar_path = self._tar_path(entry.tar_id)
            with tar_path.open("rb") as src:
                src.seek(entry.offset_data)
                data = src.read(entry.byte_size)
            if len(data) != entry.byte_size:
                raise RuntimeError(f"Short read for pano {pano_id}: expected {entry.byte_size}, got {len(data)}")
            tmp_path.write_bytes(data)
            tmp_path.replace(image_path)
        return entry, image_path

    def lookup(
        self,
        pano_id: str,
        *,
        lon: float | None = None,
        lat: float | None = None,
        capture_date: int | None = None,
        entry_key: str | None = None,
    ) -> PanoIndexEntry | None:
        numeric_pano_id = int(pano_id)
        if (lon is None) != (lat is None):
            raise ValueError("Both lon and lat are required when selecting a panorama by location")

        columns = (
            "entry_key, pano_id, tar_id, member_name, "
            "lon, lat, capture_date, offset_data, byte_size"
        )
        clauses = ["pano_id = ?"]
        params: list[str | int] = [numeric_pano_id]
        if entry_key is not None:
            clauses.append("entry_key = ?")
            params.append(entry_key)
        with self._index_connection_lock:
            conn = self._read_index_connection()
            rows = conn.execute(
                f"SELECT {columns} FROM panos WHERE {' AND '.join(clauses)} "
                "ORDER BY tar_id, member_name",
                params,
            ).fetchall()
        if not rows:
            return None
        candidates = [pano_index_entry_from_row(row) for row in rows]

        if entry_key is not None:
            if len(candidates) != 1:
                raise AmbiguousPanoIdError(f"Panorama entry key {entry_key!r} is not unique")
            return candidates[0]

        if capture_date is not None:
            date_matches = [entry for entry in candidates if entry.capture_date == capture_date]
            if date_matches:
                candidates = date_matches

        if lon is not None and lat is not None:
            located = [entry for entry in candidates if entry.lon is not None and entry.lat is not None]
            if not located:
                raise PanoCoordinateMismatchError(
                    f"Panorama {numeric_pano_id} has no indexed coordinates for location matching"
                )
            ranked = sorted(
                (
                    (pano_coordinate_distance_m(lon, lat, float(entry.lon), float(entry.lat)), entry)
                    for entry in located
                ),
                key=lambda item: (item[0], item[1].source_id, item[1].entry_key),
            )
            nearest_distance, nearest = ranked[0]
            if nearest_distance > PANO_COORDINATE_MATCH_MAX_METERS:
                raise PanoCoordinateMismatchError(
                    f"Panorama {numeric_pano_id} nearest indexed image is {nearest_distance:.1f} m from the map point"
                )
            if len(ranked) > 1 and abs(ranked[1][0] - nearest_distance) <= PANO_COORDINATE_TIE_METERS:
                raise AmbiguousPanoIdError(
                    f"Panorama {numeric_pano_id} has multiple images at the requested location; source_id is required"
                )
            return nearest

        if len(candidates) == 1:
            return candidates[0]
        sources = ", ".join(sorted({entry.source_id for entry in candidates}))
        raise AmbiguousPanoIdError(
            f"Panorama {numeric_pano_id} exists in multiple source mappings ({sources}); lon and lat are required"
        )

    def image_path(self, entry: PanoIndexEntry) -> Path:
        suffix = Path(entry.member_name).suffix.lower()
        if suffix not in IMG_EXTENSIONS:
            suffix = ".jpg"
        return (
            self.settings.pano_cache_root
            / safe_segment(entry.source_id)
            / safe_segment(entry.tar_id)
            / f"{safe_segment(entry.pano_id)}-{entry.entry_key}{suffix}"
        )

    def image_url(self, entry: PanoIndexEntry) -> str:
        if self.dataset_id:
            route = f"/api/datasets/{safe_segment(self.dataset_id)}/panos/{safe_segment(entry.pano_id)}/image"
        else:
            route = f"/api/panos/{safe_segment(entry.pano_id)}/image"
        route = f"{route}?{urlencode({'entry_key': entry.entry_key})}"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"

    def _index_is_current(self) -> bool:
        path = self.settings.pano_index_path
        if not path.exists():
            return False
        try:
            with closing(sqlite3.connect(path)) as conn:
                conn.execute("SELECT 1 FROM panos LIMIT 1").fetchone()
                fingerprint = conn.execute("SELECT value FROM meta WHERE key = 'fingerprint'").fetchone()
                schema_version = conn.execute("SELECT value FROM meta WHERE key = 'schema_version'").fetchone()
                return (
                    schema_version is not None
                    and schema_version[0] == PANO_INDEX_SCHEMA_VERSION
                    and fingerprint is not None
                    and fingerprint[0] == self._fingerprint()
                )
        except sqlite3.Error:
            return False

    def _build_index(self) -> int:
        self._close_index_connection()
        index_path = self.settings.pano_index_path
        index_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = index_path.with_name(f"{index_path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
        if tmp_path.exists():
            tmp_path.unlink()

        row_count = 0
        with closing(sqlite3.connect(tmp_path)) as conn:
            conn.execute("PRAGMA journal_mode = OFF")
            conn.execute("PRAGMA synchronous = OFF")
            conn.execute(
                "CREATE TABLE panos ("
                "entry_key TEXT PRIMARY KEY, "
                "pano_id INTEGER NOT NULL, "
                "tar_id TEXT NOT NULL, "
                "member_name TEXT NOT NULL, "
                "lon REAL, "
                "lat REAL, "
                "capture_date INTEGER, "
                "offset_data INTEGER NOT NULL, "
                "byte_size INTEGER NOT NULL, "
                "UNIQUE (tar_id, member_name)) WITHOUT ROWID"
            )
            conn.execute("CREATE INDEX panos_pano_idx ON panos (pano_id)")
            conn.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")

            batch = []
            for pano_range in self._ranges:
                tar_path = self._tar_path(pano_range.tar_id)
                if not tar_path.exists():
                    print(f"Pano index skipping missing tar {tar_path}", flush=True)
                    continue
                tar_started_count = row_count + len(batch)
                print(f"Pano index scanning {tar_path}", flush=True)
                tar_stat = tar_path.stat()
                with tarfile.open(tar_path, "r:") as tf:
                    for member in tf:
                        if not member.isfile():
                            continue
                        suffix = Path(member.name).suffix.lower()
                        if suffix not in IMG_EXTENSIONS:
                            continue
                        identity = pano_member_identity_from_name(member.name)
                        if identity is None or not pano_range_contains(pano_range, identity.pano_id):
                            continue
                        entry_key = pano_entry_key(
                            pano_range.tar_id,
                            member.name,
                            offset_data=int(member.offset_data),
                            byte_size=int(member.size),
                            tar_size=int(tar_stat.st_size),
                            tar_mtime_ns=int(tar_stat.st_mtime_ns),
                        )
                        batch.append(
                            (
                                entry_key,
                                identity.pano_id,
                                pano_range.tar_id,
                                member.name,
                                identity.lon,
                                identity.lat,
                                identity.capture_date,
                                int(member.offset_data),
                                int(member.size),
                            )
                        )
                        if len(batch) >= 5000:
                            conn.executemany("INSERT INTO panos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
                            row_count += len(batch)
                            batch.clear()
                print(f"Pano index scanned {tar_path}: {row_count + len(batch) - tar_started_count} rows", flush=True)
            if batch:
                conn.executemany("INSERT INTO panos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", batch)
                row_count += len(batch)

            conn.execute("INSERT OR REPLACE INTO meta VALUES ('fingerprint', ?)", (self._fingerprint(),))
            conn.execute("INSERT OR REPLACE INTO meta VALUES ('ranges', ?)", (self.settings.pano_tar_ranges,))
            conn.execute("INSERT OR REPLACE INTO meta VALUES ('schema_version', ?)", (PANO_INDEX_SCHEMA_VERSION,))
            conn.commit()

        tmp_path.replace(index_path)
        return row_count

    def close(self) -> None:
        self._close_index_connection()

    def _read_index_connection(self) -> sqlite3.Connection:
        if self._index_connection is None:
            uri = f"{self.settings.pano_index_path.resolve().as_uri()}?mode=ro&immutable=1"
            self._index_connection = sqlite3.connect(uri, uri=True, check_same_thread=False)
            self._index_connection.execute("PRAGMA query_only = ON")
        return self._index_connection

    def _close_index_connection(self) -> None:
        with self._index_connection_lock:
            if self._index_connection is not None:
                self._index_connection.close()
                self._index_connection = None

    def _fingerprint(self) -> str:
        digest = hashlib.blake2b(digest_size=16)
        digest.update(PANO_INDEX_SCHEMA_VERSION.encode("ascii"))
        digest.update(b"\n")
        digest.update(self.settings.pano_tar_ranges.encode("utf-8"))
        for pano_range in self._ranges:
            tar_path = self._tar_path(pano_range.tar_id)
            digest.update(pano_range.tar_id.encode("utf-8"))
            digest.update(b"\x1f")
            if tar_path.exists():
                stat = tar_path.stat()
                digest.update(str(stat.st_size).encode("ascii"))
                digest.update(b"\x1f")
                digest.update(str(stat.st_mtime_ns).encode("ascii"))
            else:
                digest.update(b"missing")
            digest.update(b"\n")
        return digest.hexdigest()

    def _tar_path(self, tar_id: str) -> Path:
        path = Path(tar_id)
        if path.suffix.lower() == ".tar":
            return path if path.is_absolute() else self.settings.pano_tar_dir / path
        return self.settings.pano_tar_dir / f"{tar_id}.tar"


class PanoServiceRegistry:
    def __init__(self, settings: BackendSettings) -> None:
        self.settings = settings
        self._services: dict[str | None, PanoService] = {}
        self._lock = threading.RLock()

    def allowed_dataset_ids(self) -> set[str]:
        dataset_ids = set(dict.fromkeys((*self.settings.default_dataset_ids, self.settings.default_dataset_id)))
        if NEW_YORK_SCORING_DATASET_ID in dataset_ids:
            dataset_ids.update(
                {
                    NEW_YORK_MANHATTAN_PANO_DATASET_ID,
                    NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID,
                }
            )
        return dataset_ids

    def service_for(self, dataset_id: str | None = None) -> PanoService:
        if dataset_id is not None and dataset_id not in self.allowed_dataset_ids():
            allowed = ", ".join(sorted(self.allowed_dataset_ids()))
            raise ValueError(f"Unsupported dataset id {dataset_id!r}; allowed dataset ids: {allowed}")

        key = dataset_id
        with self._lock:
            service = self._services.get(key)
            if service is not None:
                return service
            service = PanoService(pano_settings_for_dataset(self.settings, dataset_id), dataset_id=dataset_id)
            self._services[key] = service
            return service

    def warmup(self) -> dict[str, float | int | str]:
        timings: dict[str, float | int | str] = {}
        for dataset_id in sorted(self.allowed_dataset_ids()):
            if not pano_tar_ranges_for_dataset(self.settings, dataset_id):
                timings[f"{dataset_id}:pano_index_status"] = "not_configured"
                continue
            result = self.service_for(dataset_id).warmup()
            timings.update({f"{dataset_id}:{key}": value for key, value in result.items()})
        return timings

    def close(self) -> None:
        with self._lock:
            services = tuple(self._services.values())
            self._services.clear()
        for service in services:
            service.close()


def pano_settings_for_dataset(settings: BackendSettings, dataset_id: str | None) -> BackendSettings:
    if dataset_id is None:
        return settings
    suffix = dataset_env_suffix(dataset_id)
    is_default_dataset = dataset_id == settings.default_dataset_id
    default_index_path = settings.pano_index_path if is_default_dataset else settings.pano_index_path.parent / safe_segment(dataset_id) / "pano_index.sqlite"
    default_cache_root = settings.pano_cache_root if is_default_dataset else settings.pano_cache_root / safe_segment(dataset_id)
    tar_ranges = pano_tar_ranges_for_dataset(settings, dataset_id)
    if not tar_ranges:
        raise ValueError(f"Pano tar ranges are not configured for dataset {dataset_id!r}. Set PANO_TAR_RANGES_{suffix}.")
    return replace(
        settings,
        pano_tar_dir=Path(os.getenv(f"PANO_TAR_DIR_{suffix}", str(settings.pano_tar_dir))).expanduser(),
        pano_cache_root=Path(os.getenv(f"PANO_CACHE_ROOT_{suffix}", str(default_cache_root))).expanduser(),
        pano_index_path=Path(os.getenv(f"PANO_INDEX_PATH_{suffix}", str(default_index_path))).expanduser(),
        pano_tar_ranges=tar_ranges,
    )


def dataset_env_suffix(dataset_id: str) -> str:
    return "".join(char if char.isalnum() else "_" for char in dataset_id.upper())


def pano_tar_ranges_for_dataset(settings: BackendSettings, dataset_id: str) -> str:
    # New York scoring combines two embedding sets, but street-view archives use
    # separate dataset namespaces so overlapping numeric pano IDs can never
    # overwrite one another in SQLite.
    if dataset_id == NEW_YORK_SCORING_DATASET_ID:
        return ""
    suffix = dataset_env_suffix(dataset_id)
    configured = os.getenv(f"PANO_TAR_RANGES_{suffix}")
    if configured:
        return configured
    if dataset_id == NEW_YORK_MANHATTAN_PANO_DATASET_ID:
        return ",".join(f"New_York_Manhattan_chunk_{chunk}.tar" for chunk in range(5))
    if dataset_id == NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID:
        return ",".join(f"New_York_Option_A_outside_Manhattan_chunk_{chunk}.tar" for chunk in range(5))
    if dataset_id == settings.default_dataset_id:
        return settings.pano_tar_ranges
    if dataset_id == "shanghai_224_8_45_2B":
        return "shanghai_rootless"
    return ""


def parse_pano_tar_ranges(raw: str) -> tuple[PanoTarRange, ...]:
    ranges: list[PanoTarRange] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        parts = item.split(":")
        if len(parts) == 1:
            ranges.append(PanoTarRange(tar_id=parts[0], start=None, end=None))
            continue
        if len(parts) != 3:
            raise ValueError(f"Invalid pano tar range {item!r}; expected tar_id or tar_id:start:end")
        tar_id, start, end = parts
        ranges.append(PanoTarRange(tar_id=tar_id, start=int(start) if start else None, end=int(end) if end else None))
    if not ranges:
        raise ValueError("At least one pano tar range must be configured")
    return tuple(ranges)


def pano_id_from_member_name(name: str) -> int | None:
    identity = pano_member_identity_from_name(name)
    return identity.pano_id if identity is not None else None


def pano_member_identity_from_name(name: str) -> PanoMemberIdentity | None:
    stem = Path(name).stem
    parts = stem.replace(",", "_").split("_")
    try:
        pano_id = int(parts[0])
    except ValueError:
        return None
    if len(parts) < 4:
        return PanoMemberIdentity(pano_id=pano_id, lon=None, lat=None, capture_date=None)
    try:
        return PanoMemberIdentity(
            pano_id=pano_id,
            lon=float(parts[1]),
            lat=float(parts[2]),
            capture_date=int(parts[3]),
        )
    except ValueError:
        return PanoMemberIdentity(pano_id=pano_id, lon=None, lat=None, capture_date=None)


def pano_source_id_from_tar_id(tar_id: str) -> str:
    stem = Path(tar_id).stem
    source = _CHUNK_SUFFIX.sub("", stem).lower()
    return safe_segment(source)


def pano_entry_key(
    tar_id: str,
    member_name: str,
    *,
    offset_data: int,
    byte_size: int,
    tar_size: int,
    tar_mtime_ns: int,
) -> str:
    digest = hashlib.blake2b(digest_size=12)
    for value in (tar_id, member_name, offset_data, byte_size, tar_size, tar_mtime_ns):
        digest.update(str(value).encode("utf-8"))
        digest.update(b"\x1f")
    return digest.hexdigest()


def pano_index_entry_from_row(row: tuple[object, ...]) -> PanoIndexEntry:
    return PanoIndexEntry(
        entry_key=str(row[0]),
        source_id=pano_source_id_from_tar_id(str(row[2])),
        pano_id=str(row[1]),
        tar_id=str(row[2]),
        member_name=str(row[3]),
        lon=float(row[4]) if row[4] is not None else None,
        lat=float(row[5]) if row[5] is not None else None,
        capture_date=int(row[6]) if row[6] is not None else None,
        offset_data=int(row[7]),
        byte_size=int(row[8]),
    )


def pano_coordinate_distance_m(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> float:
    mean_latitude = math.radians((lat_a + lat_b) / 2.0)
    delta_lon_m = (lon_a - lon_b) * math.cos(mean_latitude) * 111_320.0
    delta_lat_m = (lat_a - lat_b) * 110_540.0
    return math.hypot(delta_lon_m, delta_lat_m)


def pano_range_contains(pano_range: PanoTarRange, pano_id: int) -> bool:
    if pano_range.start is not None and pano_id < pano_range.start:
        return False
    return pano_range.end is None or pano_id <= pano_range.end
