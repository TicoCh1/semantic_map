import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Info, MonitorPlay, RefreshCw, X } from "lucide-react";
import {
  REMOTE_LOG_EVENT,
  createPanoReferenceScoringJob,
  createScoringJob,
  deleteGradient,
  deleteLayer,
  ensureExhibitDefaultRemoteLayers,
  getAppState,
  hasExhibitDefaultLayers,
  isUsableRemoteBackendUrl,
  loadPanoImage,
  getRemoteBackendConfig,
  patchLayer,
  reorderLayers,
  refreshAllScoringLayers,
  resetExhibitState,
  resumeRemoteScoringJobs,
  saveGradient
} from "./api/client";
import type {
  AppStateResponse,
  CityId,
  CityPriorityTiles,
  GradientPreset,
  LayerState,
  MarkedPano,
  PanoMapPoint,
  PanoReference,
  RemoteBackendConfig,
  RemoteLogEntry,
  SemanticLayer,
  TileCoord
} from "./api/types";
import { GradientEditor } from "./components/GradientEditor";
import { HistogramPanel } from "./components/HistogramPanel";
import { LayerPanel } from "./components/LayerPanel";
import { LogPanel } from "./components/LogPanel";
import { MapView } from "./components/MapView";
import { PromptBar } from "./components/PromptBar";
import { ScreensaverOverlay } from "./components/ScreensaverOverlay";
import { SplitPane } from "./components/SplitPane";
import { normalizeBasemapId, type BasemapId } from "./state/basemaps";
import { layerGradient, layerStyleFromGradient } from "./state/color";
import { exhibitConfig } from "./state/exhibitConfig";
import { runtimeConfig } from "./state/runtimeConfig";
import { STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE } from "./state/staticDeployment";
import { TUTORIAL_PAGES } from "./state/tutorialContent";

function keyForPano(pano: Pick<PanoMapPoint, "pano_id" | "pano_key" | "dataset_id" | "city_id">): string {
  if (pano.pano_key) return pano.pano_key;
  const scope = pano.dataset_id || pano.city_id || "default";
  return `${scope}:${pano.pano_id}`;
}

function revokeObjectUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function panoFailureMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/Pano request failed\s*\(404\)/i.test(message) || /Failed to parse URL|Invalid URL/i.test(message)) {
    return STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE;
  }
  return message || "Pano unavailable";
}

type IdleResetDebugState = {
  enabled?: boolean;
  blocked_reason?: "disabled" | "tutorial_open" | null;
  idle_ms?: number;
  armed_at?: string | null;
  reset_due_at?: string | null;
  last_activity_at?: string | null;
  last_activity_type?: string | null;
  ignored_activity_at?: string | null;
  ignored_activity_type?: string | null;
  countdown_seconds?: number | null;
};

declare global {
  interface Window {
    __SEMANTIC_MAP_IDLE_RESET__?: IdleResetDebugState;
  }
}

function isoFromTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function isIdleResetActivity(event: Event): boolean {
  if (!event.isTrusted) return false;
  if (event.type !== "wheel") return true;

  const wheel = event as WheelEvent;
  const totalDelta = Math.abs(wheel.deltaX) + Math.abs(wheel.deltaY) + Math.abs(wheel.deltaZ);
  return Number.isFinite(totalDelta) && totalDelta > 0;
}

const THEME_SOURCE_KEY = "semantic-map-theme-source";
const BASEMAP_SOURCE_KEY = "semantic-map-basemap-source";

function isCompactViewport(): boolean {
  return window.matchMedia("(max-width: 700px)").matches;
}

function prefersDarkColorScheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function loadInitialDarkMode(): boolean {
  if (window.localStorage.getItem(THEME_SOURCE_KEY) === "manual") {
    return window.localStorage.getItem("semantic-map-theme") === "dark";
  }
  if (isCompactViewport()) return prefersDarkColorScheme();
  return window.localStorage.getItem("semantic-map-theme") === "dark";
}

