#!/usr/bin/env python3
"""Generate human-readable before/after sheets for verified dataset samples."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

from dataset_image_pipeline import transform_image


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    result = Image.new("RGB", size, "white")
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    result.paste(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    copy.close()
    return result


def label(image: Image.Image, text: str) -> None:
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, image.width, 28), fill=(0, 0, 0))
    draw.text((8, 7), text, fill=(255, 255, 255))


def perspective_sheet(source: Image.Image, dataset_id: str,
                      perspective_mode: str = "center_crop") -> tuple[Image.Image, list[dict]]:
    outputs = transform_image(source, "perspective", perspective_mode=perspective_mode)
    before = fit(source, (512, 512))
    label(before, f"BEFORE: {dataset_id} {source.width}x{source.height}")
    sheet = Image.new("RGB", (512 * (1 + len(outputs)), 512), "white")
    sheet.paste(before, (0, 0)); before.close()
    metadata = []
    for index, (after, row) in enumerate(outputs):
        suffix = row.get("tile", "center")
        label(after, f"AFTER: {suffix} crop + resize 512x512")
        sheet.paste(after, (512 * (index + 1), 0))
        after.close(); metadata.append(row)
    return sheet, metadata


def panorama_sheet(source: Image.Image, dataset_id: str) -> tuple[Image.Image, list[dict]]:
    outputs = transform_image(source, "equirectangular")
    before = fit(source, (1024, 512))
    label(before, f"BEFORE: {dataset_id} equirectangular {source.width}x{source.height}")
    sheet = Image.new("RGB", (1024, 1024), "white")
    sheet.paste(before, (0, 0)); before.close()
    metadata = []
    for index, (view, row) in enumerate(outputs):
        tile = view.resize((256, 256), Image.Resampling.LANCZOS)
        label(tile, f"AFTER: yaw {row['yaw_degrees']:g}, FOV 45")
        sheet.paste(tile, ((index % 4) * 256, 512 + (index // 4) * 256))
        tile.close(); view.close(); metadata.append(row)
    return sheet, metadata


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()
    source, output = Path(args.source_dir), Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    samples = [
        ("cityscapes", source / "cityscapes_perspective.png", "perspective",
         "horizontal_halves_if_2_to_1"),
        ("mapillary", source / "mapillary_perspective.jpg", "perspective", "center_crop"),
        ("omnicity_v2", source / "omnicity_v2_svi.jpg", "equirectangular", "center_crop"),
    ]
    mappings = []
    for dataset_id, path, projection, perspective_mode in samples:
        with Image.open(path) as raw:
            image = ImageOps.exif_transpose(raw).convert("RGB")
        if projection == "perspective":
            sheet, transforms = perspective_sheet(image, dataset_id, perspective_mode)
        else:
            sheet, transforms = panorama_sheet(image, dataset_id)
        destination = output / f"{dataset_id}_before_after.jpg"
        sheet.save(destination, "JPEG", quality=92)
        sheet.close()
        mappings.append({"dataset_id": dataset_id, "source": str(path),
                         "projection": projection, "original_size": list(image.size),
                         "qc_sheet": destination.name, "transforms": transforms})
        image.close()
    with (output / "projection_qc_mapping.jsonl").open("w", encoding="utf-8") as handle:
        for row in mappings:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
