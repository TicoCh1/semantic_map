export type RuntimeMode = "demo" | "full";

export type SemanticMapRuntimeConfig = {
  mode: RuntimeMode;
  runpodUrl: string;
  runpodToken: string;
  lockRunpodUrl: boolean;
  idleResetEnabled: boolean;
  idleMs: number;
  defaultDatasetId: string;
  defaultDatasetIds: string[];
  defaultDatasetGroupId: string;
  defaultRemoteBackendUrl: string;
  remoteBackendEnabled: boolean;
  demoWatchdogUrl: string;
};

declare global {
  interface Window {
    __SEMANTIC_MAP_RUNTIME_CONFIG__?: Partial<SemanticMapRuntimeConfig>;
  }
}

function envString(name: string): string {
  return String(import.meta.env[name] ?? "").trim();
}

function envBoolean(name: string): boolean {
  const value = envString(name).toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

function asPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const items = rawItems.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? Array.from(new Set(items)) : fallback;
}

function normalizeRunpodProxyUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
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

const rawRuntimeConfig = typeof window !== "undefined" ? window.__SEMANTIC_MAP_RUNTIME_CONFIG__ ?? {} : {};
const envRunpodUrl = envString("VITE_EXHIBIT_RUNPOD_URL");
const defaultDatasetId = asString(rawRuntimeConfig.defaultDatasetId, "london_224_8_45");
const configuredRunpodUrl = normalizeRunpodProxyUrl(asString(rawRuntimeConfig.runpodUrl, envRunpodUrl));

export const runtimeConfig: SemanticMapRuntimeConfig = {
  mode: rawRuntimeConfig.mode === "demo" ? "demo" : "full",
  runpodUrl: configuredRunpodUrl,
  runpodToken: asString(rawRuntimeConfig.runpodToken, envString("VITE_EXHIBIT_RUNPOD_TOKEN")),
  lockRunpodUrl: asBoolean(rawRuntimeConfig.lockRunpodUrl, envBoolean("VITE_EXHIBIT_LOCK_RUNPOD_URL")),
  idleResetEnabled: asBoolean(rawRuntimeConfig.idleResetEnabled, envBoolean("VITE_EXHIBIT_IDLE_RESET")),
  idleMs: asPositiveInteger(rawRuntimeConfig.idleMs, asPositiveInteger(envString("VITE_EXHIBIT_IDLE_MS"), 180000)),
  defaultDatasetId,
  defaultDatasetIds: asStringList(
    rawRuntimeConfig.defaultDatasetIds ?? envString("VITE_DEFAULT_DATASET_IDS"),
    [defaultDatasetId, "shanghai_224_8_45_2B"]
  ),
  defaultDatasetGroupId: asString(rawRuntimeConfig.defaultDatasetGroupId, envString("VITE_DEFAULT_DATASET_GROUP_ID") || "london_shanghai"),
  defaultRemoteBackendUrl: normalizeRunpodProxyUrl(asString(rawRuntimeConfig.defaultRemoteBackendUrl, configuredRunpodUrl)),
  remoteBackendEnabled: asBoolean(rawRuntimeConfig.remoteBackendEnabled, true),
  demoWatchdogUrl: asString(rawRuntimeConfig.demoWatchdogUrl, envString("VITE_DEMO_WATCHDOG_URL"))
};
