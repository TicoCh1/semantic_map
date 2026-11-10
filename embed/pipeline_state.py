"""Input inventory and crash-consistent outputs for the panorama rerun.

Importing this module never loads a model. All writes belong to a new run root;
source archives and existing datasets are opened read-only.
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import struct
import tarfile
import uuid
import time
import zipfile
from contextlib import contextmanager

import numpy as np


DATASETS = {
    "london": "london_512_8_45_8B",
    "shanghai": "shanghai_512_8_45_8B",
    "new_york": "new_york_512_8_45_8B",
    "rome": "rome_512_8_45_8B",
}
EXPECTED_COUNTS = {"london": 156895, "shanghai": 173622, "new_york": 138911, "rome": 131879}


def parse_identity(name):
    """Both ID_lon_lat_date and Shanghai's ID_lon,lat_date are supported."""
    stem = PurePosixPath(name).stem
    parts = stem.split("_")
    if len(parts) >= 3 and "," in parts[1]:
        lon, lat = parts[1].split(",")
        parts = [parts[0], lon, lat, *parts[2:]]
    if len(parts) < 4 or not re.fullmatch(r"\d+", parts[0]):
        raise ValueError(f"Cannot parse panorama identity: {name!r}")
    pano_id, lon, lat, date = int(parts[0]), float(parts[1]), float(parts[2]), int(parts[3])
    if not (-180 <= lon <= 180 and -90 <= lat <= 90) or pano_id > 2**53:
        raise ValueError(f"Invalid panorama identity: {name!r}")
    heading = None
    for token in parts[4:]:
        if token.lower().startswith("heading"):
            heading = float(token[7:])
            if not math.isfinite(heading):
                raise ValueError(f"Invalid heading: {name!r}")
    return pano_id, lon, lat, date, heading


def ref_key(pano_id, lon, lat, date):
    # The supplied QGIS/legacy references contain FP32 coordinates. Compare at
    # that representation, but retain full source precision in new references.
    fp32 = lambda value: struct.unpack("<f", struct.pack("<f", float(value)))[0]
    return int(pano_id), fp32(lon), fp32(lat), int(date)


def read_selection(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["id", "lon", "lat", "date"]:
            raise ValueError("London CSV must contain exactly id,lon,lat,date")
        keys = [ref_key(row["id"], row["lon"], row["lat"], row["date"]) for row in reader]
    if not keys or len(set(keys)) != len(keys):
        raise ValueError("London CSV is empty or has duplicate identities")
    return set(keys)


def source_specs(pano_root, cities):
    root = Path(pano_root).resolve()
    sources = []
    for city in cities:
        if city == "london":
            names = [(f"{i:02d}.tar", "london") for i in range(1, 7)]
        elif city == "shanghai":
            names = [("shanghai_rootless.tar", "shanghai")]
        elif city == "new_york":
            names = [(f"New_York_Manhattan_chunk_{i}.tar", "new_york_manhattan") for i in range(5)]
            names += [(f"New_York_Option_A_outside_Manhattan_chunk_{i}.tar", "new_york_outside_manhattan") for i in range(5)]
        else:
            names = [(f"Rome_Vatican_chunk_{i}.tar", "rome") for i in range(5)]
        for name, namespace in names:
            path = root / name
            stat = path.stat()
            sources.append(dict(city=city, namespace=namespace, name=name,
                                size=stat.st_size, mtime_ns=stat.st_mtime_ns))
    return sources


def fsync_dir(path):
    if os.name == "posix":
        fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)


def atomic_json(path, value):
    path = Path(path)
    partial = path.with_name(path.name + ".partial")
    with partial.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, allow_nan=False)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(partial, path)
    fsync_dir(path.parent)


