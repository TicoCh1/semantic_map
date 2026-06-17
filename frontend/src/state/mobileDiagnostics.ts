type DiagnosticDetails = Record<string, unknown>;

export type MobileDiagnosticEntry = {
  id: string;
  timestamp: string;
  type: string;
  details?: DiagnosticDetails;
};

type DiagnosticsApi = {
  entries: MobileDiagnosticEntry[];
  export: () => MobileDiagnosticEntry[];
  clear: () => void;
  record: (type: string, details?: DiagnosticDetails) => void;
};

type DiagnosticMap = {
  on: (type: string, listener: (...args: any[]) => void) => void;
  off: (type: string, listener: (...args: any[]) => void) => void;
  getCanvas?: () => HTMLCanvasElement;
  getCenter?: () => { lng: number; lat: number };
  getZoom?: () => number;
  getPixelRatio?: () => number;
};

type AttachMapDiagnosticsOptions = {
  cityId: string;
  container?: HTMLElement | null;
  reducedPixelRatio?: boolean;
};

declare global {
  interface Window {
    __SEMANTIC_MAP_DIAGNOSTICS__?: DiagnosticsApi;
  }
}

const DIAGNOSTICS_KEY = "semantic-map-mobile-diagnostics-v1";
const ACTIVE_SESSION_KEY = "semantic-map-mobile-diagnostics-active-v1";
const MAX_ENTRIES = 240;
const MAIN_THREAD_STALL_MS = 450;
const MAIN_THREAD_SAMPLE_MS = 1000;
const HEAP_SAMPLE_MS = 15000;

let started = false;
let entries: MobileDiagnosticEntry[] = [];
let panel: HTMLDivElement | null = null;
let panelRenderTimer: number | undefined;

export function startMobileDiagnostics() {
  if (started || typeof window === "undefined") return;
  started = true;
  entries = readStoredEntries();

  exposeDiagnosticsApi();
  recordPreviousSessionIfNeeded();
  installGlobalListeners();
  installMainThreadSampler();
  installHeapSampler();

  recordMobileDiagnostic("diagnostics_started", runtimeSnapshot());
  if (shouldShowPanel()) ensureDiagnosticsPanel();
}

export function recordMobileDiagnostic(type: string, details?: DiagnosticDetails) {
  if (typeof window === "undefined") return;
  const entry: MobileDiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    type,
    details: details ? sanitizeDetails(details) : undefined
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persistEntries();
  exposeDiagnosticsApi();
  schedulePanelRender();
}

export function attachMapDiagnostics(map: DiagnosticMap, options: AttachMapDiagnosticsOptions): () => void {
  const canvas = map.getCanvas?.();
  const recordMapSnapshot = (type: string, extra: DiagnosticDetails = {}) => {
    recordMobileDiagnostic(type, {
      city_id: options.cityId,
      reduced_pixel_ratio: options.reducedPixelRatio ?? false,
      ...mapSnapshot(map, options.container ?? null),
      ...extra
    });
  };

  const onMapError = (event: { error?: Error }) => {
    recordMapSnapshot("maplibre_error", {
      message: event.error?.message ?? "MapLibre error",
      name: event.error?.name ?? null,
      stack: event.error?.stack?.slice(0, 1600) ?? null
    });
  };
  const onMoveEnd = () => recordMapSnapshot("map_moveend");
  const onZoomEnd = () => recordMapSnapshot("map_zoomend");
  const onIdle = () => recordMapSnapshot("map_idle");
  const onContextLost = (event: Event) => {
    event.preventDefault();
    recordMapSnapshot("webgl_context_lost");
  };
  const onContextRestored = () => recordMapSnapshot("webgl_context_restored");

  map.on("error", onMapError);
  map.on("moveend", onMoveEnd);
  map.on("zoomend", onZoomEnd);
  map.on("idle", onIdle);
  canvas?.addEventListener("webglcontextlost", onContextLost, false);
  canvas?.addEventListener("webglcontextrestored", onContextRestored, false);
  recordMapSnapshot("map_diagnostics_attached");

  return () => {
    map.off("error", onMapError);
    map.off("moveend", onMoveEnd);
    map.off("zoomend", onZoomEnd);
    map.off("idle", onIdle);
    canvas?.removeEventListener("webglcontextlost", onContextLost);
    canvas?.removeEventListener("webglcontextrestored", onContextRestored);
  };
}

function installGlobalListeners() {
  const onGlobalError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      recordMobileDiagnostic("window_error", {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        name: event.error?.name ?? null,
        stack: event.error?.stack?.slice(0, 1600) ?? null
      });
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    recordMobileDiagnostic("resource_error", {
      tag: target.tagName,
      src: readElementUrl(target),
      outer_html: target.outerHTML?.slice(0, 600)
    });
  };

  window.addEventListener(
    "error",
    onGlobalError,
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordMobileDiagnostic("unhandled_rejection", {
      message: reason instanceof Error ? reason.message : String(reason),
      name: reason instanceof Error ? reason.name : null,
      stack: reason instanceof Error ? reason.stack?.slice(0, 1600) : null
    });
  });

  window.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length < 2) return;
      recordMobileDiagnostic("pinch_start", {
        touches: event.touches.length,
        ...runtimeSnapshot()
      });
    },
    { passive: true }
  );

  const closeSession = (type: string) => {
    recordMobileDiagnostic(type, runtimeSnapshot());
    window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  };
  window.addEventListener("pagehide", () => closeSession("pagehide"));
  window.addEventListener("beforeunload", () => closeSession("beforeunload"));
}

