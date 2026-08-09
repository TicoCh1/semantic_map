import type { CityConfig, CityId, RemoteBackendConfig } from "../api/types";

export const DEFAULT_CITY_CONFIGS: CityConfig[] = [
  {
    id: "london",
    name: "London",
    datasetId: "london_224_8_45",
    center: [-0.1276, 51.5072],
    initialZoom: 10.45,
    bounds: { west: -1.05, east: 0.7, south: 50.85, north: 52.05 },
    liveDemo: true
  },
  {
    id: "shanghai",
    name: "Shanghai",
    datasetId: "shanghai_224_8_45_2B",
    center: [121.4737, 31.2304],
    initialZoom: 10.45,
    bounds: { west: 120.85, east: 122.25, south: 30.65, north: 31.85 },
    liveDemo: true
  },
  {
    id: "new_york",
    name: "New York",
    datasetId: "new_york_224_8_45",
    center: [-74.006, 40.7128],
    initialZoom: 10.45,
    bounds: { west: -74.45, east: -73.45, south: 40.45, north: 41.05 },
    liveDemo: true
  },
  {
    id: "rome",
    name: "Rome",
    datasetId: "rome_224_8_45",
    center: [12.4964, 41.9028],
    initialZoom: 10.45,
    bounds: { west: 12.2, east: 12.8, south: 41.7, north: 42.1 },
    liveDemo: false
  }
];

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normaliseCity(raw: unknown): CityConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = String(value.id ?? "").trim();
  const name = String(value.name ?? id).trim();
  const datasetId = String(value.datasetId ?? value.dataset_id ?? "").trim();
  const center = value.center;
  const bounds = value.bounds;
  if (!id || !name || !datasetId || !Array.isArray(center) || center.length !== 2 || !bounds || typeof bounds !== "object") return null;
  const lon = finiteNumber(center[0]);
  const lat = finiteNumber(center[1]);
  const rawBounds = bounds as Record<string, unknown>;
  const west = finiteNumber(rawBounds.west);
  const east = finiteNumber(rawBounds.east);
  const south = finiteNumber(rawBounds.south);
  const north = finiteNumber(rawBounds.north);
  const initialZoom = finiteNumber(value.initialZoom ?? value.initial_zoom) ?? 10.45;
  if ([lon, lat, west, east, south, north].some((item) => item === null)) return null;
  return {
    id,
    name,
    datasetId,
    center: [lon!, lat!],
    initialZoom,
    bounds: { west: west!, east: east!, south: south!, north: north! },
    liveDemo: Boolean(value.liveDemo ?? value.live_demo)
  };
}

export function normaliseCityConfigs(raw: unknown): CityConfig[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const city = normaliseCity(item);
    if (!city || seen.has(city.id)) return [];
    seen.add(city.id);
    return [city];
  });
}

export function cityConfigForDataset(datasetId: string | null | undefined, cities: readonly CityConfig[] = DEFAULT_CITY_CONFIGS): CityConfig | null {
  return cities.find((city) => city.datasetId === datasetId) ?? DEFAULT_CITY_CONFIGS.find((city) => city.datasetId === datasetId) ?? null;
}

export function cityConfigForId(cityId: CityId | null | undefined, cities: readonly CityConfig[] = DEFAULT_CITY_CONFIGS): CityConfig | null {
  return cities.find((city) => city.id === cityId) ?? DEFAULT_CITY_CONFIGS.find((city) => city.id === cityId) ?? null;
}

export function cityConfigsForRemoteBackend(config: Pick<RemoteBackendConfig, "datasetId" | "datasetIds" | "cities"> | null | undefined): CityConfig[] {
  if (config?.cities?.length) return config.cities;
  const datasetIds = new Set(config?.datasetIds?.length ? config.datasetIds : config?.datasetId ? [config.datasetId] : []);
  return datasetIds.size ? DEFAULT_CITY_CONFIGS.filter((city) => datasetIds.has(city.datasetId)) : DEFAULT_CITY_CONFIGS.slice(0, 2);
}
