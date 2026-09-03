import { Download, LoaderCircle, RefreshCw, RotateCcw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { getRemoteBackendConfig, isUsableRemoteBackendUrl, loadPanoImage, saveRemoteBackendConfig } from "../api/client";
import type { RemoteBackendConfig } from "../api/types";
import { PanoramaViewer } from "../components/PanoramaViewer";
import { panoDatasetIdForPoint } from "../state/panoDatasets";
import { exportRatingsCsv, localRaterId, newVerificationSessionId, saveRatings } from "./responseStorage";
import type {
  HumanRatingRecord,
  HumanVerificationPresentation,
  HumanVerificationStudy
} from "./types";

const PREFETCH_COUNT = 5;
const FRESH_TASKS_PER_PROMPT = 20;
const SAMPLES_PER_BUCKET_PER_DATASET = 1;
const PROGRESS_PAGE_SIZE = 100;
const MAX_ENCORES_PER_PROMPT = 5;
const PROMPT_EMPHASIS_MS = 1200;
const MILESTONE_ANIMATION_MS = 2200;

type CachedPano = {
  status: "loading" | "ready" | "failed";
  objectUrl?: string;
  message?: string;
};

function initialParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name)?.trim() || "";
}

function initialMilestonePreview(): number | null {
  const value = Number.parseInt(initialParam("previewMilestone"), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function VerifyApp() {
  const [backendUrl, setBackendUrl] = useState(() => initialParam("backend") || initialParam("runpod"));
  const [presentations, setPresentations] = useState<HumanVerificationPresentation[]>([]);
  const [ratings, setRatings] = useState<Record<string, HumanRatingRecord>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId, setSessionId] = useState(newVerificationSessionId);
  const [loadingStudy, setLoadingStudy] = useState(false);
  const [loadingNextPrompt, setLoadingNextPrompt] = useState(false);
  const [nextPromptRetry, setNextPromptRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [counterPulse, setCounterPulse] = useState(0);
  const [promptEmphasis, setPromptEmphasis] = useState<number | null>(null);
  const [milestoneNotice, setMilestoneNotice] = useState<number | null>(initialMilestonePreview);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [, setCacheVersion] = useState(0);
  const raterId = useMemo(localRaterId, []);
  const autoStartedRef = useRef(false);
  const currentStartedAtRef = useRef(performance.now());
  const panoCacheRef = useRef<Map<string, CachedPano>>(new Map());
  const panoRequestsRef = useRef<Map<string, Promise<void>>>(new Map());
  const backendConfigRef = useRef<RemoteBackendConfig | null>(null);
  const loadingNextPromptRef = useRef(false);
  const lastPromptRef = useRef<string | null>(null);
  const promptNoticeKeyRef = useRef(0);
  const milestoneActiveRef = useRef(milestoneNotice !== null);

  const requestStudy = useCallback(async (config: RemoteBackendConfig, excludePrompts: string[]) => {
    const response = await fetch(`${config.baseUrl}/api/verification/sample`, {
      method: "POST",
      headers: verificationHeaders(config),
      body: JSON.stringify({
        samples_per_bucket_per_dataset: SAMPLES_PER_BUCKET_PER_DATASET,
        exclude_prompts: excludePrompts
      })
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { detail?: string } | null;
      throw new Error(detail?.detail || `Verification sample request failed (${response.status}).`);
    }
    const study = await response.json() as HumanVerificationStudy;
    if (study.tasks.length < FRESH_TASKS_PER_PROMPT) {
      throw new Error(`Prompt sampling returned ${study.tasks.length} images; 20 are required for a prompt block.`);
    }
    return study;
  }, []);

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
      const firstStudy = await requestStudy(savedConfig, []);
      backendConfigRef.current = await saveStudyBackendConfig(savedConfig, firstStudy);
      clearPanoCache(panoCacheRef.current);
      panoRequestsRef.current.clear();
      const nextSessionId = newVerificationSessionId();
      setSessionId(nextSessionId);
      setPresentations(composePromptBlock(firstStudy, []));
      setRatings({});
      setCurrentIndex(0);
      setCounterPulse(0);
      setPromptEmphasis(null);
      setMilestoneNotice(null);
      milestoneActiveRef.current = false;
      lastPromptRef.current = null;
      setBackendUrl(savedConfig.baseUrl);
      syncQuery(savedConfig.baseUrl);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the verification stream.");
    } finally {
      setLoadingStudy(false);
    }
  }, [backendUrl, requestStudy]);

  useEffect(() => {
    if (autoStartedRef.current || !backendUrl.trim()) return;
    autoStartedRef.current = true;
    void connectAndLoad();
  }, [backendUrl, connectAndLoad]);

  useEffect(() => {
    if (!presentations.length || presentations.length - currentIndex > FRESH_TASKS_PER_PROMPT) return;
    if (loadingNextPromptRef.current) return;
    const latestPrompt = [...presentations].reverse().find((item) => !item.is_encore)?.prompt;
    loadingNextPromptRef.current = true;
    setLoadingNextPrompt(true);
    setError(null);
    void (async () => {
      try {
        const config = backendConfigRef.current ?? await getRemoteBackendConfig();
        const nextStudy = await requestStudy(config, latestPrompt ? [latestPrompt] : []);
        backendConfigRef.current = await saveStudyBackendConfig(config, nextStudy);
        setPresentations((current) => composePromptBlock(nextStudy, current));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the next prompt.");
      } finally {
        loadingNextPromptRef.current = false;
        setLoadingNextPrompt(false);
      }
    })();
  }, [currentIndex, nextPromptRetry, presentations, requestStudy]);

  const ensurePano = useCallback((presentation: HumanVerificationPresentation) => {
    const key = panoCacheKey(presentation);
    const cached = panoCacheRef.current.get(key);
    if (cached?.status === "ready" || panoRequestsRef.current.has(key)) return;
    panoCacheRef.current.set(key, { status: "loading" });
    setCacheVersion((version) => version + 1);

    const panoDatasetId = panoDatasetIdForPoint(presentation.dataset_id, presentation.lon, presentation.lat);
    const request = loadPanoImage(presentation.pano_id, panoDatasetId, {
      lon: presentation.lon,
      lat: presentation.lat,
      date: presentation.date ?? null
    })
      .then((metadata) => {
        panoCacheRef.current.set(key, {
          status: "ready",
          objectUrl: metadata.object_url || metadata.image_url || undefined,
          message: metadata.message
        });
      })
      .catch((panoError) => {
        panoCacheRef.current.set(key, {
          status: "failed",
          message: panoError instanceof Error ? panoError.message : "Panorama failed to load."
        });
      })
      .finally(() => {
        panoRequestsRef.current.delete(key);
        setCacheVersion((version) => version + 1);
      });
    panoRequestsRef.current.set(key, request);
  }, []);

  useEffect(() => {
    if (currentIndex >= presentations.length) return;
    for (const presentation of presentations.slice(currentIndex, currentIndex + PREFETCH_COUNT)) {
      ensurePano(presentation);
    }
    prunePanoCache(panoCacheRef.current, presentations, currentIndex);
  }, [currentIndex, ensurePano, presentations]);

  useEffect(() => {
    currentStartedAtRef.current = performance.now();
  }, [currentIndex]);

  useEffect(() => () => clearPanoCache(panoCacheRef.current), []);

  const currentTask = presentations[currentIndex] ?? null;
  const currentPano = currentTask ? panoCacheRef.current.get(panoCacheKey(currentTask)) : null;
  const ratedCount = Object.keys(ratings).length;
  const progressTarget = Math.max(
    PROGRESS_PAGE_SIZE,
    Math.ceil(ratedCount / PROGRESS_PAGE_SIZE) * PROGRESS_PAGE_SIZE
  );

  useEffect(() => {
    const nextPrompt = currentTask?.prompt;
    if (!nextPrompt) return;

    const previousPrompt = lastPromptRef.current;
    lastPromptRef.current = nextPrompt;
    if (!previousPrompt || previousPrompt === nextPrompt) return;

    promptNoticeKeyRef.current += 1;
    setPromptEmphasis(promptNoticeKeyRef.current);
    const timeout = window.setTimeout(() => setPromptEmphasis(null), PROMPT_EMPHASIS_MS);
    return () => window.clearTimeout(timeout);
  }, [currentTask?.prompt]);

  useEffect(() => {
    if (milestoneNotice === null) return;
    const timeout = window.setTimeout(() => {
      milestoneActiveRef.current = false;
      setMilestoneNotice(null);
    }, MILESTONE_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [milestoneNotice]);

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
          source_task_id: record.source_task_id,
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
    if (!currentTask || currentPano?.status !== "ready" || milestoneActiveRef.current) return;
    const {
      source_task_id: sourceTaskId,
      study_id: studyId,
      prompt,
      dataset_group_id: datasetGroupId,
      sequence_number: sequenceNumber,
      is_encore: _isEncore,
      ...task
    } = currentTask;
    const record: HumanRatingRecord = {
      ...task,
      source_task_id: sourceTaskId,
      study_id: studyId,
      prompt,
      dataset_group_id: datasetGroupId,
      session_id: sessionId,
      rater_id: raterId,
      task_order: sequenceNumber,
      human_rating: rating,
      elapsed_ms: Math.max(0, Math.round(performance.now() - currentStartedAtRef.current)),
      rated_at: new Date().toISOString()
    };
    const nextRatings = { ...ratings, [currentTask.task_id]: record };
    const nextRatedCount = Object.keys(nextRatings).length;
    setRatings(nextRatings);
    saveRatings(sessionId, nextRatings);
    void syncRating(record)
      .then(() => setSyncError(null))
      .catch((syncFailure) => {
        const message = syncFailure instanceof Error ? syncFailure.message : "Backend rating sync failed.";
        setSyncError(`Saved locally, but not yet stored by RunPod: ${message}`);
      });
    setCounterPulse((pulse) => pulse + 1);
    if (nextRatedCount > 0 && nextRatedCount % PROGRESS_PAGE_SIZE === 0) {
      milestoneActiveRef.current = true;
      setMilestoneNotice(nextRatedCount);
    }
    setCurrentIndex((index) => index + 1);
  }, [currentPano?.status, currentTask, raterId, ratings, sessionId, syncRating]);

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
    setMobileSettingsOpen(false);
    void connectAndLoad();
  }

  function retryCurrentPano() {
    if (!currentTask) return;
    const key = panoCacheKey(currentTask);
    const cached = panoCacheRef.current.get(key);
    revokeIfBlob(cached?.objectUrl);
    panoCacheRef.current.delete(key);
    ensurePano(currentTask);
  }

  const milestoneOverlay = milestoneNotice !== null ? (
    <section className="verify-milestone" role="status" aria-live="assertive">
      <div className="verify-milestone-content">
        <strong>{milestoneNotice}</strong>
        <h2>ratings complete</h2>
      </div>
      <div className="verify-milestone-progress" aria-hidden="true" />
    </section>
  ) : null;

  if (!presentations.length) {
    return (
      <main className="verify-setup-shell">
        <form className="verify-setup-card" onSubmit={submitSetup}>
          <div className="verify-wordmark">UrbanFabric</div>
          <h1>Human Verify</h1>
          <p>Rate how closely each 360° street scene matches the statement. Prompts rotate as you continue.</p>
          <label>
            <span>RunPod URL</span>
            <input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="https://pod-id-8000.proxy.runpod.net" autoFocus />
          </label>
          {error ? <div className="verify-error">{error}</div> : null}
          <button className="verify-primary-button" type="submit" disabled={loadingStudy}>
            {loadingStudy ? <LoaderCircle className="verify-spin" size={18} /> : null}
            {loadingStudy ? "Preparing stream" : "Start verification"}
          </button>
          <small>Five score buckets · twenty new scenes per prompt · continuous verification</small>
        </form>
        {milestoneOverlay}
      </main>
    );
  }

  return (
    <main className="verify-app-shell">
      <header className="verify-toolbar">
        <div
          key={promptEmphasis ?? "steady-toolbar-prompt"}
          className={`verify-toolbar-prompt-block verify-prompt-block${promptEmphasis ? " verify-prompt-block-changed" : ""}`}
          style={{ "--verify-mobile-prompt-size": mobilePromptFontSize(currentTask?.prompt ?? "") } as CSSProperties}
        >
          <span>Rate this statement</span>
          <h1>{currentTask?.prompt}</h1>
        </div>
        <form className={`verify-backend-control${mobileSettingsOpen ? " is-open" : ""}`} onSubmit={submitSetup}>
          <label htmlFor="verify-backend-url">RunPod</label>
          <input id="verify-backend-url" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          <button type="submit" title="Start a new verification session" aria-label="Start a new verification session" disabled={loadingStudy || loadingNextPrompt}>
            <RefreshCw className={loadingStudy || loadingNextPrompt ? "verify-spin" : ""} size={17} />
          </button>
        </form>
        <div
          key={`progress-${counterPulse}`}
          className="verify-progress-block"
          aria-label={`${ratedCount} of ${progressTarget} rated`}
        >
          <span>Rated</span>
          <strong>{ratedCount}<small> / {progressTarget}</small></strong>
          {counterPulse ? <i key={counterPulse} className="verify-progress-plus-one" aria-hidden="true">+1</i> : null}
        </div>
        <button
          className="verify-settings-button"
          type="button"
          title="Edit RunPod URL"
          aria-label="Edit RunPod URL"
          aria-expanded={mobileSettingsOpen}
          onClick={() => setMobileSettingsOpen((open) => !open)}
        >
          <Settings size={18} />
        </button>
        <button
          className="verify-export-button"
          type="button"
          title="Export results"
          aria-label="Export results"
          onClick={() => exportRatingsCsv(sessionId, ratings)}
          disabled={!ratedCount}
        >
          <Download size={17} />
        </button>
      </header>

      <section className="verify-viewer-section">
        {currentTask ? (
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
        ) : (
          <div className="verify-viewer-state">
            {loadingNextPrompt ? <LoaderCircle className="verify-spin" size={26} /> : null}
            <span>{loadingNextPrompt ? "Loading the next prompt" : "The next prompt could not be loaded"}</span>
            {!loadingNextPrompt ? (
              <button className="verify-primary-button" type="button" onClick={() => setNextPromptRetry((value) => value + 1)}>
                <RotateCcw size={17} />
                Retry
              </button>
            ) : null}
          </div>
        )}
      </section>

      {currentTask ? (
        <section className="verify-rating-panel">
          <div className="verify-scale-block">
            <div className="verify-scale" role="group" aria-label="Human rating from 1 to 5">
              {RATING_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => rate(value)}
                  disabled={currentPano?.status !== "ready" || milestoneNotice !== null}
                  aria-label={`Rate ${value} out of 5`}
                >
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
            <div className="verify-scale-guide" aria-hidden="true">
              <span>Image and description are <strong>NOT</strong> related</span>
              <span>Image and description are <strong>HIGHLY</strong> related</span>
            </div>
          </div>
        </section>
      ) : null}
      {milestoneOverlay}
      {(error || syncError) ? <div className="verify-floating-error">{error || syncError}</div> : null}
    </main>
  );
}

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

