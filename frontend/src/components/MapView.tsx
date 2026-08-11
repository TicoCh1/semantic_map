import maplibregl, { type Map as MapLibreMap, type MapLayerMouseEvent } from "maplibre-gl";
import { Check, Copy, Search, SendHorizontal } from "lucide-react";
import { memo, type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CityConfig, CityId, FeatureCollection, GradientPreset, MarkedPano, PanoLayerValue, PanoMapPoint, RemoteLogEntry, SemanticLayer, TileCoord } from "../api/types";
import {
  getLayerFallbackGeojson,
  getLayerGeojson,
  getLayerSourcePath,
  getRemoteTileGeojson,
  isRemoteTileTemplate,
  isStaticFallbackTileTemplate,
  mergeFeatureCollections
} from "../api/client";
import { StreetViewPanel } from "./StreetViewPanel";
import { BASEMAPS, type BasemapId, basemapById, basemapStyle } from "../state/basemaps";
import { DEFAULT_POINT_RADIUS, layerGradient } from "../state/color";
import { DEFAULT_CITY_CONFIGS } from "../state/cities";
import { circleRadiusExpression, colorExpression } from "../state/mapStyle";
import { panoDatasetIdForPoint, panoPointKey } from "../state/panoDatasets";
import { attachMapDiagnostics } from "../state/mobileDiagnostics";
import { copyStaticDeploymentContactEmail, STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE } from "../state/staticDeployment";

type MapViewProps = {
  cities: CityConfig[];
  layers: SemanticLayer[];
  gradients: GradientPreset[];
  selectedLayerId: string | null;
  basemapId: BasemapId;
  onBasemapChange: (basemapId: BasemapId) => void;
  onSelectLayer: (layerId: string) => void;
  onPriorityTileChange?: (cityId: CityId, tile: TileCoord | null) => void;
  markedPanos: MarkedPano[];
  selectedPanoKey: string | null;
  onMarkPano: (pano: PanoMapPoint) => void;
  onSelectPano: (panoKey: string) => void;
  onRemovePano: (panoKey: string) => void;
  scoreField: "score" | "zscore";
  progressEntries: RemoteLogEntry[];
  refreshingLayers?: boolean;
  onCreatePrompt?: (prompt: string) => Promise<void>;
  promptDisabled?: boolean;
  liveSearchAvailable?: boolean;
};

const REMOTE_MAX_DETAIL_ZOOM = 13;
const MAX_LAYER_GEOJSON_CACHE_ENTRIES = 80;
const MAX_REMOTE_TILE_CACHE_ENTRIES = 192;
const CITY_SELECTION_KEY = "semantic-map-selected-cities-v2";
const MOBILE_CITY_KEY = "semantic-map-mobile-city-v1";
const CITY_SPLIT_KEY = "semantic-map-city-split-percent";
const MIN_CITY_SPLIT = 28;
const MAX_CITY_SPLIT = 72;
const DEFAULT_SCALE_BAR_METERS = 500;
const MAX_DETAIL_MIN_SCALE_BAR_METERS = 1000;
const SCALE_CONTROL_MAX_WIDTH = 120;
const MAPLIBRE_METERS_PER_PIXEL_ZOOM0 = 78271.51696402048;
const MOBILE_SEARCH_PLACEHOLDERS = [
  "Search semantic prompt with statements",
  "The scene contains brick facade",
  "The scene contains abundant vegetation"
];
const STATIC_SEARCH_PLACEHOLDER = STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE;
const STATIC_FALLBACK_TILE_RANGES: Partial<Record<CityId, { z: number; minX: number; maxX: number; minY: number; maxY: number }>> = {
  london: { z: 13, minX: 4091, maxX: 4095, minY: 2721, maxY: 2725 },
  shanghai: { z: 13, minX: 6858, maxX: 6861, minY: 3345, maxY: 3348 }
};

function isCompactMapViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
}

