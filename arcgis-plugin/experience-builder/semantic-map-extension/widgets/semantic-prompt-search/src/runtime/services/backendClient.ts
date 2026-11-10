import { DEFAULT_CONFIG, DEFAULT_DATASET_IDS, type Config, type ScoreField } from "../../config";

export type JobStatus =
  | "queued"
  | "loading_model"
  | "loading_dataset"
  | "scoring"
  | "building_tiles"
  | "ready"
  | "failed"
  | "cancelled";

export interface ScoringResultRef {
  dataset_id: string;
  prompt_id: string;
  manifest_url: string;
  tile_url_template: string;
}

export interface ScoringJobResponse {
  job_id: string;
  prompt_id: string;
  dataset_id: string;
  dataset_group_id?: string | null;
  dataset_ids?: string[];
  prompt: string;
  status: JobStatus;
  progress: number;
  message?: string;
  current_stage?: string | null;
  results?: ScoringResultRef[];
}

export interface ArcGISFeatureField {
  name: string;
  type: "oid" | "string" | "double" | "integer" | "date";
  alias?: string | null;
  length?: number | null;
}

export interface ArcGISFeature {
  geometry: {
    x: number;
    y: number;
    spatialReference?: { wkid: number };
  };
  attributes: Record<string, unknown>;
}

export interface ArcGISFeaturePage {
  prompt_id: string;
  dataset_id: string;
  dataset_group_id?: string | null;
  prompt: string;
  query_type: "text" | "pano_reference";
  geometry_type: "esriGeometryPoint";
  object_id_field_name: string;
  spatial_reference: { wkid: number };
  fields: ArcGISFeatureField[];
  total: number;
  features: ArcGISFeature[];
  offset: number;
  limit: number;
  count: number;
  has_more: boolean;
  next_offset?: number | null;
}

export interface SemanticBackendConfig {
  backendUrl: string;
  token: string;
  datasetGroupId: string;
  datasetIds: string[];
  scoreField: ScoreField;
  rangeMin: number;
  rangeMax: number;
  pageSize: number;
  maxFeatures: number;
  useCurrentExtent: boolean;
}

export interface FeatureFetchOptions {
  field: ScoreField;
  min?: number;
  max?: number;
  bbox?: string;
  pageSize: number;
  maxFeatures: number;
}

export type StatusListener = (message: string, job?: ScoringJobResponse) => void;

export function normalizeConfig(config?: Config | null): SemanticBackendConfig {
  const datasetIds = Array.isArray(config?.datasetIds) && config?.datasetIds.length ? config.datasetIds : DEFAULT_DATASET_IDS;
  return {
    backendUrl: normalizeBackendUrl(config?.backendUrl || DEFAULT_CONFIG.backendUrl),
    token: config?.token || "",
    datasetGroupId: config?.datasetGroupId || DEFAULT_CONFIG.datasetGroupId,
    datasetIds,
    scoreField: config?.scoreField || DEFAULT_CONFIG.scoreField,
    rangeMin: Number.isFinite(config?.rangeMin) ? Number(config?.rangeMin) : DEFAULT_CONFIG.rangeMin,
    rangeMax: Number.isFinite(config?.rangeMax) ? Number(config?.rangeMax) : DEFAULT_CONFIG.rangeMax,
    pageSize: clampInteger(config?.pageSize, 1000, 200000, DEFAULT_CONFIG.pageSize),
    maxFeatures: clampInteger(config?.maxFeatures, 1000, 2000000, DEFAULT_CONFIG.maxFeatures),
    useCurrentExtent: config?.useCurrentExtent ?? DEFAULT_CONFIG.useCurrentExtent
  };
}

export async function submitPromptJob(config: SemanticBackendConfig, prompt: string): Promise<ScoringJobResponse> {
  const datasetIds = config.datasetIds.length ? config.datasetIds : DEFAULT_DATASET_IDS;
  const body =
    datasetIds.length > 1
      ? {
          dataset_group_id: config.datasetGroupId,
          dataset_ids: datasetIds,
          prompt,
          query_type: "text"
        }
      : {
          dataset_id: datasetIds[0],
          prompt,
          query_type: "text"
        };

  const response = await fetch(resolveBackendUrl(config, "/api/scoring/jobs"), {
    method: "POST",
    headers: jsonHeaders(config),
    body: JSON.stringify(body)
  });
  return checkedJson<ScoringJobResponse>(response, "Prompt submission failed");
}

