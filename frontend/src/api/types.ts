import type { FeatureCollection as GeoJsonFeatureCollection, Geometry } from "geojson";

export const PANO_REFERENCE_DRAG_TYPE = "application/x-semantic-map-pano-reference";

export type QueryType = "text" | "pano_reference";

export type GradientStop = {
  value: number;
  color: string;
};

export type GradientPreset = {
  id: string;
  name: string;
  stops: GradientStop[];
  opacity: number;
  score_min: number;
  score_max: number;
  updated_at?: string | null;
  is_default: boolean;
};

export type LayerStyle = {
  gradient_id: string;
  gradient_name?: string | null;
  stops?: GradientStop[] | null;
  opacity: number;
  score_min: number;
  score_max: number;
  point_radius: number;
  absolute_radius: boolean;
};

export type SemanticLayer = {
  id: string;
  name: string;
  prompt: string;
  query_type?: QueryType;
  reference_pano?: PanoReference | null;
  visible: boolean;
  order: number;
  source_type: "geojson";
  source_path: string;
  source_paths?: Partial<Record<CityId, string>>;
  score_property: string;
  style: LayerStyle;
  status: "queued" | "running" | "ready" | "failed";
  created_at: string;
};

export type CityId = "london" | "shanghai";

export type TileCoord = {
  z: number;
  x: number;
  y: number;
  dataset_id?: string | null;
};

export type CityPriorityTiles = Partial<Record<CityId, TileCoord | null>>;

export type LayerState = {
  layers: SemanticLayer[];
  selected_layer_id: string | null;
  updated_at?: string | null;
};

export type AppStateResponse = {
  state: LayerState;
  gradients: GradientPreset[];
};

export type LayerCreate = {
  prompt: string;
  name?: string;
  gradient_id?: string;
};

export type LayerPatch = {
  name?: string;
  visible?: boolean;
  selected?: boolean;
  score_property?: string;
  style?: LayerStyle;
};

export type FeatureCollection = GeoJsonFeatureCollection<Geometry, Record<string, unknown>>;

export type PanoMapPoint = {
  pano_id: string;
  pano_key?: string;
  dataset_id?: string | null;
  city_id?: CityId | string | null;
  lon: number;
  lat: number;
  date?: string | number | null;
  source_layer_id?: string | null;
  source_layer_name?: string | null;
  score?: number | null;
  zscore?: number | null;
  layer_values?: PanoLayerValue[];
};

export type PanoReference = {
  pano_id: string;
  dataset_id: string;
  city_id?: CityId | string | null;
  lon?: number | null;
  lat?: number | null;
  date?: string | number | null;
};

export type PanoLayerValue = {
  layer_id: string;
  layer_name: string;
  visible: boolean;
  score?: number | null;
  zscore?: number | null;
  date?: string | number | null;
};

export type MarkedPano = PanoMapPoint & {
  status: "loading" | "ready" | "failed";
  image_url?: string | null;
  object_url?: string | null;
  member_name?: string | null;
  tar_id?: string | null;
  message?: string | null;
};

export type PanoImageResponse = {
  pano_id: string;
  status: "ready" | "missing" | "unavailable";
  image_url?: string | null;
  member_name?: string | null;
  tar_id?: string | null;
  byte_size?: number | null;
  message: string;
};

export type ScoringJob = {
  job_id: string;
  prompt_id?: string;
  dataset_id?: string;
  dataset_group_id?: string | null;
  dataset_ids?: string[];
  prompt: string;
  query_type?: QueryType;
  reference_pano?: PanoReference | null;
  status: "queued" | "running" | "loading_model" | "loading_dataset" | "scoring" | "building_tiles" | "ready" | "failed" | "cancelled";
  progress: number;
  layer_id: string | null;
  message: string;
  created_at: string;
  updated_at: string;
  priority_tile?: TileCoord | null;
  priority_tiles?: TileCoord[];
  current_stage?: string | null;
  current_tile?: TileCoord | null;
  tiles_done?: number;
  tiles_total?: number;
  stage_timings?: Record<string, number>;
  manifest_url?: string | null;
  tile_url_template?: string | null;
  results?: ScoringResultRef[];
};

export type ScoringResultRef = {
  dataset_id: string;
  prompt_id: string;
  manifest_url: string;
  tile_url_template: string;
  priority_tile?: TileCoord | null;
};

export type RemoteLogEntry = {
  id: string;
  timestamp: string;
  layer_id?: string | null;
  job_id?: string | null;
  prompt?: string | null;
  status: ScoringJob["status"] | "info";
  progress?: number;
  message: string;
  current_stage?: string | null;
  current_tile?: TileCoord | null;
  tiles_done?: number;
  tiles_total?: number;
  stage_timings?: Record<string, number>;
  map_overlay?: boolean;
};

export type RemoteBackendConfig = {
  baseUrl: string;
  token?: string;
  datasetId: string;
  datasetIds: string[];
  datasetGroupId?: string;
  enabled: boolean;
};

export type RemoteResultManifest = {
  prompt_id: string;
  dataset_id: string;
  prompt: string;
  query_type?: QueryType;
  reference_pano?: PanoReference | null;
  source_type: "zxy_geojson";
  tile_url_template: string;
  score_property: string;
  zscore_property: string;
  zooms: number[];
  density_rule?: string;
  density_base_zoom?: number | null;
  stats: {
    count: number;
    score_min: number;
    score_max: number;
    zscore_min: number;
    zscore_max: number;
  };
};
