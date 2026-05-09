import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

export type BasemapId = "osm" | "openfreemap_dark" | "sentinel2_cloudless";

type RasterBasemap = {
  id: BasemapId;
  name: string;
  type: "raster";
  tiles: string[];
  attribution: string;
  maxzoom?: number;
};

type StyleBasemap = {
  id: BasemapId;
  name: string;
  type: "style";
  styleUrl: string;
};

export type BasemapConfig = RasterBasemap | StyleBasemap;

export const BASEMAPS: BasemapConfig[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    type: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "OpenStreetMap contributors",
    maxzoom: 19
  },
  {
    id: "openfreemap_dark",
    name: "OpenFreeMap Dark",
    type: "style",
    styleUrl: "https://tiles.openfreemap.org/styles/dark"
  },
  {
    id: "sentinel2_cloudless",
    name: "Sentinel-2 Cloudless 2016",
    type: "raster",
    tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
    attribution: "Sentinel-2 cloudless by EOX IT Services GmbH, contains modified Copernicus Sentinel data 2016 & 2017",
    maxzoom: 14
  }
];

export function normalizeBasemapId(id: string | null | undefined): BasemapId {
  return BASEMAPS.some((basemap) => basemap.id === id) ? (id as BasemapId) : "osm";
}

export function basemapById(id: string | null | undefined): BasemapConfig {
  id = normalizeBasemapId(id);
  return BASEMAPS.find((basemap) => basemap.id === id) ?? BASEMAPS[0];
}

export function basemapStyle(basemap: BasemapConfig): string | StyleSpecification {
  if (basemap.type === "style") return basemap.styleUrl;

  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: basemap.tiles,
        tileSize: 256,
        attribution: basemap.attribution,
        maxzoom: basemap.maxzoom
      }
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }]
  };
}
