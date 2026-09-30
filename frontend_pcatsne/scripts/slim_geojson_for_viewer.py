from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "pcatsne-geojson"
TARGET_DIR = ROOT / "frontend_pcatsne" / "public" / "data"

SOURCES = [
    ("2km_tsne3_rgb_uint8.geojson", "r02km_bbox"),
    ("4km_tsne3_rgb_uint8.geojson", "r04km_bbox"),
    ("8km_tsne3_rgb_uint8.geojson", "r08km_bbox"),
    ("16km_tsne3_rgb_uint8.geojson", "r16km_bbox"),
    ("32km_tsne3_rgb_uint8.geojson", "r32km_all_london"),
]


def iter_feature_json(path: Path, chunk_size: int = 1024 * 1024) -> Iterator[str]:
    with path.open("r", encoding="utf-8") as handle:
        buffer = ""
        in_features = False
        in_object = False
        in_string = False
        escaped = False
        depth = 0
        feature_chars: list[str] = []

        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break
            buffer += chunk

            index = 0
            if not in_features:
                marker_index = buffer.find('"features"')
                if marker_index < 0:
                    buffer = buffer[-32:]
                    continue
                bracket_index = buffer.find("[", marker_index)
                if bracket_index < 0:
                    buffer = buffer[marker_index:]
                    continue
                in_features = True
                index = bracket_index + 1

            while index < len(buffer):
                char = buffer[index]
                index += 1

                if not in_object:
                    if char == "{":
                        in_object = True
                        in_string = False
                        escaped = False
                        depth = 1
                        feature_chars = ["{"]
                    elif char == "]":
                        return
                    continue

                feature_chars.append(char)
                if in_string:
                    if escaped:
                        escaped = False
                    elif char == "\\":
                        escaped = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        yield "".join(feature_chars)
                        in_object = False
                        feature_chars = []

            buffer = "" if in_features else buffer[-32:]


def as_int(value):
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def numeric_property(properties: dict, lower_name: str, upper_name: str):
    value = properties.get(lower_name, properties.get(upper_name))
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return value


def slim_feature(feature: dict) -> dict:
    properties = feature.get("properties") or {}
    geometry = feature.get("geometry") or {"type": "Point", "coordinates": [None, None]}
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    lon = coordinates[0] if isinstance(coordinates, list) and len(coordinates) >= 2 else properties.get("LON")
    lat = coordinates[1] if isinstance(coordinates, list) and len(coordinates) >= 2 else properties.get("LAT")

    pano_id = properties.get("pano_id", properties.get("ID"))
    slim_properties = {
        "row_index": as_int(properties.get("row_index")),
        "ID": as_int(pano_id),
        "LON": lon,
        "LAT": lat,
        "DATE": as_int(properties.get("date", properties.get("DATE"))),
        "R": as_int(properties.get("r", properties.get("R"))),
        "G": as_int(properties.get("g", properties.get("G"))),
        "B": as_int(properties.get("b", properties.get("B"))),
        "TSNE1_NORM": numeric_property(properties, "tsne1_norm", "TSNE1_NORM"),
        "TSNE2_NORM": numeric_property(properties, "tsne2_norm", "TSNE2_NORM"),
        "TSNE3_NORM": numeric_property(properties, "tsne3_norm", "TSNE3_NORM"),
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": slim_properties,
    }


def convert_file(source: Path, target: Path) -> int:
    target.parent.mkdir(parents=True, exist_ok=True)
    feature_count = 0
    with target.open("w", encoding="utf-8") as out:
        out.write('{"type":"FeatureCollection","features":[')
        first = True
        for raw_feature in iter_feature_json(source):
            feature = slim_feature(json.loads(raw_feature))
            if not first:
                out.write(",")
            out.write(json.dumps(feature, separators=(",", ":"), ensure_ascii=False))
            first = False
            feature_count += 1
            if feature_count % 50_000 == 0:
                print(f"  {feature_count:,} features")
        out.write("]}")
    return feature_count


def main() -> None:
    for source_name, target_subdir in SOURCES:
        source = SOURCE_DIR / source_name
        target = TARGET_DIR / target_subdir / "tsne3_rgb_uint8.geojson"
        if not source.exists():
            raise FileNotFoundError(source)
        print(f"Converting {source.name} -> {target.relative_to(ROOT)}")
        feature_count = convert_file(source, target)
        print(
            f"  done: {feature_count:,} features, "
            f"{source.stat().st_size / 1024 / 1024:.2f} MiB -> {target.stat().st_size / 1024 / 1024:.2f} MiB"
        )


if __name__ == "__main__":
    main()
