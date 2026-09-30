import { test } from "node:test";
import assert from "node:assert/strict";
import { createMapResizeScheduler } from "../src/state/mapResize.ts";

function frameClock() {
  let id = 0;
  const pending = new Map();
  return {
    requestFrame(callback) { pending.set(++id, callback); return id; },
    cancelFrame(frame) { pending.delete(frame); },
    tick() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
    get pending() { return pending.size; }
  };
}

test("continuous resizing never presents the cleared WebGL buffer", () => {
  const clock = frameClock();
  let desiredWidth = 800;
  let drawnWidth = desiredWidth;
  let blank = false;
  let resizeCount = 0;
  let resizeInProgress = false;
  const map = {
    resize() {
      assert.equal(resizeInProgress, true);
      resizeCount++;
      blank = true;
      // MapLibre normally schedules the draw on a subsequent animation frame.
      clock.requestFrame(() => { blank = false; drawnWidth = desiredWidth; });
    },
    redraw() { assert.equal(resizeInProgress, true); blank = false; drawnWidth = desiredWidth; }
  };
  const resize = createMapResizeScheduler(map, {
    ...clock,
    beforeResize: () => { resizeInProgress = true; },
    afterResize: () => { resizeInProgress = false; }
  });
  // Many pointer/observer updates per frame, reversing direction repeatedly.
  for (let frame = 0; frame < 120; frame++) {
    for (let event = 0; event < 12; event++) {
      desiredWidth = 800 + Math.round(300 * Math.sin((frame * 12 + event) / 40));
      resize.schedule();
    }
    clock.tick();
    assert.equal(blank, false, `blank canvas presented on frame ${frame}`);
    assert.equal(drawnWidth, desiredWidth, "the latest container width must be drawn before paint");
    assert.equal(resizeInProgress, false);
  }
  assert.equal(resizeCount, 120, "resize at most once per browser frame");
});

test("disposing a replaced map cancels pending resize work", () => {
  const clock = frameClock();
  const map = { resize() { assert.fail("a removed map must not be resized"); }, redraw() { assert.fail(); } };
  const resize = createMapResizeScheduler(map, { ...clock, beforeResize() {}, afterResize() {} });
  resize.schedule();
  resize.dispose();
  resize.schedule();
  assert.equal(clock.pending, 0);
  clock.tick();
});

test("a failed resize releases viewport event suppression", () => {
  const clock = frameClock();
  let resizing = false;
  const resize = createMapResizeScheduler({ resize() { throw new Error("context lost"); }, redraw() {} }, {
    ...clock,
    beforeResize: () => { resizing = true; },
    afterResize: () => { resizing = false; }
  });
  resize.schedule();
  assert.throws(() => clock.tick(), /context lost/);
  assert.equal(resizing, false);
});
