import { apiFetch, getRemoteBackendConfig } from "../api/client";
export const cities = ["london", "rome", "new_york", "shanghai"] as const;
export type City = typeof cities[number];
export const names: Record<City, string> = { london: "London", rome: "Rome", new_york: "New York", shanghai: "Shanghai" };
export type Coord = [number, number];
export type Hit = {rank: number; coordinates: Coord; district: string; nearest_landmark: string; dist_m: number; dist_from_source_m: number | null; sim_z: number; sim_raw: number; sim_pct: number; top_shared_themes: string[]};
export type Query = {id: string; name: string; city: City; category: string; coordinates: Coord; area: Coord[][]; radius_m: number; smart_range: {sim_z: Bounds; sim_raw: Bounds}; nodes: number; themes: string[]; reference: number; mean: number; sd: number; targets: Record<City, {hits: Hit[]; hot: number; eligible: number}>};
type Bounds = { lower: number; upper: number };
export type Index = {version: string; cities: Record<City, number>; queries: Query[]};
export type Geography = {points: Coord[]};
export type Atlas = {index: Index; geography: Record<City, Geography>};
export type Cell = {z: number; raw: number; pct: number; self: boolean};
const params = new URLSearchParams(location.search);
const pod = params.get("gpu");
const gpuOrigin = pod && /^[a-z0-9]{14}$/.test(pod) ? `https://${pod}-18771.proxy.runpod.net` : null;
export const boundaryPreview = import.meta.env.DEV && params.get("preview") === "boundary";
export const boundaryLive = !boundaryPreview && (Boolean(gpuOrigin) || (import.meta.env.DEV && !params.has("backend")));

function publicAtlasResource(path: string, init?: RequestInit) {
  const route = path.split("?")[0];
  if (["ready","analyze","search"].includes(route) || /^query\/live_[a-f0-9]{32}$/.test(route)) {
    return fetch(gpuOrigin + "/" + route, {...init, credentials:"omit", cache:"no-store"});
  }
  // Fixed searches and panorama coordinates remain available when the GPU stops.
  const fixed = route === "index" ? "query/geocheck_v3_index" : route.replace(/^query\//,"query/geocheck_v3_");
  return apiFetch("/api/region-atlas/" + fixed, init);
}
export async function atlasResource(path: string, init?: RequestInit) {
  let response: Response;
  if (gpuOrigin && !boundaryPreview) response = await publicAtlasResource(path, init);
  else if (boundaryPreview || boundaryLive) response = await fetch((boundaryLive ? "/__area-live/" : "/__area-preview/") + path, init);
  else response = await apiFetch("/api/region-atlas/" + path, init);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : `Could not load region atlas (HTTP ${response.status})`);
  }
  return response;
}
let cachedGeography: { key: string; geography: Atlas["geography"] } | undefined;

export async function loadGeography(index: Index, signal: AbortSignal): Promise<Atlas["geography"]> {
  const config = await getRemoteBackendConfig();
  const key = JSON.stringify([config.baseUrl, config.token, config.enabled, index.version, index.cities]);
  if (cachedGeography?.key === key) return cachedGeography.geography;
  const geography = {} as Atlas["geography"];
  await Promise.all(cities.map(async city => {
    const bytes = new DataView(await (await atlasResource("city/" + city, {signal})).arrayBuffer());
    if (bytes.byteLength !== index.cities[city] * 8) throw new Error("Incomplete city coordinates: " + names[city]);
    const points: Coord[] = Array.from({length: index.cities[city]}, (_, i) => [bytes.getInt32(i * 8,true)/1e5, bytes.getInt32(i * 8+4,true)/1e5]);
    geography[city] = {points};
  }));
  if (!signal.aborted) cachedGeography = { key, geography };
  return geography;
}
export async function loadQuery(id: string, index: Index, signal: AbortSignal) {
  const query = index.queries.find(q => q.id === id);
  if (!query) throw new Error("Unknown reference region");
  const version = boundaryLive ? "?version=" + encodeURIComponent(index.version) : "";
  const buffer = await (await atlasResource("query/" + encodeURIComponent(id) + version, {signal})).arrayBuffer();
  if (buffer.byteLength !== cities.reduce((n, c) => n + index.cities[c] * 6, 0)) throw new Error("Incomplete score data for " + id);
  const scores = {} as Record<City, Cell[]>;
  const view = new DataView(buffer);
  let offset = 0;
  for (const city of cities) {
    const count = index.cities[city], flags = offset + count * 4;
    scores[city] = Array.from({length: count}, (_, i) => {
      const raw = view.getFloat32(offset + 4*i, true), bits = view.getUint16(flags + 2*i, true);
      return {z: (raw-query.mean)/query.sd, raw, pct:(bits & 32767)/100, self: Boolean(bits & 32768)};
    });
    offset += count * 6;
  }
  return scores;
}
export const ramp = ["#d7dcda","#e4e6e1","#eee6d7","#f4bb82","#e97740","#bd3c2e","#781f33"];
export const stops = [0,.30,.47,.63,.78,.89,1];
