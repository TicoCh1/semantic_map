import type { RemoteLogEntry } from "../api/types";
import { runtimeConfig } from "./runtimeConfig";

type DemoSeverity = "info" | "warning" | "critical" | "recovered";
type DemoSource = "frontend" | "watchdog" | "backend";

type DemoEvent = {
  source: DemoSource;
  severity: DemoSeverity;
  code: string;
  message: string;
  session_id?: string;
  observed_at?: string;
  details?: Record<string, unknown>;
};

const REMOTE_LOG_EVENT = "semantic-map-remote-log";
const HEARTBEAT_INTERVAL_MS = 10000;
const REQUEST_TIMEOUT_MS = 5000;
const MAIN_THREAD_STALL_MS = 8000;
const SESSION_KEY = "semantic-map-demo-monitor-session-id";

let started = false;
let sessionId = "";
let lastMainThreadLagMs = 0;
let maxMainThreadLagMs = 0;
let inFlightPosts = 0;

export function startDemoFrontendMonitor() {
  if (started || runtimeConfig.mode !== "demo" || !runtimeConfig.runpodUrl) return;
  started = true;
  sessionId = readOrCreateSessionId();

  window.addEventListener("error", (event) => {
    reportDemoMonitorEvent({
      severity: "critical",
      code: "frontend_window_error",
      message: event.message || "Frontend window error.",
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: errorDetails(event.error)
      }
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportDemoMonitorEvent({
      severity: "critical",
      code: "frontend_unhandled_rejection",
      message: "Frontend unhandled promise rejection.",
      details: {
        reason: errorDetails(event.reason)
      }
    });
  });

  window.addEventListener(REMOTE_LOG_EVENT, (event) => {
    const entry = (event as CustomEvent<RemoteLogEntry>).detail;
    if (!entry || entry.status !== "failed") return;
    reportDemoMonitorEvent({
      severity: "warning",
      code: "frontend_remote_operation_failed",
      message: entry.message || "Frontend remote operation failed.",
      details: {
        layer_id: entry.layer_id,
        job_id: entry.job_id,
        prompt: entry.prompt,
        current_stage: entry.current_stage,
        current_tile: entry.current_tile,
        stage_timings: entry.stage_timings
      }
    });
  });

  window.addEventListener("offline", () => {
    reportDemoMonitorEvent({
      severity: "critical",
      code: "frontend_browser_offline",
      message: "The demo browser went offline.",
      details: baseDetails()
    });
  });

  window.addEventListener("online", () => {
    reportDemoMonitorEvent({
      severity: "recovered",
      code: "frontend_browser_online",
      message: "The demo browser is back online.",
      details: baseDetails()
    });
  });

  window.addEventListener("visibilitychange", sendHeartbeat);
  window.addEventListener("pagehide", (event) => {
    const eventPayload = buildDemoMonitorEventPayload({
      severity: "info",
      code: "frontend_page_hidden_or_closing",
      message: "Frontend page is being hidden or closed.",
      details: {
        ...baseDetails(),
        pagehide_persisted: event.persisted
      }
    });
    const sentToWatchdog = postWatchdogBeacon("/frontend/events", eventPayload);
    void postBackendDemoMonitorPayload("/api/demo/monitor/events", eventPayload);
    void postWatchdogPayload("/frontend/events", eventPayload, { keepaliveOnly: sentToWatchdog });
  });

  startMainThreadLagProbe();
  sendHeartbeat();
  window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export function reportDemoMonitorEvent(payload: Omit<DemoEvent, "source" | "session_id" | "observed_at">) {
  if (runtimeConfig.mode !== "demo" || !runtimeConfig.runpodUrl) return;
  const eventPayload = buildDemoMonitorEventPayload(payload);
  void postBackendDemoMonitorPayload("/api/demo/monitor/events", eventPayload);
  void postWatchdogPayload("/frontend/events", eventPayload);
}

function buildDemoMonitorEventPayload(payload: Omit<DemoEvent, "source" | "session_id" | "observed_at">) {
  return {
    source: "frontend",
    session_id: sessionId || readOrCreateSessionId(),
    observed_at: utcNow(),
    ...payload,
    details: {
      ...baseDetails(),
      ...(payload.details ?? {})
    }
  };
}

function sendHeartbeat() {
  const heartbeatPayload = {
    source: "frontend",
    session_id: sessionId || readOrCreateSessionId(),
    status: !navigator.onLine ? "offline" : document.visibilityState === "hidden" ? "hidden" : "ok",
    observed_at: utcNow(),
    frontend_url: window.location.href,
    backend_url: runtimeConfig.runpodUrl,
    details: baseDetails()
  };
  void postBackendDemoMonitorPayload("/api/demo/monitor/heartbeat", heartbeatPayload);
  void postWatchdogPayload("/frontend/heartbeat", heartbeatPayload);
}

function startMainThreadLagProbe() {
  let expectedAt = performance.now() + 1000;
  window.setInterval(() => {
    const now = performance.now();
    const lag = Math.max(0, now - expectedAt);
    expectedAt = now + 1000;
    lastMainThreadLagMs = Math.round(lag);
    maxMainThreadLagMs = Math.max(maxMainThreadLagMs, lastMainThreadLagMs);
    if (lag >= MAIN_THREAD_STALL_MS) {
      reportDemoMonitorEvent({
        severity: "warning",
        code: "frontend_main_thread_stall",
        message: `Frontend main thread stalled for ${Math.round(lag)} ms.`,
        details: { lag_ms: Math.round(lag) }
      });
    }
  }, 1000);
}

async function postBackendDemoMonitorPayload(path: string, payload: unknown) {
  await postJson(`${runtimeConfig.runpodUrl.replace(/\/+$/, "")}${path}`, monitorHeaders(), payload);
}

async function postWatchdogPayload(path: string, payload: unknown, options: { keepaliveOnly?: boolean } = {}) {
  if (!runtimeConfig.demoWatchdogUrl) return;
  await postJson(
    `${runtimeConfig.demoWatchdogUrl.replace(/\/+$/, "")}${path}`,
    { "Content-Type": "text/plain;charset=UTF-8" },
    payload,
    options
  );
}

function postWatchdogBeacon(path: string, payload: unknown): boolean {
  if (!runtimeConfig.demoWatchdogUrl || !navigator.sendBeacon) return false;
  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
    return navigator.sendBeacon(`${runtimeConfig.demoWatchdogUrl.replace(/\/+$/, "")}${path}`, blob);
  } catch {
    return false;
  }
}

async function postJson(url: string, headers: HeadersInit, payload: unknown, options: { keepaliveOnly?: boolean } = {}) {
  if (inFlightPosts > 4) return;
  inFlightPosts += 1;
  const controller = new AbortController();
  const timeout = options.keepaliveOnly ? 0 : window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const body = JSON.stringify(payload);
    await fetch(url, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      keepalive: body.length < 60000,
      signal: options.keepaliveOnly ? undefined : controller.signal
    });
  } catch {
  } finally {
    if (timeout) window.clearTimeout(timeout);
    inFlightPosts -= 1;
  }
}

function monitorHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (runtimeConfig.runpodToken) headers.Authorization = `Bearer ${runtimeConfig.runpodToken}`;
  return headers;
}

function baseDetails(): Record<string, unknown> {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }).memory;
  return {
    href: window.location.href,
    visibility_state: document.visibilityState,
    online: navigator.onLine,
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    main_thread_last_lag_ms: lastMainThreadLagMs,
    main_thread_max_lag_ms: maxMainThreadLagMs,
    used_js_heap_mb: memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null,
    js_heap_limit_mb: memory?.jsHeapSizeLimit ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : null
  };
}

function readOrCreateSessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = `frontend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function errorDetails(value: unknown): Record<string, unknown> {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack?.slice(0, 4000)
    };
  }
  return { value: String(value).slice(0, 4000) };
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
