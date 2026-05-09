from __future__ import annotations

import glob
import re
from dataclasses import dataclass
from pathlib import Path

from .backend_config import BackendSettings
from .scoring_models import PanoRecord


@dataclass(frozen=True, slots=True)
class DatasetLayout:
    dataset_id: str
    dataset_dir: Path
    embedding_paths: tuple[Path, ...]
    ref_paths: tuple[Path, ...]


def shard_index_from_name(path: Path) -> int:
    match = re.search(r"shard_(\d+)", path.stem)
    return int(match.group(1)) if match else 0


def locate_dataset(dataset_id: str, settings: BackendSettings) -> DatasetLayout:
    dataset_dir = settings.data_root / dataset_id
    embedding_paths = tuple(
        sorted(
            (
                Path(path)
                for path in glob.glob(str(dataset_dir / "views_emb_shard_*.npy"))
                if not str(path).endswith("_ref.npy")
            ),
            key=shard_index_from_name,
        )
    )

    ref_paths = []
    for embedding_path in embedding_paths:
        ref_path = embedding_path.with_name(f"{embedding_path.stem}_ref.npy")
        if not ref_path.exists():
            raise FileNotFoundError(f"Missing reference file for {embedding_path.name}: {ref_path.name}")
        ref_paths.append(ref_path)

    if not embedding_paths:
        raise FileNotFoundError(f"No embedding shards found for dataset {dataset_id}: {dataset_dir}")

    return DatasetLayout(
        dataset_id=dataset_id,
        dataset_dir=dataset_dir,
        embedding_paths=embedding_paths,
        ref_paths=tuple(ref_paths),
    )


def load_pano_records_from_refs(layout: DatasetLayout) -> tuple[PanoRecord, ...]:
    import numpy as np

    records: list[PanoRecord] = []
    row_index = 0
    for ref_path in layout.ref_paths:
        refs = np.load(ref_path, mmap_mode="r")
        if refs.ndim != 2 or refs.shape[1] < 4:
            raise RuntimeError(f"Unexpected ref shape {refs.shape} for {ref_path}")

        for local_index in range(refs.shape[0]):
            record = refs[local_index]
            records.append(
                PanoRecord(
                    pano_id=str(int(record[0])),
                    row_index=row_index,
                    lon=float(record[1]),
                    lat=float(record[2]),
                    date=int(record[3]),
                )
            )
            row_index += 1

    return tuple(records)