async function saveStudyBackendConfig(config: RemoteBackendConfig, study: HumanVerificationStudy): Promise<RemoteBackendConfig> {
  return saveRemoteBackendConfig({
    ...config,
    datasetId: study.dataset_ids[0] || config.datasetId,
    datasetIds: study.dataset_ids,
    datasetGroupId: study.dataset_group_id || config.datasetGroupId,
    enabled: true
  });
}

function composePromptBlock(
  study: HumanVerificationStudy,
  previous: HumanVerificationPresentation[]
): HumanVerificationPresentation[] {
  const output = [...previous];
  const freshTasks = study.tasks.slice(0, FRESH_TASKS_PER_PROMPT);
  const encoreCountsByPrompt = new Map<string, number>();
  for (const item of output) {
    if (!item.is_encore) continue;
    encoreCountsByPrompt.set(item.prompt, (encoreCountsByPrompt.get(item.prompt) ?? 0) + 1);
  }
  let freshIndex = 0;
  while (freshIndex < freshTasks.length) {
    const sequenceNumber = output.length + 1;
    const eligibleEncoreSources = output.filter(
      (item) => !item.is_encore
        && item.sequence_number <= sequenceNumber - 10
        && (encoreCountsByPrompt.get(item.prompt) ?? 0) < MAX_ENCORES_PER_PROMPT
    );
    if (eligibleEncoreSources.length && Math.random() < encoreProbability(sequenceNumber)) {
      const source = eligibleEncoreSources[Math.floor(Math.random() * eligibleEncoreSources.length)];
      output.push({
        ...source,
        task_id: uniqueId("encore"),
        source_task_id: source.source_task_id,
        sequence_number: sequenceNumber,
        is_encore: true
      });
      encoreCountsByPrompt.set(source.prompt, (encoreCountsByPrompt.get(source.prompt) ?? 0) + 1);
      continue;
    }

    const task = freshTasks[freshIndex];
    freshIndex += 1;
    output.push({
      ...task,
      source_task_id: task.task_id,
      study_id: study.study_id,
      prompt: study.prompt,
      dataset_group_id: study.dataset_group_id,
      sequence_number: sequenceNumber,
      is_encore: false
    });
  }
  return output;
}

