import type { Map as MapLibreMap } from "maplibre-gl";

type ResizeMap = Pick<MapLibreMap, "resize" | "redraw">;
type ResizeCallbacks = {
  beforeResize: () => void;
  afterResize: () => void;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (frame: number) => void;
};

/** Canvas dimension writes clear the WebGL buffer immediately. Resize and draw
 * must therefore finish in the same browser frame, including during a drag. */
export function createMapResizeScheduler(map: ResizeMap, {
  beforeResize,
  afterResize,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (frame) => window.cancelAnimationFrame(frame)
}: ResizeCallbacks) {
  let frame: number | undefined;
  let disposed = false;

  return {
    schedule() {
      if (disposed || frame !== undefined) return;
      frame = requestFrame(() => {
        frame = undefined;
        if (disposed) return;
        beforeResize();
        try {
          map.resize();
          // triggerRepaint() would queue the draw for the next frame: too late.
          map.redraw();
        } finally {
          afterResize();
        }
      });
    },
    dispose() {
      disposed = true;
      if (frame !== undefined) cancelFrame(frame);
      frame = undefined;
    }
  };
}
