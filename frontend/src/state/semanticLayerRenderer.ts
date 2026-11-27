import type { CircleLayerSpecification, SymbolLayerSpecification, GeoJSONSource, GeoJSONSourceDiff, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, PointShape } from "../api/types";

type SemanticMap = Pick<MapLibreMap, "getSource" | "getLayer" | "addSource" | "addLayer" | "removeLayer" | "setPaintProperty" | "setLayoutProperty" | "hasImage" | "addImage">;
type CalculateSourceDiff = (previous: FeatureCollection, next: FeatureCollection) => GeoJSONSourceDiff | undefined;
type SourceUpdate = { submitted?: FeatureCollection; requested: FeatureCollection; pending: boolean; calculateDiff?: CalculateSourceDiff };
const submittedData = new WeakMap<GeoJSONSource, SourceUpdate>();
const submittedPaint = new WeakMap<object, Map<string, string>>();
const submittedLayout = new WeakMap<object, Map<string, string>>();
const shapes = ["square", "diamond", "triangle"] as const;
type IconShape = typeof shapes[number];
export const POINT_ICON_HALF_SIZE = 20;
const iconPrefix = "semantic-point-shape-v1-";
const images = new Map<IconShape, { width: number; height: number; data: Uint8Array }>();

export function normalizePointShape(value: unknown): PointShape {
  return shapes.includes(value as IconShape) ? value as IconShape : "circle";
}

function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** MapLibre SDFs use a 0.75 edge threshold and eight-pixel distance range.
 * Guard bands keep outlines sharp when scaling, without fetching icon assets. */
export function pointShapeImage(shape: IconShape) {
  const cached = images.get(shape);
  if (cached) return cached;
  const width = 64, data = new Uint8Array(width * width * 4), r = POINT_ICON_HALF_SIZE;
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const x = col + 0.5 - width / 2, y = row + 0.5 - width / 2;
      let distance: number;
      if (shape === "square") {
        const dx = Math.abs(x) - r, dy = Math.abs(y) - r;
        distance = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
      } else if (shape === "diamond") {
        distance = Math.min(
          segmentDistance(x, y, 0, -r, r, 0), segmentDistance(x, y, r, 0, 0, r),
          segmentDistance(x, y, 0, r, -r, 0), segmentDistance(x, y, -r, 0, 0, -r)
        ) * (Math.abs(x) + Math.abs(y) <= r ? -1 : 1);
      } else {
        distance = Math.min(
          segmentDistance(x, y, 0, -r, r, r), segmentDistance(x, y, r, r, -r, r),
          segmentDistance(x, y, -r, r, 0, -r)
        ) * (y <= r && y >= 2 * Math.abs(x) - r ? -1 : 1);
      }
      const index = (row * width + col) * 4;
      data[index] = data[index + 1] = data[index + 2] = 255;
      data[index + 3] = Math.max(0, Math.min(255, Math.round(255 * (0.75 - distance / 8))));
    }
  }
  const image = { width, height: width, data };
  images.set(shape, image);
  return image;
}

export function ensurePointImage(map: Pick<SemanticMap, "hasImage" | "addImage">, shape: IconShape) {
  const id = iconPrefix + shape;
  if (!map.hasImage(id)) map.addImage(id, pointShapeImage(shape), { sdf: true });
  return id;
}

/** setStyle may preserve semantic layers but drop the runtime image registry. */
export function attachPointShapeImages(map: MapLibreMap) {
  const onMissing = (event: { id: string }) => {
    const shape = event.id.startsWith(iconPrefix) ? event.id.slice(iconPrefix.length) : "";
    if (shapes.includes(shape as IconShape)) ensurePointImage(map, shape as IconShape);
  };
  map.on("styleimagemissing", onMissing);
  return () => { map.off("styleimagemissing", onMissing); };
}

export function getRequestedSemanticSourceData(map: Pick<SemanticMap, "getSource">, id: string): FeatureCollection | undefined {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  return source && submittedData.get(source)?.requested;
}

export function updateSemanticSource(map: Pick<SemanticMap, "getSource" | "addSource">, id: string, data: FeatureCollection, calculateDiff?: CalculateSourceDiff) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (!source) {
    map.addSource(id, { type: "geojson", data });
    const added = map.getSource(id) as GeoJSONSource | undefined;
    if (added) submittedData.set(added, { submitted: data, requested: data, pending: false });
    return;
  }

  let state = submittedData.get(source);
  if (!state) {
    state = { requested: data, pending: false };
    submittedData.set(source, state);
  }
  state.requested = data;
  state.calculateDiff = calculateDiff;
  submitSemanticSourceUpdate(map, id, source, state);
}

