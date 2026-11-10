"""Temporary native shard fixtures for later RunPod reader verification."""
import json
import os
from pathlib import Path
import tempfile
import unittest

import numpy as np

from backend.semantic_map.region_matching_data import AlignedMatrix, DatasetSpec, RegionDataset, spatial_weights


def write_dataset(root, name="toy", sizes=(3, 2), coordinates=None, views=None):
    directory = Path(root) / name
    directory.mkdir()
    offset = 0
    rng = np.random.default_rng(10)
    for shard, count in enumerate(sizes):
        stem = f"views_emb_shard_{shard:05d}"
        payload = rng.normal(size=(count, 2, 3)).astype(np.float16) if views is None else views[offset:offset + count]
        refs = []
        identities = []
        for local in range(count):
            row = offset + local
            lon, lat = coordinates[row] if coordinates is not None else (float(row), 1.0)
            pano = 10 if row in (0, 3) else 10 + row
            date = (2020 + row // 12) * 100 + row % 12 + 1
            refs.append([pano, lon, lat, date])
            identities.append({"pano_id": pano, "lon": lon, "lat": lat, "capture_date": date,
                               "seq": 900 + row, "namespace": "first" if row < 3 else "second",
                               "output_row": shard * 8192 + local})
        np.save(directory / (stem + ".npy"), payload)
        np.save(directory / (stem + "_ref.npy"), np.asarray(refs, dtype=np.float64))
        (directory / (stem + "_identity.jsonl")).write_text(
            "".join(json.dumps(item) + "\n" for item in identities), encoding="utf-8")
        offset += count
    return directory


class RegionDataTest(unittest.TestCase):
    def test_partial_shard_offsets_and_duplicate_numeric_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            write_dataset(temporary)
            dataset = RegionDataset(Path(temporary), "toy", DatasetSpec("toy", "EPSG:32630"))
            self.assertEqual([(s.start, s.end) for s in dataset.shards], [(0, 3), (3, 5)])
            self.assertEqual(dataset.identity(0)["pano_id"], dataset.identity(3)["pano_id"])
            self.assertNotEqual(dataset.identity(0)["namespace"], dataset.identity(3)["namespace"])
            rows = np.array([2, 3, 4])
            matrix = AlignedMatrix(dataset, rows, (1, 0), block_size=1)
            blocks = np.concatenate([block for _, block in matrix.blocks()])
            direct = np.concatenate([view[:, (1, 0), :].reshape(len(view), -1) for _, view in dataset.iter_views(rows, 1)])
            np.testing.assert_allclose(blocks, direct.astype(np.float32) / np.sqrt(2))

    def test_polygon_holes_boundaries_and_metadata_revision(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = write_dataset(temporary)
            dataset = RegionDataset(Path(temporary), "toy", DatasetSpec("toy", "EPSG:32630"))
            polygon = {"type": "Polygon", "coordinates": [
                [[0, 0], [4, 0], [4, 2], [0, 2], [0, 0]],
                [[1.5, 0.5], [2.5, 0.5], [2.5, 1.5], [1.5, 1.5], [1.5, 0.5]],
            ]}
            self.assertEqual(dataset.polygon_rows(polygon).tolist(), [0, 1, 3, 4])
            path = directory / "views_emb_shard_00001.npy"
            stat = path.stat()
            os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1_000_000))
            with self.assertRaisesRegex(ValueError, "changed"):
                dataset.assert_unchanged()

    def test_cell_weights_do_not_overweight_duplicate_observations(self):
        weights, _, count = spatial_weights(np.array([[0, 0], [1, 1], [30, 0]]), 25)
        self.assertEqual(count, 2)
        np.testing.assert_allclose(weights, [0.25, 0.25, 0.5])


if __name__ == "__main__":
    unittest.main()