class RunLock:
    """Kernel lock: a killed process cannot leave a stale PID lock behind."""
    def __init__(self, root):
        self.path = Path(root) / ".run.lock"

    def __enter__(self):
        import fcntl
        self.handle = self.path.open("a+")
        try:
            fcntl.flock(self.handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            self.handle.close()
            raise RuntimeError(f"Another process owns this run: {self.path.parent}") from None
        return self

    def __exit__(self, *args):
        self.handle.close()


class RunState:
    def __init__(self, root, config, selection_path=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        owner = self.root / "run.json"
        config = json.loads(json.dumps(config))
        if owner.exists():
            saved = json.loads(owner.read_text())
            if saved["config"] != config:
                raise ValueError("Run configuration or source/model metadata changed. Use a NEW output root.")
            self.run_id = saved["run_id"]
        else:
            unexpected = [p.name for p in self.root.iterdir() if p.name not in (".run.lock", "run.json.partial")]
            if unexpected:
                raise ValueError(f"Refusing a nonempty, unowned output root: {unexpected[:8]}")
            self.run_id = str(uuid.uuid4())
            atomic_json(owner, dict(run_id=self.run_id, config=config))
        self.config = config
        if selection_path is not None:
            raw = Path(selection_path).read_bytes()
            snapshot = self.root / "london_selection.csv"
            if snapshot.exists() and snapshot.read_bytes() != raw:
                raise ValueError("London selection changed; use a new output root")
            if not snapshot.exists():
                temporary = snapshot.with_suffix(".csv.partial")
                with temporary.open("wb") as handle:
                    handle.write(raw)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, snapshot)
                fsync_dir(self.root)
        self.db = self.root / "inventory.sqlite3"
        with self.connect() as con:
            con.executescript("""
                CREATE TABLE IF NOT EXISTS sources(
                    name TEXT PRIMARY KEY, cursor INTEGER NOT NULL DEFAULT 0,
                    complete INTEGER NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS records(
                    seq INTEGER PRIMARY KEY, city TEXT NOT NULL, namespace TEXT NOT NULL,
                    tar_name TEXT NOT NULL, member_name TEXT NOT NULL,
                    offset_data INTEGER NOT NULL, byte_size INTEGER NOT NULL,
                    pano_id INTEGER NOT NULL, lon REAL NOT NULL, lat REAL NOT NULL,
                    capture_date INTEGER NOT NULL, heading REAL, selection_key TEXT,
                    shard INTEGER, output_row INTEGER,
                    UNIQUE(tar_name, offset_data));
                CREATE INDEX IF NOT EXISTS records_pending ON records(city,shard,seq);
                CREATE TABLE IF NOT EXISTS failures(
                    failure_key TEXT PRIMARY KEY, record_id INTEGER, city TEXT,
                    stage TEXT, detail TEXT, error TEXT, attempts INTEGER DEFAULT 1,
                    updated REAL, resolved INTEGER DEFAULT 0);
                CREATE INDEX IF NOT EXISTS failures_record ON failures(record_id,resolved);
                CREATE TABLE IF NOT EXISTS retry_events(
                    event_id INTEGER PRIMARY KEY, stage TEXT, detail TEXT, error TEXT, updated REAL);
            """)

    @contextmanager
    def connect(self):
        con = sqlite3.connect(self.db, timeout=60)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA synchronous=FULL")
        try:
            with con:
                yield con
        finally:
            con.close()

    def inventory(self, pano_root, selection, stats, stop, expected=None, policy=None):
        """Scan TAR headers once; commit the cursor and selected identities together.

        Do not use the serving index: its configured London ranges omit low IDs.
        Seeking over image payloads avoids reading/decoding unselected pictures.
        """
        for spec in self.config["sources"]:
            with self.connect() as con:
                con.execute("INSERT OR IGNORE INTO sources(name) VALUES(?)", (spec["name"],))
                status = con.execute("SELECT * FROM sources WHERE name=?", (spec["name"],)).fetchone()
                if status["complete"]:
                    continue
                stats.set(stage="inventory", archive=spec["name"])
                path = Path(pano_root) / spec["name"]
                stat = path.stat()
                if (stat.st_size, stat.st_mtime_ns) != (spec["size"], spec["mtime_ns"]):
                    raise RuntimeError(f"Source changed during inventory: {path}")
                with path.open("rb") as handle:
                    handle.seek(status["cursor"])
                    with tarfile.open(fileobj=handle, mode="r:") as tar:
                        n = 0
                        for member in tar:
                            if stop.is_set():
                                con.commit()
                                return False
                            next_offset = tar.offset
                            if member.isfile() and Path(member.name).suffix.lower() in (".jpg", ".jpeg", ".png"):
                                try:
                                    identity = parse_identity(member.name)
                                except Exception as exc:
                                    if policy is None:
                                        raise
                                    detail = dict(city=spec['city'], tar_name=spec['name'], member_name=member.name)
                                    # Use the existing inventory transaction, avoiding a second WAL writer.
                                    self.failure(detail, 'identity', exc, con=con)
                                    con.execute("UPDATE sources SET cursor=? WHERE name=?", (next_offset,spec['name']))
                                    con.commit()
                                    policy.outcome('identity', False)
                                    continue
                                if policy is not None:
                                    policy.outcome('identity', True)
                                key = ref_key(*identity[:4])
                                keep = spec["city"] != "london" or key in selection
                                if keep:
                                    con.execute("""INSERT OR IGNORE INTO records
                                        (city,namespace,tar_name,member_name,offset_data,byte_size,
                                         pano_id,lon,lat,capture_date,heading,selection_key)
                                        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
                                        (spec["city"], spec["namespace"], spec["name"], member.name,
                                         member.offset_data, member.size, *identity,
                                         json.dumps(key) if spec["city"] == "london" else None))
                                    stats.add(inventory_selected=1)
                            con.execute("UPDATE sources SET cursor=? WHERE name=?", (next_offset, spec["name"]))
                            n += 1
                            stats.add(inventory_headers=1)
                            if n % 1000 == 0:
                                con.commit()
                        con.execute("UPDATE sources SET complete=1 WHERE name=?", (spec["name"],))
                con.commit()
        counts = self.counts()
        with self.connect() as con:
            matched = [json.loads(r[0]) for r in con.execute("SELECT selection_key FROM records WHERE city='london'")]
        if selection:
            keys = [tuple(row) for row in matched]
            missing = selection - set(keys)
            duplicate = len(keys) - len(set(keys))
            if missing or duplicate:
                atomic_json(self.root / "inventory_problems.json", dict(missing_london=sorted(missing), duplicate_matches=duplicate))
                if policy is None or duplicate or len(missing) >= max(100, len(selection)*.01):
                    raise RuntimeError(f"London raw coverage incomplete: missing={len(missing)}, duplicate_matches={duplicate}. See inventory_problems.json")
                self.failure(dict(city='london',missing_count=len(missing)), 'coverage', f'{len(missing)} selected identities absent; see inventory_problems.json')
        if expected is not None:
            for city in self.config["cities"]:
                if counts.get(city, 0) != expected[city]:
                    difference = expected[city]-counts.get(city,0)
                    if policy is None or difference < 0 or difference >= max(100,expected[city]*.01):
                        raise RuntimeError(f"{city}: expected {expected[city]} source images, found {counts.get(city, 0)}")
                    self.failure(dict(city=city,missing_count=difference), 'coverage', f'Expected {expected[city]}, found {counts.get(city,0)} source images')
        atomic_json(self.root / "inventory_complete.json", dict(run_id=self.run_id, counts=counts))
        return True

    def counts(self, committed=False):
        where = "WHERE shard IS NOT NULL" if committed else ""
        with self.connect() as con:
            return dict(con.execute(f"SELECT city,count(*) FROM records {where} GROUP BY city").fetchall())

    def pending(self, city):
        # Short-lived page reads let the writer checkpoint without retaining a
        # multi-hour SQLite read transaction or an ever-growing WAL.
        after = 0
        while True:
            with self.connect() as con:
                rows = con.execute("SELECT * FROM records WHERE city=? AND shard IS NULL AND seq>? AND NOT EXISTS (SELECT 1 FROM failures WHERE record_id=records.seq AND resolved=0) ORDER BY seq LIMIT 256", (city, after)).fetchall()
            if not rows:
                return
            for row in rows:
                yield dict(row)
            after = rows[-1]["seq"]

    def failure(self, record, stage, error, con=None):
        key = f"{stage}:{record.get('seq',str(record.get('tar_name',''))+':'+str(record.get('member_name',record.get('city',''))))}"
        values=(key,record.get('seq'),record.get('city'),stage,json.dumps(record),str(error)[-8000:],time.time())
        sql='''INSERT INTO failures(failure_key,record_id,city,stage,detail,error,updated)
               VALUES(?,?,?,?,?,?,?) ON CONFLICT(failure_key) DO UPDATE SET
               error=excluded.error,attempts=failures.attempts+1,updated=excluded.updated,resolved=0'''
        if con is not None:
            con.execute(sql,values)
        else:
            with self.connect() as db:db.execute(sql,values)

    def reset_failed(self):
        # Keep history; make failed records eligible again without touching successes.
        with self.connect() as con:
            con.execute('UPDATE failures SET resolved=1 WHERE record_id IS NOT NULL')

    def event(self,stage,detail,error):
        with self.connect() as con:
            con.execute('INSERT INTO retry_events(stage,detail,error,updated) VALUES(?,?,?,?)',
                        (stage,json.dumps(detail),str(error)[-8000:],time.time()))

    def failure_report(self):
        destination=self.root/'failures.jsonl'
        temporary=destination.with_suffix('.jsonl.partial')
        with self.connect() as con, temporary.open('w',encoding='utf-8') as handle:
            for row in con.execute('SELECT * FROM failures ORDER BY updated,failure_key'):
                entry=dict(row);entry['detail']=json.loads(entry['detail'])
                handle.write(json.dumps(entry)+'\n')
            for row in con.execute('SELECT * FROM retry_events ORDER BY event_id'):
                entry=dict(row);entry['detail']=json.loads(entry['detail']);entry['type']='retry_event'
                handle.write(json.dumps(entry)+'\n')
            handle.flush();os.fsync(handle.fileno())
        os.replace(temporary,destination)
        fsync_dir(self.root)
        archive=self.root/'error_report.zip'
        partial=archive.with_suffix('.zip.partial')
        with zipfile.ZipFile(partial,'w',compression=zipfile.ZIP_DEFLATED) as bundle:
            bundle.write(destination,destination.name)
            for name in ('inventory_problems.json','complete.json'):
                path=self.root/name
                if path.exists():bundle.write(path,name)
            bundle.writestr('summary.json',json.dumps(self.completion(),indent=2))
        with partial.open('rb') as handle:os.fsync(handle.fileno())
        os.replace(partial,archive)
        fsync_dir(self.root)

    def completion(self):
        with self.connect() as con:
            remaining=con.execute('''SELECT count(*) FROM records WHERE shard IS NULL AND NOT EXISTS
                (SELECT 1 FROM failures WHERE record_id=records.seq AND resolved=0)''').fetchone()[0]
            failed=con.execute('''SELECT count(*) FROM records WHERE shard IS NULL AND EXISTS
                (SELECT 1 FROM failures WHERE record_id=records.seq AND resolved=0)''').fetchone()[0]
            issues=con.execute('SELECT count(*) FROM failures WHERE resolved=0').fetchone()[0]
        return dict(remaining=remaining,failed_panos=failed,unresolved_issues=issues,committed_counts=self.counts(True))

    def paths(self, city, shard):
        dataset = DATASETS[city]
        emb = self.root / "embedding" / dataset
        pano = self.root / "pano" / dataset
        checkpoints = self.root / "checkpoints" / dataset
        for directory in (emb, pano, checkpoints):
            if any(p.is_symlink() for p in (directory, *directory.parents) if p != self.root.parent):
                raise ValueError(f"Symlink output directory is not allowed: {directory}")
            directory.mkdir(parents=True, exist_ok=True)
        stem = f"views_emb_shard_{shard:05d}"
        return {
            "embedding": emb / f"{stem}.npy",
            "reference": emb / f"{stem}_ref.npy",
            "identities": emb / f"{stem}_identity.jsonl",
            "pano": pano / f"panos_shard_{shard:05d}.tar",
            "marker": checkpoints / f"checkpoint_{shard:05d}.json",
        }

    def recover(self):
        """A durable marker is authoritative, including crash-after-marker cases."""
        next_shards = {city: 0 for city in self.config["cities"]}
        for city in self.config["cities"]:
            directory = self.root / "checkpoints" / DATASETS[city]
            for marker_path in sorted(directory.glob("checkpoint_*.json")):
                marker = json.loads(marker_path.read_text())
                if marker["run_id"] != self.run_id or marker["city"] != city:
                    raise RuntimeError(f"Foreign checkpoint: {marker_path}")
                shard = marker["shard"]
                if shard != next_shards[city]:
                    raise RuntimeError(f"Checkpoint sequence gap at {marker_path}")
                paths = self.paths(city, shard)
                for kind, size in marker["file_sizes"].items():
                    if paths[kind].stat().st_size != size:
                        raise RuntimeError(f"Incomplete committed file: {paths[kind]}")
                array = np.load(paths["embedding"], mmap_mode="r", allow_pickle=False)
                refs = np.load(paths["reference"], mmap_mode="r", allow_pickle=False)
                if list(array.shape) != marker["shape"] or array.dtype != np.dtype("float16") or refs.shape != (len(marker["record_ids"]), 5):
                    raise RuntimeError(f"Invalid committed arrays: {marker_path}")
                del array, refs
                self.mark_committed(marker)
                next_shards[city] = shard + 1
        with self.connect() as con:
            for city, max_shard in next_shards.items():
                if con.execute("SELECT 1 FROM records WHERE city=? AND shard>=? LIMIT 1", (city,max_shard)).fetchone():
                    raise RuntimeError("Inventory refers to a missing durable checkpoint")
        return next_shards

    def mark_committed(self, marker):
        with self.connect() as con:
            for index, seq in enumerate(marker["record_ids"]):
                row = con.execute("SELECT city,shard,output_row FROM records WHERE seq=?", (seq,)).fetchone()
                output_row = marker["first_row"] + index
                if row is None or row["city"] != marker["city"] or (row["shard"] is not None and (row["shard"],row["output_row"]) != (marker["shard"],output_row)):
                    raise RuntimeError(f"Conflicting checkpoint identity {seq}")
                con.execute("UPDATE records SET shard=?,output_row=? WHERE seq=?", (marker["shard"], output_row, seq))

    def write_shard(self, city, shard, first_row, items, embeddings, stats, fault=None):
        paths = self.paths(city, shard)
        if paths["marker"].exists():
            raise RuntimeError(f"Refusing to overwrite a committed shard: {paths['marker']}")
        embeddings = np.asarray(embeddings, dtype=np.float16)
        expected_shape = (len(items), 8, self.config["dimension"])
        if embeddings.shape != expected_shape or not np.isfinite(embeddings).all():
            raise ValueError(f"Invalid embeddings: {embeddings.shape}, expected {expected_shape}")
        refs = np.asarray([[i.record["pano_id"],i.record["lon"],i.record["lat"],i.record["capture_date"],
                            i.record["heading"] if i.record["heading"] is not None else np.nan] for i in items], dtype=np.float64)
        partials = {key: path.with_name(path.name + ".partial") for key,path in paths.items() if key != "marker"}
        for kind, value in (("embedding",embeddings),("reference",refs)):
            with partials[kind].open("wb") as handle:
                np.save(handle, value, allow_pickle=False)
                handle.flush(); os.fsync(handle.fileno())
        with partials["pano"].open("wb") as raw, partials["identities"].open("w",encoding="utf-8") as identities:
            with tarfile.open(fileobj=raw, mode="w", format=tarfile.PAX_FORMAT) as tar:
                for index,item in enumerate(items):
                    record = item.record
                    member = f"{record['namespace']}/{record['seq']}/{record['pano_id']}_{record['lon']:.17g}_{record['lat']:.17g}_{record['capture_date']}.jpg"
                    info = tarfile.TarInfo(member)
                    info.size=len(item.jpeg); info.mode=0o644; info.mtime=0
                    tar.addfile(info,io.BytesIO(item.jpeg))
                    identities.write(json.dumps(dict(record, output_row=first_row+index,
                        original_size=item.original_size, geometry=item.geometry,
                        pano_tar=paths["pano"].name, pano_member=member,
                        pano_size=[2048,1024],jpeg_quality=self.config["jpeg_quality"]),allow_nan=False)+"\n")
            raw.flush();os.fsync(raw.fileno())
            identities.flush();os.fsync(identities.fileno())
        for kind in partials:
            os.replace(partials[kind], paths[kind])
            fsync_dir(paths[kind].parent)
            if fault is not None:
                fault(kind)
        marker=dict(run_id=self.run_id,city=city,shard=shard,first_row=first_row,
                    record_ids=[i.record["seq"] for i in items],shape=list(embeddings.shape),
                    file_sizes={kind:paths[kind].stat().st_size for kind in partials})
        atomic_json(paths["marker"],marker)
        if fault is not None:
            fault("marker")
        self.mark_committed(marker)
        stats.add(committed_panos=len(items),committed_shards=1,
                  written_bytes=sum(marker["file_sizes"].values()))
        return marker
