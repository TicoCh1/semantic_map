import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

/** Basemaps are replaceable scene layers, not owners of application data.
 * Retain live semantic/selection sources and their order in MapLibre's diff. */
export function preserveSceneStyle(previous: StyleSpecification | undefined, next: StyleSpecification, sourceIds: ReadonlySet<string>): StyleSpecification {
  if (!previous) return next;
  const sources = { ...next.sources };
  for (const id of sourceIds) if (previous.sources[id]) sources[id] = previous.sources[id];
  const sceneLayers = previous.layers.filter(layer => "source" in layer && typeof layer.source === "string" && sourceIds.has(layer.source));
  const ids = new Set(sceneLayers.map(layer => layer.id));
  return { ...next, sources, layers: [...next.layers.filter(layer => !ids.has(layer.id)), ...sceneLayers] };
}
