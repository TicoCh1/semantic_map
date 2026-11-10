import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { atlasDatasets, scaleOpacities } from "./atlas-adapter.js";

const USE_NEIGHBOR_ATLAS = new URLSearchParams(window.location.search).get("atlas") === "1";
document.querySelector("#potato-gis-link").hidden = !USE_NEIGHBOR_ATLAS;
const ATLAS_CENTER_VIEW = new URLSearchParams(window.location.search).get("view") === "center";
const ATLAS_EDGE_ROOT = new URLSearchParams(window.location.search).get("root") === "edge";

const CENTER = {
  lon: -0.11559,
  lat: 51.51024
};

const MIN_LONG_AXIS_METERS = 2000 * 1.8;
const MAX_LONG_AXIS_METERS = 32000 * 1.8;
const MIN_SCALE_ZOOM = 15;
const MAX_SCALE_ZOOM = 10;
const EARTH_RADIUS_METERS = 6371008.8;
const CROSSFADE_HOLD_FRACTION = 0.2;
const CROSSFADE_ACTIVE_FRACTION = 1 - CROSSFADE_HOLD_FRACTION;
const BASE_POINT_RADIUS = 3;
const POINT_RECORD_BYTES = 12;
const OPENFREEMAP_DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const BASEMAP_FALLBACK_DELAY_MS = 6000;
const WEB_MERCATOR_HALF_WORLD_METERS = 20037508.342789244;
const PATCH_GRID_LINE_COLOR = new Float32Array([1, 1, 1, 1]);
const DEFAULT_GRID_TRANSPARENCY = 0.66;
const DEFAULT_GRID_LINE_WIDTH = 1.5;
const GRID_VERTEX_FLOATS = 6;
const SMART_CENTER_DATASET_ID = "webmercator-center";
const SMART_GRID_DATASET_ID = "webmercator-grid";

const COLOR_MATRIX_IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const COLOR_MATRIX_SWAP_GB = new Float32Array([1, 0, 0, 0, 0, 1, 0, 1, 0]);
const COLOR_MATRIX_SWAP_RG = new Float32Array([0, 1, 0, 1, 0, 0, 0, 0, 1]);
const COLOR_MATRIX_SWAP_RG_THEN_GB = new Float32Array([0, 0, 1, 1, 0, 0, 0, 1, 0]);
const COLOR_MATRIX_SWAP_RG_THEN_RB = new Float32Array([0, 1, 0, 0, 0, 1, 1, 0, 0]);
const FULL_MERCATOR_BOUNDS = new Float32Array([0, 0, 1, 1]);
const COLOR_MATRICES = {
  identity: COLOR_MATRIX_IDENTITY,
  swap_gb: COLOR_MATRIX_SWAP_GB,
  swap_rg: COLOR_MATRIX_SWAP_RG,
  swap_rg_then_gb: COLOR_MATRIX_SWAP_RG_THEN_GB,
  swap_rg_then_rb: COLOR_MATRIX_SWAP_RG_THEN_RB
};

const MULTISCALE_LAYERS = [
  {
    id: "webmercator-center:wm02km_center",
    label: "2 km grid",
    radiusMeters: 2000,
    boundaryMeters: 2000 * 1.8,
    url: "./data/webmercator_grid_rgb48/2km/2km_0_0/points.bin",
    manifestUrl: "./data/webmercator_grid_rgb48/2km/2km_0_0/points.json",
    colorMatrix: COLOR_MATRIX_SWAP_RG_THEN_RB,
    scaleIndex: 0,
    datasetId: SMART_CENTER_DATASET_ID
  },
  {
    id: "webmercator-center:wm04km_center",
    label: "4 km grid",
    radiusMeters: 4000,
    boundaryMeters: 4000 * 1.8,
    url: "./data/webmercator_grid_rgb48/4km/4km_0_0/points.bin",
    manifestUrl: "./data/webmercator_grid_rgb48/4km/4km_0_0/points.json",
    colorMatrix: COLOR_MATRIX_SWAP_RG_THEN_RB,
    scaleIndex: 1,
    datasetId: SMART_CENTER_DATASET_ID
  },
  {
    id: "webmercator-center:wm08km_center",
    label: "8 km grid",
    radiusMeters: 8000,
    boundaryMeters: 8000 * 1.8,
    url: "./data/webmercator_grid_rgb48/8km/8km_0_0/points.bin",
    manifestUrl: "./data/webmercator_grid_rgb48/8km/8km_0_0/points.json",
    colorMatrix: COLOR_MATRIX_SWAP_RG_THEN_RB,
    scaleIndex: 2,
    datasetId: SMART_CENTER_DATASET_ID
  },
  {
    id: "webmercator-center:wm16km_center",
    label: "16 km grid",
    radiusMeters: 16000,
    boundaryMeters: 16000 * 1.8,
    url: "./data/webmercator_grid_rgb48/16km/16km_0_0/points.bin",
    manifestUrl: "./data/webmercator_grid_rgb48/16km/16km_0_0/points.json",
    colorMatrix: COLOR_MATRIX_SWAP_RG,
    scaleIndex: 3,
    datasetId: SMART_CENTER_DATASET_ID
  },
  {
    id: "webmercator-center:wm32km_all_london",
    label: "32 km all London",
    radiusMeters: 32000,
    boundaryMeters: 32000 * 1.8,
    url: "./data/webmercator_grid_rgb48/32km_all_london/points.bin",
    manifestUrl: "./data/webmercator_grid_rgb48/32km_all_london/points.json",
    colorMatrix: COLOR_MATRIX_SWAP_RG,
    scaleIndex: 4,
    datasetId: SMART_CENTER_DATASET_ID
  }
];

const DATASET_CONFIGS = {
  [SMART_CENTER_DATASET_ID]: {
    id: SMART_CENTER_DATASET_ID,
    label: "WebMercator center patches",
    mode: "center-patches",
    layers: MULTISCALE_LAYERS
  },
  [SMART_GRID_DATASET_ID]: {
    id: SMART_GRID_DATASET_ID,
    label: "WebMercator grouped patches",
    mode: "manifest-layers",
    manifestUrl: "./data/webmercator_grid_rgb48_grouped/manifest.json",
    gridManifestUrl: "./data/webmercator_grid_rgb48/manifest.json",
    layers: []
  }
};

let activeDatasetId = SMART_CENTER_DATASET_ID;
let activeDataset = DATASET_CONFIGS[activeDatasetId];
let activeLayers = activeDataset.layers;

const slider = document.querySelector("#scale-slider");
const axisSlider = document.querySelector("#axis-slider");
const datasetSelect = document.querySelector("#dataset-select");
const atlasScaleSelect = document.querySelector("#atlas-scale-select");
let atlasSelectedScaleKm = null;
const colorModeSelect = document.querySelector("#color-mode");
const colorStatus = document.querySelector("#color-status");
const atlasGridToggle = document.querySelector("#atlas-grid-toggle");
let atlasGridVisible = false;
let atlasCameraCenter = null;
let atlasDetailCenter = null;
let atlasOverviewZoom = MAX_SCALE_ZOOM;
const scaleOutput = document.querySelector("#scale-output");
const axisOutput = document.querySelector("#axis-output");
const scaleAxisLabel = document.querySelector("#scale-axis-label");
const zoomLabel = document.querySelector("#zoom-label");
const layerReadout = document.querySelector("#layer-readout");
const dataStatus = document.querySelector("#data-status");
const gridControls = document.querySelector("#grid-controls");
const gridTransparencySlider = document.querySelector("#grid-transparency-slider");
const gridTransparencyOutput = document.querySelector("#grid-transparency-output");
const gridWidthSlider = document.querySelector("#grid-width-slider");
const gridWidthOutput = document.querySelector("#grid-width-output");
const mapContainer = document.querySelector("#map");
const loadingOverlay = document.querySelector("#loading-overlay");
const loadingBar = document.querySelector("#loading-bar");
const loadingLabel = document.querySelector("#loading-label");
const loadingPercent = document.querySelector("#loading-percent");

