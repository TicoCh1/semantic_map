import { ThemedSelect } from "./ThemedSelect";
import { WorkspaceSelect, type Workspace } from "./WorkspaceSelect";
import { GlassPanel as Glass, GlassButton, GlassInput, GlassSwitch } from "@form-glass/react";
import { applyGlassSurface, observeMapGlass } from "../styles/glass";
import { attachPointShapeImages, ensurePointImage, getRequestedSemanticSourceData, normalizePointShape, POINT_ICON_HALF_SIZE, syncSemanticLayerOrder, updateSemanticLayer, updateSemanticSource } from "../state/semanticLayerRenderer";
import { createMapResizeScheduler } from "../state/mapResize";
import { MapSceneCamera, groundScaleForZoom, zoomForGroundScale, latitudeCos } from "../state/mapSceneCamera";
import { SceneResources } from "../state/sceneResources";
import { isCompleteRemoteTile, loadRemoteTileViewport, remoteRenderTiles, REMOTE_MAX_DETAIL_ZOOM, settledRemoteTileZoom, type RemoteRenderTile, type RemoteTileViewport } from "../state/remoteTileData";
import { preserveSceneStyle } from "../state/mapSceneStyle";
import { installBasemapTransport, sceneTileRequest } from "../state/basemapTransport";
import * as maplibregl from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { Map as MapLibreMap, MapMouseEvent, MapEventType } from "maplibre-gl";

import { Check, Copy, Search, SendHorizontal } from "lucide-react";
import { memo, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CityConfig, CityId, FeatureCollection, GradientPreset, MarkedPano, PanoLayerValue, PanoMapPoint, RemoteLogEntry, SemanticLayer, TileCoord } from "../api/types";
import {
  getLayerFallbackGeojson,
  getLayerGeojson,
  getLayerSourcePath,
  getRemoteTileGeojson,
  isRemoteTileTemplate,
  isStaticFallbackTileTemplate
} from "../api/client";
import { StreetViewPanel } from "./StreetViewPanel";
import { SavedPromptSearch } from "./SavedPromptSearch";
import type { RemoteBackendConfig } from "../api/types";
import { BASEMAPS, type BasemapId, basemapById, basemapStyle } from "../state/basemaps";
import { DEFAULT_POINT_RADIUS, layerGradient } from "../state/color";
import { DEFAULT_CITY_CONFIGS } from "../state/cities";
import { circleRadiusExpression, colorExpression, colorRangeForLayer } from "../state/mapStyle";
import { panoDatasetIdForPoint, panoPointKey } from "../state/panoDatasets";
import { useEmbeddingComparison } from "../state/useEmbeddingComparison";
import { attachMapDiagnostics } from "../state/mobileDiagnostics";
import { copyStaticDeploymentContactEmail, STATIC_DEPLOYMENT_CONTACT_EMAIL, STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE } from "../state/staticDeployment";

// Bundle the v6 worker and its shared module into the deployed Vite assets.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export type MapViewProps = {
  onWorkspaceChange: (workspace: Workspace) => void;
  regionHeatmaps?: {
    selector: ReactNode;
    radiusMeters?: number;
    focus?: {city: CityId};
    description?: string;
    dataProvider: LayerDataProvider;
    selectionAreas: Record<string, FeatureCollection>;
    register: (cityId: string, map: MapLibreMap) => () => void;
  };
  backendConfig?: RemoteBackendConfig | null;
  cities: CityConfig[];
  layers: SemanticLayer[];
  gradients: GradientPreset[];
  selectedLayerId: string | null;
  basemapId: BasemapId;
  attributionHost?: HTMLElement | null;
  onBasemapChange: (basemapId: BasemapId) => void;
  onSelectLayer: (layerId: string) => void;
  onPriorityTileChange?: (cityId: CityId, tile: TileCoord | null) => void;
  onVisibleCitiesChange?: (cities: CityConfig[]) => void;
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
  allowStaticTiles?: boolean;
};

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

let nextSemanticTileFrame = Promise.resolve();
const movingMaps = new Set<MapLibreMap>();

/** Share upload slots between panes so preparing two dense maps cannot run
 * all of MapLibre's worker serialization in one browser task. */
function waitForSemanticTileFrame() {
  nextSemanticTileFrame = nextSemanticTileFrame.then(() => new Promise<void>(resolve => {
    const timer = window.setTimeout(() => { window.cancelAnimationFrame(frame); resolve(); }, 50);
    const frame = window.requestAnimationFrame(() => { window.clearTimeout(timer); resolve(); });
  }));
  return nextSemanticTileFrame;
}

function isCompactMapViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches;
}

