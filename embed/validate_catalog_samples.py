#!/usr/bin/env python3
"""Render one real before/after QC sheet per selected catalog dataset."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

from dataset_image_pipeline import ImageReader, iter_rule_records, load_catalog, transform_image


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, "white")
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas.paste(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    copy.close()
    return canvas


def label(image: Image.Image, text: str) -> None:
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, image.width, 30), fill="black")
    draw.text((8, 8), text, fill="white")


def render(source: Image.Image, dataset_id: str, projection: str,
           perspective_mode: str = "center_crop"):
    outputs = transform_image(source, projection, perspective_mode=perspective_mode)
    if projection == "perspective":
        sheet = Image.new("RGB", (512 * (1 + len(outputs)), 512), "white")
        before = fit(source, (512, 512))
        label(before, f"BEFORE {dataset_id} {source.width}x{source.height}")
        sheet.paste(before, (0, 0))
        for index, (view, metadata) in enumerate(outputs):
            suffix = metadata.get("tile", f"view {index}")
            label(view, f"AFTER {suffix}: crop/tile + resize 512x512")
            sheet.paste(view, (512 * (index + 1), 0))
        before.close()
    else:
        sheet = Image.new("RGB", (1024, 1024), "white")
        before = fit(source, (1024, 512))
        label(before, f"BEFORE {dataset_id} equirectangular {source.width}x{source.height}")
        sheet.paste(before, (0, 0)); before.close()
        for index, (view, metadata) in enumerate(outputs):
            tile = view.resize((256, 256), Image.Resampling.LANCZOS)
            label(tile, f"AFTER yaw {metadata['yaw_degrees']:g}, FOV 45")
            sheet.paste(tile, ((index % 4) * 256, 512 + (index // 4) * 256))
            tile.close()
    transforms = [metadata for _, metadata in outputs]
    for image, _ in outputs:
        image.close()
    return sheet, transforms


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--cache-root", required=True)
    parser.add_argument("--datasets", nargs="+")
    args = parser.parse_args(argv)
    _, rules = load_catalog(args.catalog)
    selected = set(args.datasets or [rule.dataset_id for rule in rules])
    unknown = selected - {rule.dataset_id for rule in rules}
    if unknown:
        parser.error(f"unknown datasets: {sorted(unknown)}")
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    with ImageReader(args.cache_root) as reader:
        for rule in rules:
            if rule.dataset_id not in selected:
                continue
            records = iter_rule_records(rule, nested_cache=reader.cache)
            try:
                record = next(records)
            except StopIteration as exc:
                raise RuntimeError(f"No images matched {rule.dataset_id}") from exc
            finally:
                records.close()
            source = reader.read(record)
            original_size = list(source.size)
            sheet, transforms = render(source, rule.dataset_id, rule.projection,
                                       rule.perspective_mode)
            source.close()
            destination = output / f"{rule.dataset_id}_before_after.jpg"
            sheet.save(destination, "JPEG", quality=90)
            sheet.close()
            rows.append({**record.json(), "original_size": original_size,
                         "qc_sheet": destination.name, "transforms": transforms})
    (output / "qc_mapping.jsonl").write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8")


if __name__ == "__main__":
    main()
