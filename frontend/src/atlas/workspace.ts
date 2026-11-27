import type { SemanticLayer } from "../api/types";
import type { Query } from "./data";

const key = "semantic-map-region-workspace-150m-v1";
type SavedLayer = Pick<SemanticLayer, "id" | "visible" | "style" | "score_property" | "color_range_override">;
type Workspace = { layers: SavedLayer[]; selectedId: string | null; showSelf: boolean };

export function saveWorkspace(layers: SemanticLayer[], selectedId: string | null, showSelf: boolean) {
  try {
    localStorage.setItem(key, JSON.stringify({ layers: layers.map(({ id, visible, style, score_property, color_range_override }) =>
      ({ id, visible, style, score_property, color_range_override })), selectedId, showSelf }));
  } catch { /* The map still works when browser storage is unavailable. */ }
}

export function defaultRange(query: Query, field: string) {
  return field === "score" ? query.smart_range.sim_raw : query.smart_range.sim_z;
}

export function restoreWorkspace(queries: Query[], requested: string | null, create: (q: Query) => SemanticLayer) {
  let saved: Workspace | undefined;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(parsed?.layers)) saved = parsed;
  } catch { /* No usable workspace yet. */ }
  const layers: SemanticLayer[] = [];
  for (const item of saved?.layers ?? []) {
    const q = queries.find(query => query.id === item?.id);
    if (!q || layers.some(layer => layer.id === q.id)) continue;
    const layer = create(q);
    const style = item.style;
    if (style && typeof style.gradient_id === "string" && Array.isArray(style.stops) && style.stops.length >= 2
      && style.stops.every((stop, i, stops) => stop && Number.isFinite(stop.value) && /^#[0-9a-f]{6}$/i.test(stop.color)
        && stop.value >= 0 && stop.value <= 1 && (!i || stop.value > stops[i-1].value))
      && Number.isFinite(style.opacity) && Number.isFinite(style.point_radius)) layer.style = { ...layer.style, ...style };
    layer.visible = item.visible !== false;
    layer.score_property = item.score_property === "score" ? "score" : "zscore";
    layer.color_range_default = defaultRange(q, layer.score_property);
    layer.style.score_min = layer.color_range_default.lower;
    layer.style.score_max = layer.color_range_default.upper;
    const range = item.color_range_override;
    if (range?.field === layer.score_property && Number.isFinite(range.lower) && Number.isFinite(range.upper) && range.upper > range.lower)
      layer.color_range_override = range;
    layers.push(layer);
  }
  const linked = queries.find(q => q.id === requested);
  let selectedId = layers.find(l => l.id === saved?.selectedId)?.id ?? layers[0]?.id ?? null;
  if (linked && (linked.id !== selectedId || !layers.some(l => l.id === linked.id))) {
    const index = layers.findIndex(layer => layer.id === linked.id);
    const layer = index < 0 ? create(linked) : layers.splice(index, 1)[0];
    layer.visible = true;
    layers.unshift(layer);
    selectedId = layer.id;
  } else if (!saved && !linked) {
    const layer = create(queries[0]);
    layers.push(layer);
    selectedId = layer.id;
  }
  return { layers, selectedId, showSelf: saved?.showSelf !== false };
}
