import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { GradientPreset, SemanticLayer } from "../api/types";
import { DEFAULT_POINT_RADIUS, clamp } from "./color";

export function colorExpression(gradient: GradientPreset, layer: SemanticLayer): ExpressionSpecification {
  const stops = [...gradient.stops].sort((a, b) => a.value - b.value);
  const scoreMin = layer.style.score_min ?? gradient.score_min ?? 0;
  const scoreMax = layer.style.score_max ?? gradient.score_max ?? 1;
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

export function circleRadiusExpression(layer: SemanticLayer): number | ExpressionSpecification {
  const radius = clamp(layer.style.point_radius ?? DEFAULT_POINT_RADIUS, 0.25, 128);
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
