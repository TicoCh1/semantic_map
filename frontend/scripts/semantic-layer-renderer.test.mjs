import { test } from "node:test";
import assert from "node:assert/strict";
import { updateSemanticLayer, pointShapeImage, normalizePointShape, attachPointShapeImages } from "../src/state/semanticLayerRenderer.ts";

function fakeMap() {
  const sources = new Map();
  const layers = new Map();
  const images = new Map();
  const handlers = new Map();
  const order = [];
  const calls = { addSource: 0, addLayer: 0 };
  return {
    sources, layers, images, handlers, order, calls,
    hasImage: id => images.has(id),
    addImage: (id, image, options) => images.set(id, { image, options }),
    on: (event, handler) => handlers.set(event, handler),
    off: event => handlers.delete(event),
    getSource: (id) => sources.get(id),
    getLayer: (id) => layers.get(id),
    addSource(id, spec) {
      calls.addSource++;
      sources.set(id, { data: spec.data, setData(data) { this.data = data; } });
    },
    addLayer(spec) { calls.addLayer++; layers.set(spec.id, spec); order.push(spec.id); },
    removeLayer(id) { layers.delete(id); order.splice(order.indexOf(id), 1); },
    setLayoutProperty(id, property, value) { layers.get(id).layout[property] = value; },
    setPaintProperty(id, property, value) { layers.get(id).paint[property] = value; },
    moveLayer(id) { order.splice(order.indexOf(id), 1); order.push(id); }
  };
}
const collection = (id) => ({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { id } }] });

test("repeated viewport updates retain the visible source and layer identity", () => {
  const map = fakeMap();
  updateSemanticLayer(map, "brick", collection(0), { "circle-radius": 3 });
  const source = map.getSource("brick");
  const layer = map.getLayer("brick");
  for (let i = 1; i <= 30; i++) updateSemanticLayer(map, "brick", collection(i), { "circle-radius": 4 });
  assert.equal(map.getSource("brick"), source);
  assert.equal(map.getLayer("brick"), layer);
  assert.deepEqual(map.calls, { addSource: 1, addLayer: 1 });
  assert.equal(source.data.features[0].properties.id, 30);
  assert.equal(layer.paint["circle-radius"], 4);
});

test("shape switches retain data sources, gradient colours, opacity and target IDs", () => {
  const map = fakeMap(), data = collection(0);
  const paint = { "circle-radius": 5, "circle-color": ["get", "colour"], "circle-opacity": 0.6 };
  updateSemanticLayer(map, "brick", data, paint);
  const source = map.getSource("brick");
  let submissions = 0;
  source.setData = () => submissions++;
  for (const shape of ["square", "diamond", "triangle"]) {
    updateSemanticLayer(map, "brick", data, paint, { shape, size: 0.25 });
    const layer = map.getLayer("brick");
    assert.equal(layer.type, "symbol");
    assert.equal(layer.source, "brick");
    assert.equal(layer.layout["icon-image"], "semantic-point-shape-v1-" + shape);
    assert.equal(layer.layout["icon-size"], 0.25);
    assert.equal(layer.layout["icon-allow-overlap"], true);
    assert.equal(layer.layout["icon-ignore-placement"], true);
    assert.deepEqual(layer.paint["icon-color"], paint["circle-color"]);
    assert.equal(layer.paint["icon-opacity"], 0.6);
  }
  assert.equal(map.getSource("brick"), source);
  assert.equal(submissions, 0);
  assert.equal(map.calls.addSource, 1);
  assert.equal(map.calls.addLayer, 2, "symbol-to-symbol switches update layout in place");
  updateSemanticLayer(map, "brick", data, paint, { shape: "circle", size: 0.25 });
  assert.equal(map.getLayer("brick").type, "circle");
  assert.equal(map.getSource("brick"), source);
});

test("basemap resets restore only requested point images and detach the listener", () => {
  const map = fakeMap();
  const detach = attachPointShapeImages(map);
  updateSemanticLayer(map, "brick", collection(0), { "circle-color": "#ff0000" }, { shape: "square", size: 0.25 });
  map.images.clear();
  map.handlers.get("styleimagemissing")({ id: "unrelated-icon" });
  assert.equal(map.images.size, 0);
  map.handlers.get("styleimagemissing")({ id: "semantic-point-shape-v1-square" });
  assert.equal(map.images.get("semantic-point-shape-v1-square").options.sdf, true);
  detach();
  assert.equal(map.handlers.size, 0);
});

test("SDF assets have distinct geometry, opaque interiors and transparent guard bands", () => {
  const alpha = (image, x, y) => image.data[(y * image.width + x) * 4 + 3];
  for (const shape of ["square", "diamond", "triangle"]) {
    const image = pointShapeImage(shape);
    assert.equal(alpha(image, 32, 32), 255);
    assert.equal(alpha(image, 0, 0), 0);
    assert.equal(alpha(image, 63, 32), 0);
    assert.equal(pointShapeImage(shape), image);
  }
  assert.ok(alpha(pointShapeImage("square"), 47, 47) > 191);
  assert.ok(alpha(pointShapeImage("diamond"), 47, 47) < 191);
  assert.ok(alpha(pointShapeImage("triangle"), 47, 16) < 191);
  assert.equal(normalizePointShape(undefined), "circle");
  assert.equal(normalizePointShape("invalid-import"), "circle");
  assert.equal(normalizePointShape("square"), "square");
});

test("reordering existing layers changes stacking without rebuilding sources", () => {
  const map = fakeMap();
  for (const id of ["brick", "trees"]) updateSemanticLayer(map, id, collection(id), { "circle-radius": 3 });
  const brick = map.getSource("brick");
  for (const id of ["trees", "brick"]) updateSemanticLayer(map, id, collection(id), { "circle-radius": 3 });
  assert.deepEqual(map.order, ["trees", "brick"]);
  assert.equal(map.getSource("brick"), brick);
  assert.deepEqual(map.calls, { addSource: 2, addLayer: 2 });
});

test("after a basemap style reset missing sources and layers are restored", () => {
  const map = fakeMap();
  updateSemanticLayer(map, "brick", collection(0), { "circle-radius": 3 });
  map.sources.clear(); map.layers.clear(); map.order.length = 0;
  updateSemanticLayer(map, "brick", collection(1), { "circle-radius": 5 });
  assert.deepEqual(map.calls, { addSource: 2, addLayer: 2 });
  assert.equal(map.getSource("brick").data.features[0].properties.id, 1);
});

test("style-only edits and repeated viewports do not resubmit unchanged GeoJSON to the worker", () => {
  const map = fakeMap(), data = collection(0);
  updateSemanticLayer(map, "brick", data, { "circle-radius": 3 });
  let submissions = 0, paints = 0;
  const source = map.getSource("brick"), setData = source.setData.bind(source), setPaint = map.setPaintProperty.bind(map);
  source.setData = value => { submissions++; setData(value); };
  map.setPaintProperty = (...args) => { paints++; setPaint(...args); };
  for (let i = 0; i < 30; i++) updateSemanticLayer(map, "brick", data, { "circle-radius": 3 });
  assert.equal(submissions, 0); assert.equal(paints, 0);
  updateSemanticLayer(map, "brick", data, { "circle-radius": 6 });
  assert.equal(submissions, 0); assert.equal(paints, 1);
  updateSemanticLayer(map, "brick", collection(1), { "circle-radius": 6 });
  assert.equal(submissions, 1);
});
