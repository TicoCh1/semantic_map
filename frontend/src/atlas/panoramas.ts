import type { FeatureCollection } from "../api/types";
import { atlasResource, type Cell, type City } from "./data";

type Bounds = [number, number, number, number];
const rowWords = 5;
const representative = 1 << 30;
type CityRows = { rows: Int32Array; overview: number[] };
const assets = new Map<City, Promise<CityRows>>();

export function clearPanoramaCache() { assets.clear(); }

function loadRows(city: City, count: number) {
  const cached = assets.get(city);
  if (cached) return cached;
  const request = (async () => {
    const response = await atlasResource("panoramas/" + city);
    if (!response.ok) throw new Error(`Panorama index unavailable for ${city} (${response.status})`);
    const rows = new Int32Array(await response.arrayBuffer());
    const overview = new Array<number>(count).fill(-1);
    if (rows.length % rowWords) throw new Error("Incomplete panorama index");
    for (let i = 0; i < rows.length; i += rowWords) {
      const encoded = rows[i + 4], cell = encoded & ~representative;
      if (cell < 0 || cell >= count) throw new Error("Panorama index and region centers disagree");
      if (encoded & representative) overview[cell] = i;
    }
    if (overview.includes(-1)) throw new Error("Missing panorama for a region center");
    return { rows, overview };
  })();
  assets.set(city, request);
  request.catch(() => { if (assets.get(city) === request) assets.delete(city); });
  return request;
}

// Keep one overview and one buffered viewport per score array. The histogram
// always uses windows, so a denser street has no extra weight in its distribution.
const cache = new WeakMap<Cell[], Map<string, { key: string; data: FeatureCollection }>>();

export async function panoramaFeatures(city: City, scores: Cell[], showSelf: boolean, bounds?: Bounds) {
  const { rows, overview } = await loadRows(city, scores.length);
  const bucket = bounds?.map((n, i) => (i < 2 ? Math.floor(n * 100) : Math.ceil(n * 100)) / 100);
  const slot = bounds ? "detail" : "overview";
  const key = [showSelf, ...(bucket ?? [])].join(",");
  const entries = cache.get(scores) ?? new Map();
  cache.set(scores, entries);
  const last = entries.get(slot);
  if (last?.key === key) return last.data;
  const data: FeatureCollection = { type: "FeatureCollection", features: [] };
  function append(i: number) {
    const cell = rows[i + 4] & ~representative;
    const score = scores[cell];
    if (!showSelf && score.self) return;
    const lon = rows[i + 1] / 1e7, lat = rows[i + 2] / 1e7;
    if (bucket && (lon < bucket[0] || lat < bucket[1] || lon > bucket[2] || lat > bucket[3])) return;
    data.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { pano_id: String(rows[i]), pano_lon: lon, pano_lat: lat, date: rows[i + 3], cell_index: cell,
        score: score.raw, zscore: score.z, sim_pct: score.pct, is_self_zone: score.self } });
  }
  if (bounds) for (let i = 0; i < rows.length; i += rowWords) append(i);
  else overview.forEach(append);
  entries.set(slot, { key, data });
  return data;
}