export async function pollScoringJob(
  config: SemanticBackendConfig,
  jobId: string,
  onStatus?: StatusListener
): Promise<ScoringJobResponse> {
  for (let attempt = 0; attempt < 720; attempt += 1) {
    const response = await fetch(resolveBackendUrl(config, `/api/scoring/jobs/${encodeURIComponent(jobId)}`), {
      headers: authHeaders(config),
      cache: "no-store"
    });
    const job = await checkedJson<ScoringJobResponse>(response, "Job polling failed");
    onStatus?.(job.message || job.current_stage || job.status, job);
    if (job.status === "ready") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      throw new Error(job.message || `Scoring job ${job.status}`);
    }
    await delay(1500);
  }
  throw new Error("Scoring job polling timed out");
}

export function resultRefs(job: ScoringJobResponse): ScoringResultRef[] {
  if (job.results?.length) return job.results;
  return [
    {
      dataset_id: job.dataset_id,
      prompt_id: job.prompt_id,
      manifest_url: `/api/scoring/results/${encodeURIComponent(job.prompt_id)}/manifest`,
      tile_url_template: ""
    }
  ];
}

export async function fetchAllFeatures(
  config: SemanticBackendConfig,
  result: ScoringResultRef,
  options: FeatureFetchOptions,
  onStatus?: (message: string, page?: ArcGISFeaturePage) => void
): Promise<ArcGISFeaturePage> {
  let offset = 0;
  let combined: ArcGISFeaturePage | null = null;
  const features: ArcGISFeature[] = [];

  while (features.length < options.maxFeatures) {
    const limit = Math.min(options.pageSize, options.maxFeatures - features.length);
    const page = await fetchFeaturePage(config, result, { ...options, pageSize: limit }, offset);
    if (!combined) combined = { ...page, features: [] };
    features.push(...page.features);
    onStatus?.(`Fetched ${features.length.toLocaleString()} of ${page.total.toLocaleString()} ${datasetLabel(result.dataset_id)} points.`, page);

    if (!page.has_more || !page.next_offset || page.count === 0) break;
    offset = page.next_offset;
  }

  if (!combined) {
    throw new Error("No feature page was returned");
  }
  return {
    ...combined,
    features,
    count: features.length,
    has_more: features.length < combined.total
  };
}

export function datasetLabel(datasetId: string): string {
  if (datasetId.toLowerCase().includes("shanghai")) return "Shanghai";
  if (datasetId.toLowerCase().includes("london")) return "London";
  return datasetId;
}

async function fetchFeaturePage(
  config: SemanticBackendConfig,
  result: ScoringResultRef,
  options: FeatureFetchOptions,
  offset: number
): Promise<ArcGISFeaturePage> {
  const params = new URLSearchParams({
    dataset_id: result.dataset_id,
    field: options.field,
    limit: String(options.pageSize),
    offset: String(offset)
  });
  if (typeof options.min === "number" && Number.isFinite(options.min)) params.set("min", String(options.min));
  if (typeof options.max === "number" && Number.isFinite(options.max)) params.set("max", String(options.max));
  if (options.bbox) params.set("bbox", options.bbox);

  const path = `/api/scoring/results/${encodeURIComponent(result.prompt_id)}/features/page?${params.toString()}`;
  const response = await fetch(resolveBackendUrl(config, path), {
    headers: authHeaders(config),
    cache: "no-store"
  });
  return checkedJson<ArcGISFeaturePage>(response, "Feature export failed");
}

function resolveBackendUrl(config: SemanticBackendConfig, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${config.backendUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function normalizeBackendUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function authHeaders(config: SemanticBackendConfig): HeadersInit {
  return config.token.trim() ? { Authorization: `Bearer ${config.token.trim()}` } : {};
}

function jsonHeaders(config: SemanticBackendConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(config)
  };
}

async function checkedJson<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: unknown; message?: unknown };
      detail = String(payload.detail || payload.message || "");
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`${message} (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