export const MapView = memo(function MapView({
  cities,
  layers,
  gradients,
  selectedLayerId,
  basemapId,
  onBasemapChange,
  onSelectLayer,
  onPriorityTileChange,
  markedPanos,
  selectedPanoKey,
  onMarkPano,
  onSelectPano,
  onRemovePano,
  scoreField,
  progressEntries,
  onCreatePrompt,
  promptDisabled = false,
  liveSearchAvailable = true
}: MapViewProps) {
  const [citySelection, setCitySelection] = useState<CityId[]>(loadCitySelection);
  const [mobileCityId, setMobileCityId] = useState<CityId>(loadMobileCityId);
  const [citySplit, setCitySplit] = useState(loadCitySplit);
  const [draggingCitySplit, setDraggingCitySplit] = useState(false);
  const [compactViewport, setCompactViewport] = useState(isCompactMapViewport);
  const [forceMaxDetail, setForceMaxDetail] = useState(() => window.localStorage.getItem("semantic-map-force-max-detail") === "true");
  const [maxDetailAutoCancelled, setMaxDetailAutoCancelled] = useState(false);
  const [sharedGroundScale, setSharedGroundScale] = useState(() =>
    groundScaleForZoom(zoomForScaleBarMeters(DEFAULT_SCALE_BAR_METERS, cities[0]?.center[1] ?? 0), cities[0]?.center[1] ?? 0)
  );
  const [cityRemoteTileZooms, setCityRemoteTileZooms] = useState<Record<CityId, number>>({});
  const [semanticLayerLoadingByCity, setSemanticLayerLoadingByCity] = useState<Partial<Record<CityId, boolean>>>({});
  const desktopCities = useMemo(
    () => citySelection.map((cityId) => cities.find((city) => city.id === cityId)).filter((city): city is CityConfig => Boolean(city)),
    [cities, citySelection]
  );
  const activeCities = compactViewport ? cities.filter((city) => city.id === mobileCityId) : desktopCities;
  const sharedRemoteTileZoom = Math.max(...activeCities.map((city) => cityRemoteTileZooms[city.id] ?? 10), 10);
  const visibleLayerCount = layers.filter((layer) => layer.visible).length;
  const allLayersHidden = layers.length > 0 && visibleLayerCount === 0;
  const semanticLayerOverlayActive = !allLayersHidden && activeCities.length > 0 && activeCities.every((city) => semanticLayerLoadingByCity[city.id] === true);
  const title = layers.find((layer) => layer.id === selectedLayerId)?.name ?? "No layer selected";
  const statusLabel = activeCities.length === 2 ? "Scale synced" : `${activeCities[0]?.name ?? "No city"} visible`;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setCompactViewport(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setCitySelection((current) => normaliseCitySelection(cities, current));
    setMobileCityId((current) => (cities.some((city) => city.id === current) ? current : cities[0]?.id ?? ""));
  }, [cities]);

  useEffect(() => {
    window.localStorage.setItem(CITY_SELECTION_KEY, JSON.stringify(citySelection));
  }, [citySelection]);

  useEffect(() => {
    window.localStorage.setItem(MOBILE_CITY_KEY, mobileCityId);
  }, [mobileCityId]);

  useEffect(() => {
    if (!compactViewport || !onPriorityTileChange) return;
    for (const city of cities) {
      if (city.id !== mobileCityId) onPriorityTileChange(city.id, null);
    }
  }, [cities, compactViewport, mobileCityId, onPriorityTileChange]);

  useEffect(() => {
    window.localStorage.setItem(CITY_SPLIT_KEY, String(citySplit));
  }, [citySplit]);

  useEffect(() => {
    window.localStorage.setItem("semantic-map-force-max-detail", forceMaxDetail ? "true" : "false");
  }, [forceMaxDetail]);

  const selectCitySlot = useCallback((slot: number, cityId: CityId) => {
    setCitySelection((current) => {
      const next = normaliseCitySelection(cities, current);
      const currentSlot = next.indexOf(cityId);
      if (currentSlot === slot) return next;
      const displaced = next[slot];
      if (currentSlot >= 0) {
        next[currentSlot] = displaced;
        next[slot] = cityId;
        return next;
      }
      next[slot] = cityId;
      return normaliseCitySelection(cities, next);
    });
  }, [cities]);

  const startCitySplitDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (compactViewport) return;
    setDraggingCitySplit(true);
    const shell = event.currentTarget.closest(".city-map-layout") as HTMLElement | null;
    if (!shell) return;
    const rect = shell.getBoundingClientRect();

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const raw = ((moveEvent.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      setCitySplit(clampNumber(raw, MIN_CITY_SPLIT, MAX_CITY_SPLIT));
    };
    const onUp = () => {
      setDraggingCitySplit(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [compactViewport]);

  const handleCityRemoteTileZoomChange = useCallback((cityId: CityId, zoom: number) => {
    setCityRemoteTileZooms((current) => {
      const nextZoom = clampInteger(zoom, 10, REMOTE_MAX_DETAIL_ZOOM);
      return current[cityId] === nextZoom ? current : { ...current, [cityId]: nextZoom };
    });
  }, []);

  const handleSemanticLayerLoadingChange = useCallback((cityId: CityId, loading: boolean) => {
    setSemanticLayerLoadingByCity((current) => (current[cityId] === loading ? current : { ...current, [cityId]: loading }));
  }, []);

  const handleForceMaxDetailChange = useCallback((enabled: boolean, reason: "user" | "scale_limit" = "user") => {
    setForceMaxDetail(enabled);
    if (!enabled && reason === "scale_limit") {
      setMaxDetailAutoCancelled(true);
      window.setTimeout(() => setMaxDetailAutoCancelled(false), 650);
    }
  }, []);

  return (
    <div
      className={`map-shell${draggingCitySplit ? " is-city-dragging" : ""}${semanticLayerOverlayActive ? " is-refreshing-layers" : ""}${
        allLayersHidden ? " is-all-layers-hidden" : ""
      }`}
      data-tour-target="map"
    >
      <MobileMapSearch disabled={promptDisabled} liveSearchAvailable={liveSearchAvailable} onCreatePrompt={onCreatePrompt} />
      <div className="map-toolbar">
        <div>
          <span>Semantic Map</span>
          <strong>{title}</strong>
        </div>
        <div className="mobile-city-switch" aria-label="Available cities" role="group">
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              className={city.id === mobileCityId ? "is-active" : ""}
              aria-pressed={city.id === mobileCityId}
              onClick={() => setMobileCityId(city.id)}
            >
              {city.name}
            </button>
          ))}
        </div>
        <div className="city-toggle-group city-source-selectors">
          <span>Map sources</span>
          <div>
            {desktopCities.map((city, slot) => (
              <label className="city-toggle" key={`${slot}-${city.id}`}>
                <span>{slot === 0 ? "Left" : "Right"}</span>
                <select value={city.id} onChange={(event) => selectCitySlot(slot, event.target.value)}>
                  {cities.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        <label className="basemap-select">
          <span>Basemap</span>
          <select value={basemapId} onChange={(event) => onBasemapChange(event.target.value as BasemapId)}>
            {BASEMAPS.map((basemap) => (
              <option key={basemap.id} value={basemap.id}>
                {basemap.name}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`map-detail-toggle${maxDetailAutoCancelled ? " is-auto-cancelled" : ""}`}
          title="Max detail loads high-resolution semantic tiles. On phones it is limited to a 1 km scale to avoid crashes."
        >
          <input type="checkbox" checked={forceMaxDetail} onChange={(event) => handleForceMaxDetailChange(event.target.checked)} />
          <span title="when enabled, map render time might be significantly delayed if viewing a large region">Max detail</span>
        </label>
        <div className="map-status">{statusLabel}</div>
      </div>

      <div
        className={`city-map-layout${activeCities.length === 2 ? " has-two-cities" : ""}`}
        style={{ "--city-split": `${citySplit}%` } as CSSProperties}
      >
        {activeCities.map((city, index) => (
          <CityMapPane
            key={city.id}
            city={city}
            layers={layers}
            gradients={gradients}
            basemapId={basemapId}
            selectedLayerId={selectedLayerId}
            onSelectLayer={onSelectLayer}
            onPriorityTileChange={onPriorityTileChange ? (tile) => onPriorityTileChange(city.id, tile) : undefined}
            markedPanos={markedPanos}
            selectedPanoKey={selectedPanoKey}
            onMarkPano={onMarkPano}
            onSelectPano={onSelectPano}
            forceMaxDetail={forceMaxDetail}
            onForceMaxDetailChange={handleForceMaxDetailChange}
            sharedGroundScale={sharedGroundScale}
            onSharedGroundScaleChange={setSharedGroundScale}
            sharedRemoteTileZoom={sharedRemoteTileZoom}
            onRemoteTileZoomChange={(zoom) => handleCityRemoteTileZoomChange(city.id, zoom)}
            onSemanticLayerLoadingChange={handleSemanticLayerLoadingChange}
            splitIndex={index}
            compactControls={compactViewport}
          />
        ))}
        {activeCities.length === 2 ? (
          <div className="city-split-resizer" onPointerDown={startCitySplitDrag} title="Resize city maps" aria-label="Resize city maps" />
        ) : null}
      </div>

      <MapProgressOverlay entries={progressEntries} />
      <MapRefreshOverlay active={semanticLayerOverlayActive} />
      <AllLayersHiddenOverlay active={allLayersHidden} />
      <StreetViewPanel
        panos={markedPanos}
        selectedPanoKey={selectedPanoKey}
        scoreField={scoreField}
        onSelectPano={onSelectPano}
        onRemovePano={onRemovePano}
      />
    </div>
  );
});

type CityMapPaneProps = {
  city: CityConfig;
  layers: SemanticLayer[];
  gradients: GradientPreset[];
  basemapId: BasemapId;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onPriorityTileChange?: (tile: TileCoord | null) => void;
  markedPanos: MarkedPano[];
  selectedPanoKey: string | null;
  onMarkPano: (pano: PanoMapPoint) => void;
  onSelectPano: (panoKey: string) => void;
  forceMaxDetail: boolean;
  onForceMaxDetailChange: (enabled: boolean, reason?: "user" | "scale_limit") => void;
  sharedGroundScale: number;
  onSharedGroundScaleChange: (scale: number) => void;
  sharedRemoteTileZoom: number;
  onRemoteTileZoomChange: (zoom: number) => void;
  onSemanticLayerLoadingChange: (cityId: CityId, loading: boolean) => void;
  splitIndex: number;
  compactControls: boolean;
};

function MobileMapSearch({
  disabled,
  liveSearchAvailable,
  onCreatePrompt
}: {
  disabled: boolean;
  liveSearchAvailable: boolean;
  onCreatePrompt?: (prompt: string) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [contactCopied, setContactCopied] = useState(false);

  useEffect(() => {
    if (!liveSearchAvailable) return;
    const timer = window.setInterval(() => {
      setPlaceholderIndex((index) => (index + 1) % MOBILE_SEARCH_PLACEHOLDERS.length);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [liveSearchAvailable]);

  async function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || disabled || !liveSearchAvailable || submitting || !onCreatePrompt) return;
    setSubmitting(true);
    try {
      await onCreatePrompt(trimmed);
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyContactEmail() {
    await copyStaticDeploymentContactEmail();
    setContactCopied(true);
    window.setTimeout(() => setContactCopied(false), 1400);
  }

  return (
    <form
      className={`mobile-map-search${liveSearchAvailable ? "" : " is-static-unavailable"}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Search size={17} />
      {liveSearchAvailable ? (
        <input
          value={prompt}
          placeholder={MOBILE_SEARCH_PLACEHOLDERS[placeholderIndex]}
          aria-label="Search semantic prompt"
          disabled={disabled}
          onChange={(event) => setPrompt(event.target.value)}
        />
      ) : (
        <div className="mobile-static-search-message" aria-label={STATIC_SEARCH_PLACEHOLDER}>
          <div className="mobile-static-search-message-track">
            <span>{STATIC_SEARCH_PLACEHOLDER}</span>
            <span aria-hidden="true">{STATIC_SEARCH_PLACEHOLDER}</span>
          </div>
        </div>
      )}
      <button
        type={liveSearchAvailable ? "submit" : "button"}
        className={liveSearchAvailable ? "" : contactCopied ? "is-copied" : "is-contact-copy"}
        disabled={liveSearchAvailable ? disabled || submitting || !prompt.trim() || !onCreatePrompt : false}
        title={liveSearchAvailable ? "Create layer" : "Copy author email"}
        aria-label={liveSearchAvailable ? "Create layer" : "Copy author email"}
        onClick={liveSearchAvailable ? undefined : () => void copyContactEmail()}
      >
        {liveSearchAvailable ? <SendHorizontal size={17} /> : contactCopied ? <Check size={17} /> : <Copy size={17} />}
      </button>
    </form>
  );
}

function CityMapPane({
  city,
  layers,
  gradients,
  basemapId,
  selectedLayerId,
  onSelectLayer,
  onPriorityTileChange,
  markedPanos,
  selectedPanoKey,
  onMarkPano,
  onSelectPano,
  forceMaxDetail,
  onForceMaxDetailChange,
  sharedGroundScale,
  onSharedGroundScaleChange,
  sharedRemoteTileZoom,
  onRemoteTileZoomChange,
  onSemanticLayerLoadingChange,
  splitIndex,
  compactControls
}: CityMapPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const basemapRef = useRef<BasemapId>(basemapId);
  const forceMaxDetailRef = useRef(forceMaxDetail);
  const forceMaxDetailChangeRef = useRef(onForceMaxDetailChange);
  const sharedGroundScaleRef = useRef(sharedGroundScale);
  const sharedRemoteTileZoomRef = useRef(sharedRemoteTileZoom);
  const priorityTileChangeRef = useRef(onPriorityTileChange);
  const remoteTileZoomChangeRef = useRef(onRemoteTileZoomChange);
  const selectLayerRef = useRef(onSelectLayer);
  const markPanoRef = useRef(onMarkPano);
  const selectPanoRef = useRef(onSelectPano);
  const panoMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const styleGenerationRef = useRef(0);
  const drawnLayerIds = useRef<Set<string>>(new Set());
  const handlerCleanups = useRef<Map<string, Array<() => void>>>(new Map());
  const geojsonCache = useRef<Map<string, FeatureCollection>>(new Map());
  const remoteTileCache = useRef<Map<string, FeatureCollection>>(new Map());
  const layersRef = useRef(layers);
  const gradientsRef = useRef(gradients);
  const applyingScaleSyncRef = useRef(false);
  const semanticRedrawTimerRef = useRef<number | undefined>(undefined);
  const [redrawRequest, setRedrawRequest] = useState({ generation: 0, nonce: 0 });
  const [status, setStatus] = useState("Loading map");
  const [showMaxDetailWarning, setShowMaxDetailWarning] = useState(false);
  const selectedLayerName = layers.find((layer) => layer.id === selectedLayerId)?.name ?? "No layer selected";
  const semanticDrawKey = useMemo(() => semanticLayerDrawKey(layers, gradients, city.id), [city.id, gradients, layers]);
  layersRef.current = layers;
  gradientsRef.current = gradients;

  function clearSemanticLayers(map: MapLibreMap) {
    for (const layerId of drawnLayerIds.current) {
      handlerCleanups.current.get(layerId)?.forEach((cleanup) => cleanup());
      handlerCleanups.current.delete(layerId);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(layerId)) map.removeSource(layerId);
    }
    drawnLayerIds.current.clear();
  }

  function requestSemanticRedraw(generation: number, message?: string) {
    if (styleGenerationRef.current !== generation) return;
    if (message) setStatus(message);
    if (semanticRedrawTimerRef.current !== undefined) {
      window.clearTimeout(semanticRedrawTimerRef.current);
      semanticRedrawTimerRef.current = undefined;
    }
    setRedrawRequest((current) => ({
      generation,
      nonce: current.nonce + 1
    }));
  }

  function scheduleSemanticRedraw(generation: number, delayMs = 160) {
    if (styleGenerationRef.current !== generation) return;
    if (semanticRedrawTimerRef.current !== undefined) {
      window.clearTimeout(semanticRedrawTimerRef.current);
    }
    semanticRedrawTimerRef.current = window.setTimeout(() => {
      semanticRedrawTimerRef.current = undefined;
      requestSemanticRedraw(generation);
    }, delayMs);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialBasemap = basemapById(basemapId);
    const generation = styleGenerationRef.current + 1;
    styleGenerationRef.current = generation;
    basemapRef.current = initialBasemap.id;

    const mapOptions = {
      container: containerRef.current,
      style: basemapStyle(initialBasemap),
      center: city.center,
      zoom: compactControls ? zoomForScaleBarMeters(DEFAULT_SCALE_BAR_METERS, city.center[1]) : zoomForGroundScale(sharedGroundScaleRef.current, city.center[1]),
      minZoom: 2,
      maxZoom: 18
    };

    const map = new maplibregl.Map(mapOptions);

    if (!compactControls) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    }
    map.addControl(new maplibregl.ScaleControl({ maxWidth: SCALE_CONTROL_MAX_WIDTH, unit: "metric" }), "bottom-right");
    const detachDiagnostics = attachMapDiagnostics(map, {
      cityId: city.id,
      container: containerRef.current
    });
    map.on("load", () => {
      reportRemoteTileZoom(map, forceMaxDetailRef.current, remoteTileZoomChangeRef.current);
      reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
      requestSemanticRedraw(generation, `${city.name} ${initialBasemap.name} ready`);
    });
    map.on("error", (event) => setStatus(event.error?.message ?? "Map error"));
    mapRef.current = map;
    requestSemanticRedraw(generation, `Loading ${city.name}`);
    reportRemoteTileZoom(map, forceMaxDetailRef.current, remoteTileZoomChangeRef.current);
    reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);

    return () => {
      if (semanticRedrawTimerRef.current !== undefined) {
        window.clearTimeout(semanticRedrawTimerRef.current);
        semanticRedrawTimerRef.current = undefined;
      }
      detachDiagnostics();
      map.remove();
      mapRef.current = null;
    };
  }, [city.center, city.datasetId, city.id, city.name, compactControls]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(() => {
      map.resize();
      scheduleSemanticRedraw(styleGenerationRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    forceMaxDetailRef.current = forceMaxDetail;
    const map = mapRef.current;
    if (!map) return;
    remoteTileCache.current.clear();
    geojsonCache.current.clear();
    if (compactControls && forceMaxDetail && zoomToScaleBarIfNeeded(map, MAX_DETAIL_MIN_SCALE_BAR_METERS)) {
      reportRemoteTileZoom(map, forceMaxDetail, remoteTileZoomChangeRef.current);
      reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
      return;
    }
    reportRemoteTileZoom(map, forceMaxDetail, remoteTileZoomChangeRef.current);
    reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
    requestSemanticRedraw(styleGenerationRef.current);
  }, [city.datasetId, compactControls, forceMaxDetail]);

  useEffect(() => {
    forceMaxDetailChangeRef.current = onForceMaxDetailChange;
  }, [onForceMaxDetailChange]);

  useEffect(() => {
    priorityTileChangeRef.current = onPriorityTileChange;
    const map = mapRef.current;
    if (map) reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
  }, [onPriorityTileChange]);

  useEffect(() => {
    remoteTileZoomChangeRef.current = onRemoteTileZoomChange;
  }, [onRemoteTileZoomChange]);

  useEffect(() => {
    sharedRemoteTileZoomRef.current = sharedRemoteTileZoom;
    const map = mapRef.current;
    if (!map) return;
    reportPriorityTile(map, city.datasetId, sharedRemoteTileZoom, priorityTileChangeRef.current);
    scheduleSemanticRedraw(styleGenerationRef.current);
  }, [sharedRemoteTileZoom]);

  useEffect(() => {
    selectLayerRef.current = onSelectLayer;
  }, [onSelectLayer]);

  useEffect(() => {
    markPanoRef.current = onMarkPano;
  }, [onMarkPano]);

  useEffect(() => {
    selectPanoRef.current = onSelectPano;
  }, [onSelectPano]);

  useEffect(() => () => onSemanticLayerLoadingChange(city.id, false), [city.id, onSemanticLayerLoadingChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cityPanos = markedPanos.filter((pano) => panoBelongsToCity(pano, city));
    const currentKeys = new Set(cityPanos.map((pano) => panoKey(pano)));
    for (const [key, marker] of panoMarkersRef.current) {
      if (!currentKeys.has(key)) {
        marker.remove();
        panoMarkersRef.current.delete(key);
      }
    }

    for (const pano of cityPanos) {
      const key = panoKey(pano);
      let marker = panoMarkersRef.current.get(key);
      if (!marker) {
        const element = document.createElement("button");
        element.type = "button";
        element.classList.add("pano-map-marker");
        element.title = `Pano ${pano.pano_id}`;
        element.addEventListener("click", (event) => {
          event.stopPropagation();
          selectPanoRef.current(key);
        });
        marker = new maplibregl.Marker({ element, anchor: "center" }).setLngLat([pano.lon, pano.lat]).addTo(map);
        panoMarkersRef.current.set(key, marker);
      } else {
        marker.setLngLat([pano.lon, pano.lat]);
      }
      const element = marker.getElement();
      element.classList.add("pano-map-marker");
      element.classList.toggle("is-selected", key === selectedPanoKey);
      element.classList.toggle("is-failed", pano.status === "failed");
      element.classList.toggle("is-loading", pano.status === "loading");
    }
  }, [city, markedPanos, selectedPanoKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPanoKey) return;
    const selected = markedPanos.find((pano) => panoKey(pano) === selectedPanoKey && panoBelongsToCity(pano, city));
    if (!selected) return;
    if (!map.getBounds().contains([selected.lon, selected.lat])) {
      map.easeTo({
        center: [selected.lon, selected.lat],
        duration: 500,
        essential: true
      });
    }
  }, [city, markedPanos, selectedPanoKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || basemapRef.current === basemapId) return;

    const nextBasemap = basemapById(basemapId);
    const generation = styleGenerationRef.current + 1;
    styleGenerationRef.current = generation;
    basemapRef.current = nextBasemap.id;
    setStatus(`Loading ${nextBasemap.name}`);
    clearSemanticLayers(map);

    const onStyleReady = () => {
      requestSemanticRedraw(generation, `${city.name} ${nextBasemap.name} ready`);
    };

    map.once("style.load", onStyleReady);
    map.once("idle", onStyleReady);
    map.setStyle(basemapStyle(nextBasemap));
    requestSemanticRedraw(generation);

    return () => {
      map.off("style.load", onStyleReady);
      map.off("idle", onStyleReady);
    };
  }, [basemapId, city.name]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onViewportSettled = () => {
      if (compactControls && forceMaxDetailRef.current && isScaleBarPastLimit(map, MAX_DETAIL_MIN_SCALE_BAR_METERS)) {
        forceMaxDetailChangeRef.current(false, "scale_limit");
        return;
      }
      if (!applyingScaleSyncRef.current) {
        const nextScale = groundScaleForZoom(map.getZoom(), map.getCenter().lat);
        sharedGroundScaleRef.current = nextScale;
        onSharedGroundScaleChange(nextScale);
      }
      reportRemoteTileZoom(map, forceMaxDetailRef.current, remoteTileZoomChangeRef.current);
      reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
      scheduleSemanticRedraw(styleGenerationRef.current);
    };
    map.on("zoomend", onViewportSettled);
    map.on("moveend", onViewportSettled);
    return () => {
      map.off("zoomend", onViewportSettled);
      map.off("moveend", onViewportSettled);
    };
  }, [compactControls, onSharedGroundScaleChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    sharedGroundScaleRef.current = sharedGroundScale;
    const nextZoom = zoomForGroundScale(sharedGroundScale, map.getCenter().lat);
    if (Math.abs(map.getZoom() - nextZoom) < 0.01) return;
    applyingScaleSyncRef.current = true;
    map.jumpTo({ zoom: nextZoom });
    window.setTimeout(() => {
      applyingScaleSyncRef.current = false;
      reportRemoteTileZoom(map, forceMaxDetailRef.current, remoteTileZoomChangeRef.current);
      reportPriorityTile(map, city.datasetId, sharedRemoteTileZoomRef.current, priorityTileChangeRef.current);
      scheduleSemanticRedraw(styleGenerationRef.current);
    }, 0);
  }, [sharedGroundScale]);

  useEffect(() => {
    const map = mapRef.current;
    const generation = redrawRequest.generation;
    if (!map || generation === 0 || generation !== styleGenerationRef.current) return;

    const currentMap = map;
    let cancelled = false;
    let retryTimer: number | undefined;
    let maxDetailWarningTimer: number | undefined;
    let loadingReported = false;

    const reportSemanticLoading = (loading: boolean) => {
      if (loadingReported === loading) return;
      loadingReported = loading;
      onSemanticLayerLoadingChange(city.id, loading);
    };

    async function draw(attempt = 0) {
      if (cancelled || generation !== styleGenerationRef.current) return;

      try {
        const currentLayers = layersRef.current;
        const currentGradients = gradientsRef.current;
        const visibleTopToBottom = currentLayers.filter((layer) => layer.visible);
        if (!visibleTopToBottom.length) {
          clearSemanticLayers(currentMap);
          setStatus(`0 rendered / 0 visible / ${currentLayers.length} total`);
          reportSemanticLoading(false);
          return;
        }
        reportSemanticLoading(true);

        if (forceMaxDetailRef.current && maxDetailWarningTimer === undefined) {
          setShowMaxDetailWarning(false);
          maxDetailWarningTimer = window.setTimeout(() => {
            if (!cancelled && generation === styleGenerationRef.current && forceMaxDetailRef.current) {
              setShowMaxDetailWarning(true);
            }
          }, 1200);
        }

        if (!currentMap.getStyle()?.layers) {
          throw new Error("Map style is not ready");
        }

        clearSemanticLayers(currentMap);

        const renderableTopToBottom = renderableSemanticLayers(visibleTopToBottom);
        const layersToDraw = renderableTopToBottom.slice().reverse();
        let displayedContent = false;
        for (const layer of layersToDraw) {
          const geojson = await loadLayerGeojsonForMap(
            layer,
            currentMap,
            geojsonCache.current,
            remoteTileCache.current,
            forceMaxDetailRef.current,
            sharedRemoteTileZoomRef.current,
            city.id
          );
          if (cancelled || generation !== styleGenerationRef.current) return;

          const sourceId = sourceIdForCityLayer(city.id, layer.id);
          const gradient = layerGradient(layer, currentGradients);
          if (currentMap.getLayer(sourceId)) currentMap.removeLayer(sourceId);
          if (currentMap.getSource(sourceId)) currentMap.removeSource(sourceId);
          currentMap.addSource(sourceId, { type: "geojson", data: geojson });
          currentMap.addLayer({
            id: sourceId,
            type: "circle",
            source: sourceId,
            paint: {
              "circle-radius": circleRadiusExpression(layer),
              "circle-color": gradient ? colorExpression(gradient, layer) : "#2f80ed",
              "circle-opacity": layer.style.opacity,
              "circle-pitch-scale": layer.style.absolute_radius ? "map" : "viewport",
              "circle-stroke-width": 0,
              "circle-stroke-opacity": 0
            }
          });

          const onMouseEnter = () => {
            currentMap.getCanvas().style.cursor = "pointer";
          };
          const onMouseLeave = () => {
            currentMap.getCanvas().style.cursor = "";
          };
          const onClick = (event: MapLayerMouseEvent) => {
            selectLayerRef.current(layer.id);
            const feature = event.features?.[0];
            if (!feature) return;
            const props = feature.properties ?? {};
            const pano = panoPointFromFeature(feature, event, layer, city);
            if (pano) {
              markPanoRef.current(pano);
              void collectPanoLayerValues(
                pano.pano_id,
                pano.dataset_id ?? city.datasetId,
                pano.lon,
                pano.lat,
                layersRef.current,
                currentMap,
                geojsonCache.current,
                remoteTileCache.current,
                forceMaxDetailRef.current,
                sharedRemoteTileZoomRef.current,
                city.id
              ).then((layerValues) => {
                if (!cancelled && layerValues.length) {
                  markPanoRef.current({ ...pano, layer_values: layerValues });
                }
              });
            }
            const score = Number(props.score);
            const zscore = Number(props.zscore);
            new maplibregl.Popup({ closeButton: true, closeOnClick: true })
              .setLngLat(pano ? [pano.lon, pano.lat] : event.lngLat)
              .setHTML(
                `<div class="popup-title">${layer.name}</div>
                 <div class="popup-row"><span>ID</span><span>${props.id ?? ""}</span></div>
                 <div class="popup-row"><span>score</span><span>${Number.isFinite(score) ? score.toFixed(4) : ""}</span></div>
                 <div class="popup-row"><span>zscore</span><span>${Number.isFinite(zscore) ? zscore.toFixed(3) : ""}</span></div>`
              )
              .addTo(currentMap);
          };

          currentMap.on("mouseenter", sourceId, onMouseEnter);
          currentMap.on("mouseleave", sourceId, onMouseLeave);
          currentMap.on("click", sourceId, onClick);
          handlerCleanups.current.set(sourceId, [
            () => currentMap.off("mouseenter", sourceId, onMouseEnter),
            () => currentMap.off("mouseleave", sourceId, onMouseLeave),
            () => currentMap.off("click", sourceId, onClick)
          ]);

          drawnLayerIds.current.add(sourceId);
          if (!displayedContent && geojson.features.length) {
            displayedContent = true;
            reportSemanticLoading(false);
          }
        }

        const missingLayer = layersToDraw.some((layer) => !currentMap.getLayer(sourceIdForCityLayer(city.id, layer.id)));
        if (missingLayer) {
          throw new Error("Semantic layers were not attached");
        }

        if (!cancelled && generation === styleGenerationRef.current) {
          if (maxDetailWarningTimer !== undefined) {
            window.clearTimeout(maxDetailWarningTimer);
            maxDetailWarningTimer = undefined;
          }
          setShowMaxDetailWarning(false);
          setStatus(`${layersToDraw.length} rendered / ${visibleTopToBottom.length} visible / ${currentLayers.length} total`);
          if (!displayedContent && layersToDraw.some((layer) => isLayerWaitingForRemoteData(layer, city.id))) {
            setStatus(`Waiting for semantic layer data`);
          } else {
            reportSemanticLoading(false);
          }
        }
      } catch (error) {
        if (cancelled || generation !== styleGenerationRef.current) return;
        if (attempt < 80) {
          if (attempt === 0) setStatus(`Restoring semantic layers`);
          retryTimer = window.setTimeout(() => {
            void draw(attempt + 1);
          }, 100);
          return;
        }
        if (maxDetailWarningTimer !== undefined) {
          window.clearTimeout(maxDetailWarningTimer);
          maxDetailWarningTimer = undefined;
        }
        setShowMaxDetailWarning(false);
        setStatus(error instanceof Error ? error.message : "Layer draw failed");
        reportSemanticLoading(false);
      }
    }

    void draw();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (maxDetailWarningTimer !== undefined) window.clearTimeout(maxDetailWarningTimer);
      setShowMaxDetailWarning(false);
      reportSemanticLoading(false);
    };
  }, [city.id, redrawRequest, semanticDrawKey, onSemanticLayerLoadingChange]);

  return (
    <section className={`city-map-pane city-map-pane-${city.id}`} data-split-index={splitIndex}>
      <div ref={containerRef} className="map-container" />
      <div className="city-map-label">
        <span>{city.name}</span>
        <strong>{selectedLayerName}</strong>
        <small>{status}</small>
      </div>
      {showMaxDetailWarning ? (
        <div className="map-max-detail-warning">When max detailed is enable, map render time might be significantly delayed when viewing a large area</div>
      ) : null}
    </section>
  );
}

function MapRefreshOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="map-refresh-overlay" role="status" aria-live="polite">
      <span className="map-refresh-spinner" aria-hidden="true" />
      <span>Updating semantic layers...</span>
    </div>
  );
}

function AllLayersHiddenOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="map-hidden-layers-overlay" role="status" aria-live="polite">
      <span>All semantic layers are hidden. Turn on an eye icon to display the map data.</span>
    </div>
  );
}

function MapProgressOverlay({ entries }: { entries: RemoteLogEntry[] }) {
  if (!entries.length) return null;

  return (
    <div className="map-progress-overlay" role="status" aria-live="polite">
      <div className="map-progress-title">
        <span>RunPod progress</span>
        <strong>{entries.length} active</strong>
      </div>
      <div className="map-progress-list">
        {entries.map((entry) => {
          const percent = Math.max(0, Math.min(100, Math.round((entry.progress ?? 0) * 100)));
          return (
            <div className={`map-progress-card is-${entry.status}`} key={entry.job_id || entry.id}>
              <div className="map-progress-card-top">
                <strong>{entry.current_stage || entry.status}</strong>
                <span>{percent}%</span>
              </div>
              <div className="map-progress-prompt">{entry.prompt || "Remote prompt"}</div>
              <div className="map-progress-bar" aria-hidden="true">
                <div className="map-progress-bar-fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="map-progress-detail">
                <span>{entry.message}</span>
                {entry.current_tile ? <span>tile {entry.current_tile.z}/{entry.current_tile.x}/{entry.current_tile.y}</span> : null}
                {entry.tiles_total ? <span>{entry.tiles_done ?? 0}/{entry.tiles_total} tiles</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function panoPointFromFeature(feature: GeoJSON.Feature, event: MapLayerMouseEvent, layer: SemanticLayer, city: CityConfig): PanoMapPoint | null {
  const props = feature.properties ?? {};
  const rawId = props.pano_id ?? props.id;
  if (rawId === undefined || rawId === null) return null;
  const panoId = String(rawId);
  if (!/^\d+$/.test(panoId)) return null;

  let lon = event.lngLat.lng;
  let lat = event.lngLat.lat;
  if (feature.geometry.type === "Point") {
    const coordinates = feature.geometry.coordinates;
    if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
      lon = coordinates[0];
      lat = coordinates[1];
    }
  }

  const score = Number(props.score);
  const zscore = Number(props.zscore);
  const datasetId = typeof props.dataset_id === "string" && props.dataset_id ? props.dataset_id : city.datasetId;
  const explicitPanoDatasetId = typeof props.pano_dataset_id === "string" ? props.pano_dataset_id.trim() : "";
  const panoDatasetId = explicitPanoDatasetId || panoDatasetIdForPoint(datasetId, lon, lat);
  return {
    pano_id: panoId,
    pano_key: panoPointKey(panoDatasetId, panoId, lon, lat),
    dataset_id: datasetId,
    pano_dataset_id: panoDatasetId,
    city_id: city.id,
    lon,
    lat,
    date: typeof props.date === "string" || typeof props.date === "number" ? props.date : null,
    source_layer_id: layer.id,
    source_layer_name: layer.name,
    score: Number.isFinite(score) ? score : null,
    zscore: Number.isFinite(zscore) ? zscore : null
  };
}

async function collectPanoLayerValues(
  panoId: string,
  datasetId: string,
  panoLon: number,
  panoLat: number,
  layers: SemanticLayer[],
  map: MapLibreMap,
  layerCache: Map<string, FeatureCollection>,
  remoteTileCache: Map<string, FeatureCollection>,
  forceMaxDetail: boolean,
  remoteTileZoom: number,
  cityId: CityId
): Promise<PanoLayerValue[]> {
  const values = await Promise.all(
    layers
      .filter((layer) => layer.status === "ready")
      .map(async (layer) => {
        const geojson = await loadLayerGeojsonForMap(layer, map, layerCache, remoteTileCache, forceMaxDetail, remoteTileZoom, cityId);
        const matchingFeatures = geojson.features.filter((item) => {
          const props = item.properties ?? {};
          const featureDatasetId = typeof props.dataset_id === "string" && props.dataset_id ? props.dataset_id : datasetId;
          return featureDatasetId === datasetId && String(props.pano_id ?? props.id ?? "") === panoId;
        });
        const feature = matchingFeatures.reduce<GeoJSON.Feature | null>((nearest, candidate) => {
          if (!nearest) return candidate;
          return pointFeatureDistanceSquared(candidate, panoLon, panoLat) < pointFeatureDistanceSquared(nearest, panoLon, panoLat)
            ? candidate
            : nearest;
        }, null);
        if (!feature) {
          return {
            layer_id: layer.id,
            layer_name: layer.name,
            visible: layer.visible,
            score: null,
            zscore: null,
            date: null
          };
        }

        const props = feature.properties ?? {};
        const score = Number(props.score);
        const zscore = Number(props.zscore);
        return {
          layer_id: layer.id,
          layer_name: layer.name,
          visible: layer.visible,
          score: Number.isFinite(score) ? score : null,
          zscore: Number.isFinite(zscore) ? zscore : null,
          date: typeof props.date === "string" || typeof props.date === "number" ? props.date : null
        };
      })
  );
  return values;
}

function pointFeatureDistanceSquared(feature: GeoJSON.Feature, lon: number, lat: number): number {
  if (feature.geometry.type !== "Point") return Number.POSITIVE_INFINITY;
  const coordinates = feature.geometry.coordinates;
  if (typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return Number.POSITIVE_INFINITY;
  return (coordinates[0] - lon) ** 2 + (coordinates[1] - lat) ** 2;
}

async function loadLayerGeojsonForMap(
  layer: SemanticLayer,
  map: MapLibreMap,
  layerCache: Map<string, FeatureCollection>,
  remoteTileCache: Map<string, FeatureCollection>,
  forceMaxDetail: boolean,
  remoteTileZoom: number,
  cityId: CityId
): Promise<FeatureCollection> {
  const sourcePath = getLayerSourcePath(layer, cityId);
  if (!isRemoteTileTemplate(sourcePath)) {
    const cacheKey = `${cityId}:${layer.id}:${sourcePath || "empty"}`;
    let geojson = getCachedFeatureCollection(layerCache, cacheKey);
    if (!geojson) {
      geojson = await getLayerGeojson(layer.id, cityId);
      setCachedFeatureCollection(layerCache, cacheKey, geojson, MAX_LAYER_GEOJSON_CACHE_ENTRIES);
    }
    return geojson;
  }

  const usesStaticFallback = isStaticFallbackTileTemplate(sourcePath);
  const tileZoom = usesStaticFallback ? REMOTE_MAX_DETAIL_ZOOM : remoteTileZoom;
  const tiles = filterStaticFallbackTiles(cityId, visibleRemoteTiles(map, tileZoom, forceMaxDetail || usesStaticFallback), usesStaticFallback);
  const combinedKey = `${cityId}:${layer.id}:${sourcePath}:${tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`).join("|")}`;
  const cached = getCachedFeatureCollection(layerCache, combinedKey);
  if (cached) return cached;
  if (!tiles.length) return emptyFeatureCollection();

  let collections: FeatureCollection[];
  try {
    collections = await Promise.all(
      tiles.map(async (tile) => {
        const tileUrlKey = `${cityId}:${sourcePath}:${tile.z}/${tile.x}/${tile.y}`;
        const cachedTile = getCachedFeatureCollection(remoteTileCache, tileUrlKey);
        if (cachedTile) return cachedTile;
        const geojson = await getRemoteTileGeojson(sourcePath, tile.z, tile.x, tile.y);
        setCachedFeatureCollection(remoteTileCache, tileUrlKey, geojson, MAX_REMOTE_TILE_CACHE_ENTRIES);
        return geojson;
      })
    );
  } catch {
    return getLayerFallbackGeojson(layer.id, cityId);
  }
  const merged = mergeFeatureCollections(collections);
  setCachedFeatureCollection(layerCache, combinedKey, merged, MAX_LAYER_GEOJSON_CACHE_ENTRIES);
  return merged;
}

function getCachedFeatureCollection(cache: Map<string, FeatureCollection>, key: string): FeatureCollection | undefined {
  const value = cache.get(key);
  if (!value) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function setCachedFeatureCollection(cache: Map<string, FeatureCollection>, key: string, value: FeatureCollection, maxEntries: number) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function visibleRemoteTiles(map: MapLibreMap, remoteTileZoom: number, forceMaxDetail = false): Array<{ z: number; x: number; y: number }> {
  const bounds = map.getBounds();
  const z = clampInteger(remoteTileZoom, 10, REMOTE_MAX_DETAIL_ZOOM);
  return tilesForBounds(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(), z);
}

function filterStaticFallbackTiles(cityId: CityId, tiles: Array<{ z: number; x: number; y: number }>, active: boolean): Array<{ z: number; x: number; y: number }> {
  if (!active) return tiles;
  const range = STATIC_FALLBACK_TILE_RANGES[cityId];
  if (!range) return [];
  return tiles.filter((tile) => tile.z === range.z && tile.x >= range.minX && tile.x <= range.maxX && tile.y >= range.minY && tile.y <= range.maxY);
}

function emptyFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: []
  } as FeatureCollection;
}

function remoteTileZoomForMap(map: MapLibreMap, forceMaxDetail: boolean): number {
  return forceMaxDetail ? REMOTE_MAX_DETAIL_ZOOM : clampInteger(Math.floor(map.getZoom()), 10, REMOTE_MAX_DETAIL_ZOOM);
}

function reportRemoteTileZoom(map: MapLibreMap, forceMaxDetail: boolean, onRemoteTileZoomChange?: (zoom: number) => void) {
  if (!onRemoteTileZoomChange) return;
  onRemoteTileZoomChange(remoteTileZoomForMap(map, forceMaxDetail));
}

function reportPriorityTile(map: MapLibreMap, datasetId: string, remoteTileZoom: number, onPriorityTileChange?: (tile: TileCoord | null) => void) {
  if (!onPriorityTileChange) return;
  const center = map.getCenter();
  const z = clampInteger(remoteTileZoom, 10, REMOTE_MAX_DETAIL_ZOOM);
  const tile = lonLatToTile(center.lat, center.lng, z);
  onPriorityTileChange({ z, x: tile.x, y: tile.y, dataset_id: datasetId });
}

function tilesForBounds(west: number, south: number, east: number, north: number, z: number): Array<{ z: number; x: number; y: number }> {
  const northWest = lonLatToTile(north, west, z);
  const southEast = lonLatToTile(south, east, z);
  const minX = Math.min(northWest.x, southEast.x);
  const maxX = Math.max(northWest.x, southEast.x);
  const minY = Math.min(northWest.y, southEast.y);
  const maxY = Math.max(northWest.y, southEast.y);
  const tiles = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

function lonLatToTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const wrappedLon = ((lon + 180) % 360) - 180;
  const latRad = (clampedLat * Math.PI) / 180;
  const n = 2 ** z;
  return {
    x: clampInteger(Math.floor(((wrappedLon + 180) / 360) * n), 0, n - 1),
    y: clampInteger(Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n), 0, n - 1)
  };
}

function groundScaleForZoom(zoom: number, lat: number): number {
  return 2 ** zoom / latitudeCos(lat);
}

function zoomForGroundScale(scale: number, lat: number): number {
  const scaledWorld = scale * latitudeCos(lat);
  if (!Number.isFinite(scaledWorld) || scaledWorld <= 0) return DEFAULT_CITY_CONFIGS[0].initialZoom;
  return clampNumber(Math.log(scaledWorld) / Math.LN2, 2, 18);
}

function zoomForScaleBarMeters(targetMeters: number, lat: number): number {
  const targetMaxDistance = targetMeters * 1.1;
  const metersPerPixel = targetMaxDistance / SCALE_CONTROL_MAX_WIDTH;
  // MapLibre zoom 0 uses a 512 px world, so this is half the common 256 px Web Mercator constant.
  const worldMetersAtLat = MAPLIBRE_METERS_PER_PIXEL_ZOOM0 * latitudeCos(lat);
  return clampNumber(Math.log2(worldMetersAtLat / metersPerPixel), 2, 18);
}

function isScaleBarPastLimit(map: MapLibreMap, limitMeters: number): boolean {
  const minZoom = zoomForScaleBarMeters(limitMeters, map.getCenter().lat);
  return map.getZoom() < minZoom - 0.02;
}

function zoomToScaleBarIfNeeded(map: MapLibreMap, limitMeters: number): boolean {
  const minZoom = zoomForScaleBarMeters(limitMeters, map.getCenter().lat);
  if (map.getZoom() >= minZoom - 0.02) return false;
  map.easeTo({
    zoom: minZoom,
    duration: 420,
    essential: true
  });
  return true;
}

function latitudeCos(lat: number): number {
  const clampedLat = clampNumber(lat, -85.05112878, 85.05112878);
  return Math.max(0.001, Math.cos((clampedLat * Math.PI) / 180));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function renderableSemanticLayers(topToBottom: SemanticLayer[]): SemanticLayer[] {
  const renderable: SemanticLayer[] = [];
  let largestRadiusAbove = -Infinity;

  for (const layer of topToBottom) {
    const radius = Number(layer.style.point_radius ?? DEFAULT_POINT_RADIUS);
    const comparableRadius = Number.isFinite(radius) ? radius : DEFAULT_POINT_RADIUS;
    if (renderable.length === 0 || comparableRadius > largestRadiusAbove) {
      renderable.push(layer);
      largestRadiusAbove = Math.max(largestRadiusAbove, comparableRadius);
    }
  }

  return renderable;
}

function semanticLayerDrawKey(layers: SemanticLayer[], gradients: GradientPreset[], cityId: CityId): string {
  return renderableSemanticLayers(layers.filter((layer) => layer.visible))
    .map((layer) => {
      const style = layer.style;
      const gradient = layerGradient(layer, gradients);
      return [
        layer.id,
        layer.status,
        getLayerSourcePath(layer, cityId),
        layer.score_property,
        style.gradient_id,
        style.opacity,
        style.score_min,
        style.score_max,
        style.point_radius,
        style.absolute_radius ? 1 : 0,
        gradient?.updated_at ?? "",
        gradient?.opacity ?? "",
        gradient?.score_min ?? "",
        gradient?.score_max ?? "",
        (style.stops ?? gradient?.stops ?? []).map((stop) => `${stop.value}:${stop.color}`).join(",")
      ].join("~");
    })
    .join("|");
}

function isLayerWaitingForRemoteData(layer: SemanticLayer, cityId: CityId): boolean {
  const sourcePath = getLayerSourcePath(layer, cityId);
  return layer.status === "queued" || layer.status === "running" || sourcePath.startsWith("remote://job/") || sourcePath.startsWith("remote://pending/");
}

function normaliseCitySelection(cities: CityConfig[], current: readonly CityId[]): CityId[] {
  const available = new Set(cities.map((city) => city.id));
  const selection = current.filter((cityId, index) => available.has(cityId) && current.indexOf(cityId) === index).slice(0, 2);
  for (const city of cities) {
    if (selection.length >= 2) break;
    if (!selection.includes(city.id)) selection.push(city.id);
  }
  return selection;
}

function loadCitySelection(): CityId[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CITY_SELECTION_KEY) || "");
    if (Array.isArray(parsed)) return parsed.filter((cityId): cityId is CityId => typeof cityId === "string").slice(0, 2);

    // Migrate the old London/Shanghai checkbox record when it is present.
    const legacy = JSON.parse(window.localStorage.getItem("semantic-map-visible-cities-v1") || "") as Partial<Record<CityId, boolean>>;
    const legacySelection = Object.entries(legacy)
      .filter(([, visible]) => visible)
      .map(([cityId]) => cityId)
      .slice(0, 2);
    return legacySelection.length ? legacySelection : DEFAULT_CITY_CONFIGS.slice(0, 2).map((city) => city.id);
  } catch {
    return DEFAULT_CITY_CONFIGS.slice(0, 2).map((city) => city.id);
  }
}

function loadMobileCityId(): CityId {
  const stored = window.localStorage.getItem(MOBILE_CITY_KEY);
  return stored || DEFAULT_CITY_CONFIGS[0].id;
}

function loadCitySplit(): number {
  const raw = window.localStorage.getItem(CITY_SPLIT_KEY);
  if (raw === null) return 50;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampNumber(parsed, MIN_CITY_SPLIT, MAX_CITY_SPLIT) : 50;
}

function sourceIdForCityLayer(cityId: CityId, layerId: string): string {
  return `${cityId}__${layerId}`;
}

function panoKey(pano: Pick<MarkedPano | PanoMapPoint, "pano_id" | "pano_key" | "dataset_id" | "pano_dataset_id" | "city_id">): string {
  if (pano.pano_key) return pano.pano_key;
  const scope = pano.pano_dataset_id || pano.dataset_id || pano.city_id || "default";
  return `${scope}:${pano.pano_id}`;
}

function panoBelongsToCity(pano: MarkedPano, city: CityConfig): boolean {
  if (pano.city_id) return pano.city_id === city.id;
  if (pano.dataset_id) return pano.dataset_id === city.datasetId;
  return pano.lon >= city.bounds.west && pano.lon <= city.bounds.east && pano.lat >= city.bounds.south && pano.lat <= city.bounds.north;
}
