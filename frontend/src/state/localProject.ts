import type {
  AppStateResponse,
  CityId,
  CityPriorityTiles,
  FeatureCollection,
  GradientPreset,
  GradientStop,
  LayerCreate,
  LayerPatch,
  LayerState,
  PanoImageResponse,
  PanoReference,
  RemoteBackendConfig,
  RemoteLogEntry,
  RemoteResultManifest,
  ScoringJob,
  SemanticLayer,
  TileCoord
} from "../api/types";
import { DEFAULT_POINT_RADIUS, clamp, layerStyleFromGradient, slugify } from "./color";
import { reportDemoMonitorEvent } from "./demoMonitor";
import { exhibitConfig } from "./exhibitConfig";
import { runtimeConfig } from "./runtimeConfig";

const STATE_KEY = "semantic-map-local-state-v1";
const GRADIENTS_KEY = "semantic-map-local-gradients-v1";
const REMOTE_BACKEND_KEY = "semantic-map-runpod-backend-v1";
const REMOTE_TILE_CACHE_DB = "semantic-map-remote-tile-cache-v1";
const REMOTE_TILE_CACHE_STORE = "tiles";
const MOCK_POINT_COUNT = 240;
const MOCK_PANO_ID_START = 10002;
const MOCK_SHANGHAI_PANO_ID_START = 700000;
const DEFAULT_REMOTE_BACKEND_URL = runtimeConfig.defaultRemoteBackendUrl;
const DEFAULT_REMOTE_DATASET_ID = runtimeConfig.defaultDatasetId;
const DEFAULT_REMOTE_DATASET_IDS = normalizeDatasetIds(runtimeConfig.defaultDatasetIds);
const DEFAULT_REMOTE_DATASET_GROUP_ID = runtimeConfig.defaultDatasetGroupId;
const DEFAULT_REMOTE_ZOOMS = [10, 11, 12, 13];
const STATE_UPDATED_EVENT = "semantic-map-local-state-updated";
const EXHIBIT_RESET_EVENT = "semantic-map-exhibit-reset";
const EXHIBIT_SCORE_MIN = -1;
const EXHIBIT_SCORE_MAX = 3;
const EXHIBIT_POINT_RADIUS = 3;
const REFERENCE_ZSCORE_MIN = 2;
const REFERENCE_ZSCORE_MAX = 6;
export const REMOTE_LOG_EVENT = "semantic-map-remote-log";
const ACTIVE_REMOTE_POLLS = new Set<string>();
const LAST_REMOTE_LOG_KEYS = new Map<string, string>();
let remoteTileCacheDbPromise: Promise<IDBDatabase | null> | null = null;
const REMOTE_TILE_CACHE_DB_VERSION = 2;
const REMOTE_TILE_CACHE_MAX_ENTRIES = 500;
const MAP_CITY_DATASETS: Record<CityId, string> = {
  london: "london_224_8_45",
  shanghai: "shanghai_224_8_45_2B"
};

const LONDON_CENTER = [-0.1276, 51.5072] as const;
const LONDON_BOUNDS = {
  west: -0.31,
  east: 0.05,
  south: 51.42,
  north: 51.58
};
const SHANGHAI_CENTER = [121.4737, 31.2304] as const;
const SHANGHAI_BOUNDS = {
  west: 121.1,
  east: 121.82,
  south: 31.05,
  north: 31.38
};
const STATIC_FALLBACK_PANO_IMAGES = [
  {
    datasetId: "london_224_8_45",
    cityId: "london" as const,
    panoId: "126048",
    file: "london-126048.jpg"
  },
  {
    datasetId: "shanghai_224_8_45_2B",
    cityId: "shanghai" as const,
    panoId: "103110",
    file: "shanghai-103110.jpg"
  }
] as const;
type MockCityId = "london" | "shanghai";

