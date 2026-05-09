from __future__ import annotations

import html
import json
import uuid
from pathlib import Path
from typing import Any

from .gradients import gradient_by_id, gradient_to_mapbox_expression
from .mock_data import LONDON_CENTER


def render_map_iframe(
    state: dict[str, Any],
    gradients: list[dict[str, Any]],
    project_root: Path,
) -> str:
    frame_html = render_map_document(state, gradients, project_root)
    return (
        '<iframe class="semantic-map-frame" '
        'title="Semantic score map" '
        'referrerpolicy="no-referrer-when-downgrade" '
        f'srcdoc="{html.escape(frame_html, quote=True)}"></iframe>'
    )


def render_map_document(
    state: dict[str, Any],
    gradients: list[dict[str, Any]],
    project_root: Path,
) -> str:
    map_id = f"map_{uuid.uuid4().hex}"
    layers = []

    for layer in state.get("layers", []):
        if not layer.get("visible", True):
            continue

        source_path = layer.get("source_path")
        if not source_path:
            continue

        absolute_path = project_root / source_path
        if not absolute_path.exists():
            continue

        geojson = json.loads(absolute_path.read_text(encoding="utf-8"))
        style = layer.get("style", {})
        gradient = gradient_by_id(gradients, style.get("gradient_id", "default_heat"))
        opacity = float(style.get("opacity", gradient.get("opacity", 0.75)))
        score_min = float(style.get("score_min", gradient.get("score_min", 0.0)))
        score_max = float(style.get("score_max", gradient.get("score_max", 1.0)))
        score_property = layer.get("score_property", "score")

        layers.append(
            {
                "id": layer["id"],
                "name": layer.get("name", layer["id"]),
                "prompt": layer.get("prompt", ""),
                "geojson": geojson,
                "scoreProperty": score_property,
                "paint": {
                    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 13, 5.5, 16, 9.5],
                    "circle-color": gradient_to_mapbox_expression(
                        gradient,
                        score_property=score_property,
                        score_min=score_min,
                        score_max=score_max,
                    ),
                    "circle-opacity": opacity,
                    "circle-stroke-color": "#1f2937",
                    "circle-stroke-width": 0.45,
                    "circle-stroke-opacity": 0.55,
                },
            }
        )

    payload = {
        "center": list(LONDON_CENTER),
        "drawLayers": list(reversed(layers)),
        "uiLayers": [
            {
                "name": layer.get("name", layer["id"]),
                "visible": bool(layer.get("visible", True)),
                "gradient": layer.get("style", {}).get("gradient_id", "default_heat"),
            }
            for layer in state.get("layers", [])
        ],
    }

    payload_json = json.dumps(payload)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://api.mapbox.com/mapbox-gl-js/v1.13.3/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v1.13.3/mapbox-gl.js"></script>
  <style>
    html, body, #{map_id} {{
      height: 100%;
      margin: 0;
      background: #eef0f2;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    .map-status {{
      position: absolute;
      left: 12px;
      bottom: 24px;
      z-index: 2;
      max-width: 360px;
      padding: 8px 10px;
      border: 1px solid rgba(17, 24, 39, 0.12);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.92);
      color: #111827;
      font-size: 12px;
      line-height: 1.35;
      box-shadow: 0 6px 18px rgba(17, 24, 39, 0.12);
    }}
    .mapboxgl-popup-content {{
      border-radius: 6px;
      padding: 10px 12px;
      color: #111827;
      font-size: 12px;
    }}
    .popup-title {{
      font-weight: 650;
      margin-bottom: 4px;
    }}
    .popup-row {{
      display: grid;
      grid-template-columns: 64px 1fr;
      gap: 8px;
      margin-top: 2px;
    }}
  </style>
</head>
<body>
  <div id="{map_id}"></div>
  <div id="status" class="map-status">Loading map...</div>
  <script>
    const payload = {payload_json};
    const statusEl = document.getElementById("status");

    function setStatus(message) {{
      statusEl.textContent = message;
    }}

    function popupHtml(layerName, props) {{
      const score = Number(props.score);
      const zscore = Number(props.zscore);
      return `
        <div class="popup-title">${{layerName}}</div>
        <div class="popup-row"><span>ID</span><span>${{props.id || ""}}</span></div>
        <div class="popup-row"><span>score</span><span>${{Number.isFinite(score) ? score.toFixed(4) : ""}}</span></div>
        <div class="popup-row"><span>zscore</span><span>${{Number.isFinite(zscore) ? zscore.toFixed(3) : ""}}</span></div>
      `;
    }}

    function boot() {{
      if (!window.mapboxgl) {{
        setStatus("Mapbox GL JS failed to load. Check network access to the CDN.");
        return;
      }}

      mapboxgl.accessToken = "";
      const map = new mapboxgl.Map({{
        container: "{map_id}",
        style: {{
          version: 8,
          sources: {{
            osm: {{
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors"
            }}
          }},
          layers: [
            {{
              id: "osm",
              type: "raster",
              source: "osm"
            }}
          ]
        }},
        center: payload.center,
        zoom: 10.45,
        minZoom: 8,
        maxZoom: 18,
        pitch: 0
      }});

      map.addControl(new mapboxgl.NavigationControl({{ visualizePitch: true }}), "top-right");
      map.addControl(new mapboxgl.ScaleControl({{ maxWidth: 120, unit: "metric" }}), "bottom-right");

      map.on("load", () => {{
        payload.drawLayers.forEach((layer) => {{
          map.addSource(layer.id, {{
            type: "geojson",
            data: layer.geojson
          }});
          map.addLayer({{
            id: layer.id,
            type: "circle",
            source: layer.id,
            paint: layer.paint
          }});

          map.on("mouseenter", layer.id, () => {{
            map.getCanvas().style.cursor = "pointer";
          }});
          map.on("mouseleave", layer.id, () => {{
            map.getCanvas().style.cursor = "";
          }});
          map.on("click", layer.id, (event) => {{
            const feature = event.features && event.features[0];
            if (!feature) return;
            new mapboxgl.Popup({{ closeButton: true, closeOnClick: true }})
              .setLngLat(event.lngLat)
              .setHTML(popupHtml(layer.name, feature.properties || {{}}))
              .addTo(map);
          }});
        }});

        const visibleCount = payload.drawLayers.length;
        const totalCount = payload.uiLayers.length;
        setStatus(`${{visibleCount}} visible semantic layer${{visibleCount === 1 ? "" : "s"}} / ${{totalCount}} total`);
      }});

      map.on("error", (event) => {{
        const message = event && event.error && event.error.message ? event.error.message : "Map error";
        setStatus(message);
      }});
    }}

    boot();
  </script>
</body>
</html>"""