export const MapView = memo(function MapView({
  regionHeatmaps,
  onWorkspaceChange,
  cities,
  layers,
  gradients,
  selectedLayerId,
  basemapId,
  attributionHost,
  onBasemapChange,
  onSelectLayer,
  onPriorityTileChange,
  onVisibleCitiesChange,
  markedPanos,
  selectedPanoKey,
  onMarkPano,
  onSelectPano,
  onRemovePano,
  scoreField,
  progressEntries,
  onCreatePrompt,
  backendConfig,
  promptDisabled = false,
  liveSearchAvailable = true,
  allowStaticTiles = true
}: MapViewProps) {
  const [citySelection, setCitySelection] = useState<CityId[]>(loadCitySelection);
  const [comparisonMode, setComparisonMode] = useState<"cities" | "embeddings" | "difference">("cities");
  const [comparisonCityId, setComparisonCityId] = useState<CityId>(citySelection[0]);
  const comparisonCities = cities.filter(city => backendConfig?.embeddingComparisonDatasetIds?.includes(city.datasetId));
  const comparisonEnabled = comparisonMode !== "cities" && !!backendConfig?.enabled && comparisonCities.length > 0;
  const differenceEnabled = comparisonEnabled && comparisonMode === "difference";
  const comparisonCity = comparisonCities.find(city => city.id === comparisonCityId) ?? comparisonCities[0];
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId);
  const comparison = useEmbeddingComparison(comparisonEnabled, backendConfig, comparisonCity, selectedLayer);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = toolbarRef.current;
    const toolbar = shell?.querySelector<HTMLElement>(".map-toolbar");
    if (!toolbar || !shell) return;
    const updateClearance = () => {
      shell.style.setProperty("--map-toolbar-clearance", `${Math.ceil(toolbar.offsetTop + toolbar.offsetHeight + 12)}px`);
    };
    const observer = new ResizeObserver(updateClearance);
    observer.observe(toolbar);
    updateClearance();
    window.addEventListener("resize", updateClearance);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateClearance); };
  }, []);

  const [mobileCityId, setMobileCityId] = useState<CityId>(loadMobileCityId);
  const focus = regionHeatmaps?.focus;
  useEffect(() => {
    if (!focus) return;
    setCitySelection(current => current[0] === focus.city ? current :
      [focus.city, current.includes(focus.city) ? current[0] : current[1]].filter(Boolean));
    setMobileCityId(focus.city);
  }, [focus]);
  const [citySplit, setCitySplit] = useState(loadCitySplit);
  const [draggingCitySplit, setDraggingCitySplit] = useState(false);
  const [compactViewport, setCompactViewport] = useState(isCompactMapViewport);
  const [forceMaxDetail, setForceMaxDetail] = useState(() => window.localStorage.getItem("semantic-map-force-max-detail") === "true");
  const [maxDetailAutoCancelled, setMaxDetailAutoCancelled] = useState(false);
  const [sharedGroundScale] = useState(() =>
    groundScaleForZoom(zoomForScaleBarMeters(DEFAULT_SCALE_BAR_METERS, cities[0]?.center[1] ?? 0), cities[0]?.center[1] ?? 0)
  );
  const sceneCamera = useMemo(() => new MapSceneCamera(sharedGroundScale), [sharedGroundScale]);
  const sceneResources = useMemo(() => new SceneResources<FeatureCollection>(272, 500_000, 8, data => data.features.length), []);
  const [semanticLayerLoadingByCity, setSemanticLayerLoadingByCity] = useState<Partial<Record<CityId, boolean>>>({});
  const desktopCities = useMemo(
    () => citySelection.map((cityId) => cities.find((city) => city.id === cityId)).filter((city): city is CityConfig => Boolean(city)),
    [cities, citySelection]
  );
  const activeCities = useMemo(() => comparisonEnabled && comparisonCity
    ? (differenceEnabled ? [comparisonCity] : [comparisonCity, comparisonCity])
    : compactViewport ? cities.filter((city) => city.id === mobileCityId) : desktopCities,
  [cities, compactViewport, comparisonCity, comparisonEnabled, desktopCities, differenceEnabled, mobileCityId]);
  const visibleLayerCount = layers.filter((layer) => layer.visible).length;
  const allLayersHidden = !comparisonEnabled && layers.length > 0 && visibleLayerCount === 0;
  const semanticLayerOverlayActive = comparison.loading || (!allLayersHidden && activeCities.length > 0 && activeCities.every((city, index) => semanticLayerLoadingByCity[comparisonEnabled ? `${city.id}:${index}` : city.id] === true));
  const displayedLayer = comparisonEnabled ? selectedLayer : layers.find(layer => layer.visible);
  const title = displayedLayer?.name ?? "No visible layers";
  const agreement = colorRangeForLayer(displayedLayer ?? null)
    .calibration?.correlations?.agreement_percent;

  useEffect(() => {
    onVisibleCitiesChange?.(comparisonEnabled ? activeCities.slice(0, 1) : activeCities);
  }, [activeCities, comparisonEnabled, onVisibleCitiesChange]);

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
    const shell = event.currentTarget.closest(".city-map-layout") as HTMLElement | null;
    if (!shell) return;
    setDraggingCitySplit(true);
    const rect = shell.getBoundingClientRect();

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const raw = ((moveEvent.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      setCitySplit(clampNumber(raw, MIN_CITY_SPLIT, MAX_CITY_SPLIT));
    };
    const onUp = () => {
      setDraggingCitySplit(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [compactViewport]);

  const handleComparisonLayerSelect = useCallback(() => {
    if (selectedLayerId) onSelectLayer(selectedLayerId);
  }, [selectedLayerId, onSelectLayer]);

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
      ref={toolbarRef}
      data-basemap={basemapId}
      className={`map-shell${differenceEnabled ? " is-difference-mode" : ""}${comparisonEnabled ? " is-embedding-comparison" : ""}${draggingCitySplit ? " is-city-dragging" : ""}${semanticLayerOverlayActive ? " is-refreshing-layers" : ""}${
        allLayersHidden ? " is-all-layers-hidden" : ""
      }`}
      data-tour-target="map"
    >
      <Glass className="map-toolbar" fade={["top", "right", "bottom", "left"]}>
        {regionHeatmaps ? <Glass className="mobile-map-search cpu-map-search" fade={[]} shape="capsule">{regionHeatmaps.selector}</Glass> : <>
        {backendConfig?.enabled && backendConfig.mode === "cpu" && onCreatePrompt ?
        <Glass className="mobile-map-search cpu-map-search" fade={[]} shape="capsule"><SavedPromptSearch config={backendConfig} disabled={promptDisabled || !liveSearchAvailable} onCreate={onCreatePrompt} /></Glass> :
        <MobileMapSearch disabled={promptDisabled} liveSearchAvailable={liveSearchAvailable} onCreatePrompt={onCreatePrompt} />}
        </>}
        <div className="map-summary" data-displayed-layer-id={displayedLayer?.id}>
          <strong title={title}>{title}</strong>
          <span className="map-agreement">{regionHeatmaps ? regionHeatmaps.description ?? `${regionHeatmaps.radiusMeters ?? 150} m region similarity` : `Scoring agreement ${agreement == null ? "N/A" : `${agreement.toFixed(1)}%`}`}</span>
        </div>
        {compactViewport && !comparisonEnabled && <div className="mobile-city-picker">
          <ThemedSelect label="Map city" value={mobileCityId} onValueChange={setMobileCityId}>
            {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
          </ThemedSelect>
        </div>}
        <WorkspaceSelect value={regionHeatmaps ? "atlas" : comparisonEnabled ? comparisonMode : "cities"}
          comparisons={comparisonCities.length > 0} onChange={mode => {
            if (mode === "tsne" || mode === "atlas" || (mode === "cities" && regionHeatmaps)) onWorkspaceChange(mode);
            else setComparisonMode(mode);
          }} />
        {comparisonEnabled ? <label className="basemap-select comparison-city-select">
          <span>City</span>
          <ThemedSelect label="Embedding comparison city" value={comparisonCity?.id} onValueChange={e => setComparisonCityId(e)}>
            {comparisonCities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
          </ThemedSelect>
        </label> : <div className="city-toggle-group city-source-selectors">
          <span>Map sources</span>
          <div>
            {desktopCities.map((city, slot) => (
              <label className="city-toggle" key={`${slot}-${city.id}`}>
                <span>{slot === 0 ? "L" : "R"}</span>
                <ThemedSelect label={slot === 0 ? "Left city" : "Right city"} value={city.id} onValueChange={event => selectCitySlot(slot, event)}>
                  {cities.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </ThemedSelect>
              </label>
            ))}
          </div>
        </div>}
        <label className="basemap-select basemap-source-select">
          <span>Basemap</span>
          <ThemedSelect label="Basemap" value={basemapId} onValueChange={event => onBasemapChange(event as BasemapId)}>
            {BASEMAPS.map((basemap) => (
              <option key={basemap.id} value={basemap.id}>
                {basemap.name}
              </option>
            ))}
          </ThemedSelect>
        </label>
        <GlassSwitch
          className={`map-detail-toggle detail-state-switch${maxDetailAutoCancelled ? " is-auto-cancelled" : ""}`}
          label="Max detail" ariaLabel="Max detail"
          checked={forceMaxDetail} onChange={handleForceMaxDetailChange}
        />
      </Glass>

      <div
        className={`city-map-layout${activeCities.length === 2 ? " has-two-cities" : ""}`}
        style={{ "--city-split": `${citySplit}%` } as CSSProperties}
      >
        {activeCities.map((city, index) => (
          <CityMapPane
            key={`${comparisonEnabled ? comparisonMode : "cities"}-${city.id}-${index}`}
            city={city}
            dataProvider={regionHeatmaps?.dataProvider}
            selectionArea={regionHeatmaps?.selectionAreas[city.id]}
            onMapReady={regionHeatmaps && (map => regionHeatmaps.register(city.id, map))}
            popupLabels={regionHeatmaps && { score: "Window similarity", zscore: "Four-city z" }}
            layers={comparisonEnabled ? comparison.paneLayers[differenceEnabled ? 2 : index] : layers}
            gradients={gradients}
            basemapId={basemapId}
            attributionHost={attributionHost}
            onSelectLayer={comparisonEnabled ? handleComparisonLayerSelect : onSelectLayer}
            sceneCamera={sceneCamera}
            cameraMode={comparisonEnabled ? "camera" : "resolution"}
            sceneResources={sceneResources}
            embeddingLabel={differenceEnabled ? `Difference · New − old ${scoreField}` : comparisonEnabled ? (index === 0 ? "Old embedding · 2B" : "New embedding · 8B / 4096") : undefined}
            loadingKey={comparisonEnabled ? `${city.id}:${index}` : city.id}
            onPriorityTileChange={comparisonEnabled ? undefined : onPriorityTileChange}
            markedPanos={markedPanos}
            selectedPanoKey={selectedPanoKey}
            onMarkPano={onMarkPano}
            onSelectPano={onSelectPano}
            forceMaxDetail={forceMaxDetail}
            onForceMaxDetailChange={handleForceMaxDetailChange}
            sharedGroundScale={sharedGroundScale}
            allowStaticTiles={allowStaticTiles}
            onSemanticLayerLoadingChange={handleSemanticLayerLoadingChange}
            splitIndex={index}
            compactControls={compactViewport}
            resizing={draggingCitySplit}
          />
        ))}
        {activeCities.length === 2 ? (
          <div
            className="city-split-resizer"
            onPointerDown={startCitySplitDrag}
            title="Drag to resize city maps"
            role="separator"
            aria-label="Resize city maps"
            aria-orientation="vertical"
            aria-valuemin={MIN_CITY_SPLIT}
            aria-valuemax={MAX_CITY_SPLIT}
            aria-valuenow={Math.round(citySplit)}
            tabIndex={compactViewport ? -1 : 0}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              setCitySplit((current) => clampNumber(current + (event.key === "ArrowLeft" ? -2 : 2), MIN_CITY_SPLIT, MAX_CITY_SPLIT));
            }}
          />
        ) : null}
      </div>

      <MapProgressOverlay entries={progressEntries} />
      {comparisonEnabled && <Glass className="embedding-comparison-note" fade={[]} role="status">
        {comparison.error || (!selectedLayer ? "Select a saved prompt to compare embeddings." :
          comparison.count ? `${comparison.count.toLocaleString()} matched panoramas · ${differenceEnabled ? `New − old ${scoreField}` : scoreField === "zscore" ? "Z-score within each embedding" : "Original scores"}` : "Loading comparison…")}
        {differenceEnabled && comparison.count && !comparison.error ? <div className="difference-legend" aria-label="Difference color scale">
          <span>Lower in new</span><span>0</span><span>Higher in new</span>
          <div className="difference-legend-ramp" />
          <span>≤ −{scoreField === "zscore" ? "3" : "0.2"}</span><span>New − old</span><span>≥ +{scoreField === "zscore" ? "3" : "0.2"}</span>
        </div> : null}
      </Glass>}
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

export type LayerDataProvider = (layer: SemanticLayer, cityId: CityId, detailBounds?: [number, number, number, number]) => Promise<FeatureCollection>;

type CityMapPaneProps = {
  dataProvider?: LayerDataProvider;
  selectionArea?: FeatureCollection;
  onMapReady?: (map: MapLibreMap) => (() => void);
  popupLabels?: { score: string; zscore: string };
  attributionHost?: HTMLElement | null;
  sceneCamera?: MapSceneCamera;
  cameraMode?: "resolution" | "camera";
  sceneResources?: SceneResources<FeatureCollection>;
  embeddingLabel?: string;
  loadingKey: string;
  city: CityConfig;
  layers: SemanticLayer[];
  gradients: GradientPreset[];
  basemapId: BasemapId;
  onSelectLayer: (layerId: string) => void;
  onPriorityTileChange?: MapViewProps["onPriorityTileChange"];
  markedPanos: MarkedPano[];
  selectedPanoKey: string | null;
  onMarkPano: (pano: PanoMapPoint) => void;
  onSelectPano: (panoKey: string) => void;
  forceMaxDetail: boolean;
  onForceMaxDetailChange: (enabled: boolean, reason?: "user" | "scale_limit") => void;
  sharedGroundScale: number;
  onSharedGroundScaleChange?: (scale: number) => void;
  allowStaticTiles?: boolean;
  onSemanticLayerLoadingChange: (cityId: CityId, loading: boolean) => void;
  splitIndex: number;
  compactControls: boolean;
  resizing: boolean;
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
    <Glass className={`mobile-map-search${liveSearchAvailable ? "" : " is-static-unavailable"}`} shape="capsule" fade={[]}>
    <form className="mobile-search-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Search size={17} />
      {liveSearchAvailable ? (
        <GlassInput label="Search semantic prompt"
          value={prompt}
          placeholder={MOBILE_SEARCH_PLACEHOLDERS[placeholderIndex]}
          aria-label="Search semantic prompt"
          disabled={disabled}
          onChange={(event) => setPrompt(event.target.value)}
        />
      ) : (
        <div className="mobile-static-search-message" aria-label={STATIC_SEARCH_PLACEHOLDER}>
          <span>Search unavailable in this demo</span>
        </div>
      )}
      {liveSearchAvailable || STATIC_DEPLOYMENT_CONTACT_EMAIL ? <GlassButton
        type={liveSearchAvailable ? "submit" : "button"}
        className={liveSearchAvailable ? "" : contactCopied ? "is-copied" : "is-contact-copy"}
        disabled={liveSearchAvailable ? disabled || submitting || !prompt.trim() || !onCreatePrompt : false}
        title={liveSearchAvailable ? "Create layer" : "Copy support email"}
        aria-label={liveSearchAvailable ? "Create layer" : "Copy support email"}
        onClick={liveSearchAvailable ? undefined : () => void copyContactEmail()}
      >
        {liveSearchAvailable ? <SendHorizontal size={17} /> : contactCopied ? <Check size={17} /> : <Copy size={17} />}
      </GlassButton> : null}
    </form></Glass>
  );
}

export const CityMapPane = memo(function CityMapPane({
  dataProvider,
  selectionArea,
  onMapReady,
  popupLabels,
  attributionHost,
  sceneCamera,
  cameraMode = "resolution",
  sceneResources,
  embeddingLabel,
  loadingKey,
  city,
  layers,
  gradients,
  basemapId,
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
  allowStaticTiles = true,
  onSemanticLayerLoadingChange,
  splitIndex,
  compactControls,
  resizing
}: CityMapPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const resizingRef = useRef(resizing);
  const applyingResizeRef = useRef(false);
  resizingRef.current = resizing;
  const basemapRef = useRef<BasemapId>(basemapId);
  const forceMaxDetailRef = useRef(forceMaxDetail);
  const forceMaxDetailChangeRef = useRef(onForceMaxDetailChange);
  const sharedGroundScaleRef = useRef(sharedGroundScale);
  const remoteTileZoomRef = useRef(REMOTE_MAX_DETAIL_ZOOM);
  const autoTileZoomRef = useRef<number>();
  const priorityTileChangeRef = useRef(onPriorityTileChange);
  const selectLayerRef = useRef(onSelectLayer);
  const markPanoRef = useRef(onMarkPano);
  const selectPanoRef = useRef(onSelectPano);
  const panoMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const regionPopup = useRef<{ popup: maplibregl.Popup; key: string; layerId: string } | null>(null);
  const displayedLayerId = layers.find(layer => layer.visible)?.id;
  useEffect(() => {
    const active = regionPopup.current;
    if (active && (active.key !== selectedPanoKey || active.layerId !== displayedLayerId)) active.popup.remove();
  }, [displayedLayerId, selectedPanoKey]);
  const styleGenerationRef = useRef(0);
  const viewportGenerationRef = useRef(0);
  const drawnLayerIds = useRef(new Map<string, string>());
  const tiledViewports = useRef(new Map<string, { viewport: RemoteTileViewport; tiles: RemoteRenderTile[] }>());
  const localResources = useMemo(() => new SceneResources<FeatureCollection>(272, 500_000, 8, data => data.features.length), []);
  const resources = sceneResources ?? localResources;
  const layersRef = useRef(layers);
  const gradientsRef = useRef(gradients);
  const dataProviderRef = useRef(dataProvider);
  const selectionAreaRef = useRef(selectionArea);
  const popupLabelsRef = useRef(popupLabels);
  const allowStaticTilesRef = useRef(allowStaticTiles);
  dataProviderRef.current = dataProvider;
  selectionAreaRef.current = selectionArea;
  popupLabelsRef.current = popupLabels;
  allowStaticTilesRef.current = allowStaticTiles;
  const applyingScaleSyncRef = useRef(false);
  const semanticRedrawTimerRef = useRef<number | undefined>(undefined);
  const [redrawRequest, setRedrawRequest] = useState({ generation: 0, nonce: 0 });
  const [status, setStatus] = useState("Loading map");
  const [showMaxDetailWarning, setShowMaxDetailWarning] = useState(false);
  const semanticDrawKey = useMemo(() => semanticLayerDrawKey(layers, gradients, city), [city, gradients, layers]);
  layersRef.current = layers;
  gradientsRef.current = gradients;

  function removeSemanticLayers(map: MapLibreMap, shouldRemove: (sourceId: string, layerId: string) => boolean) {
    for (const [id, layerId] of drawnLayerIds.current) {
      if (!shouldRemove(id, layerId)) continue;
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
      drawnLayerIds.current.delete(id);
    }
  }

  function inspectSemanticPoint(map: MapLibreMap, event: MapMouseEvent, feature: maplibregl.MapGeoJSONFeature) {
    const layerId = drawnLayerIds.current.get(feature.layer.id);
    const layer = layersRef.current.find(item => item.id === layerId);
    if (!layer) return;
    selectLayerRef.current(layer.id);
    const props = feature.properties ?? {};
    const pano = panoPointFromFeature(feature, event, layer, city);
    if (pano) {
      markPanoRef.current(pano);
      if (pano.cell_index === undefined) void collectPanoLayerValues(
        pano,
        feature,
        layersRef.current,
        resources,
        city,
        allowStaticTilesRef.current,
        dataProviderRef.current
      ).then((layerValues) => {
        if (mapRef.current === map && layerValues.length) {
          markPanoRef.current({ ...pano, layer_values: layerValues });
        }
      });
    }
    const score = Number(props.score);
    const zscore = Number(props.zscore);
    const labels = popupLabelsRef.current;
    const content = document.createElement("div");
    const title = document.createElement("div");
    title.className = "popup-title";
    title.textContent = layer.name;
    content.append(title);
    function addRow(label: string, value: string) {
      const row = document.createElement("div");
      row.className = "popup-row";
      for (const text of [label, value]) {
        const span = document.createElement("span");
        span.textContent = text;
        row.append(span);
      }
      content.append(row);
    }
    const difference = layer.id.endsWith(":embedding-difference");
    addRow(labels?.score ?? (difference ? "Δ score" : "score"), Number.isFinite(score) ? score.toFixed(4) : "");
    addRow(labels?.zscore ?? (difference ? "Δ zscore" : "zscore"), Number.isFinite(zscore) ? zscore.toFixed(3) : "");
    if (typeof props.sim_pct === "number") {
      addRow("Four-city percentile", props.sim_pct.toFixed(2));
      if (props.is_self_zone) addRow("Source overlap", "Within 300 m");
    }
    regionPopup.current?.popup.remove();
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(pano ? [pano.lon, pano.lat] : event.lngLat)
      .setDOMContent(content)
      .addTo(map);
    if (pano?.cell_index !== undefined && pano.pano_key) {
      regionPopup.current = { popup, key: pano.pano_key, layerId: layer.id };
      popup.once("close", () => { if (regionPopup.current?.popup === popup) regionPopup.current = null; });
    }
    popup.once("close", applyGlassSurface(popup.getElement().querySelector(".maplibregl-popup-content")));
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

  function publishRemoteTileZoom(map: MapLibreMap, forceMaxDetail: boolean) {
    if (forceMaxDetail) {
      remoteTileZoomRef.current = REMOTE_MAX_DETAIL_ZOOM;
      return;
    }
    const zoom = settledRemoteTileZoom(map.getZoom(), autoTileZoomRef.current);
    autoTileZoomRef.current = zoom;
    remoteTileZoomRef.current = zoom;
  }

  function scheduleSemanticRedraw(generation: number, delayMs = 160) {
    if (styleGenerationRef.current !== generation) return;
    if (semanticRedrawTimerRef.current !== undefined) {
      window.clearTimeout(semanticRedrawTimerRef.current);
    }
    if (resizingRef.current) {
      semanticRedrawTimerRef.current = undefined;
      return;
    }
    semanticRedrawTimerRef.current = window.setTimeout(() => {
      semanticRedrawTimerRef.current = undefined;
      const map = mapRef.current;
      if (resizingRef.current || map?.isMoving()) return;
      if (map) {
        publishRemoteTileZoom(map, forceMaxDetailRef.current);
        reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
      }
      requestSemanticRedraw(generation);
    }, delayMs);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialBasemap = basemapById(basemapId);
    autoTileZoomRef.current = undefined;
    const generation = styleGenerationRef.current + 1;
    styleGenerationRef.current = generation;
    basemapRef.current = initialBasemap.id;

    installBasemapTransport();
    const mapOptions = {
      container: containerRef.current,
      style: basemapStyle(initialBasemap),
      center: city.center,
      zoom: compactControls ? zoomForScaleBarMeters(DEFAULT_SCALE_BAR_METERS, city.center[1]) : zoomForGroundScale(sharedGroundScaleRef.current, city.center[1]),
      minZoom: 2,
      maxZoom: 18,
      trackResize: false,
      transformRequest: sceneTileRequest,
      attributionControl: false as const
    };

    const map = new maplibregl.Map(mapOptions);

    if (!compactControls) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    }
    const scaleControl = new maplibregl.ScaleControl({ maxWidth: SCALE_CONTROL_MAX_WIDTH, unit: "metric" });
    map.addControl(scaleControl, "bottom-right");
    map.off("move", scaleControl._onMove);
    const detachGlass = observeMapGlass(map.getContainer());
    const detachPointImages = attachPointShapeImages(map);
    const detachDiagnostics = attachMapDiagnostics(map, {
      cityId: city.id,
      container: containerRef.current
    });
    map.on("load", () => {
      publishRemoteTileZoom(map, forceMaxDetailRef.current);
      reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
      requestSemanticRedraw(generation, `${city.name} ${initialBasemap.name} ready`);
    });
    map.on("error", (event) => setStatus(event.error?.message ?? "Map error"));
    mapRef.current = map;
    const publishViewport = () => {
      const container = map.getContainer();
      const center = map.getCenter();
      const zoom = map.getZoom();
      container.dataset.mapZoom = String(zoom);
      container.dataset.groundMetersPerPixel = String(MAPLIBRE_METERS_PER_PIXEL_ZOOM0 / groundScaleForZoom(zoom, center.lat));
      container.dataset.mapCenter = `${center.lng},${center.lat}`;
      scaleControl._onMove();
    };
    publishViewport();
    let settleTimer: number | undefined;
    const clearMotion = () => {
      if (movingMaps.delete(map) && movingMaps.size === 0) document.documentElement.classList.remove("is-map-interacting");
    };
    map.on("movestart", () => {
      if (applyingResizeRef.current || resizingRef.current || movingMaps.has(map)) return;
      movingMaps.add(map);
      if (movingMaps.size === 1) document.documentElement.classList.add("is-map-interacting");
    });
    map.on("move", () => { viewportGenerationRef.current++; });
    map.on("moveend", () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (map.isMoving()) return;
        publishViewport();
        clearMotion();
      }, 150);
    });
    const canvas = map.getCanvas();
    let hoverTimer: number | undefined;
    let hoverPoint: MapMouseEvent["point"];
    const semanticPointAt = (point: MapMouseEvent["point"]) => {
      const layers = [...drawnLayerIds.current.keys()].filter(id => map.getLayer(id));
      return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : undefined;
    };
    const clearHover = () => {
      window.clearTimeout(hoverTimer);
      hoverTimer = undefined;
      if (canvas.style.cursor) canvas.style.cursor = "";
    };
    const hoverSemanticLayers = (event: MapMouseEvent) => {
      if (!drawnLayerIds.current.size || map.isMoving() || event.originalEvent.buttons) {
        clearHover();
        return;
      }
      hoverPoint = event.point;
      if (hoverTimer !== undefined) return;
      hoverTimer = window.setTimeout(() => {
        hoverTimer = undefined;
        const cursor = !map.isMoving() && semanticPointAt(hoverPoint) ? "pointer" : "";
        if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
      }, 80);
    };
    map.on("click", (event) => {
      const point = semanticPointAt(event.point);
      if (point) inspectSemanticPoint(map, event, point);
    });
    map.on("mousemove", hoverSemanticLayers);
    map.on("mouseout", clearHover);
    map.on("movestart", clearHover);
    const unregisterSceneCamera = sceneCamera?.register(map, cameraMode, () => applyingResizeRef.current || resizingRef.current);
    const unregisterLocalMap = onMapReady?.(map);
    requestSemanticRedraw(generation, `Loading ${city.name}`);
    publishRemoteTileZoom(map, forceMaxDetailRef.current);
    reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);

    return () => {
      if (semanticRedrawTimerRef.current !== undefined) {
        window.clearTimeout(semanticRedrawTimerRef.current);
        semanticRedrawTimerRef.current = undefined;
      }
      detachDiagnostics();
      detachGlass();
      detachPointImages();
      unregisterSceneCamera?.();
      unregisterLocalMap?.();
      clearHover();
      window.clearTimeout(settleTimer);
      clearMotion();
      drawnLayerIds.current.clear();
      tiledViewports.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [city.center[0], city.center[1], city.datasetId, city.id, city.name, compactControls]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map || !("ResizeObserver" in window)) return;
    const resize = createMapResizeScheduler(map, {
      beforeResize: () => { applyingResizeRef.current = true; },
      afterResize: () => {
        applyingResizeRef.current = false;
        scheduleSemanticRedraw(styleGenerationRef.current);
      }
    });
    const observer = new ResizeObserver(resize.schedule);
    observer.observe(container);
    return () => {
      observer.disconnect();
      resize.dispose();
    };
    // Rebind when map creation replaces its instance; never resize a removed map.
  }, [city.center[0], city.center[1], city.datasetId, city.id, city.name, compactControls]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !attributionHost || splitIndex !== 0) return;
    // Keep MapLibre's source/style updates and deduplication, but mount its
    // attribution in the shared sidebar footer instead of either map corner.
    const attribution = new maplibregl.AttributionControl({
      compact: false,
      customAttribution: '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>'
    });
    attributionHost.append(attribution.onAdd(map));
    return () => attribution.onRemove();
  }, [attributionHost, splitIndex, city.center[0], city.center[1], city.datasetId, city.id, city.name, compactControls]);

  useEffect(() => {
    // Refresh new viewport tiles after pointer-up, even if no final size event fires.
    if (!resizing) scheduleSemanticRedraw(styleGenerationRef.current);
    else if (semanticRedrawTimerRef.current !== undefined) {
      window.clearTimeout(semanticRedrawTimerRef.current);
      semanticRedrawTimerRef.current = undefined;
    }
  }, [resizing]);

  useEffect(() => {
    forceMaxDetailRef.current = forceMaxDetail;
    const map = mapRef.current;
    if (!map) return;
    if (compactControls && forceMaxDetail && zoomToScaleBarIfNeeded(map, MAX_DETAIL_MIN_SCALE_BAR_METERS)) {
      publishRemoteTileZoom(map, forceMaxDetail);
      reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
      return;
    }
    publishRemoteTileZoom(map, forceMaxDetail);
    reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
    requestSemanticRedraw(styleGenerationRef.current);
  }, [city.datasetId, compactControls, forceMaxDetail]);

  useEffect(() => {
    forceMaxDetailChangeRef.current = onForceMaxDetailChange;
  }, [onForceMaxDetailChange]);

  useEffect(() => {
    priorityTileChangeRef.current = onPriorityTileChange;
    const map = mapRef.current;
    if (map) reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
  }, [onPriorityTileChange]);

  useEffect(() => {
    selectLayerRef.current = onSelectLayer;
  }, [onSelectLayer]);

  useEffect(() => {
    markPanoRef.current = onMarkPano;
  }, [onMarkPano]);

  useEffect(() => {
    selectPanoRef.current = onSelectPano;
  }, [onSelectPano]);

  useEffect(() => () => onSemanticLayerLoadingChange(loadingKey, false), [loadingKey, onSemanticLayerLoadingChange]);

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
    const onStyleReady = () => {
      requestSemanticRedraw(generation, `${city.name} ${nextBasemap.name} ready`);
    };

    map.once("style.load", onStyleReady);
    map.once("idle", onStyleReady);
    map.setStyle(basemapStyle(nextBasemap), {
      transformStyle: (previous, next) => preserveSceneStyle(previous, next, new Set([...drawnLayerIds.current.keys(), "reference-selection"]))
    });
    requestSemanticRedraw(generation);

    return () => {
      map.off("style.load", onStyleReady);
      map.off("idle", onStyleReady);
    };
  }, [basemapId, city.name]);

  useEffect(() => {
    // Remote capabilities can replace the city/dataset after initial mount.
    // Rebind to every replacement map, not just changes to the callback.
    const map = mapRef.current;
    if (!map) return;
    const onViewportSettled = (event: MapEventType["moveend"] & { sceneCameraSync?: boolean }) => {
      // resize() emits moveend although the camera did not move.
      if (applyingResizeRef.current || resizingRef.current) return;
      if (event.sceneCameraSync) {
        // Peer jumpTo emits moveend on every animation frame. Its tile/data
        // work is settled separately; camera motion itself stays immediate.
        scheduleSemanticRedraw(styleGenerationRef.current);
        return;
      }
      if (compactControls && forceMaxDetailRef.current && isScaleBarPastLimit(map, MAX_DETAIL_MIN_SCALE_BAR_METERS)) {
        forceMaxDetailChangeRef.current(false, "scale_limit");
        return;
      }
      if (!sceneCamera && !applyingScaleSyncRef.current) {
        const nextScale = groundScaleForZoom(map.getZoom(), map.getCenter().lat);
        sharedGroundScaleRef.current = nextScale;
        onSharedGroundScaleChange?.(nextScale);
      }
      publishRemoteTileZoom(map, forceMaxDetailRef.current);
      reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
      scheduleSemanticRedraw(styleGenerationRef.current);
    };
    map.on("moveend", onViewportSettled);
    return () => {
      map.off("moveend", onViewportSettled);
    };
  }, [city.center[0], city.center[1], city.datasetId, city.id, city.name, compactControls, onSharedGroundScaleChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || sceneCamera) return;
    sharedGroundScaleRef.current = sharedGroundScale;
    const nextZoom = zoomForGroundScale(sharedGroundScale, map.getCenter().lat);
    if (Math.abs(map.getZoom() - nextZoom) < 0.01) return;
    applyingScaleSyncRef.current = true;
    try {
      // jumpTo emits camera events synchronously; suppress only those events.
      map.jumpTo({ zoom: nextZoom });
    } finally {
      applyingScaleSyncRef.current = false;
    }
    publishRemoteTileZoom(map, forceMaxDetailRef.current);
    reportPriorityTile(map, city, remoteTileZoomRef.current, priorityTileChangeRef.current);
    scheduleSemanticRedraw(styleGenerationRef.current);
  }, [city.center[0], city.center[1], city.datasetId, city.id, city.name, compactControls, sharedGroundScale]);

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
      onSemanticLayerLoadingChange(loadingKey, loading);
    };

    async function draw(attempt = 0) {
      if (cancelled || generation !== styleGenerationRef.current) return;
      const viewportGeneration = viewportGenerationRef.current;
      const viewportNeeded = () => !cancelled && generation === styleGenerationRef.current
        && viewportGeneration === viewportGenerationRef.current;

      try {
        const currentLayers = layersRef.current;
        const currentGradients = gradientsRef.current;
        const visibleTopToBottom = currentLayers.filter((layer) => layer.visible);
        const area = selectionAreaRef.current;
        const hasBoundarySamples = area?.features.some(f => f.properties.categoryColor);
        if (area && (area.features.length || currentMap.getSource("reference-selection"))) {
          updateSemanticSource(currentMap, "reference-selection", area);
          if (!currentMap.getLayer("reference-selection-fill")) currentMap.addLayer({ id: "reference-selection-fill", type: "fill", source: "reference-selection", paint: { "fill-color": "#2c7bb6", "fill-opacity": 0.08 } });
          if (!currentMap.getLayer("reference-selection-outline")) currentMap.addLayer({ id: "reference-selection-outline", type: "line", source: "reference-selection", paint: { "line-color": "#2c7bb6", "line-width": 2, "line-dasharray": [3, 2] } });
          if (hasBoundarySamples && !currentMap.getLayer("boundary-classes")) {
            currentMap.addLayer({
              id: "boundary-classes", type: "symbol", source: "reference-selection",
              filter: ["has", "categoryColor"],
              layout: {
                "icon-image": ensurePointImage(currentMap, "square"),
                "icon-size": ["case", ["get", "highlighted"], 5 / POINT_ICON_HALF_SIZE, 3 / POINT_ICON_HALF_SIZE],
                "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-padding": 0,
                "symbol-sort-key": ["case", ["get", "highlighted"], 1, 0]
              },
              paint: {
                "icon-color": ["get", "categoryColor"],
                "icon-opacity": ["case", ["get", "highlighted"], 1, 0.1]
              }
            });
          }
        }
        if (!visibleTopToBottom.length) {
          removeSemanticLayers(currentMap, () => true);
          tiledViewports.current.clear();
          setStatus(`0 rendered / 0 visible / ${currentLayers.length} total`);
          reportSemanticLoading(false);
          return;
        }
        reportSemanticLoading(![...drawnLayerIds.current.keys()].some(id => currentMap.getLayer(id)));

        if (forceMaxDetailRef.current && maxDetailWarningTimer === undefined) {
          setShowMaxDetailWarning(false);
          maxDetailWarningTimer = window.setTimeout(() => {
            if (viewportNeeded() && forceMaxDetailRef.current) {
              setShowMaxDetailWarning(true);
            }
          }, 1200);
        }

        if (!currentMap.getLayersOrder().length && !currentMap.getStyle()?.layers) {
          throw new Error("Map style is not ready");
        }



        const renderableTopToBottom = renderableSemanticLayers(visibleTopToBottom);
        const layersToDraw = renderableTopToBottom.slice().reverse();
        const orderedIds: string[] = [];
        const wantedIds = new Set(layersToDraw.map(layer => layer.id));
        // Remove only layers the user hid/deleted, retaining visible data during fetches.
        removeSemanticLayers(currentMap, (_id, layerId) => !wantedIds.has(layerId));
        for (const layerId of tiledViewports.current.keys()) if (!wantedIds.has(layerId)) tiledViewports.current.delete(layerId);
        let displayedContent = false;
        let waitingForStaticFallback = false;
        for (const layer of layersToDraw) {
          const sourceId = sourceIdForCityLayer(city.id, layer.id);
          const sourcePath = getLayerSourcePath(layer, city.id);
          const remote = isRemoteTileTemplate(sourcePath);
          const useRenderTiles = remote && !dataProviderRef.current;
          const staticFallback = isStaticFallbackTileTemplate(sourcePath);
          if (useRenderTiles && staticFallback && !allowStaticTiles) {
            waitingForStaticFallback = true;
            for (const [id, owner] of drawnLayerIds.current) {
              if (owner === layer.id && currentMap.getLayer(id)) orderedIds.push(id);
            }
            continue;
          }
          let sources: { id: string; data: FeatureCollection }[];
          if (useRenderTiles) {
            try {
              const previous = tiledViewports.current.get(layer.id);
              const tileZoom = staticFallback ? REMOTE_MAX_DETAIL_ZOOM : remoteTileZoomRef.current;
              const tileCoords = filterStaticFallbackTiles(city.id, visibleRemoteTiles(currentMap, tileZoom), staticFallback);
              const viewport = await loadRemoteTileViewport(resources, sourcePath, tileCoords,
                tile => getRemoteTileGeojson(sourcePath, tile.z, tile.x, tile.y), previous?.viewport, viewportNeeded);
              if (!viewportNeeded()) return;
              const tiles = viewport === previous?.viewport ? previous.tiles : remoteRenderTiles(viewport, previous?.tiles);
              tiledViewports.current.set(layer.id, { viewport, tiles });
              sources = tiles.map(tile => ({ id: `${sourceId}--render-tile-${tile.key.replace(/\//g, "-")}`, data: tile.data }));
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") throw error;
              if (!viewportNeeded()) return;
              sources = [{ id: sourceId, data: await getLayerFallbackGeojson(layer.id, city.id) }];
            }
          } else {
            const bounds = currentMap.getBounds();
            const detailed = forceMaxDetailRef.current || remoteTileZoomRef.current === REMOTE_MAX_DETAIL_ZOOM;
            const geojson = dataProviderRef.current
              ? await dataProviderRef.current(layer, city.id, detailed ? [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()] : undefined)
              : await loadLocalLayerGeojson(layer, resources, city.id);
            sources = [{ id: sourceId, data: geojson }];
          }
          if (cancelled || generation !== styleGenerationRef.current) return;
          // Slow tile requests can finish during the next gesture. The settled
          // camera will schedule its own draw with the current tile coverage.
          if (!viewportNeeded() && remote) return;
          const hasContent = sources.some(source => source.data.features.length > 0);
          // A new scoring job can temporarily have no published tiles. Keep
          // its last visible result until replacement content becomes ready.
          if (!hasContent && isLayerWaitingForRemoteData(layer, city.id)) {
            const existing = [...drawnLayerIds.current]
              .filter(([id, owner]) => owner === layer.id && currentMap.getLayer(id));
            if (existing.length) {
              orderedIds.push(...existing.map(([id]) => id));
              continue;
            }
          }
          const nextIds = new Set(sources.map(source => source.id));
          if (useRenderTiles) {
            removeSemanticLayers(currentMap, (id, owner) => owner === layer.id && !nextIds.has(id) && !currentMap.getLayer(id));
            for (const { id, data } of sources) {
              if (id === sourceId || getRequestedSemanticSourceData(currentMap, id) === data) continue;
              await waitForSemanticTileFrame();
              if (!viewportNeeded()) return;
              updateSemanticSource(currentMap, id, data);
              drawnLayerIds.current.set(id, layer.id);
            }
          }
          const gradient = layerGradient(layer, currentGradients);
          const paint = {
            "circle-radius": circleRadiusExpression(layer),
            "circle-color": gradient ? colorExpression(gradient, layer) : "#2f80ed",
            "circle-opacity": hasBoundarySamples ? layer.style.opacity * 0.12 : layer.style.opacity,
            "circle-pitch-scale": layer.style.absolute_radius ? "map" : "viewport",
            "circle-stroke-width": 0,
            "circle-stroke-opacity": 0
          } as const;
          const marker = { shape: normalizePointShape(layer.style.point_shape), size: circleRadiusExpression(layer, 1 / POINT_ICON_HALF_SIZE) };
          for (const { id, data } of sources) {
            updateSemanticLayer(currentMap, id, data, paint, marker);
            drawnLayerIds.current.set(id, layer.id);
            orderedIds.push(id);
          }
          removeSemanticLayers(currentMap, (id, owner) => owner === layer.id && !nextIds.has(id));
          if (!useRenderTiles) tiledViewports.current.delete(layer.id);
          if (!displayedContent && hasContent) {
            displayedContent = true;
            reportSemanticLoading(false);
          }
        }

        const missingLayer = orderedIds.some(id => !currentMap.getLayer(id));
        if (missingLayer) {
          throw new Error("Semantic layers were not attached");
        }
        if (currentMap.getLayer("boundary-classes")) orderedIds.push("boundary-classes");
        syncSemanticLayerOrder(currentMap, orderedIds);

        if (!cancelled && generation === styleGenerationRef.current) {
          if (maxDetailWarningTimer !== undefined) {
            window.clearTimeout(maxDetailWarningTimer);
            maxDetailWarningTimer = undefined;
          }
          setShowMaxDetailWarning(false);
          setStatus(`${layersToDraw.length} rendered / ${visibleTopToBottom.length} visible / ${currentLayers.length} total`);
          if (!displayedContent && (waitingForStaticFallback || layersToDraw.some((layer) => isLayerWaitingForRemoteData(layer, city.id)))) {
            setStatus(`Waiting for semantic layer data`);
          } else {
            reportSemanticLoading(false);
          }
        }
      } catch (error) {
        if (cancelled || generation !== styleGenerationRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError" && !viewportNeeded()) return;
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
  }, [city.id, redrawRequest, semanticDrawKey, allowStaticTiles, onSemanticLayerLoadingChange, dataProvider, selectionArea]);

  return (
    <section className={`city-map-pane city-map-pane-${city.id}`} data-split-index={splitIndex} aria-label={`${city.name} map`} data-map-status={status}>
      {embeddingLabel && <Glass className="embedding-pane-label" fade={[]}>{embeddingLabel}</Glass>}
      <div ref={containerRef} className="map-container" />
      {showMaxDetailWarning ? (
        <Glass className="map-max-detail-warning" fade={[]}>When max detailed is enable, map render time might be significantly delayed when viewing a large area</Glass>
      ) : null}
    </section>
  );
});

function MapRefreshOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <Glass className="map-refresh-overlay" fade={[]} role="status" aria-live="polite">
      <span className="map-refresh-spinner" aria-hidden="true" />
      <span>Updating semantic layers...</span>
    </Glass>
  );
}

function AllLayersHiddenOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <Glass className="map-hidden-layers-overlay" fade={[]} role="status" aria-live="polite">
      <span>All semantic layers are hidden. Turn on an eye icon to display the map data.</span>
    </Glass>
  );
}

function MapProgressOverlay({ entries }: { entries: RemoteLogEntry[] }) {
  if (!entries.length) return null;

  return (
    <Glass className="map-progress-overlay" fade={[]} role="status" aria-live="polite">
      <div className="glass-scroll-content">
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
    </Glass>
  );
}

function panoPointFromFeature(feature: GeoJSON.Feature, event: MapMouseEvent, layer: SemanticLayer, city: CityConfig): PanoMapPoint | null {
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

  // Map tiles quantize point geometry. Use the capture coordinates for panorama identity.
  if (Number.isFinite(props.pano_lon) && Number.isFinite(props.pano_lat)) {
    lon = props.pano_lon;
    lat = props.pano_lat;
  }
  const score = Number(props.score);
  const zscore = Number(props.zscore);
  const datasetId = typeof props.dataset_id === "string" && props.dataset_id ? props.dataset_id : city.datasetId;
  const explicitPanoDatasetId = typeof props.pano_dataset_id === "string" ? props.pano_dataset_id.trim() : "";
  const panoDatasetId = explicitPanoDatasetId || panoDatasetIdForPoint(datasetId, lon, lat);
  return {
    pano_id: panoId,
    ...(Number.isInteger(props.cell_index) ? { cell_index: props.cell_index } : {}),
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
  pano: PanoMapPoint,
  clickedFeature: maplibregl.MapGeoJSONFeature,
  layers: SemanticLayer[],
  resources: SceneResources<FeatureCollection>,
  city: CityConfig,
  allowStaticTiles: boolean,
  dataProvider?: LayerDataProvider
): Promise<PanoLayerValue[]> {
  const datasetId = pano.dataset_id ?? city.datasetId;
  const z = REMOTE_MAX_DETAIL_ZOOM;
  const { x, y } = lonLatToTile(pano.lat, pano.lon, z);
  return Promise.all(
    layers
      .filter((layer) => layer.status === "ready")
      .map(async (layer) => {
        let feature: GeoJSON.Feature | undefined;
        if (layer.id === pano.source_layer_id) {
          feature = clickedFeature;
        } else {
          try {
            const sourcePath = getLayerSourcePath(layer, city.id);
            const staticFallback = isStaticFallbackTileTemplate(sourcePath);
            let points: FeatureCollection | undefined;
            if (dataProvider || !isRemoteTileTemplate(sourcePath)) {
              points = await loadLocalLayerGeojson(layer, resources, city.id, dataProvider);
            } else if (!staticFallback || (allowStaticTiles && filterStaticFallbackTiles(city.id, [{ z, x, y }], true).length)) {
              points = await resources.load(`tile:${sourcePath}:${z}/${x}/${y}`, () => getRemoteTileGeojson(sourcePath, z, x, y), { cacheable: isCompleteRemoteTile });
            }
            let nearestDistance = Number.POSITIVE_INFINITY;
            for (const candidate of points?.features ?? []) {
              const props = candidate.properties ?? {};
              const candidateDataset = typeof props.dataset_id === "string" && props.dataset_id ? props.dataset_id : datasetId;
              if (candidateDataset !== datasetId || String(props.pano_id ?? props.id ?? "") !== pano.pano_id) continue;
              const distance = pointFeatureDistanceSquared(candidate, pano.lon, pano.lat);
              if (distance >= nearestDistance) continue;
              nearestDistance = distance;
              feature = candidate;
            }
          } catch {
            // The selected point remains usable if an auxiliary score is unavailable.
          }
        }
        const props = feature?.properties ?? {};
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
}

function pointFeatureDistanceSquared(feature: GeoJSON.Feature, lon: number, lat: number): number {
  if (feature.geometry.type !== "Point") return Number.POSITIVE_INFINITY;
  const coordinates = feature.geometry.coordinates;
  if (typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return Number.POSITIVE_INFINITY;
  return (coordinates[0] - lon) ** 2 + (coordinates[1] - lat) ** 2;
}

function loadLocalLayerGeojson(
  layer: SemanticLayer,
  resources: SceneResources<FeatureCollection>,
  cityId: CityId,
  dataProvider?: LayerDataProvider
): Promise<FeatureCollection> {
  if (dataProvider) return dataProvider(layer, cityId);
  const sourcePath = getLayerSourcePath(layer, cityId);
  return resources.load(`${cityId}:${layer.id}:${sourcePath}:${layer.status}`, () => getLayerGeojson(layer.id, cityId), {
    cacheable: data => data.features.length > 0
  });
}

function visibleRemoteTiles(map: MapLibreMap, remoteTileZoom: number): Array<{ z: number; x: number; y: number }> {
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

function reportPriorityTile(map: MapLibreMap, city: CityConfig, remoteTileZoom: number, onPriorityTileChange?: MapViewProps["onPriorityTileChange"]) {
  if (!onPriorityTileChange) return;
  const center = map.getCenter();
  const z = clampInteger(remoteTileZoom, 10, REMOTE_MAX_DETAIL_ZOOM);
  const tile = lonLatToTile(center.lat, center.lng, z);
  onPriorityTileChange(city.id, { z, x: tile.x, y: tile.y, dataset_id: city.datasetId });
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

function semanticLayerDrawKey(layers: SemanticLayer[], gradients: GradientPreset[], city: CityConfig): string {
  return renderableSemanticLayers(layers.filter((layer) => layer.visible))
    .map((layer) => {
      const style = layer.style;
      const gradient = layerGradient(layer, gradients);
      const range = colorRangeForLayer(layer);
      return [
        layer.id,
        layer.status,
        getLayerSourcePath(layer, city.id),
        layer.score_property,
        style.gradient_id,
        style.opacity,
        range.lower,
        range.upper,
        style.point_radius,
        style.point_shape ?? "circle",
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
