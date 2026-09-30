/** One normalized profile for tone opacity, blur radius and every faded edge.
 * Softmax uses logits 3 log(t), 3 log(1-t). Unlike a finite-range sigmoid,
 * it reaches exactly 0/1 with zero first and second derivatives at both ends. */
export type GlassFadeCurve = "softmax" | "smootherstep" | "linear";
export const GLASS_FADE_STEPS = 16;
export const GLASS_SAMPLES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const DEFAULT_GLASS_FADE_CURVE: GlassFadeCurve = "softmax";

/** A zero-distance fade needs no tiled mask. Select the same solid geometry
 * path for all React and vendor surfaces, including temporary tuning changes. */
export function syncGlassFadeMode() {
  const root = document.documentElement;
  const distance = parseFloat(getComputedStyle(root).getPropertyValue("--glass-fade-distance"));
  root.dataset.glassFadeMode = distance > 0 ? "progressive" : "solid";
}

export function glassFadeProgress(position: number, curve: GlassFadeCurve): number {
  const t = Math.max(0, Math.min(1, position));
  if (curve === "linear") return t;
  if (curve === "smootherstep") return t * t * t * (t * (6 * t - 15) + 10);
  // The power ratio is the stable form of two-way softmax: no log(0) or exp overflow.
  const inside = t * t * t;
  const outside = (1 - t) * (1 - t) * (1 - t);
  return inside / (inside + outside);
}

export function setGlassFadeCurve(curve: GlassFadeCurve) {
  const root = document.documentElement;
  for (let sample = 0; sample <= GLASS_FADE_STEPS; sample++) {
    root.style.setProperty(`--glass-fade-alpha-${sample}`, String(glassFadeProgress(sample / GLASS_FADE_STEPS, curve)));
  }
  for (const sample of GLASS_SAMPLES) {
    root.style.setProperty(`--glass-blur-weight-${sample}`, String(glassFadeProgress(sample / GLASS_SAMPLES.length, curve)));
  }
  root.dataset.glassFadeCurve = curve;
}
