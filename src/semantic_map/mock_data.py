from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path
from typing import Any


LONDON_CENTER = (-0.1276, 51.5072)
LONDON_BOUNDS = {
    "west": -0.31,
    "east": 0.05,
    "south": 51.42,
    "north": 51.58,
}


def ensure_mock_geojson(project_root: Path, layer: dict[str, Any], count: int = 220) -> str:
    data_dir = project_root / "data" / "mock"
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / f"{layer['id']}.geojson"

    if not path.exists():
        geojson = make_mock_geojson(
            prompt=str(layer.get("prompt") or layer.get("name") or layer["id"]),
            layer_id=str(layer["id"]),
            count=count,
        )
        path.write_text(json.dumps(geojson, indent=2), encoding="utf-8")

    return str(path.relative_to(project_root)).replace("\\", "/")


def make_mock_geojson(prompt: str, layer_id: str, count: int = 220) -> dict[str, Any]:
    seed = int(hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12], 16)
    rng = random.Random(seed)

    west = LONDON_BOUNDS["west"]
    east = LONDON_BOUNDS["east"]
    south = LONDON_BOUNDS["south"]
    north = LONDON_BOUNDS["north"]

    hotspots = [
        (
            rng.uniform(west, east),
            rng.uniform(south, north),
            rng.uniform(0.45, 0.85),
            rng.uniform(0.025, 0.065),
        )
        for _ in range(3)
    ]

    features = []
    raw_scores = []
    coords = []
    for index in range(count):
        lon = rng.uniform(west, east)
        lat = rng.uniform(south, north)
        score = 0.08 + rng.random() * 0.18

        for hot_lon, hot_lat, weight, radius in hotspots:
            distance = math.sqrt((lon - hot_lon) ** 2 + ((lat - hot_lat) * 1.6) ** 2)
            score += weight * math.exp(-((distance / radius) ** 2))

        score = max(0.0, min(1.0, score))
        coords.append((lon, lat))
        raw_scores.append(score)

    mean = sum(raw_scores) / len(raw_scores)
    variance = sum((score - mean) ** 2 for score in raw_scores) / len(raw_scores)
    std = math.sqrt(variance) or 1.0

    for index, ((lon, lat), score) in enumerate(zip(coords, raw_scores), start=1):
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]},
                "properties": {
                    "id": f"{layer_id}_{index:04d}",
                    "layer_id": layer_id,
                    "prompt": prompt,
                    "score": round(score, 6),
                    "zscore": round((score - mean) / std, 6),
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "layer_id": layer_id,
            "prompt": prompt,
            "mock": True,
            "center": list(LONDON_CENTER),
        },
    }
