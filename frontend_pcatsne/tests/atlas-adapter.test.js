import test from "node:test";
import assert from "node:assert/strict";
import { atlasDatasets, scaleOpacities } from "../src/atlas-adapter.js";

function fixture(scales) {
  return { dataset: "london_512_8_45_8B", sourceRows: 100, readyScalesKm: scales,
    layers: scales.map((s) => ({ id: `${s}km`, count: 100, byteLength: 1200, recordBytes: 12,
      colorMatrix: "identity", bin: `${s}km/points.bin`, patches: [
        { count: s === 32 ? 100 : 20, byteLength: s === 32 ? 1200 : 240, colorMatrix: "identity", grid: { x: 0, y: 0 }, bin: "0_0/points.bin" }
      ] })) };
}

test("2 km-only export uses its native palette and resolves both binary paths", () => {
  const atlas = atlasDatasets(fixture([2]), "https://example.com/data/atlas/manifest.json");
  assert.equal(atlas.center.length, 1);
  assert.equal(atlas.center[0].url, "https://example.com/data/atlas/2km/0_0/points.bin");
  assert.equal(atlas.grouped[0].url, "https://example.com/data/atlas/2km/points.bin");
  assert.equal(atlas.center[0].colorMatrix, "identity");
  assert.deepEqual(scaleOpacities(atlas.center, 50000), [1]);
});

test("all scales preserve center/group matching and whole-city omits square grid", () => {
  const atlas = atlasDatasets(fixture([32, 8, 2, 16, 4]), "https://example.com/atlas/manifest.json");
  assert.deepEqual(atlas.center.map((l) => l.radiusMeters), [2000, 4000, 8000, 16000, 32000]);
  assert.deepEqual(atlas.center.map((l) => l.scaleIndex), atlas.grouped.map((l) => l.scaleIndex));
  assert.equal(atlas.groups.at(-1).radiusMeters, null);
  const fade = scaleOpacities(atlas.center, (3600 + 6480) / 2);
  assert.ok(Math.abs(fade[0] - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(fade[1] - Math.SQRT1_2) < 1e-12);
  assert.deepEqual(scaleOpacities(atlas.center, 80000), [0, 0, 0, 0, 1]);
});

test("ready scales can have gaps without showing a nonexistent layer", () => {
  const atlas = atlasDatasets(fixture([2, 8]), "https://example.com/atlas/manifest.json");
  const fade = scaleOpacities(atlas.center, 8000);
  assert.equal(fade.length, 2);
  assert.ok(fade.every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...fade) - 1) < 1e-12);
});

test("reject missing center, non-native colors, stale counts, and directory escapes", () => {
  for (const modify of [
    (m) => { m.layers[0].patches = []; },
    (m) => { m.layers[0].colorMatrix = "swap_rg"; },
    (m) => { m.layers[0].count = 99; },
    (m) => { m.layers[0].bin = "../old/points.bin"; },
    (m) => { m.readyScalesKm = [2, 4]; },
    (m) => { m.readyScalesKm = [2, 2]; }
  ]) {
    const manifest = fixture([2]);
    modify(manifest);
    assert.throws(() => atlasDatasets(manifest, "https://example.com/atlas/manifest.json"));
  }
});

test("duplicate readiness entries cannot conceal a missing exported scale", () => {
  const manifest = fixture([2, 4]);
  manifest.readyScalesKm = [2, 2];
  assert.throws(() => atlasDatasets(manifest, "https://example.com/atlas/manifest.json"));
});

test("16 km whole-city metadata uses one full layer and omits its grid", () => {
  const manifest = fixture([2, 4, 8, 16]);
  const layer = manifest.layers.at(-1);
  layer.coverageMode = "whole_dataset";
  layer.patches[0].count = 100;
  layer.patches[0].byteLength = 1200;
  const atlas = atlasDatasets(manifest, "https://example.com/atlas/manifest.json");
  assert.equal(atlas.grouped.at(-1).label, "Whole city");
  assert.equal(atlas.center.at(-1).count, 100);
  assert.equal(atlas.groups.at(-1).radiusMeters, null);
  layer.patches[0].count = 99;
  assert.throws(() => atlasDatasets(manifest, "https://example.com/atlas/manifest.json"));
});
