from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = PROJECT_ROOT / "configs"
LAYERS_PATH = CONFIG_DIR / "layers.json"
GRADIENTS_PATH = CONFIG_DIR / "gradients.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str, fallback: str = "layer") -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return slug[:48] or fallback


def make_layer_id(prompt: str, existing_ids: set[str]) -> str:
    base = slugify(prompt)
    candidate = base
    index = 2
    while candidate in existing_ids:
        candidate = f"{base}_{index}"
        index += 1
    return candidate


def default_state() -> dict[str, Any]:
    return {
        "layers": [],
        "selected_layer_id": None,
        "updated_at": utc_now(),
    }


def load_layer_state(path: Path = LAYERS_PATH) -> dict[str, Any]:
    if not path.exists():
        return default_state()

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"Layer state must be an object: {path}")
    data.setdefault("layers", [])
    data.setdefault("selected_layer_id", data["layers"][0]["id"] if data["layers"] else None)
    return data


def save_layer_state(state: dict[str, Any], path: Path = LAYERS_PATH) -> None:
    state["updated_at"] = utc_now()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def new_layer(prompt: str, existing_ids: set[str], gradient_id: str = "default_heat") -> dict[str, Any]:
    layer_id = make_layer_id(prompt, existing_ids)
    label = prompt.strip()
    if len(label) > 46:
        label = label[:43].rstrip() + "..."

    return {
        "id": layer_id,
        "name": label or layer_id,
        "prompt": prompt.strip(),
        "visible": True,
        "order": 0,
        "source_type": "geojson",
        "source_path": "",
        "score_property": "score",
        "style": {
            "gradient_id": gradient_id,
            "opacity": 0.75,
            "score_min": 0.0,
            "score_max": 1.0,
        },
        "status": "ready",
        "created_at": utc_now(),
    }


def normalize_orders(state: dict[str, Any]) -> dict[str, Any]:
    for index, layer in enumerate(state.get("layers", [])):
        layer["order"] = index
    return state


def selected_layer(state: dict[str, Any]) -> dict[str, Any] | None:
    selected_id = state.get("selected_layer_id")
    for layer in state.get("layers", []):
        if layer.get("id") == selected_id:
            return layer
    return state.get("layers", [None])[0] if state.get("layers") else None


def select_layer(state: dict[str, Any], layer_id: str | None) -> dict[str, Any]:
    ids = {layer["id"] for layer in state.get("layers", [])}
    if layer_id in ids:
        state["selected_layer_id"] = layer_id
    elif state.get("layers"):
        state["selected_layer_id"] = state["layers"][0]["id"]
    else:
        state["selected_layer_id"] = None
    return state


def layer_choices(state: dict[str, Any]) -> list[str]:
    return [layer["id"] for layer in state.get("layers", [])]


def layer_table(state: dict[str, Any]) -> list[list[Any]]:
    rows = []
    selected_id = state.get("selected_layer_id")
    for index, layer in enumerate(state.get("layers", []), start=1):
        rows.append(
            [
                index,
                "*" if layer["id"] == selected_id else "",
                "on" if layer.get("visible", True) else "off",
                layer.get("name", layer["id"]),
                layer.get("prompt", ""),
                layer.get("style", {}).get("gradient_id", ""),
                layer.get("status", ""),
            ]
        )
    return rows
