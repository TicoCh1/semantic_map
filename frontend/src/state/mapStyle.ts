import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { GradientPreset, SemanticLayer } from "../api/types";
import { DEFAULT_POINT_RADIUS, clamp } from "./color";

export function colorRangeForLayer(layer: SemanticLayer | null, gradient: GradientPreset | null, datasetId?: string) {
  const cityCalibration = datasetId ? layer?.rerank_calibration_by_dataset?.[datasetId] : undefined;
  const calibration = layer?.score_property === "zscore"
    ? cityCalibration ?? (!datasetId || !layer.rerank_calibration_by_dataset ? layer.rerank_calibration : undefined)
    : undefined;
  const override = datasetId ? layer?.color_range_overrides_by_dataset?.[datasetId] : undefined;
  if (override && override.field === layer?.score_property
    && Number.isFinite(override.lower) && Number.isFinite(override.upper) && override.lower < override.upper) {
    const mode: "smart" | "manual" = override.source === "smart" ? "smart" : "manual";
    return { lower: override.lower, upper: override.upper, mode, calibration };
  }
  return {
    lower: datasetId ? layer?.color_range_default?.lower ?? -1 : layer?.style.score_min ?? gradient?.score_min ?? 0,
    upper: datasetId ? layer?.color_range_default?.upper ?? 3 : layer?.style.score_max ?? gradient?.score_max ?? 1,
    mode: "default" as const,
    calibration
  };
}

export function smartRangeForLayer(layer: SemanticLayer, datasetId: string) {
  const { calibration } = colorRangeForLayer(layer, null, datasetId);
  const range = calibration?.color_range;
  if (range?.field === layer.score_property
    && Number.isFinite(range.lower) && Number.isFinite(range.upper) && range.lower < range.upper) {
    return { lower: range.lower, upper: range.upper, field: layer.score_property, source: "smart" as const };
  }
  return undefined;
}

export function colorExpression(gradient: GradientPreset, layer: SemanticLayer, datasetId?: string): ExpressionSpecification {
  const stops = [...gradient.stops].sort((a, b) => a.value - b.value);
  const { lower: scoreMin, upper: scoreMax } = colorRangeForLayer(layer, gradient, datasetId);
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
