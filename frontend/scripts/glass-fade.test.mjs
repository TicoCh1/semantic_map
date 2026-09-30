import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { glassFadeProgress, GLASS_FADE_STEPS, GLASS_SAMPLES } from "../src/styles/glassFade.ts";

test("smooth profiles join the untouched backdrop and solid core without slope or curvature jumps", () => {
  for (const curve of ["softmax", "smootherstep"]) {
    const f = (t) => glassFadeProgress(t, curve);
    assert.equal(f(-1), 0);
    assert.equal(f(2), 1);
    assert.equal(f(0), 0);
    assert.equal(f(1), 1);
    assert.equal(f(.5), .5);
    const h = .00001;
    for (const end of [0, 1]) {
      const slope = (f(end + h) - f(end - h)) / (2 * h);
      const curvature = (f(end + h) - 2 * f(end) + f(end - h)) / (h * h);
      assert.ok(Math.abs(slope) < 1e-7, `${curve} slope at ${end}`);
      assert.ok(Math.abs(curvature) < .003, `${curve} curvature at ${end}`);
    }
    for (let i = 0; i < 1000; i++) {
      const t = i / 1000;
      assert.ok(f(t) <= f(t + .001));
      assert.ok(Math.abs(f(t) + f(1 - t) - 1) < 1e-12);
    }
  }
});

test("the sampled CSS approximation stays close to the smooth profile, including large fades", () => {
  for (const curve of ["softmax", "smootherstep"]) {
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      const left = Math.min(GLASS_FADE_STEPS - 1, Math.floor(t * GLASS_FADE_STEPS));
      const fraction = t * GLASS_FADE_STEPS - left;
      const approximation = (1 - fraction) * glassFadeProgress(left / GLASS_FADE_STEPS, curve)
        + fraction * glassFadeProgress((left + 1) / GLASS_FADE_STEPS, curve);
      assert.ok(Math.abs(approximation - glassFadeProgress(t, curve)) < .009);
    }
  }
});

test("all edge, corner and divider masks consume the same complete profile", async () => {
  const css = await fs.readFile(new URL("../src/styles/glass.css", import.meta.url), "utf8");
  let masks = 0;
  for (const gradient of css.split(/(?:radial|linear)-gradient\(/).slice(1)) {
    if (!gradient.includes("--glass-fade-alpha-")) continue;
    masks++;
    for (let i = 0; i <= GLASS_FADE_STEPS; i++) {
      assert.ok(gradient.includes(`--glass-fade-alpha-${i})`), `missing curve sample ${i}`);
    }
  }
  assert.equal(masks, 10, "four corners, four edges and two divider axes");
  for (const sample of GLASS_SAMPLES) assert.ok(css.includes(`--glass-blur-weight-${sample}`));
});
