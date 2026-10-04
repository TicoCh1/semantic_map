import maplibregl from "maplibre-gl";
import { SharedBasemapTiles } from "./sharedBasemapTiles";

const PROTOCOL = "semantic-basemap";
let installed = false;

export function installBasemapTransport() {
  if (installed) return;
  const tiles = new SharedBasemapTiles();
  maplibregl.addProtocol(PROTOCOL, (params, controller) => tiles.read(
    decodeURIComponent(params.url.slice(PROTOCOL.length + 3)), controller.signal,
    { headers: params.headers, credentials: params.credentials, cache: params.cache }
  ));
  installed = true;
}

export function sceneTileRequest(url: string, resourceType?: string) {
  return { url: resourceType === "Tile" && /^https?:\/\//.test(url) ? `${PROTOCOL}://${encodeURIComponent(url)}` : url };
}