function submitSemanticSourceUpdate(
  map: Pick<SemanticMap, "getSource">,
  id: string,
  source: GeoJSONSource,
  state: SourceUpdate
) {
  if (state.pending || state.requested === state.submitted || map.getSource(id) !== source) return;
  const next = state.requested;
  const diff = state.submitted && state.calculateDiff?.(state.submitted, next);
  state.submitted = next;
  if (diff && !diff.add?.length && !diff.remove?.length) return;
  const completion = diff ? source.updateData(diff) : source.setData(next);
  if (completion) {
    state.pending = true;
    const continueUpdates = () => {
      state.pending = false;
      submitSemanticSourceUpdate(map, id, source, state);
    };
    // A full setData must not replace MapLibre's local data while an older
    // worker result is still applying its diff. Keep only the newest request.
    void completion.then(continueUpdates, continueUpdates);
  }
}

/** Keep the semantic stack above the basemap. MapLibre invalidates symbol
 * placement on every moveLayer call, even when the layer stays in place. */
export function syncSemanticLayerOrder(map: Pick<MapLibreMap, "getLayersOrder" | "moveLayer">, ids: readonly string[]) {
  const order = map.getLayersOrder();
  const offset = order.length - ids.length;
  for (let index = ids.length - 1; index >= 0; index--) {
    const id = ids[index];
    const target = offset + index;
    if (order[target] === id) continue;
    map.moveLayer(id, order[target + 1]);
    order.splice(order.indexOf(id), 1);
    order.splice(target, 0, id);
  }
}

/** Preserve the source and hit-target ID across shape changes. Circles use the
 * native fast path; other shapes use overlap-enabled, gradient-coloured SDFs. */
export function updateSemanticLayer(
  map: SemanticMap,
  id: string,
  data: FeatureCollection,
  circlePaint: NonNullable<CircleLayerSpecification["paint"]>,
  marker?: { shape: PointShape; size: NonNullable<SymbolLayerSpecification["layout"]>["icon-size"] },
  calculateDiff?: CalculateSourceDiff
) {
  updateSemanticSource(map, id, data, calculateDiff);

  const shape = normalizePointShape(marker?.shape);
  const type = shape === "circle" ? "circle" : "symbol";
  const layout: SymbolLayerSpecification["layout"] = shape === "circle" ? undefined : {
    "icon-image": ensurePointImage(map, shape),
    "icon-size": marker?.size ?? 1,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-padding": 0,
    "icon-pitch-alignment": "viewport",
    "icon-rotation-alignment": "viewport"
  };
  const paint = type === "circle" ? circlePaint : {
    "icon-color": circlePaint["circle-color"],
    "icon-opacity": circlePaint["circle-opacity"]
  };
  let existing = map.getLayer(id);
  if (existing && existing.type !== type) {
    map.removeLayer(id);
    existing = undefined;
  }
  if (existing) {
    for (const [values, cache, apply] of [
      [paint, submittedPaint, (layerId: string, property: string, value: unknown) =>
        map.setPaintProperty(layerId, property as Parameters<SemanticMap["setPaintProperty"]>[1], value as Parameters<SemanticMap["setPaintProperty"]>[2])],
      [layout ?? {}, submittedLayout, (layerId: string, property: string, value: unknown) =>
        map.setLayoutProperty(layerId, property as Parameters<SemanticMap["setLayoutProperty"]>[1], value as Parameters<SemanticMap["setLayoutProperty"]>[2])]
    ] as const) {
      const previous = cache.get(existing) ?? new Map<string, string>();
      for (const [property, value] of Object.entries(values)) {
        const signature = JSON.stringify(value);
        if (previous.get(property) !== signature) apply(id, property, value);
        previous.set(property, signature);
      }
      cache.set(existing, previous);
    }
  } else {
    if (type === "circle") map.addLayer({ id, type, source: id, paint: circlePaint });
    else map.addLayer({ id, type, source: id, layout, paint: paint as SymbolLayerSpecification["paint"] });
    const added = map.getLayer(id);
    if (added) {
      submittedPaint.set(added, new Map(Object.entries(paint).map(([key, value]) => [key, JSON.stringify(value)])));
      submittedLayout.set(added, new Map(Object.entries(layout ?? {}).map(([key, value]) => [key, JSON.stringify(value)])));
    }
  }
}