const layerStates = new Map();
const originalPointBuffers = new Map();
const alignedPointBuffers = new Map();
let colorAlignmentManifest = null;
let colorMode = "original";
let atlasColorManifestUrl = null;
let atlasColorCaption = "";

const pointCloudLayer = createPointCloudLayer();

const map = new maplibregl.Map({
  container: mapContainer,
  style: OPENFREEMAP_DARK_STYLE_URL,
  center: [CENTER.lon, CENTER.lat],
  zoom: zoomForScaleControlValue(MIN_LONG_AXIS_METERS),
  bearing: 0,
  pitch: 0,
  minZoom: 2,
  maxZoom: 18,
  interactive: false,
  attributionControl: true
});

let usingFallbackBasemap = false;
let preloadStarted = false;
let allLayersReady = false;
let totalBytes = 1;
let currentScaleAxisMeters = MIN_LONG_AXIS_METERS;
let currentCoverageAxisMeters = MIN_LONG_AXIS_METERS;
let lockedLayerId = null;
let lockedScaleIndex = null;
let gridTransparency = DEFAULT_GRID_TRANSPARENCY;
let gridLineWidth = DEFAULT_GRID_LINE_WIDTH;

slider.disabled = true;
axisSlider.disabled = true;
datasetSelect.disabled = true;
gridTransparencySlider.disabled = true;
gridWidthSlider.disabled = true;

const basemapFallbackTimer = window.setTimeout(() => {
  if (preloadStarted || usingFallbackBasemap) return;
  usingFallbackBasemap = true;
  map.setStyle(darkRasterFallbackStyle());
}, BASEMAP_FALLBACK_DELAY_MS);

map.on("style.load", () => {
  window.clearTimeout(basemapFallbackTimer);
  ensureBlackBackground();
  addPointCloudLayer();
  applyScale(Number(slider.value));
  if (!preloadStarted) {
    preloadStarted = true;
    void preloadPointClouds();
  }
});

map.on("error", (event) => {
  console.warn(event.error?.message ?? "Map error");
});

map.on("resize", () => {
  applyScale(Number(slider.value));
});

window.addEventListener("resize", () => {
  map.resize();
  applyScale(Number(slider.value));
});

slider.addEventListener("input", () => {
  if (!allLayersReady) return;
  applyScale(Number(slider.value));
});

axisSlider.addEventListener("input", () => {
  if (!allLayersReady) return;
  applyScale(Number(slider.value));
});

datasetSelect.addEventListener("change", () => {
  if (!allLayersReady) return;
  setActiveDataset(datasetSelect.value);
});

atlasGridToggle.addEventListener("change", () => {
  atlasGridVisible = atlasGridToggle.checked;
  updateGridControls();
  applyScale(Number(slider.value));
});

atlasScaleSelect.addEventListener("change", () => {
  atlasSelectedScaleKm = Number(atlasScaleSelect.value) || null;
  syncAtlasScaleLock();
  applyScale(Number(slider.value));
});

colorModeSelect.addEventListener("change", () => {
  void setColorMode(colorModeSelect.value);
});

