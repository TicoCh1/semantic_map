import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultRange, restoreWorkspace, saveWorkspace } from "../src/atlas/workspace.ts";

const queries = ["a", "b"].map(id => ({ id, smart_range: {sim_raw: {lower: -.081, upper: .215}, sim_z: {lower: -3.19, upper: 4.81}} }));
const create = ({ id }) => ({ id, visible: true, score_property: "zscore", style: {
  gradient_id: "atlas", stops: [{ value: 0, color: "#aaaaaa" }, { value: 1, color: "#ff8833" }],
  opacity: 0.9, point_radius: 4
} });

test("reload restores the edit selection independently of display order, styling and the overlap filter", t => {
  const storage = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)
  } });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  });
  const layers = queries.map(create);
  layers[1].visible = false;
  layers[1].style.point_radius = 8;
  layers[1].score_property = "score";
  layers[1].color_range_override = { field: "score", lower: -0.01, upper: 0.23 };
  saveWorkspace(layers, "b", false);
  const state = restoreWorkspace(queries, "b", create);
  assert.deepEqual(state.layers.map(layer => layer.id), ["a", "b"]);
  assert.equal(state.selectedId, "b");
  assert.equal(state.showSelf, false);
  assert.equal(state.layers[1].visible, false);
  assert.deepEqual(state.layers[1].style, {...layers[1].style, score_min: -.081, score_max: .215});
  assert.deepEqual(state.layers[1].color_range_override, layers[1].color_range_override);
  assert.deepEqual(state.layers[1].color_range_default, defaultRange(queries[1], "score"));
  saveWorkspace([], null, true);
  assert.equal(restoreWorkspace(queries, null, create).layers.length, 0);
  assert.deepEqual(restoreWorkspace(queries, "b", create).layers.map(layer => layer.id), ["b"]);
});

test("atlas ranges come from the non-source city extrema in each field", () => {
  assert.deepEqual(defaultRange(queries[0], "score"), {lower: -.081, upper: .215});
  assert.deepEqual(defaultRange(queries[0], "zscore"), {lower: -3.19, upper: 4.81});
});
