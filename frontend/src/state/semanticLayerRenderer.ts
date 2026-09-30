import type { CircleLayerSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection } from "../api/types";

type SemanticMap = Pick<MapLibreMap, "getSource" | "getLayer" | "addSource" | "addLayer" | "setPaintProperty" | "moveLayer">;

/** Update data in place: removing a live source creates a blank frame while its
 * replacement is processed by MapLibre's worker. This also preserves hit targets. */
export function updateSemanticLayer(
  map: SemanticMap,
  id: string,
  data: FeatureCollection,
  paint: NonNullable<CircleLayerSpecification["paint"]>
) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: "geojson", data });

  if (map.getLayer(id)) {
    for (const [property, value] of Object.entries(paint)) map.setPaintProperty(id, property, value);
    map.moveLayer(id);
  } else {
    map.addLayer({ id, type: "circle", source: id, paint });
  }
}