async function setColorMode(requestedMode) {
  if (!allLayersReady || !colorAlignmentManifest) return;
  colorModeSelect.disabled = true;
  colorStatus.textContent = requestedMode === "original" ? "Restoring original colors" : "Loading aligned colors";
  try {
    const allLayers = Object.values(DATASET_CONFIGS).flatMap((dataset) => dataset.layers);
    // Prepare every layer before changing the visible mode; failures leave the
    // original display intact rather than producing a partially aligned map.
    const buffers = await Promise.all(allLayers.map(async (layer) => {
      const original = originalPointBuffers.get(layer.id);
      if (requestedMode === "original") return original;
      const cacheKey = `${requestedMode}:${layer.id}`;
      if (alignedPointBuffers.has(cacheKey)) return alignedPointBuffers.get(cacheKey);
      const kind = layer.datasetId === SMART_CENTER_DATASET_ID ? "center" : "grid";
      const key = `${kind}-${Math.round(layer.radiusMeters / 1000)}km`;
      const url = colorAlignmentManifest.layers?.[key]?.[requestedMode];
      if (!url) throw new Error(`Missing ${requestedMode} colors for ${layer.label}`);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load aligned colors: ${response.status}`);
      const rgb = new Uint8Array(await response.arrayBuffer());
      if (rgb.length !== layer.count * 3 || original.byteLength !== layer.count * POINT_RECORD_BYTES) {
        throw new Error(`Aligned color count differs for ${layer.label}`);
      }
      const bytes = new Uint8Array(original.slice(0));
      for (let i = 0; i < layer.count; i += 1) {
        const offset = i * POINT_RECORD_BYTES + 8;
        bytes[offset] = rgb[i * 3];
        bytes[offset + 1] = rgb[i * 3 + 1];
        bytes[offset + 2] = rgb[i * 3 + 2];
      }
      alignedPointBuffers.set(cacheKey, bytes.buffer);
      return bytes.buffer;
    }));
    for (let index = 0; index < allLayers.length; index += 1) {
      pointCloudLayer.setDataset(allLayers[index].id, buffers[index], allLayers[index].count);
    }
    colorMode = requestedMode;
    colorModeSelect.value = colorMode;
    const enhancementLabels = { contrast: "Patch contrast max", saturation: "Patch saturation max", boost: "Patch contrast + saturation max" };
    colorStatus.textContent = USE_NEIGHBOR_ATLAS
      ? `${atlasColorCaption} · ${enhancementLabels[colorMode] ?? "Original colors"}`
      : colorMode === "original" ? "Original saved palette" : "32 km palette reference · experimental color alignment";
    map.triggerRepaint();
  } catch (error) {
    console.error(error);
    colorModeSelect.value = colorMode;
    colorStatus.textContent = error instanceof Error ? error.message : "Color alignment failed";
  } finally {
    colorModeSelect.disabled = false;
  }
}

gridTransparencySlider.addEventListener("input", () => {
  gridTransparency = clamp(Number(gridTransparencySlider.value), 0, 1);
  updateGridControlReadout();
  pointCloudLayer.setGridStyle(gridTransparency, gridLineWidth);
});

gridWidthSlider.addEventListener("input", () => {
  gridLineWidth = clamp(Number(gridWidthSlider.value), 1, 6);
  updateGridControlReadout();
  pointCloudLayer.setGridStyle(gridTransparency, gridLineWidth);
});

function darkRasterFallbackStyle() {
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "OpenStreetMap contributors",
        maxzoom: 19
      }
    },
    layers: [
      {
        id: "fallback-background",
        type: "background",
        paint: {
          "background-color": "#000000"
        }
      },
      {
        id: "fallback-basemap",
        type: "raster",
        source: "basemap",
        paint: {
          "raster-opacity": 0.56,
          "raster-saturation": -1,
          "raster-contrast": 0.24,
          "raster-brightness-max": 0.34
        }
      }
    ]
  };
}

function ensureBlackBackground() {
  if (map.getLayer("pcatsne-black-background")) return;
  const beforeId = map.getStyle().layers?.[0]?.id;
  map.addLayer(
    {
      id: "pcatsne-black-background",
      type: "background",
      paint: {
        "background-color": "#000000"
      }
    },
    beforeId
  );
}

function addPointCloudLayer() {
  if (map.getLayer(pointCloudLayer.id)) return;
  map.addLayer(pointCloudLayer);
}

async function preloadPointClouds() {
  updateLoadingProgress("Reading point cloud manifests", 0);

  try {
    await prepareDatasetConfigs();
    const allLayers = Object.values(DATASET_CONFIGS).flatMap((dataset) => dataset.layers);
    totalBytes = allLayers.reduce((sum, layer) => sum + layer.byteLength, 0);

    let loadedBeforeCurrent = 0;
    for (const layer of allLayers) {
      const state = layerStates.get(layer.id);
      state.status = "loading";
      state.bytesLoaded = 0;
      updateDataStatus();

      const arrayBuffer = await fetchArrayBufferWithProgress(layer, (bytesLoaded) => {
        state.bytesLoaded = bytesLoaded;
        updateLoadingProgress(`Loading ${layer.label}`, loadedBeforeCurrent + bytesLoaded);
      });

      pointCloudLayer.setDataset(layer.id, arrayBuffer, layer.count);
      originalPointBuffers.set(layer.id, arrayBuffer);
      state.status = "loaded";
      state.bytesLoaded = layer.byteLength;
      loadedBeforeCurrent += layer.byteLength;
      updateLoadingProgress(`${layer.label} ready`, loadedBeforeCurrent);
      updateDataStatus();
    }

    allLayersReady = true;
    try {
      const response = await fetch(USE_NEIGHBOR_ATLAS ? atlasColorManifestUrl : "./data/affine_color_alignment/manifest.json", { cache: "no-store" });
      if (response?.ok) {
        colorAlignmentManifest = await response.json();
        if (USE_NEIGHBOR_ATLAS) {
          colorModeSelect.replaceChildren(...[
            ["original", "Original"], ["contrast", "Patch contrast max"],
            ["saturation", "Patch saturation max"], ["boost", "Patch contrast + saturation max"]
          ].map(([value, label]) => new Option(label, value)));
        }
        colorModeSelect.closest("label").hidden = false;
        colorModeSelect.disabled = false;
        colorStatus.hidden = false;
        colorStatus.textContent = USE_NEIGHBOR_ATLAS ? atlasColorCaption : "Original saved palette";
      }
    } catch (error) {
      console.warn("Optional color alignment is unavailable", error);
    }
    slider.disabled = false;
    axisSlider.disabled = false;
    updateGridControls();
    loadingOverlay.classList.add("is-hidden");
    updateLoadingProgress("Ready", totalBytes);
    if (USE_NEIGHBOR_ATLAS) {
      datasetSelect.disabled = false;
      setActiveDataset(ATLAS_CENTER_VIEW ? SMART_CENTER_DATASET_ID : SMART_GRID_DATASET_ID);
    } else {
      setSmartUnlockedDataset();
    }
    applyScale(Number(slider.value));
    updateDataStatus();
    if (USE_NEIGHBOR_ATLAS && colorAlignmentManifest) {
      const requestedColors = new URLSearchParams(window.location.search).get("colors");
      if (["contrast", "saturation", "boost"].includes(requestedColors)) await setColorMode(requestedColors);
    }
  } catch (error) {
    console.error(error);
    dataStatus.textContent = error instanceof Error ? error.message : "Point cloud preload failed";
    dataStatus.classList.add("has-warning");
    loadingOverlay.classList.add("has-error");
    loadingLabel.textContent = dataStatus.textContent;
  }
}

async function prepareDatasetConfigs() {
  if (USE_NEIGHBOR_ATLAS) {
    const atlasDirectory = ATLAS_EDGE_ROOT ? "london_4096_pca64_pacmap_edge" : "london_4096_pca64_pacmap_whole16";
    const url = new URL(`./data/${atlasDirectory}/manifest.json`, window.location.href);
    atlasColorManifestUrl = new URL("./color_boost/manifest.json", url.href).href;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("London PCA64/PaCMAP atlas has not been exported to this viewer yet");
    const manifest = await response.json();
    const atlas = atlasDatasets(manifest, url.href);
    document.title = `UrbanFabric PCA64 / PaCMAP — London ${manifest.readyScalesKm.join(" / ")} km${ATLAS_EDGE_ROOT ? " — Edge root (5, 0)" : ""}`;
    document.querySelector(".scale-heading strong").textContent = "PCA64 / PaCMAP";
    datasetSelect.closest("label").hidden = false;
    document.querySelector('label[for="dataset-select"] > span').textContent = "View";
    atlasScaleSelect.closest("label").hidden = atlas.grouped.length < 2;
    atlasScaleSelect.replaceChildren(new Option("Auto (zoom)", "auto"), ...atlas.grouped.map((layer) =>
      new Option(layer.wholeDataset ? `Whole city (${layer.radiusMeters / 1000} km level)` : `${layer.radiusMeters / 1000} km · ${layer.patchCount} patches`, String(layer.radiusMeters / 1000))
    ));
    const requestedScale = Number(new URLSearchParams(window.location.search).get("scale"));
    atlasSelectedScaleKm = atlas.grouped.some((layer) => layer.radiusMeters === requestedScale * 1000) ? requestedScale : null;
    atlasScaleSelect.value = atlasSelectedScaleKm ? String(atlasSelectedScaleKm) : "auto";
    atlasGridToggle.closest("label").hidden = false;
    document.querySelector('label[for="scale-slider"] > span').textContent = "Zoom";
    document.querySelector('label[for="axis-slider"]').hidden = true;
    axisSlider.hidden = true;
    if (manifest.centerLonLat) {
      const [lon, lat] = manifest.centerLonLat;
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) >= 85) {
        throw new Error("Invalid atlas center");
      }
      CENTER.lon = lon;
      CENTER.lat = lat;
    }
    for (const [id, layers] of [[SMART_CENTER_DATASET_ID, atlas.center], [SMART_GRID_DATASET_ID, atlas.grouped]]) {
      const dataset = DATASET_CONFIGS[id];
      dataset.layers = layers.map((layer) => ({ ...layer, colorMatrix: COLOR_MATRIX_IDENTITY,
        mercatorBounds: mercatorBoundsForLonLatBounds(layer.bounds) }));
      dataset.label = `PCA64/PaCMAP ${id === SMART_CENTER_DATASET_ID ? "center" : "grouped"} patches`;
      dataset.mode = "atlas";
      for (const layer of dataset.layers) {
        layerStates.set(layer.id, { status: "idle", count: layer.count, byteLength: layer.byteLength, bytesLoaded: 0 });
      }
      const option = datasetSelect.querySelector(`option[value="${id}"]`);
      if (option) option.textContent = id === SMART_CENTER_DATASET_ID
        ? "Central patch (0, 0)" : atlas.grouped.length === 1
          ? `All ${atlas.grouped[0].patchCount} patches · full coverage` : "All patches · full coverage";
    }
    const grid = buildPatchGrid(DATASET_CONFIGS[SMART_GRID_DATASET_ID], { groups: atlas.groups });
    DATASET_CONFIGS[SMART_GRID_DATASET_ID].patchGrid = grid;
    for (const [id, vertices] of Object.entries(grid.lineVerticesByLayerId)) {
      pointCloudLayer.setGridDataset(id, vertices, grid.lineColorByLayerId[id] ?? PATCH_GRID_LINE_COLOR);
    }
    colorModeSelect.closest("label").hidden = true;
    colorModeSelect.disabled = true;
    colorStatus.hidden = false;
    atlasColorCaption = `8 × 4096D → shared PCA64 → PaCMAP · ${manifest.readyScalesKm.join(" / ")} km${ATLAS_EDGE_ROOT ? " · Edge root (5, 0)" : ""}`;
    colorStatus.textContent = atlasColorCaption;
    return;
  }
  for (const dataset of Object.values(DATASET_CONFIGS)) {
    if (dataset.mode === "manifest-layers") {
      const response = await fetch(dataset.manifestUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Failed to load ${dataset.label} manifest: ${response.status} ${response.statusText}`);
      }
      const manifest = await response.json();
      dataset.layers = (manifest.layers ?? []).map((layer, index) => ({
        id: `${dataset.id}:${layer.id}`,
        label: layer.label ?? layer.id,
        radiusMeters: Number(layer.radiusMeters ?? 0),
        boundaryMeters: Number(layer.boundaryMeters ?? (layer.radiusMeters ?? 0) * 1.8),
        url: layer.url,
        manifestUrl: layer.manifestUrl,
        count: Number(layer.count ?? 0),
        byteLength: Number(layer.byteLength ?? (layer.count ?? 0) * POINT_RECORD_BYTES),
        mercatorBounds: mercatorBoundsForLonLatBounds(layer.bounds),
        colorMatrix: colorMatrixForManifestLayer(layer),
        scaleIndex: index,
        datasetId: dataset.id
      }));

      if (dataset.gridManifestUrl) {
        const gridResponse = await fetch(dataset.gridManifestUrl, { cache: "no-store" });
        if (!gridResponse.ok) {
          throw new Error(`Failed to load ${dataset.label} grid manifest: ${gridResponse.status} ${gridResponse.statusText}`);
        }
        const gridManifest = await gridResponse.json();
        const grid = buildPatchGrid(dataset, gridManifest);
        dataset.patchGrid = grid;
        for (const [layerId, vertices] of Object.entries(grid.lineVerticesByLayerId)) {
          pointCloudLayer.setGridDataset(layerId, vertices, grid.lineColorByLayerId[layerId] ?? PATCH_GRID_LINE_COLOR);
        }
      }
    } else {
      const manifests = await Promise.all(
        dataset.layers.map(async (layer) => {
          const response = await fetch(layer.manifestUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Failed to load ${layer.label} manifest: ${response.status} ${response.statusText}`);
          }
          return response.json();
        })
      );

      for (let index = 0; index < manifests.length; index += 1) {
        const layer = dataset.layers[index];
        const manifest = manifests[index];
        layer.count = Number(manifest.count ?? 0);
        layer.byteLength = Number(manifest.byteLength ?? layer.count * POINT_RECORD_BYTES);
        layer.mercatorBounds = mercatorBoundsForLonLatBounds(manifest.bounds);
        layer.scaleIndex = index;
        layer.datasetId = dataset.id;
      }
    }

    for (const layer of dataset.layers) {
      layerStates.set(layer.id, {
        status: "idle",
        count: Number(layer.count ?? 0),
        byteLength: Number(layer.byteLength ?? 0),
        bytesLoaded: 0
      });
    }
  }

}

function setActiveDataset(datasetId) {
  activeDatasetId = DATASET_CONFIGS[datasetId] ? datasetId : SMART_CENTER_DATASET_ID;
  activeDataset = DATASET_CONFIGS[activeDatasetId];
  activeLayers = activeDataset.layers;
  datasetSelect.value = activeDatasetId;
  lockedLayerId = null;
  lockedScaleIndex = null;
  if (USE_NEIGHBOR_ATLAS) {
    syncAtlasScaleLock();
    const bounds = (activeLayers.find((layer) => layer.id === lockedLayerId) ?? activeLayers[0])?.bounds;
    const camera = bounds ? map.cameraForBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]], { padding: 60 }) : null;
    atlasCameraCenter = camera ? [camera.center.lng, camera.center.lat] : [CENTER.lon, CENTER.lat];
    const centralBounds = DATASET_CONFIGS[SMART_CENTER_DATASET_ID].layers[0]?.bounds;
    const centralCamera = centralBounds ? map.cameraForBounds(
      [[centralBounds.west, centralBounds.south], [centralBounds.east, centralBounds.north]], { padding: 60 }
    ) : null;
    atlasDetailCenter = centralCamera ? [centralCamera.center.lng, centralCamera.center.lat] : [CENTER.lon, CENTER.lat];
    const zoom = clamp(camera?.zoom ?? 12, MAX_SCALE_ZOOM, MIN_SCALE_ZOOM);
    atlasOverviewZoom = zoom;
    const progress = (zoom - MIN_SCALE_ZOOM) / (MAX_SCALE_ZOOM - MIN_SCALE_ZOOM);
    slider.value = MIN_LONG_AXIS_METERS * Math.pow(MAX_LONG_AXIS_METERS / MIN_LONG_AXIS_METERS, progress);
  }
  updateGridControls();
  applyScale(Number(slider.value));
  updateDataStatus();
}

function syncAtlasScaleLock() {
  const index = atlasSelectedScaleKm === null ? -1 : activeLayers.findIndex((layer) => layer.radiusMeters === atlasSelectedScaleKm * 1000);
  lockedScaleIndex = index >= 0 ? index : null;
  lockedLayerId = index >= 0 ? activeLayers[index].id : null;
  updateGridControls();
}

function setSmartUnlockedDataset() {
  activeDatasetId = SMART_CENTER_DATASET_ID;
  activeDataset = DATASET_CONFIGS[activeDatasetId];
  activeLayers = activeDataset.layers;
  datasetSelect.value = activeDatasetId;
  lockedLayerId = null;
  lockedScaleIndex = null;
  updateGridControls();
}

function setSmartLockedDataset(scaleIndex) {
  activeDatasetId = SMART_GRID_DATASET_ID;
  activeDataset = DATASET_CONFIGS[activeDatasetId];
  activeLayers = activeDataset.layers;
  datasetSelect.value = activeDatasetId;
  lockedScaleIndex = clamp(Math.round(scaleIndex), 0, activeLayers.length - 1);
  lockedLayerId = activeLayers[lockedScaleIndex]?.id ?? null;
  updateGridControls();
}

function colorMatrixForManifestLayer(layer) {
  const radiusMeters = Number(layer.radiusMeters ?? 0);
  if ([2000, 4000, 8000].includes(Math.round(radiusMeters))) {
    return COLOR_MATRIX_SWAP_RG_THEN_RB;
  }
  return COLOR_MATRICES[layer.colorMatrix] ?? COLOR_MATRIX_IDENTITY;
}

async function fetchArrayBufferWithProgress(layer, onProgress) {
  const response = await fetch(layer.url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${layer.label}: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    onProgress(layer.byteLength);
    return arrayBuffer;
  }

  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress(Math.min(received, layer.byteLength));
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onProgress(layer.byteLength);
  return merged.buffer;
}

function updateLoadingProgress(label, loadedBytes) {
  const percent = clamp((loadedBytes / totalBytes) * 100, 0, 100);
  loadingBar.style.width = `${percent}%`;
  loadingLabel.textContent = label;
  loadingPercent.textContent = `${Math.round(percent)}%`;
}

function updateDataStatus() {
  const allLayers = Object.values(DATASET_CONFIGS).flatMap((dataset) => dataset.layers);
  const loaded = [...layerStates.values()].filter((state) => state.status === "loaded");
  const loading = allLayers.find((layer) => layerStates.get(layer.id)?.status === "loading");
  let activePointCount = activeLayers.reduce((sum, layer) => sum + (layerStates.get(layer.id)?.count ?? 0), 0);

  if (!allLayersReady) {
    dataStatus.textContent = loading
      ? `${loaded.length}/${allLayers.length} clouds ready - loading ${loading.label}`
      : `${loaded.length}/${allLayers.length} clouds ready`;
    dataStatus.classList.remove("has-warning");
    return;
  }

  const opacities = layerOpacitiesForDisplay(currentScaleAxisMeters);
  if (USE_NEIGHBOR_ATLAS) activePointCount = Math.max(0, ...activeLayers.filter((_, index) => opacities[index] > 0.001).map((layer) => layerStates.get(layer.id)?.count ?? 0));
  const activeLabels = activeLayers.filter((_, index) => opacities[index] > 0.001).map((layer) => layer.label);
  const lockLabel = lockedLayerId ? " locked" : "";
  dataStatus.textContent = `${activeDataset.label}: ${activeLabels.join(" + ")}${lockLabel} - ${formatInteger(activePointCount)} points loaded`;
  dataStatus.classList.remove("has-warning");
}

function applyScale(scaleControlValue) {
  const clamped = clamp(scaleControlValue, MIN_LONG_AXIS_METERS, MAX_LONG_AXIS_METERS);
  const zoom = zoomForScaleControlValue(clamped);
  let cameraCenter = [CENTER.lon, CENTER.lat];
  if (USE_NEIGHBOR_ATLAS && atlasCameraCenter && atlasDetailCenter) {
    // Keep the overview framing, then converge on the same (0, 0) focus in both views.
    const progress = clamp((zoom - atlasOverviewZoom) / Math.max(MIN_SCALE_ZOOM - atlasOverviewZoom, 0.001), 0, 1);
    const blend = progress * progress * (3 - 2 * progress);
    cameraCenter = progress === 1 ? atlasDetailCenter : atlasCameraCenter.map(
      (coordinate, index) => coordinate + (atlasDetailCenter[index] - coordinate) * blend
    );
  }
  map.jumpTo({
    center: cameraCenter,
    zoom,
    bearing: 0,
    pitch: 0
  });

  const axisMetrics = screenAxisMeters(Number(axisSlider.value));
  currentScaleAxisMeters = axisMetrics.scaleAxisMeters;
  currentCoverageAxisMeters = axisMetrics.longAxisMeters;
  const opacities = layerOpacitiesForDisplay(currentScaleAxisMeters);
  const coverageOpacities = layerOpacitiesForCoverage(currentCoverageAxisMeters);
  pointCloudLayer.setOpacities(
    Object.fromEntries(activeLayers.map((layer, index) => [layer.id, opacities[index]])),
    Object.fromEntries(activeLayers.map((layer, index) => [layer.id, coverageOpacities[index]]))
  );
  updateReadout(axisMetrics, zoom, opacities);
  if (USE_NEIGHBOR_ATLAS) {
    scaleOutput.textContent = `Zoom ${zoom.toFixed(2)}`;
    updateDataStatus();
  }
}

function createPointCloudLayer() {
  return {
    id: "pcatsne-point-cloud",
    type: "custom",
    renderingMode: "2d",
    map: null,
    gl: null,
    program: null,
    gridProgram: null,
    datasets: new Map(),
    gridDatasets: new Map(),
    opacities: {},
    coverageOpacities: {},
    gridOpacities: {},
    gridTransparency: DEFAULT_GRID_TRANSPARENCY,
    gridLineWidth: DEFAULT_GRID_LINE_WIDTH,
    locations: {},
    gridLocations: {},
    attributes: {},
    gridAttributes: {},

    onAdd(mapInstance, gl) {
      this.map = mapInstance;
      this.gl = gl;
      this.program = createProgram(gl, vertexShaderSource(), fragmentShaderSource());
      this.gridProgram = createProgram(gl, gridVertexShaderSource(), gridFragmentShaderSource());
      this.locations.matrix = gl.getUniformLocation(this.program, "u_matrix");
      this.locations.opacity = gl.getUniformLocation(this.program, "u_opacity");
      this.locations.pointSize = gl.getUniformLocation(this.program, "u_pointSize");
      this.locations.colorMatrix = gl.getUniformLocation(this.program, "u_colorMatrix");
      this.locations.overlapBounds = gl.getUniformLocation(this.program, "u_overlapBounds");
      this.locations.useCoverageBoost = gl.getUniformLocation(this.program, "u_useCoverageBoost");
      this.attributes.position = gl.getAttribLocation(this.program, "a_pos");
      this.attributes.color = gl.getAttribLocation(this.program, "a_color");
      this.gridLocations.matrix = gl.getUniformLocation(this.gridProgram, "u_matrix");
      this.gridLocations.color = gl.getUniformLocation(this.gridProgram, "u_color");
      this.gridLocations.viewport = gl.getUniformLocation(this.gridProgram, "u_viewport");
      this.gridLocations.lineWidth = gl.getUniformLocation(this.gridProgram, "u_lineWidth");
      this.gridAttributes.start = gl.getAttribLocation(this.gridProgram, "a_start");
      this.gridAttributes.end = gl.getAttribLocation(this.gridProgram, "a_end");
      this.gridAttributes.side = gl.getAttribLocation(this.gridProgram, "a_side");
      this.gridAttributes.along = gl.getAttribLocation(this.gridProgram, "a_along");

      for (const [id, dataset] of this.datasets) {
        if (!dataset.arrayBuffer || dataset.buffer) continue;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, dataset.arrayBuffer, gl.STATIC_DRAW);
        this.datasets.set(id, { ...dataset, buffer });
      }
      for (const [id, dataset] of this.gridDatasets) {
        if (!dataset.vertices || dataset.buffer) continue;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, dataset.vertices, gl.STATIC_DRAW);
        this.gridDatasets.set(id, { ...dataset, buffer });
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },

    render(gl, matrix) {
      if (!this.program) return;
      const pointSize = pointRadiusForZoom(this.map.getZoom(), BASE_POINT_RADIUS) * window.devicePixelRatio;
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.locations.matrix, false, matrix);
      gl.uniform1f(this.locations.pointSize, pointSize);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      const layers = activeLayers;
      const displayActiveIndices = layers.map((layer, index) => ((this.opacities[layer.id] ?? 0) > 0.001 ? index : -1)).filter(
        (index) => index >= 0
      );
      if (displayActiveIndices.length === 0) {
        this.renderGrid(gl, matrix, layers);
        gl.depthMask(true);
        return;
      }

      const coverageActiveIndices = layers.map((layer, index) =>
        (this.coverageOpacities[layer.id] ?? 0) > 0.001 ? index : -1
      ).filter((index) => index >= 0);
      const renderStartIndex = Math.min(...displayActiveIndices);
      const displayEndIndex = Math.max(...displayActiveIndices);
      const coverageEndIndex = coverageActiveIndices.length > 0 ? Math.max(...coverageActiveIndices) : displayEndIndex;
      const renderEndIndex = Math.max(displayEndIndex, coverageEndIndex);

      for (let layerIndex = renderStartIndex; layerIndex <= renderEndIndex; layerIndex += 1) {
        const layer = layers[layerIndex];
        const opacity = this.opacities[layer.id] ?? 0;
        const dataset = this.datasets.get(layer.id);
        if (!dataset?.buffer || dataset.count <= 0) continue;
        const useCoverageBoost = layerIndex > renderStartIndex;
        const overlapBounds = useCoverageBoost ? layers[layerIndex - 1].mercatorBounds ?? FULL_MERCATOR_BOUNDS : FULL_MERCATOR_BOUNDS;
        gl.uniform1f(this.locations.opacity, opacity);
        gl.uniformMatrix3fv(this.locations.colorMatrix, false, colorMode === "original" ? layer.colorMatrix : COLOR_MATRIX_IDENTITY);
        gl.uniform4fv(this.locations.overlapBounds, overlapBounds);
        gl.uniform1f(this.locations.useCoverageBoost, useCoverageBoost ? 1 : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, dataset.buffer);
        gl.enableVertexAttribArray(this.attributes.position);
        gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, POINT_RECORD_BYTES, 0);
        gl.enableVertexAttribArray(this.attributes.color);
        gl.vertexAttribPointer(this.attributes.color, 4, gl.UNSIGNED_BYTE, true, POINT_RECORD_BYTES, 8);
        gl.drawArrays(gl.POINTS, 0, dataset.count);
      }

      this.renderGrid(gl, matrix, layers);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.depthMask(true);
    },

    renderGrid(gl, matrix, layers) {
      if (!this.gridProgram) return;
      gl.useProgram(this.gridProgram);
      gl.uniformMatrix4fv(this.gridLocations.matrix, false, matrix);
      gl.uniform2f(this.gridLocations.viewport, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(this.gridLocations.lineWidth, this.gridLineWidth * window.devicePixelRatio);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);

      for (const layer of layers) {
        const opacity = this.gridOpacities[layer.id] ?? 0;
        const dataset = this.gridDatasets.get(layer.id);
        if (!dataset?.buffer || dataset.vertexCount <= 0 || opacity <= 0.001) continue;

        const color = dataset.color ?? PATCH_GRID_LINE_COLOR;
        gl.uniform4f(
          this.gridLocations.color,
          color[0],
          color[1],
          color[2],
          opacity * (1 - this.gridTransparency)
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, dataset.buffer);
        gl.enableVertexAttribArray(this.gridAttributes.start);
        gl.vertexAttribPointer(this.gridAttributes.start, 2, gl.FLOAT, false, GRID_VERTEX_FLOATS * 4, 0);
        gl.enableVertexAttribArray(this.gridAttributes.end);
        gl.vertexAttribPointer(this.gridAttributes.end, 2, gl.FLOAT, false, GRID_VERTEX_FLOATS * 4, 8);
        gl.enableVertexAttribArray(this.gridAttributes.side);
        gl.vertexAttribPointer(this.gridAttributes.side, 1, gl.FLOAT, false, GRID_VERTEX_FLOATS * 4, 16);
        gl.enableVertexAttribArray(this.gridAttributes.along);
        gl.vertexAttribPointer(this.gridAttributes.along, 1, gl.FLOAT, false, GRID_VERTEX_FLOATS * 4, 20);
        gl.drawArrays(gl.TRIANGLES, 0, dataset.vertexCount);
      }
    },

    onRemove(_mapInstance, gl) {
      for (const [id, dataset] of this.datasets) {
        if (dataset.buffer) gl.deleteBuffer(dataset.buffer);
        this.datasets.set(id, { ...dataset, buffer: null });
      }
      for (const [id, dataset] of this.gridDatasets) {
        if (dataset.buffer) gl.deleteBuffer(dataset.buffer);
        this.gridDatasets.set(id, { ...dataset, buffer: null });
      }
      if (this.program) gl.deleteProgram(this.program);
      if (this.gridProgram) gl.deleteProgram(this.gridProgram);
      this.program = null;
      this.gridProgram = null;
      this.gl = null;
      this.map = null;
    },

    setDataset(id, arrayBuffer, count) {
      if (!this.gl) {
        this.datasets.set(id, { arrayBuffer, count, buffer: null });
        return;
      }
      const existing = this.datasets.get(id);
      if (existing?.buffer) this.gl.deleteBuffer(existing.buffer);
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, arrayBuffer, this.gl.STATIC_DRAW);
      this.datasets.set(id, { arrayBuffer, buffer, count });
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      this.map?.triggerRepaint();
    },

    setGridDataset(id, vertices, color = PATCH_GRID_LINE_COLOR) {
      const vertexCount = Math.floor(vertices.length / GRID_VERTEX_FLOATS);
      if (!this.gl) {
        this.gridDatasets.set(id, { vertices, color, vertexCount, buffer: null });
        return;
      }
      const existing = this.gridDatasets.get(id);
      if (existing?.buffer) this.gl.deleteBuffer(existing.buffer);
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
      this.gridDatasets.set(id, { vertices, color, vertexCount, buffer });
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      this.map?.triggerRepaint();
    },

    setGridStyle(transparency, lineWidth) {
      this.gridTransparency = clamp(transparency, 0, 1);
      this.gridLineWidth = clamp(lineWidth, 1, 6);
      this.map?.triggerRepaint();
    },

    setOpacities(opacities, coverageOpacities = opacities) {
      this.opacities = opacities;
      this.coverageOpacities = coverageOpacities;
      this.gridOpacities = USE_NEIGHBOR_ATLAS
        ? (atlasGridVisible && activeDatasetId === SMART_GRID_DATASET_ID ? opacities : {})
        : (lockedLayerId ? opacities : {});
      this.map?.triggerRepaint();
    }
  };
}

function vertexShaderSource() {
  return `
    precision highp float;

    uniform mat4 u_matrix;
    uniform float u_pointSize;
    uniform mat3 u_colorMatrix;

    attribute vec2 a_pos;
    attribute vec4 a_color;

    varying vec4 v_color;
    varying vec2 v_pos;

    void main() {
      gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
      gl_PointSize = u_pointSize;
      v_color = vec4(u_colorMatrix * a_color.rgb, a_color.a);
      v_pos = a_pos;
    }
  `;
}

function fragmentShaderSource() {
  return `
    precision highp float;

    uniform float u_opacity;
    uniform vec4 u_overlapBounds;
    uniform float u_useCoverageBoost;

    varying vec4 v_color;
    varying vec2 v_pos;

    void main() {
      vec2 delta = gl_PointCoord - vec2(0.5);
      float dist = length(delta);
      float insideOverlap =
        step(u_overlapBounds.x, v_pos.x) *
        step(v_pos.x, u_overlapBounds.z) *
        step(u_overlapBounds.y, v_pos.y) *
        step(v_pos.y, u_overlapBounds.w);
      float coverageOpacity = mix(1.0, u_opacity, insideOverlap);
      float opacity = mix(u_opacity, coverageOpacity, u_useCoverageBoost);
      float alpha = smoothstep(0.5, 0.42, dist) * opacity * v_color.a;
      if (alpha <= 0.001) discard;
      gl_FragColor = vec4(v_color.rgb, alpha);
    }
  `;
}

function gridVertexShaderSource() {
  return `
    precision highp float;

    uniform mat4 u_matrix;
    uniform vec2 u_viewport;
    uniform float u_lineWidth;

    attribute vec2 a_start;
    attribute vec2 a_end;
    attribute float a_side;
    attribute float a_along;

    void main() {
      vec4 startClip = u_matrix * vec4(a_start, 0.0, 1.0);
      vec4 endClip = u_matrix * vec4(a_end, 0.0, 1.0);
      vec2 startNdc = startClip.xy / startClip.w;
      vec2 endNdc = endClip.xy / endClip.w;
      vec2 segmentPixels = (endNdc - startNdc) * u_viewport;
      float segmentLength = max(length(segmentPixels), 0.0001);
      vec2 normal = vec2(-segmentPixels.y, segmentPixels.x) / segmentLength;
      vec4 baseClip = mix(startClip, endClip, a_along);
      vec2 offsetNdc = normal * a_side * u_lineWidth / u_viewport * baseClip.w;
      gl_Position = vec4(baseClip.xy + offsetNdc, baseClip.zw);
    }
  `;
}

function gridFragmentShaderSource() {
  return `
    precision highp float;

    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
  `;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unable to link shader program";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  return program;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unable to compile shader";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function pointRadiusForZoom(zoom, radius) {
  if (zoom <= 8) return radius / 32;
  if (zoom <= 13) {
    return exponentialInterpolate(zoom, 8, radius / 32, 13, radius, 2);
  }
  if (zoom <= 18) {
    return exponentialInterpolate(zoom, 13, radius, 18, radius * 32, 2);
  }
  return radius * 32;
}

function exponentialInterpolate(value, inputMin, outputMin, inputMax, outputMax, base) {
  const progress = clamp((value - inputMin) / (inputMax - inputMin), 0, 1);
  const t = base === 1 ? progress : (Math.pow(base, progress * (inputMax - inputMin)) - 1) / (Math.pow(base, inputMax - inputMin) - 1);
  return outputMin + t * (outputMax - outputMin);
}

function layerOpacitiesForLongAxisScale(longAxisMeters) {
  return scaleOpacities(activeLayers, longAxisMeters, CROSSFADE_ACTIVE_FRACTION);
}

function layerOpacitiesForDisplay(longAxisMeters) {
  if (!lockedLayerId) return layerOpacitiesForLongAxisScale(longAxisMeters);
  return activeLayers.map((layer) => (layer.id === lockedLayerId ? 1 : 0));
}

function layerOpacitiesForCoverage(longAxisMeters) {
  if (!lockedLayerId) return layerOpacitiesForLongAxisScale(longAxisMeters);
  return activeLayers.map((layer) => (layer.id === lockedLayerId ? 1 : 0));
}

function updateReadout(axisMetrics, zoom, opacities) {
  const { scaleAxisMeters, axisBlend } = axisMetrics;
  const equivalentRadius = scaleAxisMeters / 1.8;
  scaleOutput.textContent = `${formatKm(equivalentRadius)} radius`;
  axisOutput.textContent = formatAxisBlend(axisBlend);
  scaleAxisLabel.textContent = `Axis ${formatKm(scaleAxisMeters)}`;
  zoomLabel.textContent = `Zoom ${zoom.toFixed(2)}`;

  layerReadout.replaceChildren(
    ...activeLayers.map((layer, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "layer-chip";
      item.classList.toggle("is-active", opacities[index] > 0.001);
      item.classList.toggle("is-locked", lockedLayerId === layer.id);
      item.style.setProperty("--opacity", String(opacities[index]));
      item.title = lockedLayerId === layer.id ? `Unlock ${layer.label}` : `Lock ${layer.label}`;
      item.innerHTML = `<span>${layer.label}</span><strong>${Math.round(opacities[index] * 100)}%</strong>`;
      item.addEventListener("click", () => toggleLockedLayer(layer.id));
      return item;
    })
  );
}

function toggleLockedLayer(layerId) {
  if (USE_NEIGHBOR_ATLAS) {
    if (activeLayers.length === 1) {
      setActiveDataset(activeDatasetId === SMART_GRID_DATASET_ID ? SMART_CENTER_DATASET_ID : SMART_GRID_DATASET_ID);
    } else {
      const layer = activeLayers.find((item) => item.id === layerId);
      atlasSelectedScaleKm = lockedLayerId === layerId ? null : layer.radiusMeters / 1000;
      atlasScaleSelect.value = atlasSelectedScaleKm ? String(atlasSelectedScaleKm) : "auto";
      syncAtlasScaleLock();
      applyScale(Number(slider.value));
    }
    return;
  }
  const clickedIndex = activeLayers.findIndex((layer) => layer.id === layerId);
  const targetIndex = clickedIndex >= 0 ? clickedIndex : lockedScaleIndex;
  if (lockedLayerId && lockedScaleIndex === targetIndex) {
    setSmartUnlockedDataset();
  } else {
    setSmartLockedDataset(targetIndex ?? 0);
  }
  applyScale(Number(slider.value));
  updateDataStatus();
}

function updateGridControls() {
  const wholeCity = USE_NEIGHBOR_ATLAS && Boolean(activeLayers.find((layer) => layer.id === lockedLayerId)?.wholeDataset);
  if (USE_NEIGHBOR_ATLAS) {
    atlasGridToggle.disabled = wholeCity;
    gridControls.hidden = wholeCity || !atlasGridVisible || activeDatasetId !== SMART_GRID_DATASET_ID;
  }
  const enabled = allLayersReady && (USE_NEIGHBOR_ATLAS
    ? !wholeCity && atlasGridVisible && activeDatasetId === SMART_GRID_DATASET_ID : Boolean(lockedLayerId));
  gridTransparencySlider.disabled = !enabled;
  gridWidthSlider.disabled = !enabled;
  gridControls.classList.toggle("is-disabled", !enabled);
  updateGridControlReadout();
}

function updateGridControlReadout() {
  gridTransparencyOutput.textContent = `${Math.round(gridTransparency * 100)}%`;
  gridWidthOutput.textContent = `${gridLineWidth.toFixed(1)} px`;
}

function buildPatchGrid(dataset, gridManifest) {
  const centerMeters = lonLatToWebMercatorMeters(CENTER.lon, CENTER.lat);
  const layerByRadius = new Map(dataset.layers.map((layer) => [Math.round(layer.radiusMeters), layer]));
  const layerById = new Map(dataset.layers.map((layer) => [layer.id, layer]));
  const features = [];
  const layerIdSet = new Set();
  const lineColorByLayerId = {};
  const edgeMapsByLayerId = {};

  for (const group of gridManifest.groups ?? []) {
    const radiusMeters = Number(group.radiusMeters);
    const layer = layerByRadius.get(Math.round(radiusMeters));
    if (!layer || !Number.isFinite(radiusMeters) || radiusMeters <= 0) continue;

    layerIdSet.add(layer.id);
    lineColorByLayerId[layer.id] = patchGridColorForRadius(radiusMeters);
    edgeMapsByLayerId[layer.id] ??= new Map();

    for (const patch of group.patches ?? []) {
      const gridX = Number(patch.grid?.x);
      const gridY = Number(patch.grid?.y);
      if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) continue;

      appendPatchEdges(edgeMapsByLayerId[layer.id], gridX, gridY);

      features.push({
        type: "Feature",
        properties: {
          id: patch.id,
          label: patch.label ?? patch.id,
          layerId: layer.id,
          scaleIndex: layer.scaleIndex,
          radiusMeters,
          gridX,
          gridY,
          count: Number(patch.count ?? 0)
        },
        geometry: {
          type: "LineString",
          coordinates: webMercatorPatchRing(centerMeters, radiusMeters, gridX, gridY)
        }
      });
    }
  }

  return {
    featureCollection: {
      type: "FeatureCollection",
      features
    },
    layerIds: [...layerIdSet],
    lineColorByLayerId,
    lineVerticesByLayerId: Object.fromEntries(
      Object.entries(edgeMapsByLayerId).map(([layerId, edgeMap]) => [
        layerId,
        uniqueGridEdgesToVertices(centerMeters, layerById.get(layerId)?.radiusMeters ?? 0, edgeMap)
      ])
    )
  };
}

function appendPatchEdges(edgeMap, gridX, gridY) {
  const west = 2 * gridX - 1;
  const east = 2 * gridX + 1;
  const south = 2 * gridY - 1;
  const north = 2 * gridY + 1;
  addUniqueGridEdge(edgeMap, [west, south], [east, south]);
  addUniqueGridEdge(edgeMap, [east, south], [east, north]);
  addUniqueGridEdge(edgeMap, [east, north], [west, north]);
  addUniqueGridEdge(edgeMap, [west, north], [west, south]);
}

function addUniqueGridEdge(edgeMap, start, end) {
  const [a, b] = compareGridNodes(start, end) <= 0 ? [start, end] : [end, start];
  const key = `${a[0]},${a[1]}|${b[0]},${b[1]}`;
  if (!edgeMap.has(key)) edgeMap.set(key, { start: a, end: b });
}

function compareGridNodes(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

function uniqueGridEdgesToVertices(centerMeters, radiusMeters, edgeMap) {
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return new Float32Array();
  const vertices = [];
  for (const edge of edgeMap.values()) {
    const start = webMercatorGridNodeToMercatorXY(centerMeters, radiusMeters, edge.start);
    const end = webMercatorGridNodeToMercatorXY(centerMeters, radiusMeters, edge.end);
    appendLineQuad(vertices, start, end);
  }
  return new Float32Array(vertices);
}

function appendLineQuad(vertices, start, end) {
  appendGridVertex(vertices, start, end, -1, 0);
  appendGridVertex(vertices, start, end, -1, 1);
  appendGridVertex(vertices, start, end, 1, 1);
  appendGridVertex(vertices, start, end, -1, 0);
  appendGridVertex(vertices, start, end, 1, 1);
  appendGridVertex(vertices, start, end, 1, 0);
}

function appendGridVertex(vertices, start, end, side, along) {
  vertices.push(start[0], start[1], end[0], end[1], side, along);
}

function patchGridColorForRadius(radiusMeters) {
  void radiusMeters;
  return PATCH_GRID_LINE_COLOR;
}

function webMercatorPatchRing(centerMeters, radiusMeters, gridX, gridY) {
  const sizeMeters = radiusMeters * 2;
  const minX = centerMeters.x + gridX * sizeMeters - radiusMeters;
  const maxX = centerMeters.x + gridX * sizeMeters + radiusMeters;
  const minY = centerMeters.y + gridY * sizeMeters - radiusMeters;
  const maxY = centerMeters.y + gridY * sizeMeters + radiusMeters;

  const southwest = webMercatorMetersToLonLat(minX, minY);
  const southeast = webMercatorMetersToLonLat(maxX, minY);
  const northeast = webMercatorMetersToLonLat(maxX, maxY);
  const northwest = webMercatorMetersToLonLat(minX, maxY);
  return [southwest, southeast, northeast, northwest, southwest];
}

function webMercatorPatchMercatorRing(centerMeters, radiusMeters, gridX, gridY) {
  const sizeMeters = radiusMeters * 2;
  const minX = centerMeters.x + gridX * sizeMeters - radiusMeters;
  const maxX = centerMeters.x + gridX * sizeMeters + radiusMeters;
  const minY = centerMeters.y + gridY * sizeMeters - radiusMeters;
  const maxY = centerMeters.y + gridY * sizeMeters + radiusMeters;

  const southwest = webMercatorMetersToMercatorXY(minX, minY);
  const southeast = webMercatorMetersToMercatorXY(maxX, minY);
  const northeast = webMercatorMetersToMercatorXY(maxX, maxY);
  const northwest = webMercatorMetersToMercatorXY(minX, maxY);
  return [southwest, southeast, northeast, northwest, southwest];
}

function webMercatorGridNodeToMercatorXY(centerMeters, radiusMeters, node) {
  return webMercatorMetersToMercatorXY(
    centerMeters.x + node[0] * radiusMeters,
    centerMeters.y + node[1] * radiusMeters
  );
}

function mercatorBoundsForLonLatBounds(bounds) {
  if (!bounds) return FULL_MERCATOR_BOUNDS;
  const west = Number(bounds.west);
  const south = Number(bounds.south);
  const east = Number(bounds.east);
  const north = Number(bounds.north);
  if (![west, south, east, north].every(Number.isFinite)) return FULL_MERCATOR_BOUNDS;

  const northwest = lonLatToMercator(west, north);
  const southeast = lonLatToMercator(east, south);
  return new Float32Array([
    Math.min(northwest.x, southeast.x),
    Math.min(northwest.y, southeast.y),
    Math.max(northwest.x, southeast.x),
    Math.max(northwest.y, southeast.y)
  ]);
}

function lonLatToMercator(lon, lat) {
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const sinLat = Math.sin(degreesToRadians(clampedLat));
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)
  };
}

function lonLatToWebMercatorMeters(lon, lat) {
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const latRadians = degreesToRadians(clampedLat);
  return {
    x: (lon / 180) * WEB_MERCATOR_HALF_WORLD_METERS,
    y: (Math.log(Math.tan(Math.PI / 4 + latRadians / 2)) / Math.PI) * WEB_MERCATOR_HALF_WORLD_METERS
  };
}

function webMercatorMetersToLonLat(x, y) {
  const lon = (x / WEB_MERCATOR_HALF_WORLD_METERS) * 180;
  const latRadians = 2 * Math.atan(Math.exp((y / WEB_MERCATOR_HALF_WORLD_METERS) * Math.PI)) - Math.PI / 2;
  return [lon, clamp(radiansToDegrees(latRadians), -85.05112878, 85.05112878)];
}

function webMercatorMetersToMercatorXY(x, y) {
  const worldMeters = WEB_MERCATOR_HALF_WORLD_METERS * 2;
  return [
    (x + WEB_MERCATOR_HALF_WORLD_METERS) / worldMeters,
    (WEB_MERCATOR_HALF_WORLD_METERS - y) / worldMeters
  ];
}

function screenAxisMeters(axisBlend) {
  const width = mapContainer.clientWidth || map.getCanvas().clientWidth || 1;
  const height = mapContainer.clientHeight || map.getCanvas().clientHeight || 1;
  const west = map.unproject([0, height / 2]);
  const east = map.unproject([width, height / 2]);
  const north = map.unproject([width / 2, 0]);
  const south = map.unproject([width / 2, height]);
  const horizontalMeters = haversineMeters(west.lng, west.lat, east.lng, east.lat);
  const verticalMeters = haversineMeters(north.lng, north.lat, south.lng, south.lat);
  const longAxisMeters = Math.max(horizontalMeters, verticalMeters);
  const shortAxisMeters = Math.min(horizontalMeters, verticalMeters);

  return {
    longAxisMeters,
    shortAxisMeters,
    axisBlend,
    scaleAxisMeters: lerp(longAxisMeters, shortAxisMeters, clamp(axisBlend, 0, 1))
  };
}

function haversineMeters(lonA, latA, lonB, latB) {
  const lat1 = degreesToRadians(latA);
  const lat2 = degreesToRadians(latB);
  const deltaLat = degreesToRadians(latB - latA);
  const deltaLon = degreesToRadians(lonB - lonA);
  const sinHalfLat = Math.sin(deltaLat / 2);
  const sinHalfLon = Math.sin(deltaLon / 2);
  const a = sinHalfLat * sinHalfLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfLon * sinHalfLon;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function zoomForScaleControlValue(scaleControlValue) {
  const scaleT = Math.log2(scaleControlValue / MIN_LONG_AXIS_METERS) / Math.log2(MAX_LONG_AXIS_METERS / MIN_LONG_AXIS_METERS);
  return lerp(MIN_SCALE_ZOOM, MAX_SCALE_ZOOM, clamp(scaleT, 0, 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function formatAxisBlend(axisBlend) {
  if (axisBlend <= 0.005) return "Long axis";
  if (axisBlend >= 0.995) return "Short axis";
  return `${Math.round(axisBlend * 100)}% short`;
}

function formatKm(meters) {
  if (meters >= 10000) {
    return `${Math.round(meters / 1000)} km`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatInteger(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