const DEFAULT_GRADIENTS: GradientPreset[] = [
  {
    id: "default_heat",
    name: "Default heat",
    stops: [
      { value: 0.0, color: "#2c7bb6" },
      { value: 0.5, color: "#ffffbf" },
      { value: 1.0, color: "#d7191c" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "viridis",
    name: "Viridis",
    stops: [
      { value: 0.0, color: "#440154" },
      { value: 0.25, color: "#3b528b" },
      { value: 0.5, color: "#21918c" },
      { value: 0.75, color: "#5ec962" },
      { value: 1.0, color: "#fde725" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "turbo",
    name: "Turbo",
    stops: [
      { value: 0.0, color: "#30123b" },
      { value: 0.125, color: "#4663d7" },
      { value: 0.25, color: "#37a9e6" },
      { value: 0.375, color: "#1ae4b6" },
      { value: 0.5, color: "#71fe5f" },
      { value: 0.625, color: "#c8ef34" },
      { value: 0.75, color: "#faba39" },
      { value: 0.875, color: "#ef5a11" },
      { value: 1.0, color: "#a71401" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "magma",
    name: "Magma",
    stops: [
      { value: 0.0, color: "#000004" },
      { value: 0.2, color: "#3b0f70" },
      { value: 0.4, color: "#8c2981" },
      { value: 0.6, color: "#de4968" },
      { value: 0.8, color: "#fe9f6d" },
      { value: 1.0, color: "#fcfdbf" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "spectral",
    name: "Spectral",
    stops: [
      { value: 0.0, color: "#9e0142" },
      { value: 0.125, color: "#d53e4f" },
      { value: 0.25, color: "#f46d43" },
      { value: 0.375, color: "#fdae61" },
      { value: 0.5, color: "#ffffbf" },
      { value: 0.625, color: "#abdda4" },
      { value: 0.75, color: "#66c2a5" },
      { value: 0.875, color: "#3288bd" },
      { value: 1.0, color: "#5e4fa2" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "red",
    name: "Red",
    stops: [
      { value: 0.0, color: "#000000" },
      { value: 1.0, color: "#ff0000" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "green",
    name: "Green",
    stops: [
      { value: 0.0, color: "#000000" },
      { value: 1.0, color: "#00ff00" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "vegetation",
    name: "Vegetation",
    stops: [
      { value: 0.0, color: "#582e1d" },
      { value: 0.5, color: "#000000" },
      { value: 1.0, color: "#50ff00" }
    ],
    opacity: 0.75,
    score_min: -2.5,
    score_max: 1.5,
    updated_at: "2026-04-29T00:00:00Z",
    is_default: true
  },
  {
    id: "blue",
    name: "Blue",
    stops: [
      { value: 0.0, color: "#000000" },
      { value: 1.0, color: "#0000ff" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "white",
    name: "White",
    stops: [
      { value: 0.0, color: "#000000" },
      { value: 1.0, color: "#ffffff" }
    ],
    opacity: 0.75,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: true
  },
  {
    id: "violet_gold",
    name: "Violet gold",
    stops: [
      { value: 0.0, color: "#2d3142" },
      { value: 0.45, color: "#8d99ae" },
      { value: 1.0, color: "#f6c85f" }
    ],
    opacity: 0.7,
    score_min: 0.0,
    score_max: 1.0,
    updated_at: "2026-04-27T00:00:00Z",
    is_default: false
  }
];

const BUILT_IN_GRADIENT_IDS = new Set(DEFAULT_GRADIENTS.filter((gradient) => gradient.is_default).map((gradient) => gradient.id));

const EXHIBIT_LAYER_SPECS = [
  {
    prompt: "the scene contains brick facade",
    name: "the scene contains brick facade",
    staticDataKey: "text-the-scene-contains-brick-facade",
    gradientId: "magma",
    scoreMin: EXHIBIT_SCORE_MIN,
    scoreMax: EXHIBIT_SCORE_MAX
  },
  {
    prompt: "the scene contains abundant vegetation",
    name: "the scene contains abundant vegetation",
    staticDataKey: "text-the-scene-contains-abundant-vegetation",
    gradientId: "vegetation",
    scoreMin: -2.5,
    scoreMax: 1.5
  },
  {
    prompt: "the scene shows people interacting",
    name: "the scene shows people interacting",
    staticDataKey: "text-the-scene-contains-social-interaction",
    gradientId: "turbo",
    scoreMin: EXHIBIT_SCORE_MIN,
    scoreMax: EXHIBIT_SCORE_MAX
  }
] as const;

const EXHIBIT_PROMPTS: Set<string> = new Set(EXHIBIT_LAYER_SPECS.map((spec) => spec.prompt));
const REMOTE_READY_ATTEMPTS = 180;
const REMOTE_READY_INTERVAL_MS = 2000;
const REMOTE_READY_TIMEOUT_MS = 5000;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function readJson<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function notifyStateUpdated() {
  window.dispatchEvent(new CustomEvent(STATE_UPDATED_EVENT));
}

function normalizeBackendBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/^[a-z0-9-]+-\d+\.proxy\.runpod\.net$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" && url.hostname.toLowerCase().endsWith(".proxy.runpod.net")) {
      url.protocol = "https:";
      if (url.port === "80") url.port = "";
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

function browserUrlParam(name: string): string {
  if (typeof window === "undefined") return "";
  return (new URLSearchParams(window.location.search).get(name) ?? "").trim();
}

function urlBackendOverride(): string {
  const value = browserUrlParam("backend") || browserUrlParam("runpod") || browserUrlParam("runpodUrl");
  return value ? normalizeBackendBaseUrl(value) : "";
}

function syncBackendOverrideUrl(config: RemoteBackendConfig) {
  if (typeof window === "undefined" || !urlBackendOverride()) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("runpod");
  url.searchParams.delete("runpodUrl");
  if (config.enabled && config.baseUrl.trim()) {
    url.searchParams.set("backend", normalizeBackendBaseUrl(config.baseUrl));
  } else {
    url.searchParams.delete("backend");
  }
  window.history.replaceState(window.history.state, "", url);
}

function normalizeDatasetIds(value: readonly string[] | string | null | undefined): string[] {
  const rawItems = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const items = rawItems.map((item) => String(item).trim()).filter(Boolean);
  return Array.from(new Set(items));
}

function remoteDatasetIds(config: RemoteBackendConfig): string[] {
  return normalizeDatasetIds(config.datasetIds).length
    ? normalizeDatasetIds(config.datasetIds)
    : normalizeDatasetIds(config.datasetId || DEFAULT_REMOTE_DATASET_ID);
}

function cityIdForDatasetId(datasetId: string | null | undefined): CityId | null {
  if (!datasetId) return null;
  const entry = Object.entries(MAP_CITY_DATASETS).find(([, value]) => value === datasetId);
  return entry ? (entry[0] as CityId) : null;
}

function datasetIdForCity(cityId: CityId): string {
  return MAP_CITY_DATASETS[cityId];
}

function remoteAuthHeaders(config: RemoteBackendConfig): HeadersInit | undefined {
  const headers: Record<string, string> = {};
  if (config.token?.trim()) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
  }
  return Object.keys(headers).length ? headers : undefined;
}

function remoteJsonHeaders(config: RemoteBackendConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (config.token?.trim()) {
    headers.Authorization = `Bearer ${config.token.trim()}`;
  }
  return headers;
}

function reportRemoteRequestFailure(code: string, message: string, details: Record<string, unknown> = {}) {
  reportDemoMonitorEvent({
    severity: "warning",
    code,
    message,
    details
  });
}

function resolveRemoteUrl(config: RemoteBackendConfig, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${normalizeBackendBaseUrl(config.baseUrl)}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function pendingJobSource(jobId: string): string {
  return `remote://job/${encodeURIComponent(jobId)}`;
}

function parsePendingJobSource(sourcePath: string): string | null {
  const match = sourcePath.match(/^remote:\/\/job\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isLegacyPendingSource(sourcePath: string): boolean {
  return sourcePath.startsWith("remote://pending/");
}

function layerSourcePathCandidates(layer: SemanticLayer): string[] {
  return Array.from(new Set([layer.source_path, ...Object.values(layer.source_paths ?? {})].filter(Boolean)));
}

function staticFallbackDataBaseUrl(): string {
  return runtimeConfig.staticFallbackDataBaseUrl.replace(/\/+$/, "");
}

function staticFallbackTileTemplate(dataKey: string, cityId: CityId): string {
  return `${staticFallbackDataBaseUrl()}/tiles/${encodeURIComponent(dataKey)}/${cityId}/{z}/{x}/{y}.geojson`;
}

function staticFallbackSources(dataKey: string): Pick<SemanticLayer, "source_path" | "source_paths" | "score_property" | "status"> {
  const sourcePaths = Object.fromEntries(
    (Object.keys(MAP_CITY_DATASETS) as CityId[]).map((cityId) => [cityId, staticFallbackTileTemplate(dataKey, cityId)])
  ) as Partial<Record<CityId, string>>;
  return {
    source_path: sourcePaths.london ?? Object.values(sourcePaths)[0] ?? "",
    source_paths: sourcePaths,
    score_property: "zscore",
    status: "ready"
  };
}

function exhibitSpecForLayer(layer: Pick<SemanticLayer, "prompt" | "name">) {
  return EXHIBIT_LAYER_SPECS.find((spec) => spec.prompt === layer.prompt || spec.name === layer.name) ?? null;
}

function exhibitSpecForPrompt(prompt: string) {
  return EXHIBIT_LAYER_SPECS.find((spec) => spec.prompt === prompt) ?? null;
}

export function isStaticFallbackTileTemplate(sourcePath: string): boolean {
  if (!isRemoteTileTemplate(sourcePath)) return false;
  const base = `${staticFallbackDataBaseUrl()}/tiles/`;
  return sourcePath.startsWith(base);
}

function staticFallbackPanoImageUrl(panoId: string, datasetId?: string | null): string | null {
  const normalizedPanoId = String(panoId || "").trim();
  const normalizedDatasetId = String(datasetId || "").trim();
  const match = STATIC_FALLBACK_PANO_IMAGES.find((item) => {
    if (item.panoId !== normalizedPanoId) return false;
    return !normalizedDatasetId || item.datasetId === normalizedDatasetId || item.cityId === normalizedDatasetId;
  });
  return match ? `${staticFallbackDataBaseUrl()}/panos/${match.file}` : null;
}

export function getLayerSourcePath(layer: SemanticLayer, cityId: CityId): string {
  const sourcePaths = layer.source_paths ?? {};
  const citySourcePath = sourcePaths[cityId];
  if (citySourcePath) return citySourcePath;
  if (Object.keys(sourcePaths).length) return "";
  return layer.source_path;
}

function normalizeStop(stop: GradientStop): GradientStop {
  return {
    value: clamp(Number(stop.value), 0, 1),
    color: /^#[0-9a-fA-F]{6}$/.test(stop.color) ? stop.color.toLowerCase() : "#000000"
  };
}

function normalizeGradient(raw: Partial<GradientPreset>, fallback = DEFAULT_GRADIENTS[0]): GradientPreset {
  const stops = Array.isArray(raw.stops) ? raw.stops.map(normalizeStop).sort((a, b) => a.value - b.value) : [];
  const normalizedStops = stops.length >= 2 ? stops : clone(fallback.stops);
  const id = String(raw.id || fallback.id || "gradient");

  return {
    id,
    name: String(raw.name || fallback.name || id),
    stops: normalizedStops,
    opacity: clamp(Number(raw.opacity ?? fallback.opacity ?? 0.75), 0, 1),
    score_min: Number(raw.score_min ?? fallback.score_min ?? 0),
    score_max: Number(raw.score_max ?? fallback.score_max ?? 1),
    updated_at: raw.updated_at ?? utcNow(),
    is_default: BUILT_IN_GRADIENT_IDS.has(id)
  };
}

function loadGradientsSync(): GradientPreset[] {
  const raw = readJson<Partial<GradientPreset>[]>(GRADIENTS_KEY);
  const gradients = Array.isArray(raw) && raw.length ? raw.map((item) => normalizeGradient(item)) : clone(DEFAULT_GRADIENTS);
  const byId = new Map(gradients.map((gradient) => [gradient.id, gradient]));

  for (const defaultGradient of DEFAULT_GRADIENTS.filter((gradient) => gradient.is_default)) {
    if (!byId.has(defaultGradient.id)) {
      byId.set(defaultGradient.id, clone(defaultGradient));
    }
  }

  const normalized = Array.from(byId.values());
  writeJson(GRADIENTS_KEY, normalized);
  return normalized;
}

function saveGradientsSync(gradients: GradientPreset[]) {
  writeJson(GRADIENTS_KEY, gradients.map((gradient) => normalizeGradient(gradient)));
}

function loadRemoteBackendConfigSync(): RemoteBackendConfig {
  const raw = readJson<Partial<RemoteBackendConfig>>(REMOTE_BACKEND_KEY);
  const urlBaseUrl = urlBackendOverride();
  if (urlBaseUrl) {
    return {
      baseUrl: urlBaseUrl,
      token: typeof raw?.token === "string" ? raw.token : runtimeConfig.runpodToken,
      datasetId: String(raw?.datasetId || DEFAULT_REMOTE_DATASET_ID),
      datasetIds: normalizeDatasetIds(raw?.datasetIds).length ? normalizeDatasetIds(raw?.datasetIds) : DEFAULT_REMOTE_DATASET_IDS,
      datasetGroupId: typeof raw?.datasetGroupId === "string" ? raw.datasetGroupId : DEFAULT_REMOTE_DATASET_GROUP_ID,
      enabled: true
    };
  }

  if (exhibitConfig.lockRunpodUrl) {
    return {
      baseUrl: normalizeBackendBaseUrl(exhibitConfig.lockedRunpodUrl),
      token: exhibitConfig.lockedRunpodToken,
      datasetId: DEFAULT_REMOTE_DATASET_ID,
      datasetIds: DEFAULT_REMOTE_DATASET_IDS,
      datasetGroupId: DEFAULT_REMOTE_DATASET_GROUP_ID,
      enabled: true
    };
  }

  const baseUrl = normalizeBackendBaseUrl(String(raw?.baseUrl ?? DEFAULT_REMOTE_BACKEND_URL));
  const datasetId = String(raw?.datasetId || DEFAULT_REMOTE_DATASET_ID);
  const datasetIds = normalizeDatasetIds(raw?.datasetIds).length ? normalizeDatasetIds(raw?.datasetIds) : DEFAULT_REMOTE_DATASET_IDS;
  return {
    baseUrl,
    token: typeof raw?.token === "string" ? raw.token : "",
    datasetId,
    datasetIds,
    datasetGroupId: typeof raw?.datasetGroupId === "string" ? raw.datasetGroupId : DEFAULT_REMOTE_DATASET_GROUP_ID,
    enabled: raw?.enabled ?? runtimeConfig.remoteBackendEnabled
  };
}

function saveRemoteBackendConfigSync(config: RemoteBackendConfig): RemoteBackendConfig {
  if (exhibitConfig.lockRunpodUrl) {
    return loadRemoteBackendConfigSync();
  }

  const normalized = {
    baseUrl: normalizeBackendBaseUrl(config.baseUrl),
    token: config.token ?? "",
    datasetId: config.datasetId.trim() || DEFAULT_REMOTE_DATASET_ID,
    datasetIds: normalizeDatasetIds(config.datasetIds).length ? normalizeDatasetIds(config.datasetIds) : DEFAULT_REMOTE_DATASET_IDS,
    datasetGroupId: config.datasetGroupId?.trim() || DEFAULT_REMOTE_DATASET_GROUP_ID,
    enabled: config.enabled
  };
  writeJson(REMOTE_BACKEND_KEY, normalized);
  syncBackendOverrideUrl(normalized);
  return loadRemoteBackendConfigSync();
}

export async function getRemoteBackendConfig(): Promise<RemoteBackendConfig> {
  return loadRemoteBackendConfigSync();
}

export async function saveRemoteBackendConfig(config: RemoteBackendConfig): Promise<RemoteBackendConfig> {
  return saveRemoteBackendConfigSync(config);
}

function gradientById(gradients: GradientPreset[], gradientId?: string | null): GradientPreset {
  return gradients.find((gradient) => gradient.id === gradientId) ?? gradients[0] ?? DEFAULT_GRADIENTS[0];
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function layerIdForPrompt(prompt: string, existingIds: Set<string>): string {
  const base = slugify(prompt, "layer").slice(0, 48) || "layer";
  let candidate = base;
  let index = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  return candidate;
}

function createLayerRecord(payload: LayerCreate, existingIds: Set<string>, gradients: GradientPreset[]): SemanticLayer {
  const prompt = payload.prompt.trim();
  const gradient = gradientById(gradients, payload.gradient_id);
  const id = layerIdForPrompt(prompt, existingIds);
  const label = (payload.name || prompt || id).trim();
  const name = label.length > 58 ? `${label.slice(0, 55).trim()}...` : label;
  const style = {
    ...layerStyleFromGradient(gradient, {
      gradient_id: gradient.id,
      gradient_name: gradient.name,
      stops: gradient.stops,
      opacity: gradient.opacity,
      score_min: EXHIBIT_SCORE_MIN,
      score_max: EXHIBIT_SCORE_MAX,
      point_radius: EXHIBIT_POINT_RADIUS,
      absolute_radius: false
    }),
    score_min: EXHIBIT_SCORE_MIN,
    score_max: EXHIBIT_SCORE_MAX,
    point_radius: EXHIBIT_POINT_RADIUS,
    absolute_radius: false
  };

  const staticSpec = exhibitSpecForPrompt(prompt);
  const fallbackSources = staticSpec ? staticFallbackSources(staticSpec.staticDataKey) : null;
  const sourcePath = fallbackSources?.source_path ?? `local://mock/${id}-${hashString(prompt)}.geojson`;
  return {
    id,
    name: name || id,
    prompt,
    query_type: "text",
    visible: true,
    order: 0,
    source_type: "geojson",
    source_path: sourcePath,
    source_paths: fallbackSources?.source_paths ?? {
      london: sourcePath,
      shanghai: sourcePath
    },
    score_property: fallbackSources?.score_property ?? "zscore",
    style,
    status: fallbackSources?.status ?? "ready",
    created_at: utcNow()
  };
}

function createReferenceLayerRecord(reference: PanoReference, existingIds: Set<string>, gradients: GradientPreset[]): SemanticLayer {
  const normalizedReference = normalizePanoReference(reference);
  const prompt = referenceLayerPrompt(normalizedReference);
  const gradient = gradientById(gradients, "turbo");
  const id = layerIdForPrompt(prompt, existingIds);
  const style = {
    ...layerStyleFromGradient(gradient, {
      gradient_id: gradient.id,
      gradient_name: gradient.name,
      stops: gradient.stops,
      opacity: gradient.opacity,
      score_min: REFERENCE_ZSCORE_MIN,
      score_max: REFERENCE_ZSCORE_MAX,
      point_radius: EXHIBIT_POINT_RADIUS,
      absolute_radius: false
    }),
    score_min: REFERENCE_ZSCORE_MIN,
    score_max: REFERENCE_ZSCORE_MAX,
    point_radius: EXHIBIT_POINT_RADIUS,
    absolute_radius: false
  };

  const sourcePath = `local://mock/${id}-${hashString(`${normalizedReference.dataset_id}:${normalizedReference.pano_id}`)}.geojson`;
  return {
    id,
    name: prompt,
    prompt,
    query_type: "pano_reference",
    reference_pano: normalizedReference,
    visible: true,
    order: 0,
    source_type: "geojson",
    source_path: sourcePath,
    source_paths: {
      london: sourcePath,
      shanghai: sourcePath
    },
    score_property: "zscore",
    style,
    status: "ready",
    created_at: utcNow()
  };
}

function localMockSourcePathForLayer(layer: Pick<SemanticLayer, "id" | "prompt" | "query_type" | "reference_pano">): string {
  const hashInput =
    layer.query_type === "pano_reference" && layer.reference_pano
      ? `${layer.reference_pano.dataset_id}:${layer.reference_pano.pano_id}`
      : layer.prompt;
  return `local://mock/${layer.id}-${hashString(hashInput)}.geojson`;
}

function restoreLayerLocalFallbackSync(layer: SemanticLayer): SemanticLayer | null {
  const staticSpec = exhibitSpecForLayer(layer);
  if (staticSpec) {
    return updateLayerSync(layer.id, staticFallbackSources(staticSpec.staticDataKey));
  }
  const sourcePath = localMockSourcePathForLayer(layer);
  return updateLayerSync(layer.id, {
    status: "ready",
    source_path: sourcePath,
    source_paths: {
      london: sourcePath,
      shanghai: sourcePath
    }
  });
}

function localFallbackJob(layer: SemanticLayer, message: string): ScoringJob {
  const now = utcNow();
  return {
    job_id: `local_fallback_${hashString(`${layer.id}-${now}`)}`,
    prompt: layer.prompt,
    status: "ready",
    progress: 1,
    layer_id: layer.id,
    message,
    created_at: now,
    updated_at: now
  };
}

function normalizePanoReference(reference: PanoReference): PanoReference {
  const panoId = String(reference.pano_id || "").trim();
  const datasetId = String(reference.dataset_id || "").trim();
  if (!panoId || !datasetId) {
    throw new Error("Reference pano requires pano id and dataset id.");
  }
  return {
    pano_id: panoId,
    dataset_id: datasetId,
    city_id: typeof reference.city_id === "string" ? reference.city_id : cityIdForDatasetId(datasetId) ?? null,
    lon: typeof reference.lon === "number" && Number.isFinite(reference.lon) ? reference.lon : null,
    lat: typeof reference.lat === "number" && Number.isFinite(reference.lat) ? reference.lat : null,
    date: typeof reference.date === "string" || typeof reference.date === "number" ? reference.date : null
  };
}

function referenceLayerPrompt(reference: PanoReference): string {
  const city = String(reference.city_id || cityIdForDatasetId(reference.dataset_id) || reference.dataset_id || "").trim();
  return city ? `Reference pano ${reference.pano_id} (${city})` : `Reference pano ${reference.pano_id}`;
}

function normalizeSourcePaths(raw: Partial<SemanticLayer>, fallback: string): Partial<Record<CityId, string>> | undefined {
  const sourcePaths: Partial<Record<CityId, string>> = {};
  const rawPaths = raw.source_paths as Partial<Record<CityId, unknown>> | undefined;
  for (const cityId of Object.keys(MAP_CITY_DATASETS) as CityId[]) {
    const value = rawPaths?.[cityId];
    if (typeof value === "string" && value.trim()) {
      sourcePaths[cityId] = value;
    }
  }
  if (!Object.keys(sourcePaths).length && fallback.startsWith("local://mock/")) {
    sourcePaths.london = fallback;
    sourcePaths.shanghai = fallback;
  }
  return Object.keys(sourcePaths).length ? sourcePaths : undefined;
}

function normalizeLayer(raw: Partial<SemanticLayer>, order: number, gradients: GradientPreset[]): SemanticLayer | null {
  if (!raw.id || !raw.prompt) return null;
  const gradient = gradientById(gradients, raw.style?.gradient_id);
  const queryType = raw.query_type === "pano_reference" ? "pano_reference" : "text";
  let referencePano: PanoReference | null = null;
  if (queryType === "pano_reference" && raw.reference_pano) {
    try {
      referencePano = normalizePanoReference(raw.reference_pano);
    } catch {
      referencePano = null;
    }
  }
  const style = raw.style
    ? {
        ...layerStyleFromGradient(gradient, raw.style),
        ...raw.style,
        stops: raw.style.stops?.length ? raw.style.stops.map(normalizeStop).sort((a, b) => a.value - b.value) : clone(gradient.stops),
        opacity: clamp(Number(raw.style.opacity ?? gradient.opacity), 0, 1),
        point_radius: clamp(Number(raw.style.point_radius ?? DEFAULT_POINT_RADIUS), 0.25, 128),
        absolute_radius: Boolean(raw.style.absolute_radius)
      }
    : layerStyleFromGradient(gradient);

  const sourcePath = raw.source_path || `local://mock/${raw.id}-${hashString(String(raw.prompt))}.geojson`;
  return {
    id: String(raw.id),
    name: String(raw.name || raw.prompt || raw.id),
    prompt: String(raw.prompt),
    query_type: queryType,
    reference_pano: referencePano,
    visible: raw.visible ?? true,
    order,
    source_type: "geojson",
    source_path: sourcePath,
    source_paths: normalizeSourcePaths(raw, sourcePath),
    score_property: raw.score_property || "zscore",
    style,
    status: raw.status || "ready",
    created_at: raw.created_at || utcNow()
  };
}

function createDefaultExhibitLayers(gradients: GradientPreset[]): SemanticLayer[] {
  const usedIds = new Set<string>();
  return EXHIBIT_LAYER_SPECS.map((spec, index) => {
    const gradient = gradientById(gradients, spec.gradientId);
    const id = layerIdForPrompt(spec.prompt, usedIds);
    usedIds.add(id);
    const style = {
      ...layerStyleFromGradient(
        {
          ...gradient,
          score_min: spec.scoreMin,
          score_max: spec.scoreMax
        },
        {
          gradient_id: gradient.id,
          opacity: gradient.opacity,
          score_min: spec.scoreMin,
          score_max: spec.scoreMax,
          point_radius: EXHIBIT_POINT_RADIUS,
          absolute_radius: false
        }
      ),
      score_min: spec.scoreMin,
      score_max: spec.scoreMax,
      point_radius: EXHIBIT_POINT_RADIUS,
      absolute_radius: false
    };
    const fallbackSources = staticFallbackSources(spec.staticDataKey);
    return {
      id,
      name: spec.name,
      prompt: spec.prompt,
      query_type: "text" as const,
      visible: true,
      order: index,
      source_type: "geojson" as const,
      source_path: fallbackSources.source_path,
      source_paths: fallbackSources.source_paths,
      score_property: fallbackSources.score_property,
      style,
      status: fallbackSources.status,
      created_at: utcNow()
    };
  });
}

function createDefaultExhibitState(gradients: GradientPreset[]): LayerState {
  const layers = createDefaultExhibitLayers(gradients);
  return {
    layers,
    selected_layer_id: layers[0]?.id ?? null,
    updated_at: utcNow()
  };
}

function isLegacyInitialAnimalState(state: LayerState): boolean {
  return (
    state.layers.length === 1 &&
    state.layers[0]?.name === "Animal score" &&
    state.layers[0]?.source_path.startsWith("local://mock/")
  );
}

function applyStaticFallbackToExhibitLayers(state: LayerState): LayerState {
  let changed = false;
  const config = loadRemoteBackendConfigSync();
  const canUseRemoteBackend = Boolean(config.enabled && config.baseUrl.trim());
  const layers = state.layers.map((layer) => {
    const spec = exhibitSpecForLayer(layer);
    if (!spec) return layer;
    const candidates = layerSourcePathCandidates(layer);
    if (canUseRemoteBackend && candidates.some((sourcePath) => isRemoteTileTemplate(sourcePath) && !isStaticFallbackTileTemplate(sourcePath))) {
      return layer;
    }
    if (candidates.some((sourcePath) => isStaticFallbackTileTemplate(sourcePath))) {
      return layer;
    }
    changed = true;
    return {
      ...layer,
      ...staticFallbackSources(spec.staticDataKey),
      query_type: layer.query_type ?? "text"
    };
  });
  return changed ? { ...state, layers, updated_at: utcNow() } : state;
}

function normalizeState(raw: Partial<LayerState> | null, gradients: GradientPreset[]): LayerState {
  if (!raw) {
    return createDefaultExhibitState(gradients);
  }

  const layers = (raw.layers ?? [])
    .map((layer, index) => normalizeLayer(layer, index, gradients))
    .filter((layer): layer is SemanticLayer => Boolean(layer));
  const ids = new Set(layers.map((layer) => layer.id));
  const selected = raw.selected_layer_id && ids.has(raw.selected_layer_id) ? raw.selected_layer_id : layers[0]?.id ?? null;

  const state = {
    layers,
    selected_layer_id: selected,
    updated_at: raw.updated_at ?? utcNow()
  };
  return isLegacyInitialAnimalState(state) ? createDefaultExhibitState(gradients) : applyStaticFallbackToExhibitLayers(state);
}

function loadStateSync(gradients = loadGradientsSync()): LayerState {
  const state = normalizeState(readJson<Partial<LayerState>>(STATE_KEY), gradients);
  writeJson(STATE_KEY, state);
  return state;
}

function saveStateSync(state: LayerState, gradients = loadGradientsSync()): LayerState {
  const normalized = normalizeState({ ...state, updated_at: utcNow() }, gradients);
  writeJson(STATE_KEY, normalized);
  return normalized;
}

export async function getAppState(): Promise<AppStateResponse> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  return { state, gradients };
}

export async function updateAppState(state: LayerState): Promise<LayerState> {
  return saveStateSync(state);
}

export async function resetExhibitState(): Promise<AppStateResponse> {
  const gradients = loadGradientsSync();
  const byId = new Map(gradients.map((gradient) => [gradient.id, gradient]));
  const nextGradients = Array.from(byId.values());
  saveGradientsSync(nextGradients);
  const previousState = loadStateSync(nextGradients);
  const previousByPrompt = new Map(
    previousState.layers
      .filter((layer) => EXHIBIT_PROMPTS.has(layer.prompt))
      .map((layer) => [layer.prompt, layer])
  );

  const usedIds = new Set<string>();
  const layers = EXHIBIT_LAYER_SPECS.map((spec, index) => {
    const gradient = gradientById(nextGradients, spec.gradientId);
    const previousLayer = previousByPrompt.get(spec.prompt);
    const reusableRemote = previousLayer && shouldReuseExhibitRemoteSource(previousLayer);
    const id = previousLayer?.id || layerIdForPrompt(spec.prompt, usedIds);
    usedIds.add(id);
    const style = {
      ...layerStyleFromGradient(
        {
          ...gradient,
          score_min: spec.scoreMin,
          score_max: spec.scoreMax
        },
        {
          gradient_id: gradient.id,
          opacity: gradient.opacity,
          score_min: spec.scoreMin,
          score_max: spec.scoreMax,
          point_radius: EXHIBIT_POINT_RADIUS,
          absolute_radius: false
        }
      ),
      score_min: spec.scoreMin,
      score_max: spec.scoreMax,
      point_radius: EXHIBIT_POINT_RADIUS,
      absolute_radius: false
    };

    const fallbackSources = staticFallbackSources(spec.staticDataKey);
    const sourcePath = reusableRemote ? previousLayer.source_path : fallbackSources.source_path;
    const sourcePaths = reusableRemote ? previousLayer.source_paths : fallbackSources.source_paths;
    return {
      id,
      name: spec.name,
      prompt: spec.prompt,
      visible: true,
      order: index,
      source_type: "geojson" as const,
      source_path: sourcePath,
      source_paths: sourcePaths,
      score_property: reusableRemote ? previousLayer.score_property : fallbackSources.score_property,
      style,
      status: reusableRemote ? previousLayer.status : fallbackSources.status,
      created_at: previousLayer?.created_at || utcNow()
    };
  });

  const state: LayerState = {
    layers,
    selected_layer_id: layers[0]?.id ?? null,
    updated_at: utcNow()
  };
  window.localStorage.setItem("semantic-map-histogram-bucket-width", "0.02");
  saveStateSync(state, nextGradients);
  window.dispatchEvent(new CustomEvent(EXHIBIT_RESET_EVENT));
  notifyStateUpdated();
  return { state, gradients: nextGradients };
}

function shouldReuseExhibitRemoteSource(layer: SemanticLayer): boolean {
  if (layer.status === "failed") return false;
  const config = loadRemoteBackendConfigSync();
  const canUseRemoteBackend = Boolean(config.enabled && config.baseUrl.trim());
  return layerSourcePathCandidates(layer).some((sourcePath) =>
    isStaticFallbackTileTemplate(sourcePath) ||
    (canUseRemoteBackend && (isRemoteTileTemplate(sourcePath) || Boolean(parsePendingJobSource(sourcePath)) || isLegacyPendingSource(sourcePath)))
  );
}

export function hasExhibitDefaultLayers(state: LayerState): boolean {
  const prompts = new Set(state.layers.map((layer) => layer.prompt));
  return EXHIBIT_LAYER_SPECS.every((spec) => prompts.has(spec.prompt));
}

export async function createLayer(payload: LayerCreate): Promise<SemanticLayer> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const layer = createLayerRecord(payload, new Set(state.layers.map((item) => item.id)), gradients);
  state.layers = [layer, ...state.layers].map((item, index) => ({ ...item, order: index }));
  state.selected_layer_id = layer.id;
  saveStateSync(state, gradients);
  return layer;
}

export async function createReferenceLayer(reference: PanoReference): Promise<SemanticLayer> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const layer = createReferenceLayerRecord(reference, new Set(state.layers.map((item) => item.id)), gradients);
  state.layers = [layer, ...state.layers].map((item, index) => ({ ...item, order: index }));
  state.selected_layer_id = layer.id;
  saveStateSync(state, gradients);
  return layer;
}

function updateLayerSync(layerId: string, patch: Partial<SemanticLayer>): SemanticLayer | null {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) return null;
  Object.assign(layer, patch);
  saveStateSync(state, gradients);
  notifyStateUpdated();
  return layer;
}

export async function patchLayer(layerId: string, payload: LayerPatch): Promise<SemanticLayer> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) throw new Error("Layer not found");

  if (payload.name !== undefined) layer.name = payload.name;
  if (payload.visible !== undefined) layer.visible = payload.visible;
  if (payload.score_property !== undefined) layer.score_property = payload.score_property;
  if (payload.style !== undefined) layer.style = payload.style;
  if (payload.selected) state.selected_layer_id = layer.id;

  saveStateSync(state, gradients);
  return layer;
}

export async function deleteLayer(layerId: string): Promise<void> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const nextLayers = state.layers.filter((layer) => layer.id !== layerId).map((layer, index) => ({ ...layer, order: index }));
  if (nextLayers.length === state.layers.length) throw new Error("Layer not found");
  state.layers = nextLayers;
  if (state.selected_layer_id === layerId) state.selected_layer_id = nextLayers[0]?.id ?? null;
  saveStateSync(state, gradients);
}

export async function reorderLayers(layerIds: string[]): Promise<LayerState> {
  const gradients = loadGradientsSync();
  const state = loadStateSync(gradients);
  const byId = new Map(state.layers.map((layer) => [layer.id, layer]));
  const ordered = layerIds.map((id) => byId.get(id)).filter((layer): layer is SemanticLayer => Boolean(layer));
  ordered.push(...state.layers.filter((layer) => !layerIds.includes(layer.id)));
  state.layers = ordered.map((layer, index) => ({ ...layer, order: index }));
  return saveStateSync(state, gradients);
}

export async function saveGradient(gradient: GradientPreset): Promise<GradientPreset> {
  const gradients = loadGradientsSync().filter((item) => item.id !== gradient.id);
  const saved = normalizeGradient({
    ...gradient,
    is_default: false,
    updated_at: utcNow()
  });
  saved.is_default = false;
  gradients.push(saved);
  saveGradientsSync(gradients);
  return saved;
}

export async function deleteGradient(gradientId: string): Promise<void> {
  if (BUILT_IN_GRADIENT_IDS.has(gradientId)) throw new Error("Built-in gradients cannot be deleted");
  const gradients = loadGradientsSync();
  const kept = gradients.filter((gradient) => gradient.id !== gradientId);
  if (kept.length === gradients.length) throw new Error("Gradient not found");
  saveGradientsSync(kept);
}

function emitRemoteInfoLog(layerId: string | null, prompt: string | null, message: string, status: RemoteLogEntry["status"] = "info") {
  emitRemoteLog({
    layer_id: layerId,
    prompt,
    status,
    message
  });
}

function emitRemoteJobLog(layerId: string, job: ScoringJob, options: { mapOverlay?: boolean } = {}) {
  const tile = job.current_tile ? tileLabel(job.current_tile) : "";
  const key = [
    layerId,
    job.job_id,
    job.status,
    Math.round((job.progress ?? 0) * 1000),
    job.message,
    job.current_stage ?? "",
    tile,
    job.tiles_done ?? 0,
    job.tiles_total ?? 0,
    JSON.stringify(job.stage_timings ?? {})
  ].join("|");
  if (LAST_REMOTE_LOG_KEYS.get(layerId) === key) return;
  LAST_REMOTE_LOG_KEYS.set(layerId, key);

  emitRemoteLog({
    layer_id: layerId,
    job_id: job.job_id,
    prompt: job.prompt,
    status: job.status,
    progress: job.progress,
    message: job.message || remoteStatusLabel(job),
    current_stage: job.current_stage,
    current_tile: job.current_tile ?? null,
    tiles_done: job.tiles_done,
    tiles_total: job.tiles_total,
    stage_timings: job.stage_timings,
    map_overlay: options.mapOverlay
  });
}

function emitRemoteLog(entry: Omit<RemoteLogEntry, "id" | "timestamp">) {
  const fullEntry: RemoteLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: utcNow(),
    ...entry
  };
  window.dispatchEvent(new CustomEvent<RemoteLogEntry>(REMOTE_LOG_EVENT, { detail: fullEntry }));
}

function remoteStatusLabel(job: ScoringJob): string {
  const pct = Math.round((job.progress ?? 0) * 100);
  if (job.current_tile) return `${job.status}: ${tileLabel(job.current_tile)} (${job.tiles_done ?? 0}/${job.tiles_total ?? 0})`;
  return `${job.status}: ${pct}%`;
}

function tileLabel(tile: TileCoord): string {
  const dataset = tile.dataset_id ? `${tile.dataset_id}:` : "";
  return `${dataset}${tile.z}/${tile.x}/${tile.y}`;
}

function priorityTilesLabel(priorityTiles?: CityPriorityTiles | null): string {
  if (!priorityTiles) return "";
  return (Object.keys(MAP_CITY_DATASETS) as CityId[])
    .map((cityId) => {
      const tile = priorityTiles[cityId];
      return tile ? `${cityId} ${tileLabel(tile)}` : "";
    })
    .filter(Boolean)
    .join(", ");
}

export async function createScoringJob(prompt: string, priorityTiles?: CityPriorityTiles | null): Promise<ScoringJob> {
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) {
    return createLocalMockScoringJob(prompt);
  }

  const layer = await createLayer({ prompt });
  try {
    return await submitRemoteScoringForLayer(config, layer, priorityTiles);
  } catch {
    const fallbackLayer = restoreLayerLocalFallbackSync(layer) ?? layer;
    emitRemoteInfoLog(layer.id, prompt, "RunPod submission failed. Using local fallback layer.", "info");
    return localFallbackJob(fallbackLayer, "Local fallback scoring completed after RunPod submission failed.");
  }
}

export async function createPanoReferenceScoringJob(reference: PanoReference, priorityTiles?: CityPriorityTiles | null): Promise<ScoringJob> {
  const normalizedReference = normalizePanoReference(reference);
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) {
    return createLocalMockReferenceScoringJob(normalizedReference);
  }

  const layer = await createReferenceLayer(normalizedReference);
  try {
    return await submitRemoteScoringForLayer(config, layer, priorityTiles);
  } catch {
    const fallbackLayer = restoreLayerLocalFallbackSync(layer) ?? layer;
    emitRemoteInfoLog(layer.id, layer.prompt, "RunPod reference submission failed. Using local fallback layer.", "info");
    return localFallbackJob(fallbackLayer, "Local fallback reference scoring completed after RunPod submission failed.");
  }
}

export async function refreshAllScoringLayers(priorityTiles?: CityPriorityTiles | null): Promise<{ submitted: number; skipped: number; failed: number }> {
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) {
    throw new Error("RunPod backend is not enabled.");
  }

  const state = loadStateSync();
  const layers = state.layers.filter((layer) => layer.prompt.trim());
  if (!layers.length) {
    emitRemoteInfoLog(null, null, "No layers found to refresh.");
    return { submitted: 0, skipped: 0, failed: 0 };
  }

  emitRemoteInfoLog(null, null, `Refreshing ${layers.length} layer prompt(s) through RunPod.`);
  const results = await Promise.all(
    layers.map(async (layer) => {
      if (ACTIVE_REMOTE_POLLS.has(layer.id)) return "skipped" as const;
      try {
        await submitRemoteScoringForLayer(config, layer, priorityTiles);
        return "submitted" as const;
      } catch {
        restoreLayerLocalFallbackSync(layer);
        return "failed" as const;
      }
    })
  );

  const submitted = results.filter((result) => result === "submitted").length;
  const skipped = results.filter((result) => result === "skipped").length;
  const failed = results.filter((result) => result === "failed").length;
  emitRemoteInfoLog(null, null, `Layer refresh requested: ${submitted} submitted, ${skipped} already running, ${failed} failed to submit.`, failed ? "failed" : "info");
  return { submitted, skipped, failed };
}

async function submitRemoteScoringForLayer(config: RemoteBackendConfig, layer: SemanticLayer, priorityTiles?: CityPriorityTiles | null): Promise<ScoringJob> {
  const prompt = layer.prompt;
  const isReferenceLayer = layer.query_type === "pano_reference";
  const referencePano = isReferenceLayer && layer.reference_pano ? normalizePanoReference(layer.reference_pano) : null;
  if (isReferenceLayer && !referencePano) {
    throw new Error("Reference pano layer is missing reference metadata.");
  }
  const submittingSourcePaths = Object.fromEntries(
    (Object.keys(MAP_CITY_DATASETS) as CityId[]).map((cityId) => [cityId, `remote://pending/${layer.id}`])
  ) as Partial<Record<CityId, string>>;
  updateLayerSync(layer.id, {
    status: "running",
    source_path: `remote://pending/${layer.id}`,
    source_paths: submittingSourcePaths
  });

  try {
    const priorityLabel = priorityTilesLabel(priorityTiles);
    const submitLabel = isReferenceLayer ? "reference pano" : "prompt";
    emitRemoteInfoLog(layer.id, prompt, priorityLabel ? `Submitting ${submitLabel} with priority tiles ${priorityLabel}.` : `Submitting ${submitLabel}.`);
    const submitted = referencePano
      ? await submitRemoteReferenceScoringJob(config, prompt, referencePano, priorityTiles)
      : await submitRemoteScoringJob(config, prompt, priorityTiles);
    const showOnMap = submitted.status !== "ready";
    const job: ScoringJob = {
      ...submitted,
      layer_id: layer.id,
      status: layerStatusFromRemoteJob(submitted.status),
      message: submitted.message || "Queued on RunPod."
    };
    emitRemoteJobLog(layer.id, job, { mapOverlay: showOnMap });
    const pending = pendingJobSource(job.job_id);
    const pendingSourcePaths = Object.fromEntries(
      (Object.keys(MAP_CITY_DATASETS) as CityId[]).map((cityId) => [cityId, pending])
    ) as Partial<Record<CityId, string>>;
    updateLayerSync(layer.id, {
      status: job.status === "ready" ? "ready" : "running",
      source_path: pending,
      source_paths: pendingSourcePaths,
      query_type: submitted.query_type || layer.query_type,
      reference_pano: submitted.reference_pano || layer.reference_pano || null
    });
    void pollRemoteScoringJob(config, layer.id, job, showOnMap);
    return job;
  } catch (error) {
    updateLayerSync(layer.id, { status: "failed" });
    emitRemoteInfoLog(layer.id, prompt, error instanceof Error ? error.message : "RunPod submission failed.", "failed");
    throw error;
  }
}

export async function ensureExhibitDefaultRemoteLayers(priorityTiles?: CityPriorityTiles | null): Promise<{ ready: boolean; submitted: number; skipped: number }> {
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) {
    return { ready: false, submitted: 0, skipped: 0 };
  }

  emitRemoteInfoLog(null, null, "Waiting for RunPod backend before submitting default exhibit prompts.");
  const ready = await waitForRemoteBackendReady(config);
  if (!ready) {
    emitRemoteInfoLog(null, null, "RunPod backend is not ready; default exhibit prompts were not submitted.", "failed");
    return { ready: false, submitted: 0, skipped: 0 };
  }

  const state = loadStateSync();
  const layersByPrompt = new Map(state.layers.map((layer) => [layer.prompt, layer]));
  const layersToSubmit: SemanticLayer[] = [];
  let skipped = 0;

  for (const spec of EXHIBIT_LAYER_SPECS) {
    const layer = layersByPrompt.get(spec.prompt);
    if (!layer) continue;
    if (shouldReuseExhibitRemoteSource(layer) || ACTIVE_REMOTE_POLLS.has(layer.id)) {
      skipped += 1;
      continue;
    }
    layersToSubmit.push(layer);
  }

  if (!layersToSubmit.length) {
    emitRemoteInfoLog(null, null, skipped ? "Default exhibit prompts already have remote results or pending jobs." : "No default exhibit layers were found to submit.");
    return { ready: true, submitted: 0, skipped };
  }

  emitRemoteInfoLog(null, null, `RunPod backend ready. Submitting ${layersToSubmit.length} default exhibit prompts.`);
  const results = await Promise.all(
    layersToSubmit.map(async (layer) => {
      try {
        await submitRemoteScoringForLayer(config, layer, priorityTiles);
        return true;
      } catch {
        return false;
      }
    })
  );

  return {
    ready: true,
    submitted: results.filter(Boolean).length,
    skipped
  };
}

async function waitForRemoteBackendReady(config: RemoteBackendConfig): Promise<boolean> {
  for (let attempt = 0; attempt < REMOTE_READY_ATTEMPTS; attempt += 1) {
    if (await checkRemoteBackendReady(config)) return true;
    await delay(REMOTE_READY_INTERVAL_MS);
  }
  return false;
}

async function checkRemoteBackendReady(config: RemoteBackendConfig): Promise<boolean> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REMOTE_READY_TIMEOUT_MS);
  try {
    const response = await fetch(resolveRemoteUrl(config, "/api/ready"), {
      headers: remoteAuthHeaders(config),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ready?: boolean };
    return payload.ready === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function priorityTilesForRequest(config: RemoteBackendConfig, priorityTiles?: CityPriorityTiles | null): TileCoord[] {
  if (!priorityTiles) return [];
  const datasetIds = new Set(remoteDatasetIds(config));
  const tiles: TileCoord[] = [];
  for (const cityId of Object.keys(MAP_CITY_DATASETS) as CityId[]) {
    const datasetId = datasetIdForCity(cityId);
    const tile = priorityTiles[cityId];
    if (!tile || !datasetIds.has(datasetId)) continue;
    tiles.push({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      dataset_id: datasetId
    });
  }
  return tiles;
}

async function submitRemoteScoringJob(config: RemoteBackendConfig, prompt: string, priorityTiles?: CityPriorityTiles | null): Promise<ScoringJob> {
  const datasetIds = remoteDatasetIds(config);
  const priorityTileList = priorityTilesForRequest(config, priorityTiles);
  const body =
    datasetIds.length > 1
      ? {
          dataset_group_id: config.datasetGroupId || DEFAULT_REMOTE_DATASET_GROUP_ID,
          dataset_ids: datasetIds,
          prompt,
          zooms: DEFAULT_REMOTE_ZOOMS,
          priority_tiles: priorityTileList.length ? priorityTileList : undefined
        }
      : {
          dataset_id: datasetIds[0] || config.datasetId || DEFAULT_REMOTE_DATASET_ID,
          prompt,
          zooms: DEFAULT_REMOTE_ZOOMS,
          priority_tile: priorityTileList[0] ?? undefined
        };
  const response = await fetch(resolveRemoteUrl(config, "/api/scoring/jobs"), {
    method: "POST",
    headers: remoteJsonHeaders(config),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    reportRemoteRequestFailure("remote_scoring_submit_failed", `RunPod scoring request failed (${response.status})`, {
      status: response.status,
      dataset_ids: datasetIds,
      prompt
    });
    throw new Error(`RunPod scoring request failed (${response.status})`);
  }
  const raw = (await response.json()) as ScoringJob;
  return {
    ...raw,
    layer_id: null
  };
}

async function submitRemoteReferenceScoringJob(
  config: RemoteBackendConfig,
  prompt: string,
  reference: PanoReference,
  priorityTiles?: CityPriorityTiles | null
): Promise<ScoringJob> {
  const datasetIds = remoteDatasetIds(config);
  const priorityTileList = priorityTilesForRequest(config, priorityTiles);
  const referencePano = normalizePanoReference(reference);
  const body =
    datasetIds.length > 1
      ? {
          dataset_group_id: config.datasetGroupId || DEFAULT_REMOTE_DATASET_GROUP_ID,
          dataset_ids: datasetIds,
          prompt,
          query_type: "pano_reference",
          reference_pano: referencePano,
          zooms: DEFAULT_REMOTE_ZOOMS,
          priority_tiles: priorityTileList.length ? priorityTileList : undefined
        }
      : {
          dataset_id: datasetIds[0] || config.datasetId || DEFAULT_REMOTE_DATASET_ID,
          prompt,
          query_type: "pano_reference",
          reference_pano: referencePano,
          zooms: DEFAULT_REMOTE_ZOOMS,
          priority_tile: priorityTileList[0] ?? undefined
        };
  const response = await fetch(resolveRemoteUrl(config, "/api/scoring/jobs"), {
    method: "POST",
    headers: remoteJsonHeaders(config),
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    reportRemoteRequestFailure("remote_reference_scoring_submit_failed", `RunPod reference scoring request failed (${response.status})`, {
      status: response.status,
      dataset_ids: datasetIds,
      reference_pano: referencePano
    });
    throw new Error(`RunPod reference scoring request failed (${response.status})`);
  }
  const raw = (await response.json()) as ScoringJob;
  return {
    ...raw,
    layer_id: null
  };
}

async function getRemoteScoringJob(config: RemoteBackendConfig, jobId: string): Promise<ScoringJob> {
  const response = await fetch(resolveRemoteUrl(config, `/api/scoring/jobs/${jobId}`), {
    headers: remoteAuthHeaders(config)
  });
  if (!response.ok) {
    reportRemoteRequestFailure("remote_job_poll_failed", `RunPod job polling failed (${response.status})`, {
      status: response.status,
      job_id: jobId
    });
    throw new Error(`RunPod job polling failed (${response.status})`);
  }
  return (await response.json()) as ScoringJob;
}

async function getRemoteManifest(config: RemoteBackendConfig, job: ScoringJob): Promise<RemoteResultManifest> {
  const manifestUrl = job.manifest_url || (job.prompt_id ? `/api/scoring/results/${job.prompt_id}/manifest` : "");
  if (!manifestUrl) throw new Error("RunPod job did not return a manifest URL");
  const response = await fetch(resolveRemoteUrl(config, manifestUrl), {
    headers: remoteAuthHeaders(config),
    cache: "no-store"
  });
  if (!response.ok) {
    reportRemoteRequestFailure("remote_manifest_failed", `RunPod manifest request failed (${response.status})`, {
      status: response.status,
      job_id: job.job_id,
      prompt_id: job.prompt_id,
      manifest_url: manifestUrl
    });
    throw new Error(`RunPod manifest request failed (${response.status})`);
  }
  return (await response.json()) as RemoteResultManifest;
}

async function getRemoteManifestByUrl(config: RemoteBackendConfig, manifestUrl: string): Promise<RemoteResultManifest> {
  const response = await fetch(resolveRemoteUrl(config, manifestUrl), {
    headers: remoteAuthHeaders(config),
    cache: "no-store"
  });
  if (!response.ok) {
    reportRemoteRequestFailure("remote_manifest_failed", `RunPod manifest request failed (${response.status})`, {
      status: response.status,
      manifest_url: manifestUrl
    });
    throw new Error(`RunPod manifest request failed (${response.status})`);
  }
  return (await response.json()) as RemoteResultManifest;
}

async function getRemoteResultManifests(config: RemoteBackendConfig, job: ScoringJob): Promise<RemoteResultManifest[]> {
  if (job.results?.length) {
    return Promise.all(job.results.map((result) => getRemoteManifestByUrl(config, result.manifest_url)));
  }
  return [await getRemoteManifest(config, job)];
}

function sourcePathsFromManifests(config: RemoteBackendConfig, manifests: RemoteResultManifest[]): Partial<Record<CityId, string>> {
  const paths: Partial<Record<CityId, string>> = {};
  for (const manifest of manifests) {
    const cityId = cityIdForDatasetId(manifest.dataset_id);
    if (!cityId) continue;
    paths[cityId] = resolveRemoteUrl(config, manifest.tile_url_template);
  }
  return paths;
}

export async function loadPanoImage(panoId: string, datasetId?: string | null): Promise<PanoImageResponse & { object_url?: string }> {
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) {
    const staticImageUrl = staticFallbackPanoImageUrl(panoId, datasetId);
    if (staticImageUrl) {
      return {
        pano_id: panoId,
        status: "ready",
        image_url: staticImageUrl,
        object_url: staticImageUrl,
        member_name: null,
        tar_id: null,
        message: "Loaded from packaged static fallback pano dataset."
      };
    }
    const message = "Static fallback includes semantic map tiles only for this pano. Add ?backend=<RunPod URL> for arbitrary street-view lookup.";
    reportRemoteRequestFailure("static_pano_unavailable", message, {
      pano_id: panoId,
      dataset_id: datasetId ?? null,
      backend_enabled: config.enabled,
      backend_base_url: config.baseUrl || null
    });
    throw new Error(message);
  }
  const metadataPath = datasetId
    ? `/api/datasets/${encodeURIComponent(datasetId)}/panos/${encodeURIComponent(panoId)}`
    : `/api/panos/${encodeURIComponent(panoId)}`;
  let metadata: PanoImageResponse | null = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const metadataResponse = await fetch(resolveRemoteUrl(config, metadataPath), {
      headers: remoteAuthHeaders(config)
    });
    if (!metadataResponse.ok) {
      reportRemoteRequestFailure("remote_pano_metadata_failed", `Pano request failed (${metadataResponse.status})`, {
        status: metadataResponse.status,
        pano_id: panoId,
        dataset_id: datasetId ?? null
      });
      throw new Error(`Pano request failed (${metadataResponse.status})`);
    }

    metadata = (await metadataResponse.json()) as PanoImageResponse;
    if (metadata.status !== "unavailable") break;
    await delay(2000);
  }

  if (!metadata || metadata.status !== "ready" || !metadata.image_url) {
    reportRemoteRequestFailure("remote_pano_unavailable", metadata?.message || "Pano image is unavailable", {
      pano_id: panoId,
      dataset_id: datasetId ?? null,
      status: metadata?.status ?? null
    });
    throw new Error(metadata?.message || "Pano image is unavailable");
  }

  const imageResponse = await fetch(resolveRemoteUrl(config, metadata.image_url), {
    headers: remoteAuthHeaders(config),
    cache: "force-cache"
  });
  if (!imageResponse.ok) {
    reportRemoteRequestFailure("remote_pano_download_failed", `Pano image download failed (${imageResponse.status})`, {
      status: imageResponse.status,
      pano_id: panoId,
      dataset_id: datasetId ?? null,
      image_url: metadata.image_url
    });
    throw new Error(`Pano image download failed (${imageResponse.status})`);
  }
  const blob = await imageResponse.blob();
  return {
    ...metadata,
    object_url: URL.createObjectURL(blob)
  };
}

async function pollRemoteScoringJob(config: RemoteBackendConfig, layerId: string, initialJob: ScoringJob, showOnMap = true) {
  if (ACTIVE_REMOTE_POLLS.has(layerId)) return;
  ACTIVE_REMOTE_POLLS.add(layerId);
  try {
    let job = initialJob;
    for (let attempt = 0; attempt < 720; attempt += 1) {
      emitRemoteJobLog(layerId, job, { mapOverlay: showOnMap });
      if (job.status === "ready") {
        const manifests = await getRemoteResultManifests(config, job);
        const sourcePaths = sourcePathsFromManifests(config, manifests);
        const primaryManifest = manifests[0];
        const primarySourcePath = sourcePaths.london || sourcePaths.shanghai || (primaryManifest ? resolveRemoteUrl(config, primaryManifest.tile_url_template) : "");
        if (!primarySourcePath) throw new Error("RunPod job did not return a tile URL");
        updateLayerSync(layerId, {
          status: "ready",
          source_path: primarySourcePath,
          source_paths: sourcePaths,
          score_property: primaryManifest?.zscore_property || "zscore",
          query_type: primaryManifest?.query_type || job.query_type || "text",
          reference_pano: primaryManifest?.reference_pano || job.reference_pano || null
        });
        emitRemoteJobLog(layerId, { ...job, message: "Manifest loaded. Layer is ready." }, { mapOverlay: showOnMap });
        return;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        updateLayerSync(layerId, { status: "failed" });
        emitRemoteJobLog(layerId, job, { mapOverlay: showOnMap });
        return;
      }

      await delay(1500);
      job = await getRemoteScoringJob(config, job.job_id);
    }
  } catch (error) {
    updateLayerSync(layerId, { status: "failed" });
    emitRemoteInfoLog(layerId, initialJob.prompt, error instanceof Error ? error.message : "RunPod polling failed.", "failed");
    return;
  } finally {
    ACTIVE_REMOTE_POLLS.delete(layerId);
  }
  updateLayerSync(layerId, { status: "failed" });
}

export async function resumeRemoteScoringJobs(): Promise<void> {
  const config = loadRemoteBackendConfigSync();
  if (!config.enabled || !config.baseUrl) return;

  const state = loadStateSync();
  for (const layer of state.layers) {
    if (layer.status === "ready" || layer.status === "failed") continue;
    if (isRemoteTileTemplate(layer.source_path)) continue;

    const existingJobId = parsePendingJobSource(layer.source_path);
    if (existingJobId) {
      try {
        const job = await getRemoteScoringJob(config, existingJobId);
        void pollRemoteScoringJob(config, layer.id, { ...job, layer_id: layer.id }, job.status !== "ready");
      } catch {
        updateLayerSync(layer.id, { status: "failed" });
      }
      continue;
    }

    if (isLegacyPendingSource(layer.source_path)) {
      try {
        const job =
          layer.query_type === "pano_reference" && layer.reference_pano
            ? await submitRemoteReferenceScoringJob(config, layer.prompt, layer.reference_pano)
            : await submitRemoteScoringJob(config, layer.prompt);
        const showOnMap = job.status !== "ready";
        const pending = pendingJobSource(job.job_id);
        const pendingSourcePaths = Object.fromEntries(
          (Object.keys(MAP_CITY_DATASETS) as CityId[]).map((cityId) => [cityId, pending])
        ) as Partial<Record<CityId, string>>;
        updateLayerSync(layer.id, {
          status: job.status === "ready" ? "ready" : "running",
          source_path: pending,
          source_paths: pendingSourcePaths
        });
        void pollRemoteScoringJob(config, layer.id, { ...job, layer_id: layer.id }, showOnMap);
      } catch {
        updateLayerSync(layer.id, { status: "failed" });
      }
    }
  }
}

function layerStatusFromRemoteJob(status: ScoringJob["status"]): ScoringJob["status"] {
  if (status === "ready" || status === "failed" || status === "cancelled") return status;
  if (status === "queued") return "queued";
  return "running";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function emptyFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: []
  } as FeatureCollection;
}

function openRemoteTileCacheDb(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (remoteTileCacheDbPromise) return remoteTileCacheDbPromise;

  remoteTileCacheDbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(REMOTE_TILE_CACHE_DB, REMOTE_TILE_CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(REMOTE_TILE_CACHE_STORE)) {
        store = db.createObjectStore(REMOTE_TILE_CACHE_STORE, { keyPath: "url" });
      } else {
        store = request.transaction!.objectStore(REMOTE_TILE_CACHE_STORE);
      }
      if (!store.indexNames.contains("cached_at")) {
        store.createIndex("cached_at", "cached_at", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return remoteTileCacheDbPromise;
}

async function readCachedRemoteTile(url: string): Promise<FeatureCollection | null> {
  const db = await openRemoteTileCacheDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const transaction = db.transaction(REMOTE_TILE_CACHE_STORE, "readonly");
    const request = transaction.objectStore(REMOTE_TILE_CACHE_STORE).get(url);

    request.onsuccess = () => {
      const cached = request.result as { geojson?: FeatureCollection } | undefined;
      resolve(cached?.geojson?.type === "FeatureCollection" ? cached.geojson : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeCachedRemoteTile(url: string, geojson: FeatureCollection): Promise<void> {
  const db = await openRemoteTileCacheDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const transaction = db.transaction(REMOTE_TILE_CACHE_STORE, "readwrite");
    const request = transaction.objectStore(REMOTE_TILE_CACHE_STORE).put({
      url,
      geojson,
      cached_at: utcNow()
    });

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    transaction.onerror = () => resolve();
  });
  void pruneRemoteTileCache(db);
}

async function pruneRemoteTileCache(db: IDBDatabase): Promise<void> {
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(REMOTE_TILE_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(REMOTE_TILE_CACHE_STORE);
    const countRequest = store.count();

    countRequest.onerror = () => resolve();
    countRequest.onsuccess = () => {
      const deleteCount = Math.max(0, Number(countRequest.result) - REMOTE_TILE_CACHE_MAX_ENTRIES);
      if (!deleteCount) {
        resolve();
        return;
      }
      const index = store.indexNames.contains("cached_at") ? store.index("cached_at") : null;
      const cursorRequest = index ? index.openCursor() : store.openCursor();
      let deleted = 0;
      cursorRequest.onerror = () => resolve();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || deleted >= deleteCount) {
          resolve();
          return;
        }
        cursor.delete();
        deleted += 1;
        cursor.continue();
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

export function isRemoteTileTemplate(sourcePath: string): boolean {
  return /^https?:\/\//i.test(sourcePath) && sourcePath.includes("{z}") && sourcePath.includes("{x}") && sourcePath.includes("{y}");
}

export function remoteTileUrl(sourcePath: string, z: number, x: number, y: number): string {
  return sourcePath.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

export async function getRemoteTileGeojson(sourcePath: string, z: number, x: number, y: number): Promise<FeatureCollection> {
  const config = loadRemoteBackendConfigSync();
  const url = remoteTileUrl(sourcePath, z, x, y);
  const cached = await readCachedRemoteTile(url);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: config.token?.trim() ? { Authorization: `Bearer ${config.token.trim()}` } : undefined,
      cache: "force-cache"
    });
  } catch (error) {
    reportRemoteRequestFailure("remote_tile_network_failed", error instanceof Error ? error.message : "Remote tile request failed.", {
      url
    });
    throw error;
  }
  if (response.status === 202 || response.status === 404) return emptyFeatureCollection();
  if (!response.ok) {
    reportRemoteRequestFailure("remote_tile_failed", `Remote tile request failed (${response.status})`, {
      status: response.status,
      url
    });
    throw new Error(`Remote tile request failed (${response.status})`);
  }
  const geojson = (await response.json()) as FeatureCollection;
  await writeCachedRemoteTile(url, geojson);
  return geojson;
}

export async function getDefaultRemoteLayerGeojson(sourcePath: string, cityId: MockCityId = "london"): Promise<FeatureCollection> {
  const city = mockCityConfig(cityId);
  const tileZoom = isStaticFallbackTileTemplate(sourcePath) ? 13 : 10;
  const center = lonLatToTile(city.center[1], city.center[0], tileZoom);
  const collections = await Promise.all([
    getRemoteTileGeojson(sourcePath, tileZoom, center.x - 1, center.y),
    getRemoteTileGeojson(sourcePath, tileZoom, center.x, center.y),
    getRemoteTileGeojson(sourcePath, tileZoom, center.x + 1, center.y)
  ]);
  return mergeFeatureCollections(collections);
}

export function mergeFeatureCollections(collections: FeatureCollection[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((collection) => collection.features)
  } as FeatureCollection;
}

function lonLatToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const wrappedLon = ((lon + 180) % 360) - 180;
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** z;
  return {
    x: clamp(Math.floor(((wrappedLon + 180) / 360) * n), 0, n - 1),
    y: clamp(Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n), 0, n - 1)
  };
}

/*
 * `createScoringJob` starts remote polling in the background and updates the
 * local layer when the manifest is ready. This keeps layer settings local while
 * the RunPod backend only serves scoring results and tiles.
 */
async function createLocalMockScoringJob(prompt: string): Promise<ScoringJob> {
  const layer = await createLayer({ prompt });
  const now = utcNow();
  return {
    job_id: `local_job_${hashString(`${prompt}-${now}`)}`,
    prompt,
    status: "ready",
    progress: 1,
    layer_id: layer.id,
    message: "Local mock scoring completed.",
    created_at: now,
    updated_at: now
  };
}

async function createLocalMockReferenceScoringJob(reference: PanoReference): Promise<ScoringJob> {
  const layer = await createReferenceLayer(reference);
  const now = utcNow();
  return {
    job_id: `local_reference_job_${hashString(`${reference.dataset_id}:${reference.pano_id}-${now}`)}`,
    prompt: layer.prompt,
    query_type: "pano_reference",
    reference_pano: layer.reference_pano ?? reference,
    status: "ready",
    progress: 1,
    layer_id: layer.id,
    message: "Local mock reference scoring completed.",
    created_at: now,
    updated_at: now
  };
}

export async function getLayerGeojson(layerId: string, cityId: MockCityId = "london"): Promise<FeatureCollection> {
  const state = loadStateSync();
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) throw new Error("Layer not found");
  const sourcePath = getLayerSourcePath(layer, cityId);
  if (isRemoteTileTemplate(sourcePath)) {
    return getDefaultRemoteLayerGeojson(sourcePath, cityId);
  }
  if (!sourcePath || isLegacyPendingSource(sourcePath) || parsePendingJobSource(sourcePath) || layer.status !== "ready") {
    return emptyFeatureCollection();
  }
  return makeMockGeojson(layer.prompt, layer.id, MOCK_POINT_COUNT, cityId);
}

export async function getLayerFallbackGeojson(layerId: string, cityId: MockCityId = "london"): Promise<FeatureCollection> {
  const state = loadStateSync();
  const layer = state.layers.find((item) => item.id === layerId);
  if (!layer) throw new Error("Layer not found");
  return makeMockGeojson(layer.prompt, layer.id, MOCK_POINT_COUNT, cityId);
}

function makeMockGeojson(prompt: string, layerId: string, count: number, cityId: MockCityId = "london"): FeatureCollection {
  const city = mockCityConfig(cityId);
  const geometrySeed = Number.parseInt(hashString(`${city.datasetId}:mock-pano-geometry`).slice(0, 8), 36) || 1;
  const scoreSeed = Number.parseInt(hashString(`${city.datasetId}:${prompt}:${layerId}:mock-score`).slice(0, 8), 36) || 1;
  const geometryRandom = seededRandom(geometrySeed);
  const scoreRandom = seededRandom(scoreSeed);
  const hotspots = Array.from({ length: 4 }, () => ({
    lon: randomBetween(scoreRandom, city.bounds.west, city.bounds.east),
    lat: randomBetween(scoreRandom, city.bounds.south, city.bounds.north),
    weight: randomBetween(scoreRandom, 0.42, 0.88),
    radius: randomBetween(scoreRandom, 0.022, 0.07)
  }));

  const points = Array.from({ length: count }, () => {
    const lon = randomBetween(geometryRandom, city.bounds.west, city.bounds.east);
    const lat = randomBetween(geometryRandom, city.bounds.south, city.bounds.north);
    let score = 0.06 + scoreRandom() * 0.18;

    for (const hotspot of hotspots) {
      const distance = Math.sqrt((lon - hotspot.lon) ** 2 + ((lat - hotspot.lat) * 1.6) ** 2);
      score += hotspot.weight * Math.exp(-((distance / hotspot.radius) ** 2));
    }

    return {
      lon,
      lat,
      score: clamp(score, 0, 1)
    };
  });

  const mean = points.reduce((sum, point) => sum + point.score, 0) / points.length;
  const variance = points.reduce((sum, point) => sum + (point.score - mean) ** 2, 0) / points.length;
  const std = Math.sqrt(variance) || 1;

  const geojson = {
    type: "FeatureCollection",
    features: points.map((point, index) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [round(point.lon, 7), round(point.lat, 7)]
      },
      properties: {
        id: `${layerId}_${String(index + 1).padStart(4, "0")}`,
        pano_id: String(city.panoIdStart + index),
        layer_id: layerId,
        prompt,
        score: round(point.score, 6),
        zscore: round((point.score - mean) / std, 6)
      }
    })),
    metadata: {
      layer_id: layerId,
      prompt,
      mock: true,
      local: true,
      city: cityId,
      dataset_id: city.datasetId,
      center: [...city.center]
    }
  };
  return geojson as FeatureCollection;
}

function mockCityConfig(cityId: MockCityId) {
  if (cityId === "shanghai") {
    return {
      datasetId: "shanghai_224_8_45_2B",
      bounds: SHANGHAI_BOUNDS,
      center: SHANGHAI_CENTER,
      panoIdStart: MOCK_SHANGHAI_PANO_ID_START
    };
  }
  return {
    datasetId: "london_224_8_45",
    bounds: LONDON_BOUNDS,
    center: LONDON_CENTER,
    panoIdStart: MOCK_PANO_ID_START
  };
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
