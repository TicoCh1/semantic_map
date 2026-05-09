from __future__ import annotations

import json
from typing import Any

from .frontend import CSS_TEMPLATE, HEAD_HTML, HTML_TEMPLATE, JS_ON_LOAD
from .gradients import coerce_gradient, load_gradients, save_gradients
from .mock_data import ensure_mock_geojson
from .state import (
    GRADIENTS_PATH,
    PROJECT_ROOT,
    layer_choices,
    load_layer_state,
    new_layer,
    normalize_orders,
    save_layer_state,
    select_layer,
)


APP_CSS = """
.gradio-container {
  max-width: none !important;
}
footer {
  display: none !important;
}
"""


def build_demo():
    import gradio as gr

    ensure_initial_state()

    with gr.Blocks(title="Semantic Map") as demo:
        gr.HTML(
            value="",
            html_template=HTML_TEMPLATE,
            css_template=CSS_TEMPLATE,
            js_on_load=JS_ON_LOAD,
            head=HEAD_HTML,
            min_height=680,
            server_functions=[
                get_frontend_payload,
                create_layer_from_prompt,
                delete_layer_by_id,
                save_frontend_payload,
            ],
        )

    return demo


def ensure_initial_state() -> dict[str, Any]:
    gradients = load_gradients(GRADIENTS_PATH)
    state = load_layer_state()

    if not state.get("layers"):
        layer = new_layer("The scene contains an animal", existing_ids=set(), gradient_id=gradients[0]["id"])
        layer["name"] = "Animal score"
        layer["source_path"] = ensure_mock_geojson(PROJECT_ROOT, layer)
        state["layers"] = [layer]
        state["selected_layer_id"] = layer["id"]
    else:
        for layer in state.get("layers", []):
            if not layer.get("source_path"):
                layer["source_path"] = ensure_mock_geojson(PROJECT_ROOT, layer)

    select_layer(state, state.get("selected_layer_id"))
    normalize_orders(state)
    save_layer_state(state)
    return state


def get_frontend_payload() -> dict[str, Any]:
    state = ensure_initial_state()
    gradients = load_gradients(GRADIENTS_PATH)
    return package_payload(state, gradients)


def create_layer_from_prompt(prompt: str) -> dict[str, Any]:
    prompt = (prompt or "").strip()
    if not prompt:
        return get_frontend_payload()

    state = ensure_initial_state()
    gradients = load_gradients(GRADIENTS_PATH)
    existing_ids = {layer["id"] for layer in state.get("layers", [])}
    default_gradient_id = gradients[0]["id"] if gradients else "default_heat"

    layer = new_layer(prompt, existing_ids=existing_ids, gradient_id=default_gradient_id)
    layer["source_path"] = ensure_mock_geojson(PROJECT_ROOT, layer)
    state.setdefault("layers", []).insert(0, layer)
    state["selected_layer_id"] = layer["id"]
    normalize_orders(state)
    save_layer_state(state)
    return package_payload(state, gradients)


def delete_layer_by_id(layer_id: str) -> dict[str, Any]:
    state = ensure_initial_state()
    gradients = load_gradients(GRADIENTS_PATH)
    layer_id = str(layer_id or "")
    layers = [layer for layer in state.get("layers", []) if layer.get("id") != layer_id]
    state["layers"] = layers
    state["selected_layer_id"] = layers[0]["id"] if layers else None
    normalize_orders(state)
    save_layer_state(state)
    return package_payload(state, gradients)


def save_frontend_payload(payload: dict[str, Any]) -> dict[str, Any]:
    state = sanitize_state(payload.get("state") or {})
    gradients = sanitize_gradients(payload.get("gradients") or [])

    save_gradients(GRADIENTS_PATH, gradients)
    save_layer_state(state)
    return {"ok": True, "payload": package_payload(state, gradients)}


def package_payload(state: dict[str, Any], gradients: list[dict[str, Any]]) -> dict[str, Any]:
    layer_payloads = []
    for layer in state.get("layers", []):
        source_path = layer.get("source_path")
        geojson = None
        if source_path:
            path = PROJECT_ROOT / source_path
            if path.exists() and path.is_file() and path.resolve().is_relative_to(PROJECT_ROOT):
                geojson = json.loads(path.read_text(encoding="utf-8"))
        layer_payloads.append(
            {
                "id": layer["id"],
                "geojson": geojson,
            }
        )

    return {
        "state": state,
        "gradients": gradients,
        "layers": layer_payloads,
        "layer_choices": layer_choices(state),
    }


def sanitize_gradients(raw_gradients: list[Any]) -> list[dict[str, Any]]:
    gradients = []
    seen = set()
    for raw in raw_gradients:
        try:
            gradient = coerce_gradient(raw)
        except Exception:
            continue
        if gradient["id"] in seen:
            continue
        seen.add(gradient["id"])
        gradients.append(gradient)

    if not gradients:
        gradients = load_gradients(GRADIENTS_PATH)
    return gradients


def sanitize_state(raw_state: dict[str, Any]) -> dict[str, Any]:
    current = ensure_initial_state()
    current_by_id = {layer["id"]: layer for layer in current.get("layers", [])}
    cleaned_layers = []
    seen = set()

    for raw_layer in raw_state.get("layers", []):
        if not isinstance(raw_layer, dict):
            continue
        layer_id = str(raw_layer.get("id") or "").strip()
        if not layer_id or layer_id in seen or layer_id not in current_by_id:
            continue

        existing = current_by_id[layer_id]
        style = raw_layer.get("style") if isinstance(raw_layer.get("style"), dict) else {}
        existing_style = existing.get("style", {})

        cleaned = {
            **existing,
            "visible": bool(raw_layer.get("visible", existing.get("visible", True))),
            "style": {
                "gradient_id": str(style.get("gradient_id", existing_style.get("gradient_id", "default_heat"))),
                "opacity": max(0.0, min(1.0, float(style.get("opacity", existing_style.get("opacity", 0.75))))),
                "score_min": float(style.get("score_min", existing_style.get("score_min", 0.0))),
                "score_max": float(style.get("score_max", existing_style.get("score_max", 1.0))),
            },
        }
        cleaned_layers.append(cleaned)
        seen.add(layer_id)

    for layer in current.get("layers", []):
        if layer["id"] not in seen:
            cleaned_layers.append(layer)

    state = {
        "layers": cleaned_layers,
        "selected_layer_id": raw_state.get("selected_layer_id"),
    }
    select_layer(state, state.get("selected_layer_id"))
    normalize_orders(state)
    return state
