from __future__ import annotations

import hashlib
import os
import sqlite3
import tarfile
import threading
import uuid
from dataclasses import dataclass, replace
from pathlib import Path

from .backend_config import BackendSettings
from .tile_index import safe_segment


IMG_EXTENSIONS = {".jpg", ".jpeg", ".png"}


@dataclass(frozen=True, slots=True)
class PanoTarRange:
    tar_id: str
    start: int | None
    end: int | None


@dataclass(frozen=True, slots=True)
class PanoIndexEntry:
    pano_id: str
    tar_id: str
    member_name: str
    offset_data: int
    byte_size: int


class PanoService:
    def __init__(self, settings: BackendSettings, dataset_id: str | None = None) -> None:
        self.settings = settings
        self.dataset_id = dataset_id
        self._ranges = parse_pano_tar_ranges(settings.pano_tar_ranges)
        self._index_ready = False
        self._lock = threading.RLock()

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

    def ensure_pano_image(self, pano_id: str) -> tuple[PanoIndexEntry, Path] | None:
        if not self.index_ready:
            self.warmup()
        if not self.index_ready:
            return None

        entry = self.lookup(pano_id)
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

    def lookup(self, pano_id: str) -> PanoIndexEntry | None:
        with sqlite3.connect(self.settings.pano_index_path) as conn:
            row = conn.execute(
                "SELECT pano_id, tar_id, member_name, offset_data, byte_size FROM panos WHERE pano_id = ?",
                (str(int(pano_id)),),
            ).fetchone()
        if row is None:
            return None
        return PanoIndexEntry(
            pano_id=str(row[0]),
            tar_id=str(row[1]),
            member_name=str(row[2]),
            offset_data=int(row[3]),
            byte_size=int(row[4]),
        )

    def image_path(self, entry: PanoIndexEntry) -> Path:
        suffix = Path(entry.member_name).suffix.lower()
        if suffix not in IMG_EXTENSIONS:
            suffix = ".jpg"
        return self.settings.pano_cache_root / safe_segment(entry.tar_id) / f"{safe_segment(entry.pano_id)}{suffix}"

    def image_url(self, pano_id: str) -> str:
        if self.dataset_id:
            route = f"/api/datasets/{safe_segment(self.dataset_id)}/panos/{safe_segment(pano_id)}/image"
        else:
            route = f"/api/panos/{safe_segment(pano_id)}/image"
        if not self.settings.public_base_url:
            return route
        return f"{self.settings.public_base_url.rstrip('/')}{route}"

    def _index_is_current(self) -> bool:
        path = self.settings.pano_index_path
        if not path.exists():
            return False
        try:
            with sqlite3.connect(path) as conn:
                conn.execute("SELECT 1 FROM panos LIMIT 1").fetchone()
                fingerprint = conn.execute("SELECT value FROM meta WHERE key = 'fingerprint'").fetchone()
                return fingerprint is not None and fingerprint[0] == self._fingerprint()
        except sqlite3.Error:
            return False

    def _build_index(self) -> int:
        index_path = self.settings.pano_index_path
        index_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = index_path.with_name(f"{index_path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
        if tmp_path.exists():
            tmp_path.unlink()

        row_count = 0
        with sqlite3.connect(tmp_path) as conn:
            conn.execute("PRAGMA journal_mode = OFF")
            conn.execute("PRAGMA synchronous = OFF")
            conn.execute(
                "CREATE TABLE panos ("
                "pano_id INTEGER PRIMARY KEY, "
                "tar_id TEXT NOT NULL, "
                "member_name TEXT NOT NULL, "
                "offset_data INTEGER NOT NULL, "
                "byte_size INTEGER NOT NULL)"
            )
            conn.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")

            batch = []
            for pano_range in self._ranges:
                tar_path = self._tar_path(pano_range.tar_id)
                if not tar_path.exists():
                    print(f"Pano index skipping missing tar {tar_path}", flush=True)
                    continue
                tar_started_count = row_count + len(batch)
                print(f"Pano index scanning {tar_path}", flush=True)
                with tarfile.open(tar_path, "r:") as tf:
                    for member in tf:
                        if not member.isfile():
                            continue
                        suffix = Path(member.name).suffix.lower()
                        if suffix not in IMG_EXTENSIONS:
                            continue
                        pano_id = pano_id_from_member_name(member.name)
                        if pano_id is None or not pano_range_contains(pano_range, pano_id):
                            continue
                        batch.append((pano_id, pano_range.tar_id, member.name, int(member.offset_data), int(member.size)))
                        if len(batch) >= 5000:
                            conn.executemany("INSERT OR REPLACE INTO panos VALUES (?, ?, ?, ?, ?)", batch)
                            row_count += len(batch)
                            batch.clear()
                print(f"Pano index scanned {tar_path}: {row_count + len(batch) - tar_started_count} rows", flush=True)
            if batch:
                conn.executemany("INSERT OR REPLACE INTO panos VALUES (?, ?, ?, ?, ?)", batch)
                row_count += len(batch)

            conn.execute("INSERT OR REPLACE INTO meta VALUES ('fingerprint', ?)", (self._fingerprint(),))
            conn.execute("INSERT OR REPLACE INTO meta VALUES ('ranges', ?)", (self.settings.pano_tar_ranges,))
            conn.commit()

        tmp_path.replace(index_path)
        return row_count

    def _fingerprint(self) -> str:
        digest = hashlib.blake2b(digest_size=16)
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
        return set(dict.fromkeys((*self.settings.default_dataset_ids, self.settings.default_dataset_id)))

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
        for dataset_id in self.allowed_dataset_ids():
            suffix = dataset_env_suffix(dataset_id)
            if dataset_id != self.settings.default_dataset_id and not pano_tar_ranges_for_dataset(self.settings, dataset_id):
                timings[f"{dataset_id}:pano_index_status"] = "not_configured"
                continue
            result = self.service_for(dataset_id).warmup()
            timings.update({f"{dataset_id}:{key}": value for key, value in result.items()})
        return timings


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
    suffix = dataset_env_suffix(dataset_id)
    configured = os.getenv(f"PANO_TAR_RANGES_{suffix}")
    if configured:
        return configured
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
    stem = Path(name).stem
    raw = stem.replace(",", "_").split("_", 1)[0]
    try:
        return int(raw)
    except ValueError:
        return None


def pano_range_contains(pano_range: PanoTarRange, pano_id: int) -> bool:
    if pano_range.start is not None and pano_id < pano_range.start:
        return False
    return pano_range.end is None or pano_id <= pano_range.end
