import type { CircleLayerSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "../api/types";

type SemanticMap = Pick<MapLibreMap, "getSource" | "getLayer" | "addSource" | "addLayer" | "setPaintProperty" | "moveLayer">;
const submittedData = new WeakMap<object, FeatureCollection>();
const submittedPaint = new WeakMap<object, Map<string, string>>();

/** Update data in place: removing a live source creates a blank frame while its
 * replacement is processed by MapLibre's worker. This also preserves hit targets. */
export function updateSemanticLayer(
  map: SemanticMap,
  id: string,
  data: FeatureCollection,
  paint: NonNullable<CircleLayerSpecification["paint"]>
) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) {
    if (submittedData.get(source) !== data) source.setData(data);
    submittedData.set(source, data);
  } else {
    map.addSource(id, { type: "geojson", data });
    const added = map.getSource(id);
    if (added) submittedData.set(added, data);
  }

  const existing = map.getLayer(id);
  if (existing) {
    const previous = submittedPaint.get(existing) ?? new Map<string, string>();
    for (const [property, value] of Object.entries(paint)) {
      const signature = JSON.stringify(value);
      if (previous.get(property) !== signature) map.setPaintProperty(id, property, value);
      previous.set(property, signature);
    }
    submittedPaint.set(existing, previous);
    map.moveLayer(id);
  } else {
    map.addLayer({ id, type: "circle", source: id, paint });
    const added = map.getLayer(id);
    if (added) submittedPaint.set(added, new Map(Object.entries(paint).map(([key, value]) => [key, JSON.stringify(value)])));
  }
}
