#!/usr/bin/env python3
"""Generate real image/ground-truth alignment sheets for three target types."""
from __future__ import annotations

import io
import json
from pathlib import Path, PurePosixPath
import zipfile

import numpy as np
from PIL import Image, ImageDraw

from dataset_image_pipeline import NestedZipCache, transform_image
from validation_projection import rasterize_coco_polygons, transform_raster_target


DATASETS = Path("/workspace/datasets")


def fit(image, size=(512, 512)):
    canvas = Image.new("RGB", size, "white")
    copy = image.convert("RGB"); copy.thumbnail(size, Image.Resampling.NEAREST)
    canvas.paste(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    copy.close(); return canvas


def label(image, text):
    draw = ImageDraw.Draw(image); draw.rectangle((0, 0, image.width, 28), fill="black")
    draw.text((8, 7), text, fill="white")


def overlay_mask(image, mask):
    base = np.asarray(image.convert("RGB"), dtype=np.float32)
    values = np.asarray(mask) != 0
    color = np.zeros_like(base); color[..., 0] = 255
    base[values] = base[values] * 0.55 + color[values] * 0.45
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


def cityscapes(output):
    root = DATASETS / "cityscapes_20260920/files"
    with zipfile.ZipFile(root / "leftImg8bit_trainvaltest.zip") as images, \
            zipfile.ZipFile(root / "gtFine_trainvaltest.zip") as labels:
        source_name = next(name for name in images.namelist() if name.endswith(".png"))
        stem = PurePosixPath(source_name).name.replace("_leftImg8bit.png", "")
        target_name = next(name for name in labels.namelist()
                           if stem in name and name.endswith("_gtFine_color.png"))
        with Image.open(images.open(source_name)) as raw: source = raw.convert("RGB")
        with Image.open(labels.open(target_name)) as raw: target = raw.convert("RGB")
    views = transform_image(source, "perspective",
                            perspective_mode="horizontal_halves_if_2_to_1")
    target_views = [transform_raster_target(target, metadata) for _, metadata in views]
    sheet = Image.new("RGB", (1536, 1024), "white")
    originals = [fit(source), fit(target)]
    label(originals[0], "SOURCE IMAGE 2048x1024")
    label(originals[1], "SOURCE PIXEL LABEL 2048x1024")
    sheet.paste(originals[0], (0, 0)); sheet.paste(originals[1], (0, 512))
    for index, ((view, metadata), target_view) in enumerate(zip(views, target_views)):
        label(view, f"IMAGE {metadata['tile']} 512x512")
        label(target_view, f"LABEL {metadata['tile']} nearest-neighbour")
        sheet.paste(view, (512 * (index + 1), 0)); sheet.paste(target_view, (512 * (index + 1), 512))
    destination = output / "cityscapes_image_label_alignment.jpg"
    sheet.save(destination, quality=92); sheet.close(); source.close(); target.close()
    return {"dataset_id": "cityscapes", "source": source_name, "target": target_name,
            "target_kind": "pixel_mask", "policy": "two horizontal squares; nearest-neighbour label"}


def vistas(output):
    root = DATASETS / "mapillary_vistas_2_0_20260920/files"
    for path in sorted(root.glob("*.zip")):
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            source_names = [name for name in names if name.startswith("training/images/") and name.endswith(".jpg")]
            if not source_names:
                continue
            source_name = source_names[0]; stem = PurePosixPath(source_name).stem
            target_name = next((name for name in names
                                if name.startswith("training/labels/") and PurePosixPath(name).stem == stem), None)
            if not target_name:
                continue
            with Image.open(archive.open(source_name)) as raw: source = raw.convert("RGB")
            with Image.open(archive.open(target_name)) as raw:
                raw.load(); target = raw.copy()
            break
    views = transform_image(source, "perspective")
    target_view = transform_raster_target(target, views[0][1])
    sheet = Image.new("RGB", (1024, 1024), "white")
    cells = [fit(source), fit(target), views[0][0], target_view.convert("RGB")]
    captions = ["SOURCE IMAGE", "SOURCE PIXEL LABEL", "CENTER CROP IMAGE 512x512",
                "MATCHED LABEL nearest-neighbour"]
    for index, (cell, caption) in enumerate(zip(cells, captions)):
        label(cell, caption); sheet.paste(cell, ((index % 2) * 512, (index // 2) * 512))
    destination = output / "mapillary_vistas_image_label_alignment.jpg"
    sheet.save(destination, quality=92); sheet.close(); source.close(); target.close()
    return {"dataset_id": "mapillary_vistas", "source": source_name, "target": target_name,
            "target_kind": "pixel_mask", "policy": "matching center crop; nearest-neighbour label"}


def omni_panorama(output, cache_root):
    root = DATASETS / "omnicity_20260920/OpenDataLab___OmniCity/raw/OmniCity.zip"
    annotation_name = ("OmniCity-dataset/street-level/annotation-panorama/"
                       "annotation-panorama-instance/annotation-panorama-instance-test.json")
    nested_name = "OmniCity-dataset/street-level/image-panorama/image-panorama-test.zip"
    with zipfile.ZipFile(root) as outer:
        coco = json.loads(outer.read(annotation_name))
    image_row = coco["images"][0]; basename = PurePosixPath(image_row["file_name"]).name
    annotations = [row for row in coco["annotations"] if row["image_id"] == image_row["id"]]
    with NestedZipCache(cache_root) as cache:
        nested_path = cache.materialize(str(root), nested_name)
        with zipfile.ZipFile(nested_path) as archive:
            source_name = next(name for name in archive.namelist() if PurePosixPath(name).name == basename)
            with Image.open(archive.open(source_name)) as raw: source = raw.convert("RGB")
    target = rasterize_coco_polygons(source.size, annotations)
    views = transform_image(source, "equirectangular")
    target_views = [transform_raster_target(target, metadata) for _, metadata in views]
    sheet = Image.new("RGB", (1024, 1024), "white")
    original = fit(source, (1024, 512)); label(original, "SOURCE PANORAMA + COCO polygons")
    sheet.paste(original, (0, 0)); original.close()
    for index, ((view, metadata), mask) in enumerate(zip(views, target_views)):
        overlay = overlay_mask(view, mask).resize((256, 256), Image.Resampling.LANCZOS)
        label(overlay, f"yaw {metadata['yaw_degrees']:g}: projected target")
        sheet.paste(overlay, ((index % 4) * 256, 512 + (index // 4) * 256)); overlay.close()
    destination = output / "omnicity_panorama_polygon_alignment.jpg"
    sheet.save(destination, quality=92); sheet.close(); source.close(); target.close()
    return {"dataset_id": "omnicity_panorama", "source": source_name,
            "target": annotation_name, "target_kind": "coco_polygon",
            "policy": "rasterize source polygons, then nearest-neighbour equirectangular projection"}


def main():
    output = Path("/workspace/embed/validation_qc")
    output.mkdir(parents=True, exist_ok=True)
    rows = [cityscapes(output), vistas(output), omni_panorama(output, "/workspace/embed/validation_qc_cache")]
    (output / "validation_qc.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
