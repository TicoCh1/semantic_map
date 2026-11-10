import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

import numpy as np
from PIL import Image

from dataset_image_pipeline import (EquirectangularProjector, ImageReader,
    center_crop_resize, record_from_json, transform_image, write_inventory)
from run_dataset_embedding import (ErrorLedger, ExcludedModalityError, ShardWriter,
                                   completed_source_index, source_safe_batches)
from validation_projection import (partition_source_tags, transform_bbox_xywh,
                                   transform_bbox_xyxy, transform_polygon,
                                   transform_polyline, transform_raster_target)


def jpeg(size, color):
    data = io.BytesIO()
    Image.new("RGB", size, color).save(data, "JPEG")
    return data.getvalue()


class DatasetImagePipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_perspective_is_center_cropped_not_spherical(self):
        source = Image.new("RGB", (8, 4))
        source.paste((255, 0, 0), (0, 0, 2, 4))
        source.paste((0, 255, 0), (2, 0, 6, 4))
        source.paste((0, 0, 255), (6, 0, 8, 4))
        output, metadata = center_crop_resize(source, 4)
        self.assertEqual(output.size, (4, 4))
        self.assertEqual(metadata["crop_box"], [2, 0, 6, 4])
        self.assertGreater(np.asarray(output)[..., 1].mean(), 240)

    def test_equirectangular_outputs_eight_square_views(self):
        pixels = np.zeros((64, 128, 3), dtype=np.uint8)
        pixels[:, :32] = (255, 0, 0)
        pixels[:, 32:64] = (0, 255, 0)
        pixels[:, 64:96] = (0, 0, 255)
        pixels[:, 96:] = (255, 255, 0)
        outputs = EquirectangularProjector(32, 45).project(Image.fromarray(pixels))
        self.assertEqual(len(outputs), 8)
        self.assertTrue(all(image.size == (32, 32) for image, _ in outputs))
        self.assertEqual([meta["yaw_degrees"] for _, meta in outputs],
                         [0, 45, 90, 135, 180, 225, 270, 315])

    def test_non_2_to_1_rejected_for_equirectangular_rule(self):
        with self.assertRaisesRegex(ValueError, "non-2:1"):
            transform_image(Image.new("RGB", (100, 60)), "equirectangular")

    def test_two_to_one_perspective_can_preserve_both_halves(self):
        source = Image.new("RGB", (8, 4))
        source.paste("red", (0, 0, 4, 4)); source.paste("blue", (4, 0, 8, 4))
        outputs = transform_image(source, "perspective", size=4,
                                  perspective_mode="horizontal_halves_if_2_to_1")
        self.assertEqual(len(outputs), 2)
        self.assertEqual([metadata["crop_box"] for _, metadata in outputs],
                         [[0, 0, 4, 4], [4, 0, 8, 4]])
        self.assertGreater(np.asarray(outputs[0][0])[..., 0].mean(), 240)
        self.assertGreater(np.asarray(outputs[1][0])[..., 2].mean(), 240)

    def test_raster_box_polygon_and_tags_follow_transform(self):
        transform = {"method": "horizontal_square_tile", "crop_box": [4, 0, 8, 4],
                     "output_size": [4, 4]}
        target = Image.fromarray(np.tile(np.arange(8, dtype=np.uint8), (4, 1)))
        projected = transform_raster_target(target, transform)
        self.assertEqual(np.asarray(projected)[0].tolist(), [4, 5, 6, 7])
        self.assertEqual(transform_bbox_xywh([3, 1, 3, 2], transform), [0.0, 1.0, 2.0, 2.0])
        self.assertEqual(transform_bbox_xyxy(
            {"xmin": 3, "ymin": 1, "xmax": 6, "ymax": 3}, transform),
            {"xmin": 0.0, "ymin": 1.0, "xmax": 2.0, "ymax": 3.0})
        polygon = transform_polygon([3, 1, 6, 1, 6, 3, 3, 3], transform)
        self.assertTrue(all(0 <= value <= 4 for value in polygon))
        self.assertEqual(transform_polyline([3, 2, 5, 2, 7, 2], transform),
                         [0.0, 2.0, 1.0, 2.0, 3.0, 2.0])
        tags = partition_source_tags({"weather": "clear", "view_direction": "front"},
                                     ["view_direction"])
        self.assertEqual(tags["output_tags"], {"weather": "clear"})
        self.assertEqual(tags["source_only_tags"], {"view_direction": "front"})

    def test_direct_and_nested_zip_inventory_and_read(self):
        direct = self.root / "direct.zip"
        with zipfile.ZipFile(direct, "w") as archive:
            archive.writestr("images/a.jpg", jpeg((8, 4), "red"))
            archive.writestr("labels/a.png", jpeg((8, 4), "blue"))
        nested_bytes = io.BytesIO()
        with zipfile.ZipFile(nested_bytes, "w") as nested:
            nested.writestr("pano.jpg", jpeg((16, 8), "green"))
        outer = self.root / "outer.zip"
        with zipfile.ZipFile(outer, "w") as archive:
            archive.writestr("nested/panos.zip", nested_bytes.getvalue())
        catalog = self.root / "catalog.json"
        catalog.write_text(json.dumps({"version": 1, "sources": [
            {"dataset_id": "direct", "projection": "perspective", "container": str(direct),
             "member_globs": ["images/*.jpg"]},
            {"dataset_id": "nested", "projection": "equirectangular", "container": str(outer),
             "nested_archive_globs": ["nested/*.zip"], "member_globs": ["*.jpg"]},
            {"dataset_id": "satellite_disabled", "projection": "perspective",
             "container": str(self.root / "not-needed.zip"), "input_modality": "satellite",
             "include_in_embedding": False, "exclusion_reason": "no satellite embeddings"}
        ]}))
        inventory = self.root / "inventory.jsonl"
        report = write_inventory(catalog, inventory, self.root / "cache")
        self.assertEqual(report["datasets"], {"direct": 1, "nested": 1})
        self.assertEqual(report["excluded_sources"],
                         [{"dataset_id": "satellite_disabled", "reason": "no satellite embeddings"}])
        rows = [record_from_json(json.loads(line)) for line in inventory.read_text().splitlines()]
        with ImageReader(self.root / "cache") as reader:
            self.assertEqual(reader.read(rows[0]).size, (8, 4))
            self.assertEqual(reader.read(rows[1]).size, (16, 8))
        self.assertIn("::nested/panos.zip::pano.jpg", rows[1].source_uri)

    def test_tar_inventory_and_read(self):
        archive_path = self.root / "a2d2-preview.tar"
        payload = jpeg((12, 6), "purple")
        with tarfile.open(archive_path, "w") as archive:
            info = tarfile.TarInfo("camera/front/frame.jpg")
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
        catalog = self.root / "tar-catalog.json"
        catalog.write_text(json.dumps({"version": 1, "sources": [{
            "dataset_id": "a2d2", "projection": "perspective",
            "container": str(archive_path), "member_globs": ["camera/**/*.jpg"]
        }]}))
        inventory = self.root / "tar-inventory.jsonl"
        report = write_inventory(catalog, inventory, self.root / "tar-cache")
        self.assertEqual(report["datasets"], {"a2d2": 1})
        record = record_from_json(json.loads(inventory.read_text()))
        with ImageReader(self.root / "tar-cache") as reader:
            self.assertEqual(reader.read(record).size, (12, 6))

    def test_shard_writer_preserves_dataset_image_mapping(self):
        output = self.root / "shards"
        writer = ShardWriter(output, size=2)
        for index, dataset_id in enumerate(("cityscapes", "omnicity_panorama")):
            image = Image.new("RGB", (512, 512), (index * 80, 0, 0))
            writer.add(np.asarray([index, index + 1], dtype=np.float32),
                       {"source_index": index, "dataset_id": dataset_id,
                        "container": f"/{dataset_id}.zip", "member": f"{index}.jpg",
                        "nested_archive": None,
                        "source_uri": f"/{dataset_id}.zip::{index}.jpg",
                        "original_size": [1024, 512],
                        "transform": {"method": "test", "view_index": 0},
                        "view_id": f"{dataset_id}/{index:09d}/view_00"})
            image.close()
        writer.flush_if_full()
        rows = [json.loads(line) for line in
                (output / "shard_00000_image_map.jsonl").read_text(encoding="utf-8").splitlines()]
        self.assertEqual([row["dataset_id"] for row in rows],
                         ["cityscapes", "omnicity_panorama"])
        self.assertEqual([row["embedding_row"] for row in rows], [0, 1])
        self.assertFalse((output / "shard_00000_images.tar").exists())
        self.assertEqual(completed_source_index(output), 1)

    def test_error_ledger_and_batches_preserve_source_boundaries(self):
        ledger_path = self.root / "embedding_errors.jsonl"
        source = {"source_index": 7, "dataset_id": "omnicity_satellite",
                  "source_uri": "/satellite.zip::tile.jpg"}
        with ErrorLedger(ledger_path) as ledger:
            ledger.record(source, "policy", ExcludedModalityError("excluded"))
        with ErrorLedger(ledger_path) as ledger:
            self.assertEqual(ledger.skipped_sources, {7})
        rows = ([{"source_index": 1}] * 2 + [{"source_index": 2}] * 8
                + [{"source_index": 3}] * 2)
        images = list(range(len(rows)))
        batches = source_safe_batches(images, rows, limit=8)
        self.assertEqual([[row["source_index"] for row in batch_rows]
                          for _, batch_rows in batches], [[1, 1], [2] * 8, [3, 3]])


if __name__ == "__main__":
    unittest.main()