function encoreProbability(sequenceNumber: number): number {
  const previouslySeen = sequenceNumber - 1;
  if (previouslySeen < 10) return 0;
  const progress = Math.min(1, (previouslySeen - 10) / 40);
  return 0.01 + 0.04 * progress;
}

function mobilePromptFontSize(prompt: string): string {
  const length = Array.from(prompt.trim()).length;
  if (length <= 28) return "clamp(1.2rem, 5.2vw, 1.55rem)";
  if (length <= 48) return "clamp(1.05rem, 4.7vw, 1.35rem)";
  if (length <= 78) return "clamp(0.9rem, 4vw, 1.15rem)";
  return "clamp(0.74rem, 3.35vw, 0.95rem)";
}

function uniqueId(prefix: string): string {
  if (typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function verificationHeaders(config: RemoteBackendConfig): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.token?.trim()) headers.Authorization = `Bearer ${config.token.trim()}`;
  return headers;
}

function panoCacheKey(task: HumanVerificationPresentation): string {
  return [task.dataset_id, task.pano_id, task.lon, task.lat, task.date ?? ""].join(":");
}

function prunePanoCache(
  cache: Map<string, CachedPano>,
  presentations: HumanVerificationPresentation[],
  currentIndex: number
): void {
  const keep = new Set(
    presentations
      .slice(Math.max(0, currentIndex - 3), currentIndex + PREFETCH_COUNT + 1)
      .map(panoCacheKey)
  );
  for (const [key, pano] of cache) {
    if (keep.has(key)) continue;
    revokeIfBlob(pano.objectUrl);
    cache.delete(key);
  }
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
