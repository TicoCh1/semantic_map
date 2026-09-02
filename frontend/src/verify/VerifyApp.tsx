import { Download, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getRemoteBackendConfig, isUsableRemoteBackendUrl, loadPanoImage, saveRemoteBackendConfig } from "../api/client";
import type { RemoteBackendConfig } from "../api/types";
import { PanoramaViewer } from "../components/PanoramaViewer";
import { panoDatasetIdForPoint } from "../state/panoDatasets";
import { exportRatingsCsv, loadRatings, localRaterId, saveRatings } from "./responseStorage";
import type { HumanRatingRecord, HumanVerificationStudy, HumanVerificationTask } from "./types";

const PREFETCH_COUNT = 5;
const DEFAULT_SAMPLES_PER_BUCKET = 5;

type CachedPano = {
  status: "loading" | "ready" | "failed";
  objectUrl?: string;
  message?: string;
};

function initialParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

export function VerifyApp() {
  const [backendUrl, setBackendUrl] = useState(() => initialParam("backend") || initialParam("runpod"));
  const [study, setStudy] = useState<HumanVerificationStudy | null>(null);
  const [ratings, setRatings] = useState<Record<string, HumanRatingRecord>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [, setCacheVersion] = useState(0);
  const raterId = useMemo(localRaterId, []);
  const autoStartedRef = useRef(false);
  const currentStartedAtRef = useRef(performance.now());
  const panoCacheRef = useRef<Map<string, CachedPano>>(new Map());
  const panoRequestsRef = useRef<Map<string, Promise<void>>>(new Map());
  const backendConfigRef = useRef<RemoteBackendConfig | null>(null);

  const connectAndLoad = useCallback(async () => {
    const requestedBackendUrl = backendUrl.trim();
    if (!isUsableRemoteBackendUrl(requestedBackendUrl)) {
      setError("Enter a valid RunPod URL.");
      return;
    }

    setLoadingStudy(true);
    setError(null);
    setSyncError(null);
    try {
      const currentConfig = await getRemoteBackendConfig();
      const savedConfig = await saveRemoteBackendConfig({
        ...currentConfig,
        baseUrl: requestedBackendUrl,
        enabled: true
      });
      const response = await fetch(`${savedConfig.baseUrl}/api/verification/sample`, {
        method: "POST",
        headers: verificationHeaders(savedConfig),
        body: JSON.stringify({
          samples_per_bucket_per_dataset: DEFAULT_SAMPLES_PER_BUCKET
        })
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { detail?: string } | null;
        throw new Error(detail?.detail || `Verification sample request failed (${response.status}).`);
      }
      const nextStudy = await response.json() as HumanVerificationStudy;
      if (!nextStudy.tasks.length) throw new Error("The completed result contains no verification tasks.");

      const verificationConfig = await saveRemoteBackendConfig({
        ...savedConfig,
        datasetId: nextStudy.dataset_ids[0] || savedConfig.datasetId,
        datasetIds: nextStudy.dataset_ids,
        datasetGroupId: nextStudy.dataset_group_id || savedConfig.datasetGroupId,
        enabled: true
      });
      backendConfigRef.current = verificationConfig;
      clearPanoCache(panoCacheRef.current);
      panoRequestsRef.current.clear();
      const savedRatings = loadRatings(nextStudy.study_id);
      setStudy(nextStudy);
      setRatings(savedRatings);
      setCurrentIndex(firstUnratedIndex(nextStudy, savedRatings));
      setBackendUrl(savedConfig.baseUrl);
      syncQuery(savedConfig.baseUrl);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the verification study.");
    } finally {
      setLoadingStudy(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (autoStartedRef.current || !backendUrl.trim()) return;
    autoStartedRef.current = true;
    void connectAndLoad();
  }, [backendUrl, connectAndLoad]);

  const ensurePano = useCallback((task: HumanVerificationTask) => {
    const cached = panoCacheRef.current.get(task.task_id);
    if (cached?.status === "ready" || panoRequestsRef.current.has(task.task_id)) return;
    panoCacheRef.current.set(task.task_id, { status: "loading" });
    setCacheVersion((version) => version + 1);

    const panoDatasetId = panoDatasetIdForPoint(task.dataset_id, task.lon, task.lat);
    const request = loadPanoImage(task.pano_id, panoDatasetId, {
      lon: task.lon,
      lat: task.lat,
      date: task.date ?? null
    })
      .then((metadata) => {
        panoCacheRef.current.set(task.task_id, {
          status: "ready",
          objectUrl: metadata.object_url || metadata.image_url || undefined,
          message: metadata.message
        });
      })
      .catch((panoError) => {
        panoCacheRef.current.set(task.task_id, {
          status: "failed",
          message: panoError instanceof Error ? panoError.message : "Panorama failed to load."
        });
      })
      .finally(() => {
        panoRequestsRef.current.delete(task.task_id);
        setCacheVersion((version) => version + 1);
      });
    panoRequestsRef.current.set(task.task_id, request);
  }, []);

  useEffect(() => {
    if (!study || currentIndex >= study.tasks.length) return;
    for (const task of study.tasks.slice(currentIndex, currentIndex + PREFETCH_COUNT)) {
      ensurePano(task);
    }
  }, [currentIndex, ensurePano, study]);

  useEffect(() => {
    currentStartedAtRef.current = performance.now();
  }, [currentIndex]);

  useEffect(() => () => clearPanoCache(panoCacheRef.current), []);

  const currentTask = study?.tasks[currentIndex] ?? null;
  const currentPano = currentTask ? panoCacheRef.current.get(currentTask.task_id) : null;
  const ratedCount = Object.keys(ratings).length;
  const complete = Boolean(study && currentIndex >= study.tasks.length);

  const syncRating = useCallback(async (record: HumanRatingRecord) => {
    const config = backendConfigRef.current ?? await getRemoteBackendConfig();
    const response = await fetch(`${config.baseUrl}/api/verification/ratings`, {
      method: "POST",
      headers: verificationHeaders(config),
      keepalive: true,
      body: JSON.stringify({
        ratings: [{
          study_id: record.study_id,
          task_id: record.task_id,
          rater_id: record.rater_id,
          human_rating: record.human_rating,
          elapsed_ms: record.elapsed_ms,
          rated_at: record.rated_at
        }]
      })
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(detail?.detail || `Backend rating sync failed (${response.status}).`);
    }
  }, []);

  const rate = useCallback((rating: 1 | 2 | 3 | 4 | 5) => {
    if (!study || !currentTask || currentPano?.status !== "ready") return;
    const record: HumanRatingRecord = {
      ...currentTask,
      study_id: study.study_id,
      prompt: study.prompt,
      dataset_group_id: study.dataset_group_id,
      rater_id: raterId,
      task_order: currentIndex + 1,
      human_rating: rating,
      elapsed_ms: Math.max(0, Math.round(performance.now() - currentStartedAtRef.current)),
      rated_at: new Date().toISOString()
    };
    const nextRatings = { ...ratings, [currentTask.task_id]: record };
    setRatings(nextRatings);
    saveRatings(study.study_id, nextRatings);
    void syncRating(record)
      .then(() => setSyncError(null))
      .catch((syncFailure) => {
        const message = syncFailure instanceof Error ? syncFailure.message : "Backend rating sync failed.";
        setSyncError(`Saved locally, but not yet stored by RunPod: ${message}`);
      });
    setCurrentIndex(nextUnratedIndex(study, nextRatings, currentIndex + 1));
  }, [currentIndex, currentPano?.status, currentTask, raterId, ratings, study, syncRating]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const numeric = Number(event.key);
      if (numeric >= 1 && numeric <= 5) rate(numeric as 1 | 2 | 3 | 4 | 5);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rate]);

  function submitSetup(event: FormEvent) {
    event.preventDefault();
    void connectAndLoad();
  }

  function retryCurrentPano() {
    if (!currentTask) return;
    const cached = panoCacheRef.current.get(currentTask.task_id);
    revokeIfBlob(cached?.objectUrl);
    panoCacheRef.current.delete(currentTask.task_id);
    ensurePano(currentTask);
  }

  if (!study) {
    return (
      <main className="verify-setup-shell">
        <form className="verify-setup-card" onSubmit={submitSetup}>
          <div className="verify-wordmark">UrbanFabric</div>
          <h1>Human Verify</h1>
          <p>The backend will randomly select a completed semantic prompt. Rate how well it matches each 360° street scene.</p>
          <label>
            <span>RunPod URL</span>
            <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="https://pod-id-8000.proxy.runpod.net" autoFocus />
          </label>
          {error ? <div className="verify-error">{error}</div> : null}
          <button className="verify-primary-button" type="submit" disabled={loadingStudy}>
            {loadingStudy ? <LoaderCircle className="verify-spin" size={18} /> : null}
            {loadingStudy ? "Preparing sample" : "Start verification"}
          </button>
          <small>Five z-score buckets anchored from −1 to 3 · open tails included · five samples per bucket and dataset</small>
        </form>
      </main>
    );
  }

  return (
    <main className="verify-app-shell">
      <header className="verify-toolbar">
        <div className="verify-brand-block">
          <span>UrbanFabric</span>
          <strong>Human Verify</strong>
        </div>
        <form className="verify-backend-control" onSubmit={submitSetup}>
          <label htmlFor="verify-backend-url">RunPod</label>
          <input id="verify-backend-url" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          <button type="submit" title="Choose another completed prompt" aria-label="Choose another completed prompt" disabled={loadingStudy}>
            <RefreshCw className={loadingStudy ? "verify-spin" : ""} size={17} />
          </button>
        </form>
        <div className="verify-progress-block" aria-label={`${ratedCount} of ${study.tasks.length} rated`}>
          <span>Rated</span>
          <strong>{ratedCount}<small> / {study.tasks.length}</small></strong>
        </div>
        <button className="verify-export-button" type="button" onClick={() => exportRatingsCsv(study, ratings)} disabled={!ratedCount}>
          <Download size={17} />
          Export results
        </button>
      </header>

      <section className="verify-viewer-section">
        {complete ? (
          <div className="verify-complete-state">
            <div className="verify-complete-mark">{ratedCount}</div>
            <h2>Verification complete</h2>
            <p>Your ratings are saved in this browser. Export the results as a local CSV file.</p>
            <button className="verify-primary-button" type="button" onClick={() => exportRatingsCsv(study, ratings)}>
              <Download size={18} />
              Export results
            </button>
          </div>
        ) : (
          <PanoramaViewer className="verify-panorama" panoramaUrl={currentPano?.status === "ready" ? currentPano.objectUrl : null}>
            {!currentPano || currentPano.status === "loading" ? (
              <div className="verify-viewer-state">
                <LoaderCircle className="verify-spin" size={26} />
                <span>Loading street view</span>
              </div>
            ) : null}
            {currentPano?.status === "failed" ? (
              <div className="verify-viewer-state verify-viewer-error">
                <span>{currentPano.message || "Panorama failed to load."}</span>
                <button type="button" onClick={retryCurrentPano}>
                  <RotateCcw size={17} />
                  Retry
                </button>
              </div>
            ) : null}
          </PanoramaViewer>
        )}
      </section>

      {!complete && currentTask ? (
        <section className="verify-rating-panel">
          <div className="verify-prompt-block">
            <span>Rate this statement</span>
            <h1>{study.prompt}</h1>
          </div>
          <div className="verify-scale" role="group" aria-label="Human rating from 1 to 5">
            {RATING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => rate(option.value)}
                disabled={currentPano?.status !== "ready"}
                aria-label={`${option.value}: ${option.label}`}
              >
                <strong>{option.value}</strong>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {(error || syncError) && study ? <div className="verify-floating-error">{error || syncError}</div> : null}
    </main>
  );
}

const RATING_OPTIONS = [
  { value: 1 as const, label: "Not at all" },
  { value: 2 as const, label: "Slightly" },
  { value: 3 as const, label: "Moderately" },
  { value: 4 as const, label: "Strongly" },
  { value: 5 as const, label: "Dominant" }
];

function verificationHeaders(config: RemoteBackendConfig): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.token?.trim()) headers.Authorization = `Bearer ${config.token.trim()}`;
  return headers;
}

function firstUnratedIndex(study: HumanVerificationStudy, ratings: Record<string, HumanRatingRecord>): number {
  return nextUnratedIndex(study, ratings, 0);
}

function nextUnratedIndex(study: HumanVerificationStudy, ratings: Record<string, HumanRatingRecord>, start: number): number {
  for (let index = Math.max(0, start); index < study.tasks.length; index += 1) {
    if (!ratings[study.tasks[index].task_id]) return index;
  }
  for (let index = 0; index < Math.min(start, study.tasks.length); index += 1) {
    if (!ratings[study.tasks[index].task_id]) return index;
  }
  return study.tasks.length;
}

function clearPanoCache(cache: Map<string, CachedPano>): void {
  for (const pano of cache.values()) revokeIfBlob(pano.objectUrl);
  cache.clear();
}

function revokeIfBlob(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

function syncQuery(backendUrl: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("backend", backendUrl);
  url.searchParams.delete("prompt");
  url.searchParams.delete("seed");
  window.history.replaceState(window.history.state, "", url);
}
