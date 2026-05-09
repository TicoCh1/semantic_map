from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

DEFAULT_GRADIENTS: list[dict[str, Any]] = [
    {
        "id": "default_heat",
        "name": "Default heat",
        "stops": [
            {"value": 0.0, "color": "#2c7bb6"},
            {"value": 0.5, "color": "#ffffbf"},
            {"value": 1.0, "color": "#d7191c"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "violet_gold",
        "name": "Violet gold",
        "stops": [
            {"value": 0.0, "color": "#2d3142"},
            {"value": 0.45, "color": "#8d99ae"},
            {"value": 1.0, "color": "#f6c85f"},
        ],
        "opacity": 0.7,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": False,
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_gradients(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        save_gradients(path, DEFAULT_GRADIENTS)
        return json.loads(json.dumps(DEFAULT_GRADIENTS))

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Gradient config must be a list: {path}")
    return [coerce_gradient(item) for item in data]


def save_gradients(path: Path, gradients: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cleaned = [coerce_gradient(item) for item in gradients]
    path.write_text(json.dumps(cleaned, indent=2, ensure_ascii=False), encoding="utf-8")


def gradient_by_id(gradients: list[dict[str, Any]], gradient_id: str) -> dict[str, Any]:
    for gradient in gradients:
        if gradient.get("id") == gradient_id:
            return gradient
    return gradients[0] if gradients else DEFAULT_GRADIENTS[0]


def coerce_gradient(raw: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("Gradient must be an object.")

    gradient_id = str(raw.get("id") or raw.get("name") or "gradient").strip()
    name = str(raw.get("name") or gradient_id).strip()
    stops = raw.get("stops")
    if not isinstance(stops, list) or len(stops) < 2:
        raise ValueError("Gradient requires at least two stops.")

    cleaned_stops = []
    for stop in stops:
        if not isinstance(stop, dict):
            raise ValueError("Each gradient stop must be an object.")
        value = float(stop.get("value"))
        color = str(stop.get("color", "")).strip()
        if not HEX_COLOR_RE.match(color):
            raise ValueError(f"Invalid color: {color}")
        cleaned_stops.append({"value": value, "color": color.lower()})

    cleaned_stops.sort(key=lambda item: item["value"])
    score_min = float(raw.get("score_min", cleaned_stops[0]["value"]))
    score_max = float(raw.get("score_max", cleaned_stops[-1]["value"]))
    opacity = max(0.0, min(1.0, float(raw.get("opacity", 0.75))))

    return {
        "id": gradient_id,
        "name": name,
        "stops": cleaned_stops,
        "opacity": opacity,
        "score_min": score_min,
        "score_max": score_max,
        "updated_at": str(raw.get("updated_at") or utc_now()),
        "is_default": bool(raw.get("is_default", False)),
    }


def gradient_to_mapbox_expression(
    gradient: dict[str, Any],
    score_property: str = "score",
    score_min: float | None = None,
    score_max: float | None = None,
) -> list[Any]:
    cleaned = coerce_gradient(gradient)
    source_min = cleaned["stops"][0]["value"]
    source_max = cleaned["stops"][-1]["value"]
    target_min = cleaned["score_min"] if score_min is None else float(score_min)
    target_max = cleaned["score_max"] if score_max is None else float(score_max)

    if source_max == source_min:
        source_max = source_min + 1.0
    if target_max == target_min:
        target_max = target_min + 1.0

    expression: list[Any] = ["interpolate", ["linear"], ["get", score_property]]
    for stop in cleaned["stops"]:
        normalized = (stop["value"] - source_min) / (source_max - source_min)
        mapped_value = target_min + normalized * (target_max - target_min)
        expression.extend([mapped_value, stop["color"]])
    return expression
