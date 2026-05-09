from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .mock_data import ensure_mock_geojson
from .schemas import GradientPreset, LayerState, LayerStyle, SemanticLayer


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = PROJECT_ROOT / "configs"
LAYERS_PATH = CONFIG_DIR / "layers.json"
GRADIENTS_PATH = CONFIG_DIR / "gradients.json"


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
        "id": "viridis",
        "name": "Viridis",
        "stops": [
            {"value": 0.0, "color": "#440154"},
            {"value": 0.25, "color": "#3b528b"},
            {"value": 0.5, "color": "#21918c"},
            {"value": 0.75, "color": "#5ec962"},
            {"value": 1.0, "color": "#fde725"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "turbo",
        "name": "Turbo",
        "stops": [
            {"value": 0.0, "color": "#30123b"},
            {"value": 0.125, "color": "#4663d7"},
            {"value": 0.25, "color": "#37a9e6"},
            {"value": 0.375, "color": "#1ae4b6"},
            {"value": 0.5, "color": "#71fe5f"},
            {"value": 0.625, "color": "#c8ef34"},
            {"value": 0.75, "color": "#faba39"},
            {"value": 0.875, "color": "#ef5a11"},
            {"value": 1.0, "color": "#a71401"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "magma",
        "name": "Magma",
        "stops": [
            {"value": 0.0, "color": "#000004"},
            {"value": 0.2, "color": "#3b0f70"},
            {"value": 0.4, "color": "#8c2981"},
            {"value": 0.6, "color": "#de4968"},
            {"value": 0.8, "color": "#fe9f6d"},
            {"value": 1.0, "color": "#fcfdbf"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "spectral",
        "name": "Spectral",
        "stops": [
            {"value": 0.0, "color": "#9e0142"},
            {"value": 0.125, "color": "#d53e4f"},
            {"value": 0.25, "color": "#f46d43"},
            {"value": 0.375, "color": "#fdae61"},
            {"value": 0.5, "color": "#ffffbf"},
            {"value": 0.625, "color": "#abdda4"},
            {"value": 0.75, "color": "#66c2a5"},
            {"value": 0.875, "color": "#3288bd"},
            {"value": 1.0, "color": "#5e4fa2"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "red",
        "name": "Red",
        "stops": [
            {"value": 0.0, "color": "#000000"},
            {"value": 1.0, "color": "#ff0000"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "green",
        "name": "Green",
        "stops": [
            {"value": 0.0, "color": "#000000"},
            {"value": 1.0, "color": "#00ff00"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "blue",
        "name": "Blue",
        "stops": [
            {"value": 0.0, "color": "#000000"},
            {"value": 1.0, "color": "#0000ff"},
        ],
        "opacity": 0.75,
        "score_min": 0.0,
        "score_max": 1.0,
        "updated_at": "2026-04-27T00:00:00Z",
        "is_default": True,
    },
    {
        "id": "white",
        "name": "White",
        "stops": [
            {"value": 0.0, "color": "#000000"},
            {"value": 1.0, "color": "#ffffff"},
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


def load_gradients() -> list[dict[str, Any]]:
    if not GRADIENTS_PATH.exists():
        save_gradients(DEFAULT_GRADIENTS)
        return json.loads(json.dumps(DEFAULT_GRADIENTS))

    raw = json.loads(GRADIENTS_PATH.read_text(encoding="utf-8"))
    gradients = [normalize_gradient(item) for item in raw]
    if not gradients:
        gradients = json.loads(json.dumps(DEFAULT_GRADIENTS))

    existing_ids = {gradient["id"] for gradient in gradients}
    changed = False
    for default in DEFAULT_GRADIENTS:
        if default["id"] in existing_ids:
            continue
        gradients.append(normalize_gradient(deepcopy(default)))
        changed = True
    if changed:
        save_gradients(gradients)
    return gradients


def save_gradients(gradients: list[dict[str, Any]]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    cleaned = [normalize_gradient(item) for item in gradients]
    GRADIENTS_PATH.write_text(json.dumps(cleaned, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize_gradient(raw: dict[str, Any]) -> dict[str, Any]:
    if "updated_at" not in raw or not raw["updated_at"]:
        raw = {**raw, "updated_at": utc_now()}
    model = GradientPreset.model_validate(raw)
    data = model.model_dump()
    data["stops"] = sorted(data["stops"], key=lambda stop: stop["value"])
    data["is_default"] = data["id"] in {item["id"] for item in DEFAULT_GRADIENTS if item.get("is_default")}
    return data


def find_gradient(gradients: list[dict[str, Any]], gradient_id: str | None) -> dict[str, Any]:
    return next((item for item in gradients if item["id"] == gradient_id), gradients[0])


def gradient_to_layer_style(gradient: dict[str, Any], existing: dict[str, Any] | None = None) -> dict[str, Any]:
    existing = existing or {}
    return LayerStyle.model_validate(
        {
            "gradient_id": gradient["id"],
            "gradient_name": gradient["name"],
            "stops": deepcopy(gradient["stops"]),
            "opacity": existing.get("opacity", gradient.get("opacity", 0.75)),
            "score_min": existing.get("score_min", gradient.get("score_min", 0.0)),
            "score_max": existing.get("score_max", gradient.get("score_max", 1.0)),
            "point_radius": existing.get("point_radius", 5.5),
            "absolute_radius": existing.get("absolute_radius", False),
        }
    ).model_dump()


def normalize_layer_style(raw_style: dict[str, Any] | None, gradients: list[dict[str, Any]]) -> dict[str, Any]:
    style = dict(raw_style or {})
    gradient = find_gradient(gradients, style.get("gradient_id"))

    if not style.get("stops") or len(style.get("stops", [])) < 2:
        return gradient_to_layer_style(gradient, style)

    style.setdefault("gradient_id", gradient["id"])
    style.setdefault("gradient_name", gradient["name"])
    style.setdefault("opacity", gradient.get("opacity", 0.75))
    style.setdefault("score_min", gradient.get("score_min", 0.0))
    style.setdefault("score_max", gradient.get("score_max", 1.0))
    style.setdefault("point_radius", 5.5)
    style.setdefault("absolute_radius", False)
    return LayerStyle.model_validate(style).model_dump()


def load_state() -> dict[str, Any]:
    if not LAYERS_PATH.exists():
        state = {
            "layers": [],
            "selected_layer_id": None,
            "updated_at": utc_now(),
        }
    else:
        state = json.loads(LAYERS_PATH.read_text(encoding="utf-8"))

    if not state.get("layers"):
        gradients = load_gradients()
        layer = create_layer_record(
            prompt="The scene contains an animal",
            existing_ids=set(),
            gradient_id=gradients[0]["id"],
            name="Animal score",
        )
        state = {"layers": [layer], "selected_layer_id": layer["id"], "updated_at": utc_now()}

    for layer in state.get("layers", []):
        if not layer.get("source_path") or not (PROJECT_ROOT / layer["source_path"]).exists():
            layer["source_path"] = ensure_mock_geojson(PROJECT_ROOT, layer)

    state = normalize_state(state)
    save_state(state)
    return state


def save_state(state: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    state = normalize_state(state)
    state["updated_at"] = utc_now()
    LAYERS_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def normalize_state(state: dict[str, Any]) -> dict[str, Any]:
    gradients = load_gradients()
    layers = []
    for index, raw in enumerate(state.get("layers", [])):
        raw = {**raw, "order": index}
        raw["style"] = normalize_layer_style(raw.get("style"), gradients)
        layers.append(SemanticLayer.model_validate(raw).model_dump())

    selected_id = state.get("selected_layer_id")
    ids = {layer["id"] for layer in layers}
    if selected_id not in ids:
        selected_id = layers[0]["id"] if layers else None

    return {
        "layers": layers,
        "selected_layer_id": selected_id,
        "updated_at": state.get("updated_at") or utc_now(),
    }


def create_layer_record(
    prompt: str,
    existing_ids: set[str],
    gradient_id: str = "default_heat",
    name: str | None = None,
) -> dict[str, Any]:
    gradients = load_gradients()
    gradient = find_gradient(gradients, gradient_id)
    layer_id = make_layer_id(prompt, existing_ids)
    label = (name or prompt).strip()
    if len(label) > 58:
        label = label[:55].rstrip() + "..."

    layer = {
        "id": layer_id,
        "name": label or layer_id,
        "prompt": prompt.strip(),
        "visible": True,
        "order": 0,
        "source_type": "geojson",
        "source_path": "",
        "score_property": "score",
        "style": gradient_to_layer_style(gradient),
        "status": "ready",
        "created_at": utc_now(),
    }
    layer["source_path"] = ensure_mock_geojson(PROJECT_ROOT, layer)
    return layer


def get_state_model() -> LayerState:
    return LayerState.model_validate(load_state())


def create_layer(prompt: str, name: str | None = None, gradient_id: str | None = None) -> dict[str, Any]:
    state = load_state()
    gradients = load_gradients()
    fallback_gradient = gradients[0]["id"] if gradients else "default_heat"
    existing_ids = {layer["id"] for layer in state["layers"]}
    layer = create_layer_record(
        prompt=prompt,
        existing_ids=existing_ids,
        gradient_id=gradient_id or fallback_gradient,
        name=name,
    )
    state["layers"].insert(0, layer)
    state["selected_layer_id"] = layer["id"]
    save_state(state)
    return layer


def update_layer(layer_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    state = load_state()
    updated = None
    for layer in state["layers"]:
        if layer["id"] != layer_id:
            continue
        if patch.get("name") is not None:
            layer["name"] = str(patch["name"])
        if patch.get("visible") is not None:
            layer["visible"] = bool(patch["visible"])
        if patch.get("style") is not None:
            layer["style"] = patch["style"]
        if patch.get("selected") is True:
            state["selected_layer_id"] = layer_id
        updated = layer
        break
    save_state(state)
    return updated


def delete_layer(layer_id: str) -> bool:
    state = load_state()
    before = len(state["layers"])
    state["layers"] = [layer for layer in state["layers"] if layer["id"] != layer_id]
    if state.get("selected_layer_id") == layer_id:
        state["selected_layer_id"] = state["layers"][0]["id"] if state["layers"] else None
    save_state(state)
    return len(state["layers"]) != before


def reorder_layers(layer_ids: list[str]) -> dict[str, Any]:
    state = load_state()
    by_id = {layer["id"]: layer for layer in state["layers"]}
    ordered = [by_id[layer_id] for layer_id in layer_ids if layer_id in by_id]
    ordered.extend(layer for layer in state["layers"] if layer["id"] not in set(layer_ids))
    state["layers"] = ordered
    save_state(state)
    return load_state()


def read_layer_geojson(layer_id: str) -> dict[str, Any] | None:
    state = load_state()
    layer = next((item for item in state["layers"] if item["id"] == layer_id), None)
    if not layer:
        return None
    path = (PROJECT_ROOT / layer["source_path"]).resolve()
    if not path.is_relative_to(PROJECT_ROOT.resolve()) or not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
