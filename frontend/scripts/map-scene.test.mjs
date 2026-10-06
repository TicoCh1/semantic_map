import { test } from "node:test";
import assert from "node:assert/strict";
import { MapSceneCamera, groundScaleForZoom } from "../src/state/mapSceneCamera.ts";
import { SceneResources } from "../src/state/sceneResources.ts";
import { preserveSceneStyle } from "../src/state/mapSceneStyle.ts";

function map(lat, lng = 0) {
  const listeners = new Set();
  return {
    center: { lat, lng }, zoom: 12, bearing: 0, pitch: 0, jumps: 0,
    getCenter() { return this.center; }, getZoom() { return this.zoom; },
    getBearing() { return this.bearing; }, getPitch() { return this.pitch; },
    getMinZoom() { return 2; }, getMaxZoom() { return 18; },
    on(_, fn) { listeners.add(fn); }, off(_, fn) { listeners.delete(fn); },
    emit() { for (const fn of listeners) fn(); },
    jumpTo(camera) { this.jumps++; Object.assign(this, camera); this.emit(); }
  };
}
test("500 continuous frames synchronize city ground resolution without feedback or moving city centers", () => {
  const a = map(51.5, -0.1), b = map(31.2, 121.4);
  const camera = new MapSceneCamera(groundScaleForZoom(12, 51.5));
  camera.register(a, "resolution"); camera.register(b, "resolution");
  for (let i = 0; i < 500; i++) {
    const source = i % 2 ? a : b;
    source.zoom = 12 + Math.sin(i / 20) * 2;
    source.emit();
    assert.ok(Math.abs(groundScaleForZoom(a.zoom, a.center.lat) / groundScaleForZoom(b.zoom, b.center.lat) - 1) < 1e-10);
  }
  assert.deepEqual(a.center, { lat: 51.5, lng: -0.1 });
  assert.deepEqual(b.center, { lat: 31.2, lng: 121.4 });
  assert.ok(a.jumps + b.jumps <= 502);
});
test("same-city comparisons share pan, rotation and pitch; removed maps are never updated", () => {
  const camera = new MapSceneCamera(groundScaleForZoom(12, 51.5));
  const a = map(51.5), b = map(51.5);
  camera.register(a, "camera"); const remove = camera.register(b, "camera");
  a.center = { lat: 50, lng: 2 }; a.zoom = 14; a.bearing = 20; a.pitch = 30; a.emit();
  assert.deepEqual(b.center, a.center); assert.equal(b.zoom, a.zoom);
  assert.equal(b.bearing, 20); assert.equal(b.pitch, 30);
  remove(); const jumps = b.jumps;
  a.zoom = 15; a.emit(); assert.equal(b.jumps, jumps);
  const replacement = map(51.5); camera.register(replacement, "camera");
  assert.deepEqual(replacement.center, a.center); assert.equal(replacement.zoom, 15);
});
test("resize events cannot publish a stale scale; zoom limits remain compatible at different latitudes", () => {
  const camera = new MapSceneCamera(groundScaleForZoom(12, 51.5));
  const a = map(51.5), b = map(31.2); let resizing = false;
  camera.register(a, "resolution", () => resizing); camera.register(b, "resolution");
  resizing = true; a.zoom = 10; a.emit(); assert.notEqual(b.zoom, 10);
  resizing = false; a.zoom = 18; a.emit();
  assert.ok(a.zoom < 18); assert.equal(b.zoom, 18);
  assert.ok(Math.abs(groundScaleForZoom(a.zoom, a.center.lat) / groundScaleForZoom(b.zoom, b.center.lat) - 1) < 1e-10);
});
test("new viewport registration immediately reconciles shared zoom limits", () => {
  const camera = new MapSceneCamera(groundScaleForZoom(18, 51.5));
  const a = map(51.5), b = map(31.2);
  camera.register(a, "resolution"); camera.register(b, "resolution");
  assert.equal(b.zoom, 18); assert.ok(a.zoom < 18);
  assert.ok(Math.abs(groundScaleForZoom(a.zoom, a.center.lat) / groundScaleForZoom(b.zoom, b.center.lat) - 1) < 1e-10);
});
test("shared resources coalesce concurrent requests and reuse one object across panes", async () => {
  const cache = new SceneResources(); let requests = 0;
  const loader = async () => { requests++; return { features: [1] }; };
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.load("tile:13/4094/2724", loader)));
  assert.equal(requests, 1); assert.ok(values.every(value => value === values[0]));
  assert.equal(await cache.load("tile:13/4094/2724", loader), values[0]);
});
test("resource concurrency is bounded; an aggregate cannot deadlock its child tile requests", async () => {
  const cache = new SceneResources(20, 20, 2); let active = 0, peak = 0;
  const values = await cache.load("view", () => Promise.all(Array.from({ length: 10 }, (_, i) => cache.load(`tile:${i}`, async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--; return i;
  }))), { scheduled: false });
  assert.equal(values.length, 10); assert.equal(peak, 2);
});
test("failed and not-yet-ready resources can retry; LRU obeys feature weight", async () => {
  const cache = new SceneResources(10, 3, 2, value => value.length);
  await assert.rejects(cache.load("failed", async () => { throw new Error("offline"); }));
  assert.deepEqual(await cache.load("failed", async () => [1]), [1]);
  await cache.load("pending", async () => [], { cacheable: value => value.length > 0 });
  assert.deepEqual(await cache.load("pending", async () => [2]), [2]);
  await cache.load("large", async () => [1, 2, 3]);
  let reloaded = false;
  await cache.load("failed", async () => { reloaded = true; return [4]; });
  assert.equal(reloaded, true);
});
test("basemap swap retains only scene sources, data identity, picking layers and their order", () => {
  const data = { type: "FeatureCollection", features: [] };
  const previous = { version: 8, sources: { oldBase: { type: "raster" }, points: { type: "geojson", data }, selection: { type: "geojson", data } }, layers: [
    { id: "old", type: "raster", source: "oldBase" }, { id: "points", type: "circle", source: "points" }, { id: "outline", type: "line", source: "selection" }
  ] };
  const next = { version: 8, sources: { newBase: { type: "raster" } }, layers: [{ id: "new", type: "raster", source: "newBase" }] };
  const style = preserveSceneStyle(previous, next, new Set(["points", "selection"]));
  assert.deepEqual(Object.keys(style.sources), ["newBase", "points", "selection"]);
  assert.equal(style.sources.points.data, data);
  assert.deepEqual(style.layers.map(layer => layer.id), ["new", "points", "outline"]);
});