function loadInitialBasemapId(): BasemapId {
  if (isCompactViewport()) return prefersDarkColorScheme() ? "openfreemap_dark" : "osm";
  if (window.localStorage.getItem(BASEMAP_SOURCE_KEY) === "manual") {
    return normalizeBasemapId(window.localStorage.getItem("semantic-map-basemap"));
  }
  return normalizeBasemapId(window.localStorage.getItem("semantic-map-basemap"));
}

export function App() {
  const [data, setData] = useState<AppStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(loadInitialDarkMode);
  const [basemapId, setBasemapId] = useState<BasemapId>(loadInitialBasemapId);
  const [backendConfig, setBackendConfig] = useState<RemoteBackendConfig | null>(null);
  const [priorityTiles, setPriorityTiles] = useState<CityPriorityTiles>({});
  const [remoteLogs, setRemoteLogs] = useState<RemoteLogEntry[]>([]);
  const [mapProgressEntries, setMapProgressEntries] = useState<RemoteLogEntry[]>([]);
  const [refreshingLayers, setRefreshingLayers] = useState(false);
  const [markedPanos, setMarkedPanos] = useState<MarkedPano[]>([]);
  const [selectedPanoKey, setSelectedPanoKey] = useState<string | null>(null);
  const [showExhibitIntro, setShowExhibitIntro] = useState(false);
  const [showScreensaver, setShowScreensaver] = useState(false);
  const [introVersion, setIntroVersion] = useState(0);
  const [idleResetCountdown, setIdleResetCountdown] = useState<number | null>(null);
  const markedPanosRef = useRef<MarkedPano[]>([]);
  const panoRequestsRef = useRef<Set<string>>(new Set());
  const panoObjectUrlsRef = useRef<Map<string, string>>(new Map());
  const mapProgressDismissTimersRef = useRef<Map<string, number>>(new Map());
  const exhibitInitialResetRef = useRef(false);
  const exhibitDefaultRequestRef = useRef(false);
  const startupRefreshAttemptedRef = useRef(false);
  const priorityTilesRef = useRef<CityPriorityTiles>({});
  const lastAutoReferenceRef = useRef<string | null>(null);
  const idleResetDebugRef = useRef<IdleResetDebugState>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAppState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (runtimeConfig.mode !== "screensaver" && !isCompactViewport()) {
      setShowExhibitIntro(true);
    }
  }, []);

  useEffect(() => {
    if (!isCompactViewport()) return;
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = () => {
      const prefersDark = colorScheme.matches;
      if (window.localStorage.getItem(THEME_SOURCE_KEY) !== "manual") {
        setDarkMode(prefersDark);
        setBasemapId(prefersDark ? "openfreemap_dark" : "osm");
      }
    };
    colorScheme.addEventListener("change", syncWithSystem);
    return () => colorScheme.removeEventListener("change", syncWithSystem);
  }, []);

  useEffect(() => {
    void getRemoteBackendConfig().then((config) => {
      setBackendConfig(config);
      return resumeRemoteScoringJobs();
    });
  }, []);

  useEffect(() => {
    priorityTilesRef.current = priorityTiles;
  }, [priorityTiles]);

  useEffect(() => {
    if (startupRefreshAttemptedRef.current || !data || !backendConfig) return;
    startupRefreshAttemptedRef.current = true;
    if (!backendConfig.enabled || !isUsableRemoteBackendUrl(backendConfig.baseUrl)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRefreshingLayers(true);
      void refreshAllScoringLayers(priorityTilesRef.current)
        .then(() => {
          if (!cancelled) void refresh();
        })
        .catch(() => {
          if (!cancelled) setError(null);
        })
        .finally(() => {
          if (!cancelled) setRefreshingLayers(false);
        });
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [backendConfig, data, refresh]);

  useEffect(() => {
    const onLocalStateUpdated = () => void refresh();
    window.addEventListener("semantic-map-local-state-updated", onLocalStateUpdated);
    return () => window.removeEventListener("semantic-map-local-state-updated", onLocalStateUpdated);
  }, [refresh]);

  useEffect(() => {
    const onRemoteLog = (event: Event) => {
      const entry = (event as CustomEvent<RemoteLogEntry>).detail;
      if (!entry) return;
      setRemoteLogs((current) => [entry, ...current].slice(0, 200));
      updateMapProgressEntries(entry, mapProgressDismissTimersRef.current, setMapProgressEntries);
    };
    window.addEventListener(REMOTE_LOG_EVENT, onRemoteLog);
    return () => window.removeEventListener(REMOTE_LOG_EVENT, onRemoteLog);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("semantic-map-theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("theme-dark-root", darkMode);
    return () => document.documentElement.classList.remove("theme-dark-root");
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem("semantic-map-basemap", basemapId);
  }, [basemapId]);

  const handleDarkModeChange = useCallback((enabled: boolean) => {
    window.localStorage.setItem(THEME_SOURCE_KEY, "manual");
    setDarkMode(enabled);
    if (isCompactViewport()) {
      setBasemapId(enabled ? "openfreemap_dark" : "osm");
    }
  }, []);

  useEffect(() => {
    if (!isCompactViewport()) return;
    setBasemapId(darkMode ? "openfreemap_dark" : "osm");
  }, [darkMode]);

  const handleBasemapChange = useCallback((nextBasemapId: BasemapId) => {
    window.localStorage.setItem(BASEMAP_SOURCE_KEY, "manual");
    setBasemapId(nextBasemapId);
  }, []);

  const handleCloseExhibitIntro = useCallback(() => {
    setShowExhibitIntro(false);
    if (isCompactViewport()) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
    }
  }, []);

  useEffect(() => {
    markedPanosRef.current = markedPanos;
  }, [markedPanos]);

  useEffect(() => {
    return () => {
      for (const objectUrl of panoObjectUrlsRef.current.values()) {
        revokeObjectUrl(objectUrl);
      }
      panoObjectUrlsRef.current.clear();
      panoRequestsRef.current.clear();
      for (const timer of mapProgressDismissTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      mapProgressDismissTimersRef.current.clear();
    };
  }, []);

  const clearMarkedPanos = useCallback(() => {
    for (const objectUrl of panoObjectUrlsRef.current.values()) {
      revokeObjectUrl(objectUrl);
    }
    panoObjectUrlsRef.current.clear();
    panoRequestsRef.current.clear();
    markedPanosRef.current = [];
    setMarkedPanos([]);
    setSelectedPanoKey(null);
  }, []);

  const runExhibitReset = useCallback(async (showIntro: boolean) => {
    clearMarkedPanos();
    setIdleResetCountdown(null);
    setError(null);
    const nextData = await resetExhibitState();
    setData(nextData);
    setBackendConfig(await getRemoteBackendConfig());
    if (showIntro) {
      setIntroVersion((version) => version + 1);
      setShowExhibitIntro(true);
    }
  }, [clearMarkedPanos]);

  useEffect(() => {
    if (!data || !exhibitConfig.idleResetEnabled || exhibitInitialResetRef.current) return;
    exhibitInitialResetRef.current = true;
    void runExhibitReset(false);
  }, [data, runExhibitReset]);

  useEffect(() => {
    if (
      !data ||
      !backendConfig?.enabled ||
      !isUsableRemoteBackendUrl(backendConfig.baseUrl) ||
      !exhibitConfig.idleResetEnabled ||
      !hasExhibitDefaultLayers(data.state) ||
      exhibitDefaultRequestRef.current
    ) {
      return;
    }

    let cancelled = false;
    exhibitDefaultRequestRef.current = true;
    void ensureExhibitDefaultRemoteLayers()
      .then((result) => {
        if (cancelled) return;
        if (!result.ready) {
          exhibitDefaultRequestRef.current = false;
          return;
        }
        void refresh();
      })
      .catch((err) => {
        if (cancelled) return;
        exhibitDefaultRequestRef.current = false;
        setError(err instanceof Error ? err.message : "Failed to request default exhibit prompts");
      });

    return () => {
      cancelled = true;
    };
  }, [backendConfig, data, refresh]);

  useEffect(() => {
    const publishIdleResetDebug = (patch: IdleResetDebugState) => {
      const nextState = {
        ...idleResetDebugRef.current,
        ...patch,
        idle_ms: exhibitConfig.idleMs
      };
      idleResetDebugRef.current = nextState;
      window.__SEMANTIC_MAP_IDLE_RESET__ = nextState;
    };

    if (!exhibitConfig.idleResetEnabled || showExhibitIntro) {
      setIdleResetCountdown(null);
      publishIdleResetDebug({
        enabled: exhibitConfig.idleResetEnabled,
        blocked_reason: exhibitConfig.idleResetEnabled ? "tutorial_open" : "disabled",
        reset_due_at: null,
        countdown_seconds: null
      });
      return;
    }
    let timer: number | undefined;
    let countdownTimer: number | undefined;
    let resetAt = 0;

    const schedule = (activityType: string) => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
      const now = Date.now();
      resetAt = now + exhibitConfig.idleMs;
      setIdleResetCountdown(null);
      publishIdleResetDebug({
        enabled: true,
        blocked_reason: null,
        armed_at: isoFromTimestamp(now),
        reset_due_at: isoFromTimestamp(resetAt),
        last_activity_at: isoFromTimestamp(now),
        last_activity_type: activityType,
        countdown_seconds: null
      });
      timer = window.setTimeout(() => {
        setIdleResetCountdown(null);
        publishIdleResetDebug({
          reset_due_at: null,
          countdown_seconds: null
        });
        void runExhibitReset(true);
      }, exhibitConfig.idleMs);
      countdownTimer = window.setInterval(() => {
        const remainingSeconds = Math.ceil((resetAt - Date.now()) / 1000);
        const countdownSeconds = remainingSeconds > 0 && remainingSeconds <= 30 ? remainingSeconds : null;
        setIdleResetCountdown(countdownSeconds);
        publishIdleResetDebug({ countdown_seconds: countdownSeconds });
      }, 1000);
    };

    const onActivity = (event: Event) => {
      if (!isIdleResetActivity(event)) {
        publishIdleResetDebug({
          ignored_activity_at: isoFromTimestamp(Date.now()),
          ignored_activity_type: event.type
        });
        return;
      }
      schedule(event.type);
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((eventName) => window.addEventListener(eventName, onActivity, { passive: true }));
    schedule("timer_start");

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (countdownTimer !== undefined) window.clearInterval(countdownTimer);
      events.forEach((eventName) => window.removeEventListener(eventName, onActivity));
    };
  }, [runExhibitReset, showExhibitIntro]);

  const selectedLayer = useMemo(() => {
    if (!data) return null;
    return data.state.layers.find((layer) => layer.id === data.state.selected_layer_id) ?? data.state.layers[0] ?? null;
  }, [data]);

  const selectedGradient = useMemo(() => {
    if (!data || !selectedLayer) return null;
    return layerGradient(selectedLayer, data.gradients);
  }, [data, selectedLayer]);

  const scoreField = selectedLayer?.score_property === "zscore" ? "zscore" : "score";
  const liveSearchAvailable = Boolean(backendConfig?.enabled && isUsableRemoteBackendUrl(backendConfig.baseUrl));

  const updateState = useCallback((mutator: (state: LayerState) => LayerState) => {
    setData((current) => {
      if (!current) return current;
      return { ...current, state: mutator(current.state) };
    });
  }, []);

  async function handleCreate(prompt: string) {
    setError(null);
    if (!liveSearchAvailable) {
      setError(STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE);
      return;
    }
    try {
      await createScoringJob(prompt, priorityTiles);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit prompt");
    }
  }

  async function handleCreateReference(reference: PanoReference) {
    setError(null);
    if (!liveSearchAvailable) {
      setError("Reference pano scoring requires a RunPod backend.");
      return;
    }
    try {
      await createPanoReferenceScoringJob(reference, priorityTiles);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit reference pano");
    }
  }

  async function handleRefreshAllLayers() {
    setError(null);
    if (!liveSearchAvailable) {
      await refresh();
      return;
    }
    setRefreshingLayers(true);
    try {
      await refreshAllScoringLayers(priorityTiles);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh layers");
    } finally {
      setRefreshingLayers(false);
    }
  }

  const handleSelect = useCallback(async (layerId: string) => {
    updateState((state) => ({ ...state, selected_layer_id: layerId }));
    try {
      await patchLayer(layerId, { selected: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select layer");
    }
  }, [updateState]);

  const handleMapSelectLayer = useCallback((layerId: string) => {
    void handleSelect(layerId);
  }, [handleSelect]);

  const handlePriorityTileChange = useCallback((cityId: CityId, tile: TileCoord | null) => {
    setPriorityTiles((current) => {
      const next = { ...current };
      if (tile) next[cityId] = tile;
      else delete next[cityId];
      return next;
    });
  }, []);

  const handleSelectPano = useCallback((panoKey: string) => {
    setSelectedPanoKey(panoKey);
  }, []);

  const handleRemovePano = useCallback((panoKey: string) => {
    const current = markedPanosRef.current;
    const next = current.filter((pano) => keyForPano(pano) !== panoKey);
    if (next.length === current.length) return;

    const objectUrl = panoObjectUrlsRef.current.get(panoKey);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      panoObjectUrlsRef.current.delete(panoKey);
    }
    panoRequestsRef.current.delete(panoKey);
    markedPanosRef.current = next;
    setMarkedPanos(next);
    setSelectedPanoKey((currentSelection) => (currentSelection === panoKey ? (next[0] ? keyForPano(next[0]) : null) : currentSelection));
  }, []);

  const handleMarkPano = useCallback((point: PanoMapPoint) => {
    const panoKey = keyForPano(point);
    setSelectedPanoKey(panoKey);

    const current = markedPanosRef.current;
    const existing = current.find((pano) => keyForPano(pano) === panoKey);
    if (existing && (existing.status === "ready" || existing.status === "loading" || panoRequestsRef.current.has(panoKey))) {
      const updated = current.map((pano) =>
        keyForPano(pano) === panoKey
          ? {
              ...pano,
              ...point,
              pano_key: panoKey,
              status: pano.status,
              image_url: pano.image_url,
              object_url: pano.object_url,
              member_name: pano.member_name,
              tar_id: pano.tar_id,
              message: pano.message
            }
          : pano
      );
      markedPanosRef.current = updated;
      setMarkedPanos(updated);
      return;
    }
    const loadingPano: MarkedPano = {
      ...point,
      pano_key: panoKey,
      status: "loading",
      message: "Loading pano"
    };
    const next = existing ? current.map((pano) => (keyForPano(pano) === panoKey ? loadingPano : pano)) : [...current, loadingPano];
    markedPanosRef.current = next;
    setMarkedPanos(next);

    panoRequestsRef.current.add(panoKey);
    void loadPanoImage(point.pano_id, point.dataset_id)
      .then((metadata) => {
        const latest = markedPanosRef.current;
        const latestPano = latest.find((pano) => keyForPano(pano) === panoKey);
        if (!latestPano) {
          revokeObjectUrl(metadata.object_url);
          return;
        }

        const previousObjectUrl = panoObjectUrlsRef.current.get(panoKey);
        if (previousObjectUrl && previousObjectUrl !== metadata.object_url) {
          revokeObjectUrl(previousObjectUrl);
        }
        if (metadata.object_url) {
          panoObjectUrlsRef.current.set(panoKey, metadata.object_url);
        }

        const loaded = latest.map((pano) =>
          keyForPano(pano) === panoKey
            ? {
                ...pano,
                status: "ready" as const,
                image_url: metadata.image_url ?? null,
                object_url: metadata.object_url ?? null,
                member_name: metadata.member_name ?? null,
                tar_id: metadata.tar_id ?? null,
                message: metadata.message || "Ready"
              }
            : pano
        );
        markedPanosRef.current = loaded;
        setMarkedPanos(loaded);
      })
      .catch((error) => {
        const latest = markedPanosRef.current;
        const failed = latest.map((pano) =>
          keyForPano(pano) === panoKey
            ? {
                ...pano,
                status: "failed" as const,
                message: panoFailureMessage(error)
              }
            : pano
        );
        markedPanosRef.current = failed;
        setMarkedPanos(failed);
      })
      .finally(() => {
        panoRequestsRef.current.delete(panoKey);
      });
  }, []);

  useEffect(() => {
    if (selectedLayer?.query_type !== "pano_reference" || !selectedLayer.reference_pano) return;
    const reference = selectedLayer.reference_pano;
    const signature = `${selectedLayer.id}:${reference.dataset_id}:${reference.pano_id}`;
    if (lastAutoReferenceRef.current === signature) return;
    lastAutoReferenceRef.current = signature;
    handleMarkPano({
      pano_id: reference.pano_id,
      pano_key: `${reference.dataset_id}:${reference.pano_id}`,
      dataset_id: reference.dataset_id,
      city_id: reference.city_id ?? null,
      lon: typeof reference.lon === "number" && Number.isFinite(reference.lon) ? reference.lon : 0,
      lat: typeof reference.lat === "number" && Number.isFinite(reference.lat) ? reference.lat : 0,
      date: reference.date ?? null,
      source_layer_id: selectedLayer.id,
      source_layer_name: selectedLayer.name,
      score: null,
      zscore: null
    });
  }, [handleMarkPano, selectedLayer]);

  async function handleToggle(layer: SemanticLayer) {
    updateState((state) => ({
      ...state,
      layers: state.layers.map((item) => (item.id === layer.id ? { ...item, visible: !item.visible } : item))
    }));
    try {
      await patchLayer(layer.id, { visible: !layer.visible });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    }
  }

  async function handleDelete(layer: SemanticLayer) {
    if (!window.confirm(`Delete layer "${layer.name}"?`)) return;
    updateState((state) => ({
      ...state,
      layers: state.layers.filter((item) => item.id !== layer.id),
      selected_layer_id: state.selected_layer_id === layer.id ? state.layers.find((item) => item.id !== layer.id)?.id ?? null : state.selected_layer_id
    }));
    try {
      await deleteLayer(layer.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete layer");
    }
  }

  async function handleReorder(layerIds: string[]) {
    updateState((state) => {
      const byId = new Map(state.layers.map((layer) => [layer.id, layer]));
      const layers = layerIds.map((id) => byId.get(id)).filter(Boolean) as SemanticLayer[];
      return { ...state, layers: layers.map((layer, index) => ({ ...layer, order: index })) };
    });
    try {
      const state = await reorderLayers(layerIds);
      setData((current) => (current ? { ...current, state } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder layers");
    }
  }

  async function handleApplyGradient(gradient: GradientPreset, layer: SemanticLayer, pointRadius: number, absoluteRadius: boolean) {
    const style = {
      ...layerStyleFromGradient(gradient, layer.style),
      point_radius: pointRadius,
      absolute_radius: absoluteRadius
    };
    updateState((state) => ({
      ...state,
      layers: state.layers.map((item) => (item.id === layer.id ? { ...item, style } : item))
    }));
    try {
      await patchLayer(layer.id, { style });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply gradient");
    }
  }

  async function handleSaveGradient(gradient: GradientPreset, layer: SemanticLayer, pointRadius: number, absoluteRadius: boolean) {
    setError(null);
    try {
      const saved = await saveGradient(gradient);
      await patchLayer(layer.id, {
        style: {
          ...layerStyleFromGradient(saved, layer.style),
          point_radius: pointRadius,
          absolute_radius: absoluteRadius
        }
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save gradient");
    }
  }

  async function handleDeleteGradient(gradient: GradientPreset) {
    setError(null);
    try {
      await deleteGradient(gradient.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete gradient");
    }
  }

  async function handleHistogramRangeChange(layer: SemanticLayer, scoreMin: number, scoreMax: number) {
    const style = {
      ...layer.style,
      score_min: scoreMin,
      score_max: scoreMax
    };
    updateState((state) => ({
      ...state,
      layers: state.layers.map((item) => (item.id === layer.id ? { ...item, style } : item))
    }));
    try {
      await patchLayer(layer.id, { style });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update histogram range");
      throw err;
    }
  }

  async function handleHistogramPropertyChange(layer: SemanticLayer, scoreProperty: string) {
    updateState((state) => ({
      ...state,
      layers: state.layers.map((item) => (item.id === layer.id ? { ...item, score_property: scoreProperty } : item))
    }));
    try {
      await patchLayer(layer.id, { score_property: scoreProperty });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update score field");
      throw err;
    }
  }

  if (!data) {
    return (
      <div className="boot-screen">
        <div className="boot-panel">
          <strong>Semantic Map</strong>
          <span>{loading ? "Loading" : error ?? "No state loaded"}</span>
          <button className="secondary-button" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Reload
          </button>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="sidebar-content">
      <div className="sidebar-top-bar">
        {runtimeConfig.mode === "screensaver" ? (
          <button className="secondary-button intro-button compact-action" onClick={() => setShowScreensaver(true)} title="Start screensaver" aria-label="Start screensaver">
            <MonitorPlay size={16} />
          </button>
        ) : (
          <button className="secondary-button intro-button" onClick={() => setShowExhibitIntro(true)}>
            <Info size={16} />
            Project intro
          </button>
        )}
        <label className="theme-toggle">
          <input type="checkbox" checked={darkMode} onChange={(event) => handleDarkModeChange(event.target.checked)} />
          <span>Dark mode</span>
        </label>
      </div>
      <PromptBar
        disabled={loading}
        liveSearchAvailable={liveSearchAvailable}
        backendConfig={backendConfig}
        remoteConfigLocked={exhibitConfig.lockRunpodUrl}
        onConfigChange={setBackendConfig}
        onCreate={handleCreate}
        onCreateReference={handleCreateReference}
      />
      <LayerPanel
        layers={data.state.layers}
        gradients={data.gradients}
        selectedLayerId={data.state.selected_layer_id}
        disabled={loading}
        onSelect={(layerId) => void handleSelect(layerId)}
        onToggle={(layer) => void handleToggle(layer)}
        onDelete={(layer) => void handleDelete(layer)}
        onReorder={(layerIds) => void handleReorder(layerIds)}
        onRefreshAll={handleRefreshAllLayers}
        refreshingAll={refreshingLayers}
        highlightHiddenEyes={data.state.layers.length > 0 && data.state.layers.every((layer) => !layer.visible)}
      />
      <HistogramPanel
        layer={selectedLayer}
        gradient={selectedGradient}
        onRangeChange={handleHistogramRangeChange}
        onPropertyChange={handleHistogramPropertyChange}
      />
      <GradientEditor
        layer={selectedLayer}
        gradient={selectedGradient}
        gradients={data.gradients}
        onApply={handleApplyGradient}
        onSavePreset={handleSaveGradient}
        onDeletePreset={(gradient) => handleDeleteGradient(gradient)}
      />
      {error ? (
        <div className="error-panel">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      <LogPanel entries={remoteLogs} onClear={() => setRemoteLogs([])} />
    </div>
  );

  return (
    <>
      <SplitPane
        className={darkMode ? "theme-dark" : ""}
        left={
          <MapView
            layers={data.state.layers}
            gradients={data.gradients}
            selectedLayerId={data.state.selected_layer_id}
            basemapId={basemapId}
            onBasemapChange={handleBasemapChange}
            onSelectLayer={handleMapSelectLayer}
            onPriorityTileChange={handlePriorityTileChange}
            markedPanos={markedPanos}
            selectedPanoKey={selectedPanoKey}
            onMarkPano={handleMarkPano}
            onSelectPano={handleSelectPano}
            onRemovePano={handleRemovePano}
            scoreField={scoreField}
            progressEntries={mapProgressEntries}
            refreshingLayers={refreshingLayers}
            onCreatePrompt={handleCreate}
            promptDisabled={loading}
            liveSearchAvailable={liveSearchAvailable}
          />
        }
        right={sidebar}
      />
      {idleResetCountdown !== null ? (
        <div className="idle-reset-warning">Long inactivity detected. Resetting in {idleResetCountdown} seconds.</div>
      ) : null}
      {showExhibitIntro ? <ExhibitIntroModal key={introVersion} onClose={handleCloseExhibitIntro} /> : null}
      {showScreensaver ? <ScreensaverOverlay onClose={() => setShowScreensaver(false)} /> : null}
    </>
  );
}

function ExhibitIntroModal({ onClose }: { onClose: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<TourHighlightRect | null>(null);
  const page = TUTORIAL_PAGES[pageIndex];
  const isFirst = pageIndex === 0;
  const isLast = pageIndex === TUTORIAL_PAGES.length - 1;

  useEffect(() => {
    let activeElement: HTMLElement | null = null;
    let settleTimer: number | undefined;

    const setActiveElement = (element: HTMLElement | null) => {
      if (activeElement === element) return;
      activeElement?.classList.remove("tour-target-active");
      activeElement = element;
      activeElement?.classList.add("tour-target-active");
    };

    const resolveTarget = () =>
      document.querySelector<HTMLElement>(`[data-tour-target="${page.target}"]`) ??
      document.querySelector<HTMLElement>('[data-tour-target="map"]');

    const updateHighlight = () => {
      const target = resolveTarget();
      setActiveElement(target);
      if (!target) {
        setHighlightRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 8;
      const left = Math.max(8, rect.left - padding);
      const top = Math.max(8, rect.top - padding);
      const width = Math.min(window.innerWidth - left - 8, rect.width + padding * 2);
      const height = Math.min(window.innerHeight - top - 8, rect.height + padding * 2);
      setHighlightRect({ left, top, width, height });
    };

    const target = resolveTarget();
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateHighlight();
    settleTimer = window.setTimeout(updateHighlight, 360);
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);

    return () => {
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
      activeElement?.classList.remove("tour-target-active");
      setHighlightRect(null);
    };
  }, [page.target]);

  return (
    <div className="exhibit-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="exhibit-intro-title">
      {highlightRect ? (
        <div
          className="tour-highlight-frame"
          style={{
            left: highlightRect.left,
            top: highlightRect.top,
            width: highlightRect.width,
            height: highlightRect.height
          }}
        />
      ) : null}
      <div className="exhibit-modal">
        <div className="exhibit-modal-top">
          <span className="exhibit-modal-eyebrow">UrbanFabric tutorial</span>
          <button className="icon-button exhibit-modal-close" onClick={onClose} title="Skip tutorial">
            <X size={16} />
          </button>
        </div>
        <div className="intro-progress-row" aria-label={`Tutorial step ${pageIndex + 1} of ${TUTORIAL_PAGES.length}`}>
          {TUTORIAL_PAGES.map((item, index) => (
            <button
              className={`intro-progress-dot${index === pageIndex ? " is-active" : ""}`}
              key={item.eyebrow}
              onClick={() => setPageIndex(index)}
              title={item.title}
            />
          ))}
        </div>
        <span className="intro-page-eyebrow">{page.eyebrow}</span>
        <h2 id="exhibit-intro-title">{page.title}</h2>
        <p>{page.body}</p>
        <ul className="intro-step-list">
          {page.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="intro-modal-footer">
          <button className="secondary-button" onClick={onClose}>
            Skip tutorial
          </button>
          <div className="intro-modal-actions">
            <button className="secondary-button" onClick={() => setPageIndex((index) => Math.max(0, index - 1))} disabled={isFirst}>
              <ChevronLeft size={16} />
              Back
            </button>
            <button className="primary-text-button" onClick={() => (isLast ? onClose() : setPageIndex((index) => index + 1))}>
              {isLast ? "Start exploring" : "Next"}
              {!isLast ? <ChevronRight size={16} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type TourHighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function updateMapProgressEntries(
  entry: RemoteLogEntry,
  timers: Map<string, number>,
  setEntries: Dispatch<SetStateAction<RemoteLogEntry[]>>
) {
  if (!entry.map_overlay || !entry.job_id) return;

  const key = mapProgressKey(entry);
  const previousTimer = timers.get(key);
  if (previousTimer !== undefined) {
    window.clearTimeout(previousTimer);
    timers.delete(key);
  }

  setEntries((current) => [entry, ...current.filter((item) => mapProgressKey(item) !== key)].slice(0, 4));

  if (isTerminalRemoteStatus(entry.status)) {
    const dismissDelay = entry.status === "ready" ? 3500 : 7000;
    const timer = window.setTimeout(() => {
      timers.delete(key);
      setEntries((current) => current.filter((item) => mapProgressKey(item) !== key));
    }, dismissDelay);
    timers.set(key, timer);
  }
}

function mapProgressKey(entry: RemoteLogEntry): string {
  return entry.job_id || entry.layer_id || entry.id;
}

function isTerminalRemoteStatus(status: RemoteLogEntry["status"]): boolean {
  return status === "ready" || status === "failed" || status === "cancelled";
}
