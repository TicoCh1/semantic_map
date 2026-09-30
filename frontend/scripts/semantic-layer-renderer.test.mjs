import { test } from "node:test";
import assert from "node:assert/strict";
import { updateSemanticLayer } from "../src/state/semanticLayerRenderer.ts";

function fakeMap() {
  const sources = new Map();
  const layers = new Map();
  const order = [];
  const calls = { addSource: 0, addLayer: 0 };
  return {
    sources, layers, order, calls,
    getSource: (id) => sources.get(id),
    getLayer: (id) => layers.get(id),
    addSource(id, spec) {
      calls.addSource++;
      sources.set(id, { data: spec.data, setData(data) { this.data = data; } });
    },
    addLayer(spec) { calls.addLayer++; layers.set(spec.id, spec); order.push(spec.id); },
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
