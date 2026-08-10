from __future__ import annotations

import json
import os
from collections.abc import Iterable, Mapping
from typing import Any


DEFAULT_CITY_CATALOG: dict[str, dict[str, Any]] = {
    "london": {
        "name": "London",
        "dataset_id": "london_224_8_45",
        "center": [-0.1276, 51.5072],
        "initial_zoom": 13.3758,
        "bounds": {"west": -1.05, "east": 0.70, "south": 50.85, "north": 52.05},
    },
    "shanghai": {
        "name": "Shanghai",
        "dataset_id": "shanghai_224_8_45_2B",
        "center": [121.4737, 31.2304],
        "initial_zoom": 13.8339,
        "bounds": {"west": 120.85, "east": 122.25, "south": 30.65, "north": 31.85},
    },
    "new_york": {
        "name": "New York",
        "dataset_id": "new_york_224_8_45",
        "center": [-74.0060, 40.7128],
        "initial_zoom": 13.6601,
        "bounds": {"west": -74.45, "east": -73.45, "south": 40.45, "north": 41.05},
    },
    "rome": {
        "name": "Rome",
        "dataset_id": "rome_224_8_45",
        "center": [12.4964, 41.9028],
        "initial_zoom": 13.6337,
        "bounds": {"west": 12.20, "east": 12.80, "south": 41.70, "north": 42.10},
    },
}


def _string_list(value: str | None) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(dict.fromkeys(item.strip() for item in value.split(",") if item.strip()))


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed == parsed and abs(parsed) != float("inf") else None


def _normalise_city(city_id: str, raw: Mapping[str, Any]) -> dict[str, Any] | None:
    dataset_id = str(raw.get("dataset_id") or "").strip()
    name = str(raw.get("name") or city_id.replace("_", " ").title()).strip()
    center = raw.get("center")
    bounds = raw.get("bounds")
    if not dataset_id or not isinstance(center, (list, tuple)) or len(center) != 2 or not isinstance(bounds, Mapping):
        return None
    lon = _as_number(center[0])
    lat = _as_number(center[1])
    normalised_bounds = {key: _as_number(bounds.get(key)) for key in ("west", "east", "south", "north")}
    if lon is None or lat is None or any(value is None for value in normalised_bounds.values()):
        return None
    initial_zoom = _as_number(raw.get("initial_zoom"))
    return {
        "id": city_id,
        "name": name or city_id,
        "dataset_id": dataset_id,
        "center": [lon, lat],
        "initial_zoom": initial_zoom if initial_zoom is not None else 10.45,
        "bounds": normalised_bounds,
    }


def city_catalog() -> dict[str, dict[str, Any]]:
    catalog: dict[str, dict[str, Any]] = {}
    for city_id, raw in DEFAULT_CITY_CATALOG.items():
        normalised = _normalise_city(city_id, raw)
        if normalised:
            catalog[city_id] = normalised

    raw_override = os.getenv("CITY_CATALOG_JSON", "").strip()
    if not raw_override:
        return catalog
    try:
        parsed = json.loads(raw_override)
    except json.JSONDecodeError as exc:
        raise RuntimeError("CITY_CATALOG_JSON must be valid JSON.") from exc

    entries: Iterable[tuple[str, Mapping[str, Any]]]
    if isinstance(parsed, Mapping):
        entries = ((str(city_id), raw) for city_id, raw in parsed.items() if isinstance(raw, Mapping))
    elif isinstance(parsed, list):
        entries = ((str(raw.get("id", "")), raw) for raw in parsed if isinstance(raw, Mapping))
    else:
        raise RuntimeError("CITY_CATALOG_JSON must be an object keyed by city id or a list of city objects.")

    for city_id, raw in entries:
        city_id = city_id.strip()
        normalised = _normalise_city(city_id, raw) if city_id else None
        if normalised:
            catalog[city_id] = normalised
    return catalog


def city_ids_for_datasets(dataset_ids: Iterable[str], catalog: Mapping[str, Mapping[str, Any]] | None = None) -> tuple[str, ...]:
    current_catalog = catalog or city_catalog()
    by_dataset = {str(city["dataset_id"]): city_id for city_id, city in current_catalog.items()}
    return tuple(city_id for dataset_id in dataset_ids if (city_id := by_dataset.get(dataset_id)))


def city_id_for_dataset(dataset_id: str, catalog: Mapping[str, Mapping[str, Any]] | None = None) -> str:
    current_catalog = catalog or city_catalog()
    for city_id, city in current_catalog.items():
        if city["dataset_id"] == dataset_id:
            return city_id
    return ""


def active_city_configs(settings: Any) -> list[dict[str, Any]]:
    catalog = city_catalog()
    loaded_dataset_ids = set(settings.default_dataset_ids)
    active_ids = tuple(settings.active_city_ids) or city_ids_for_datasets(settings.default_dataset_ids, catalog)
    configs: list[dict[str, Any]] = []
    for city_id in active_ids:
        city = catalog.get(city_id)
        if not city or city["dataset_id"] not in loaded_dataset_ids:
            continue
        suffix = "".join(char if char.isalnum() else "_" for char in city["dataset_id"].upper())
        has_pano_config = bool(os.getenv(f"PANO_TAR_RANGES_{suffix}")) or city["dataset_id"] in {
            "shanghai_224_8_45_2B",
            "new_york_224_8_45",
        }
        configs.append({**city, "live_demo": has_pano_config})
    return configs
