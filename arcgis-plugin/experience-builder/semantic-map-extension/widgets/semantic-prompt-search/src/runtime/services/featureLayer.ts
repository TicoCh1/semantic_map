import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type { ArcGISFeatureField, ArcGISFeaturePage } from "./backendClient";
import { datasetLabel } from "./backendClient";
import type { ScoreField } from "../../config";

export interface SemanticLayerOptions {
  title: string;
  scoreField: ScoreField;
  rangeMin: number;
  rangeMax: number;
}

export function createSemanticFeatureLayer(page: ArcGISFeaturePage, options: SemanticLayerOptions): FeatureLayer {
  return new FeatureLayer({
    title: options.title || `${page.prompt} (${datasetLabel(page.dataset_id)})`,
    source: page.features.map((feature) => {
      return new Graphic({
        geometry: {
          type: "point",
          x: feature.geometry.x,
          y: feature.geometry.y,
          spatialReference: page.spatial_reference
        },
        attributes: feature.attributes
      });
    }),
    objectIdField: page.object_id_field_name,
    fields: page.fields.map(toArcGISField),
    geometryType: "point",
    spatialReference: page.spatial_reference,
    renderer: semanticRenderer(options.scoreField, options.rangeMin, options.rangeMax),
    popupTemplate: {
      title: "{pano_id}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            { fieldName: "dataset_id", label: "Dataset" },
            { fieldName: "city_id", label: "City" },
            { fieldName: "capture_date", label: "Capture date" },
            { fieldName: "score", label: "Score", format: { places: 4 } },
            { fieldName: "zscore", label: "Z-score", format: { places: 3 } },
            { fieldName: "prompt", label: "Prompt" }
          ]
        }
      ],
      actions: []
    }
  });
}

function toArcGISField(field: ArcGISFeatureField) {
  return {
    name: field.name,
    alias: field.alias || field.name,
    type: field.type,
    length: field.length || undefined
  };
}

function semanticRenderer(field: ScoreField, min: number, max: number) {
  const mid = min + (max - min) / 2;
  return {
    type: "simple",
    symbol: {
      type: "simple-marker",
      style: "circle",
      size: 5,
      color: [49, 130, 189, 0.76],
      outline: {
        color: [17, 24, 39, 0.45],
        width: 0.45
      }
    },
    visualVariables: [
      {
        type: "color",
        field,
        stops: [
          { value: min, color: "#2c7bb6", label: String(round(min)) },
          { value: mid, color: "#ffffbf", label: String(round(mid)) },
          { value: max, color: "#d7191c", label: String(round(max)) }
        ]
      }
    ]
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
