"""CORE output namespaces; reuse Qwen inventory and atomic shard writer unchanged."""
import json
from pathlib import Path
import numpy as np
from pipeline_state import EXPECTED_COUNTS, RunLock, atomic_json, read_selection, source_specs
from pipeline_state import RunState as PanoramaRunState

DATASETS = {city: f'{city}_512_8_45_CORE8B' for city in EXPECTED_COUNTS}


class RunState(PanoramaRunState):
    def inventory(self, *args, **kwargs):
        result = super().inventory(*args, **kwargs)
        source = self.config.get('source_run')
        if result and source:
            # Committed retained TAR members encode original namespace/sequence.
            # Read the original metadata without permitting writes to its DB.
            original = Path(source['root']) / 'inventory.sqlite3'
            with self.connect() as con:
                con.execute('ATTACH DATABASE ? AS original', (original.as_uri() + '?mode=ro',))
                sequence = "CAST(substr(records.member_name,instr(records.member_name,'/')+1) AS INTEGER)"
                missing = con.execute(f'SELECT count(*) FROM records WHERE NOT EXISTS '
                    f'(SELECT 1 FROM original.records AS src WHERE src.seq={sequence} '
                    f'AND src.shard IS NOT NULL AND src.pano_id=records.pano_id)').fetchone()[0]
                if missing:
                    raise RuntimeError(f'{missing} retained source identities lack original metadata')
                con.execute(f'UPDATE records SET (namespace,heading) = '
                    f'(SELECT namespace,heading FROM original.records AS src WHERE src.seq={sequence})')
        return result

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

