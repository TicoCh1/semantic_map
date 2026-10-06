import type { CircleLayerSpecification, SymbolLayerSpecification, GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { FeatureCollection, PointShape } from "../api/types";

type SemanticMap = Pick<MapLibreMap, "getSource" | "getLayer" | "addSource" | "addLayer" | "removeLayer" | "setPaintProperty" | "setLayoutProperty" | "moveLayer" | "hasImage" | "addImage">;
const submittedData = new WeakMap<object, FeatureCollection>();
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

function ensurePointImage(map: Pick<SemanticMap, "hasImage" | "addImage">, shape: IconShape) {
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

/** Preserve the source and hit-target ID across shape changes. Circles use the
 * native fast path; other shapes use overlap-enabled, gradient-coloured SDFs. */
export function updateSemanticLayer(
  map: SemanticMap,
  id: string,
  data: FeatureCollection,
  circlePaint: NonNullable<CircleLayerSpecification["paint"]>,
  marker?: { shape: PointShape; size: NonNullable<SymbolLayerSpecification["layout"]>["icon-size"] }
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
      [paint, submittedPaint, map.setPaintProperty.bind(map)],
      [layout ?? {}, submittedLayout, map.setLayoutProperty.bind(map)]
    ] as const) {
      const previous = cache.get(existing) ?? new Map<string, string>();
      for (const [property, value] of Object.entries(values)) {
        const signature = JSON.stringify(value);
        if (previous.get(property) !== signature) apply(id, property, value);
        previous.set(property, signature);
      }
      cache.set(existing, previous);
    }
    map.moveLayer(id);
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
