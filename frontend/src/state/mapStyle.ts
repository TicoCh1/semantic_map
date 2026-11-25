import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { GradientPreset, LayerColorRangeOverride, SemanticLayer } from "../api/types";
import { DEFAULT_POINT_RADIUS, clamp } from "./color";

export function colorRangeForLayer(layer: SemanticLayer | null) {
  const calibration = layer?.score_property === "zscore"
    ? layer.rerank_calibration ?? Object.values(layer.rerank_calibration_by_dataset ?? {})
      .find(item => item.scope === "cross_city")
    : undefined;
  const override = layer?.color_range_override;
  if (override && override.field === layer?.score_property
    && Number.isFinite(override.lower) && Number.isFinite(override.upper) && override.lower < override.upper) {
    const mode: "smart" | "manual" = override.source === "smart" ? "smart" : "manual";
    return { lower: override.lower, upper: override.upper, mode, calibration };
  }
  return {
    lower: layer?.color_range_default?.lower ?? -1,
    upper: layer?.color_range_default?.upper ?? 3,
    mode: "default" as const,
    calibration
  };
}

export function smartRangeForLayer(layer: SemanticLayer): LayerColorRangeOverride | null {
  const { calibration } = colorRangeForLayer(layer);
  const range = calibration?.color_range;
  if (range?.field === layer.score_property
    && Number.isFinite(range.lower) && Number.isFinite(range.upper) && range.lower < range.upper) {
    return { lower: range.lower, upper: range.upper, field: range.field, source: "smart" };
  }
  return null;
}

export function colorExpression(gradient: GradientPreset, layer: SemanticLayer): ExpressionSpecification {
  const stops = [...gradient.stops].sort((a, b) => a.value - b.value);
  const { lower: scoreMin, upper: scoreMax } = colorRangeForLayer(layer);
  const expression: unknown[] = ["interpolate", ["linear"], ["get", layer.score_property || "score"]];
  const expressionStops = [...stops];

  if (expressionStops[0] && expressionStops[0].value > 0) {
    expressionStops.unshift({ value: 0, color: expressionStops[0].color });
  }
  const lastStop = expressionStops[expressionStops.length - 1];
  if (lastStop && lastStop.value < 1) {
    expressionStops.push({ value: 1, color: lastStop.color });
  }

  for (const stop of expressionStops) {
    const value = clamp(stop.value, 0, 1);
    expression.push(scoreMin + value * (scoreMax - scoreMin), stop.color);
  }

  return expression as ExpressionSpecification;
}

export function circleRadiusExpression(layer: SemanticLayer, unitScale = 1): number | ExpressionSpecification {
  const radius = clamp(layer.style.point_radius ?? DEFAULT_POINT_RADIUS, 0.25, 128) * unitScale;
  if (layer.style.absolute_radius) {
    return [
      "interpolate",
      ["exponential", 2],
      ["zoom"],
      8,
      radius / 32,
      13,
      radius,
      18,
      radius * 32
    ] as ExpressionSpecification;
  }

  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    9,
    radius * (2.5 / DEFAULT_POINT_RADIUS),
    13,
    radius,
    16,
    radius * (9.5 / DEFAULT_POINT_RADIUS)
  ] as ExpressionSpecification;
}
