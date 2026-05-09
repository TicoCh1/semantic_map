import type { GradientPreset, LayerStyle, SemanticLayer } from "../api/types";

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

export const DEFAULT_POINT_RADIUS = 5.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeHex(value: string): string | null {
  const raw = value.trim();
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toLowerCase() : null;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex) ?? "#000000";
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === nr) h = ((ng - nb) / delta) % 6;
    else if (max === ng) h = (nb - nr) / delta + 2;
    else h = (nr - ng) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100
  };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = val - c;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hue < 60) [r1, g1, b1] = [c, x, 0];
  else if (hue < 120) [r1, g1, b1] = [x, c, 0];
  else if (hue < 180) [r1, g1, b1] = [0, c, x];
  else if (hue < 240) [r1, g1, b1] = [0, x, c];
  else if (hue < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

export function gradientCss(gradient: GradientPreset): string {
  const stops = [...gradient.stops].sort((a, b) => a.value - b.value);
  return `linear-gradient(90deg, ${stops
    .map((stop) => `${stop.color} ${clamp(stop.value, 0, 1) * 100}%`)
    .join(", ")})`;
}

export function gradientColorAt(gradient: GradientPreset, value: number): string {
  const stops = [...gradient.stops].sort((a, b) => a.value - b.value);
  const normalizedValue = clamp(value, 0, 1);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first) return "#2f80ed";
  if (!last || normalizedValue <= first.value) return first.color;
  if (normalizedValue >= last.value) return last.color;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const left = stops[index];
    const right = stops[index + 1];
    if (!left || !right || normalizedValue < left.value || normalizedValue > right.value) continue;

    const span = right.value - left.value || 1;
    const t = clamp((normalizedValue - left.value) / span, 0, 1);
    const leftRgb = hexToRgb(left.color);
    const rightRgb = hexToRgb(right.color);
    return rgbToHex({
      r: leftRgb.r + (rightRgb.r - leftRgb.r) * t,
      g: leftRgb.g + (rightRgb.g - leftRgb.g) * t,
      b: leftRgb.b + (rightRgb.b - leftRgb.b) * t
    });
  }

  return last.color;
}

export function gradientColorForScore(gradient: GradientPreset, score: number, scoreMin = gradient.score_min, scoreMax = gradient.score_max): string {
  const span = scoreMax - scoreMin || 1;
  return gradientColorAt(gradient, (score - scoreMin) / span);
}

export function slugify(value: string, fallback = "gradient"): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug || fallback;
}

export function copyGradient(gradient: GradientPreset): GradientPreset {
  return {
    ...gradient,
    stops: gradient.stops.map((stop) => ({ ...stop }))
  };
}

export function layerGradient(layer: SemanticLayer | null, gradients: GradientPreset[]): GradientPreset | null {
  if (!layer) return null;
  const fallback = gradients.find((gradient) => gradient.id === layer.style.gradient_id) ?? gradients[0];
  const stops = layer.style.stops?.length ? layer.style.stops : fallback?.stops;
  if (!stops?.length) return fallback ? copyGradient(fallback) : null;

  return {
    id: layer.style.gradient_id || fallback?.id || "layer_gradient",
    name: layer.style.gradient_name || fallback?.name || "Layer gradient",
    stops: stops.map((stop) => ({ ...stop })).sort((a, b) => a.value - b.value),
    opacity: layer.style.opacity ?? fallback?.opacity ?? 0.75,
    score_min: layer.style.score_min ?? fallback?.score_min ?? 0,
    score_max: layer.style.score_max ?? fallback?.score_max ?? 1,
    updated_at: fallback?.updated_at ?? null,
    is_default: false
  };
}

export function layerStyleFromGradient(gradient: GradientPreset, previous?: LayerStyle): LayerStyle {
  return {
    gradient_id: gradient.id,
    gradient_name: gradient.name,
    stops: gradient.stops.map((stop) => ({ ...stop })).sort((a, b) => a.value - b.value),
    opacity: gradient.opacity,
    score_min: gradient.score_min,
    score_max: gradient.score_max,
    point_radius: previous?.point_radius ?? DEFAULT_POINT_RADIUS,
    absolute_radius: previous?.absolute_radius ?? false
  };
}
