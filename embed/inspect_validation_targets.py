#!/usr/bin/env python3
"""Read-only structural audit of validation targets on the current RunPod."""
from __future__ import annotations

import io
import json
from pathlib import Path, PurePosixPath
import zipfile

from PIL import Image


def structure(value, depth=0):
    if depth >= 3:
        return type(value).__name__
    if isinstance(value, dict):
        return {key: structure(item, depth + 1) for key, item in list(value.items())[:15]}
    if isinstance(value, list):
        return {"length": len(value), "first": structure(value[0], depth + 1) if value else None}
    return value


def image_info(archive, member):
    with Image.open(archive.open(member)) as image:
        return {"member": member, "size": list(image.size), "mode": image.mode}


def cityscapes(root):
    with zipfile.ZipFile(root / "leftImg8bit_trainvaltest.zip") as images, \
            zipfile.ZipFile(root / "gtFine_trainvaltest.zip") as labels:
        source = next(name for name in images.namelist() if name.endswith(".png"))
        stem = PurePosixPath(source).name.replace("_leftImg8bit.png", "")
        target = next(name for name in labels.namelist()
                      if stem in name and name.endswith("_gtFine_labelIds.png"))
        return {"image": image_info(images, source), "label": image_info(labels, target)}


def mapillary(root):
    result = {}
    for path in sorted(root.glob("*.zip")):
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            annotations = [name for name in names if "/annotations/" in name and name.endswith(".json")]
            if annotations and "mtsd" not in result:
                value = json.loads(archive.read(annotations[0]))
                result["mtsd"] = {"archive": path.name, "member": annotations[0],
                                  "structure": structure(value)}
            images = [name for name in names if name.startswith("training/images/") and name.endswith(".jpg")]
            labels = [name for name in names if "/labels/" in name and name.endswith(".png")]
            if images and labels and "vistas" not in result:
                stem = PurePosixPath(images[0]).stem
                target = next((name for name in labels if PurePosixPath(name).stem == stem), None)
                if target:
                    result["vistas"] = {"archive": path.name,
                                        "image": image_info(archive, images[0]),
                                        "label": image_info(archive, target)}
            csvs = [name for name in names if name.endswith(".csv")]
            if csvs and "msls" not in result:
                lines = archive.read(csvs[0]).decode("utf-8", "replace").splitlines()[:3]
                result["msls"] = {"archive": path.name, "member": csvs[0], "lines": lines}
    return result


def omnicity(root):
    result = {"v1_json": []}
    with zipfile.ZipFile(root / "OmniCity.zip") as outer:
        for name in outer.namelist():
            if name.endswith(".json"):
                result["v1_json"].append({"member": name,
                    "structure": structure(json.loads(outer.read(name)))})
        height_zip = next(name for name in outer.namelist()
                          if "annotation-height" in name and name.endswith(".zip"))
        with zipfile.ZipFile(io.BytesIO(outer.read(height_zip))) as inner:
            mask = next(name for name in inner.namelist() if name.endswith((".png", ".tif", ".tiff")))
            result["height"] = {"nested_archive": height_zip, "label": image_info(inner, mask)}
    with zipfile.ZipFile(root / "omnicity-v2.0-crossview-segmentation.zip") as archive:
        names = archive.namelist()
        svi = next(name for name in names if "/images/svi/" in name and name.endswith(".jpg"))
        stem = PurePosixPath(svi).stem
        masks = [name for name in names if name.endswith(".png") and stem in name]
        result["v2"] = {"image": image_info(archive, svi),
                        "matching_masks": [image_info(archive, name) for name in masks]}
    return result


def main():
    root = Path("/workspace/datasets")
    report = {
        "cityscapes": cityscapes(root / "cityscapes_20260920/files"),
        "mapillary": mapillary(root / "mapillary_vistas_2_0_20260920/files"),
        "omnicity": omnicity(root / "omnicity_20260920/OpenDataLab___OmniCity/raw"),
        "bdd100k": {"status": "images ZIP incomplete; no label package present"},
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
