"""Fetch OSM features explicitly named for Shenzhen's historic management line."""

from __future__ import annotations

import json
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tmp" / "shenzhen_second_line_named_osm.json"
QUERY = '''[out:json][timeout:120];
way["name"~"深圳经济特区管理线"](22.40,113.70,22.90,114.50);
out tags geom;'''


def main() -> None:
    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": QUERY},
        headers={"User-Agent": "urbanfabric-boundary-options/1.0"},
        timeout=180,
    )
    response.raise_for_status()
    payload = response.json()
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print({
        "output": str(OUTPUT),
        "features": [
            {
                "id": element["id"],
                "name": element.get("tags", {}).get("name"),
                "highway": element.get("tags", {}).get("highway"),
                "vertices": len(element.get("geometry", [])),
            }
            for element in payload.get("elements", [])
        ],
    })


if __name__ == "__main__":
    main()