function installMainThreadSampler() {
  let last = performance.now();
  window.setInterval(() => {
    const now = performance.now();
    const lag = now - last - MAIN_THREAD_SAMPLE_MS;
    last = now;
    if (lag > MAIN_THREAD_STALL_MS) {
      recordMobileDiagnostic("main_thread_stall", {
        lag_ms: Math.round(lag),
        ...runtimeSnapshot()
      });
    }
  }, MAIN_THREAD_SAMPLE_MS);
}

function installHeapSampler() {
  window.setInterval(() => {
    const heap = heapSnapshot();
    if (!heap) return;
    recordMobileDiagnostic("heap_sample", heap);
  }, HEAP_SAMPLE_MS);
}

function recordPreviousSessionIfNeeded() {
  const previous = window.localStorage.getItem(ACTIVE_SESSION_KEY);
  if (previous) {
    recordMobileDiagnostic("previous_unclean_exit", {
      previous_session: safeParse(previous)
    });
  }
  window.localStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify({
      started_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      ...runtimeSnapshot()
    })
  );
}

function exposeDiagnosticsApi() {
  window.__SEMANTIC_MAP_DIAGNOSTICS__ = {
    entries,
    export: () => [...entries],
    clear: () => {
      entries = [];
      persistEntries();
      exposeDiagnosticsApi();
      schedulePanelRender();
    },
    record: recordMobileDiagnostic
  };
}

function ensureDiagnosticsPanel() {
  if (panel) return;
  panel = document.createElement("div");
  panel.className = "mobile-diagnostics-panel";
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");
  document.body.appendChild(panel);
  renderDiagnosticsPanel();
}

function schedulePanelRender() {
  if (!panel) return;
  if (panelRenderTimer !== undefined) window.clearTimeout(panelRenderTimer);
  panelRenderTimer = window.setTimeout(() => {
    panelRenderTimer = undefined;
    renderDiagnosticsPanel();
  }, 120);
}

function renderDiagnosticsPanel() {
  if (!panel) return;
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "mobile-diagnostics-header";

  const title = document.createElement("strong");
  title.textContent = `Diagnostics (${entries.length})`;
  header.appendChild(title);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear";
  clear.addEventListener("click", () => window.__SEMANTIC_MAP_DIAGNOSTICS__?.clear());
  header.appendChild(clear);

  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(JSON.stringify(entries, null, 2));
  });
  header.appendChild(copy);

  const body = document.createElement("pre");
  body.textContent = JSON.stringify(entries.slice(0, 40), null, 2);

  panel.appendChild(header);
  panel.appendChild(body);
}

function readStoredEntries(): MobileDiagnosticEntry[] {
  const parsed = safeParse(window.localStorage.getItem(DIAGNOSTICS_KEY) || "[]");
  return Array.isArray(parsed) ? (parsed as MobileDiagnosticEntry[]).slice(0, MAX_ENTRIES) : [];
}

function persistEntries() {
  try {
    window.localStorage.setItem(DIAGNOSTICS_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // LocalStorage can fail in private browsing or under quota pressure.
  }
}

function shouldShowPanel(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("diag") === "1" || params.get("debugDiagnostics") === "1";
}

function readElementUrl(element: HTMLElement): string | null {
  if (element instanceof HTMLImageElement || element instanceof HTMLScriptElement) return element.src || null;
  if (element instanceof HTMLLinkElement) return element.href || null;
  if (element instanceof HTMLSourceElement) return element.src || null;
  return null;
}

function mapSnapshot(map: DiagnosticMap, container: HTMLElement | null): DiagnosticDetails {
  const canvas = map.getCanvas?.();
  const center = map.getCenter?.();
  const canvasRect = canvas?.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect();
  const cssWidth = canvasRect?.width ?? 0;
  const cssHeight = canvasRect?.height ?? 0;
  const pixelRatioFromCanvas = cssWidth > 0 ? (canvas?.width ?? 0) / cssWidth : null;
  return {
    zoom: safeNumber(map.getZoom?.()),
    center: center ? { lng: safeNumber(center.lng), lat: safeNumber(center.lat) } : null,
    canvas_css: canvasRect ? { width: Math.round(canvasRect.width), height: Math.round(canvasRect.height) } : null,
    canvas_pixels: canvas ? { width: canvas.width, height: canvas.height } : null,
    container_css: containerRect ? { width: Math.round(containerRect.width), height: Math.round(containerRect.height) } : null,
    map_pixel_ratio: safeNumber(map.getPixelRatio?.()),
    canvas_pixel_ratio: pixelRatioFromCanvas === null ? null : Number(pixelRatioFromCanvas.toFixed(3)),
    ...runtimeSnapshot()
  };
}

function runtimeSnapshot(): DiagnosticDetails {
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    device_pixel_ratio: window.devicePixelRatio,
    color_scheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    mobile_breakpoint: window.matchMedia("(max-width: 700px)").matches,
    online: navigator.onLine,
    heap: heapSnapshot()
  };
}

function heapSnapshot(): DiagnosticDetails | null {
  const performanceWithMemory = performance as Performance & {
    memory?: {
      jsHeapSizeLimit?: number;
      totalJSHeapSize?: number;
      usedJSHeapSize?: number;
    };
  };
  const memory = performanceWithMemory.memory;
  if (!memory) return null;
  return {
    used_js_heap_size: memory.usedJSHeapSize ?? null,
    total_js_heap_size: memory.totalJSHeapSize ?? null,
    js_heap_size_limit: memory.jsHeapSizeLimit ?? null
  };
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function sanitizeDetails(details: DiagnosticDetails): DiagnosticDetails {
  return safeParse(JSON.stringify(details)) as DiagnosticDetails;
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
