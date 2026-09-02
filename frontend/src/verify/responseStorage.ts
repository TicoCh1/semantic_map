import type { HumanRatingRecord } from "./types";

const RATER_KEY = "urbanfabric-human-verify-rater-v1";
const RESPONSE_KEY_PREFIX = "urbanfabric-human-verify-responses-v2";

export function localRaterId(): string {
  const existing = window.localStorage.getItem(RATER_KEY)?.trim();
  if (existing) return existing;
  const generated = typeof crypto.randomUUID === "function"
    ? `rater-${crypto.randomUUID().slice(0, 8)}`
    : `rater-${Date.now().toString(36)}`;
  window.localStorage.setItem(RATER_KEY, generated);
  return generated;
}

export function newVerificationSessionId(): string {
  return typeof crypto.randomUUID === "function"
    ? `session-${crypto.randomUUID()}`
    : `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function loadRatings(sessionId: string): Record<string, HumanRatingRecord> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(responseKey(sessionId)) || "{}") as Record<string, HumanRatingRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRatings(sessionId: string, ratings: Record<string, HumanRatingRecord>): void {
  window.localStorage.setItem(responseKey(sessionId), JSON.stringify(ratings));
}

export function exportRatingsCsv(sessionId: string, ratings: Record<string, HumanRatingRecord>): void {
  const columns: Array<keyof HumanRatingRecord> = [
    "session_id",
    "study_id",
    "rater_id",
    "task_id",
    "task_order",
    "dataset_group_id",
    "dataset_id",
    "city_id",
    "pano_id",
    "lon",
    "lat",
    "date",
    "prompt_id",
    "prompt",
    "score",
    "zscore",
    "ai_bucket",
    "bucket_min",
    "bucket_max",
    "stratum_population",
    "stratum_sample_count",
    "human_rating",
    "elapsed_ms",
    "rated_at",
    "result_revision"
  ];
  const rows = Object.values(ratings).sort((a, b) => a.task_order - b.task_order);
  const csv = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))
  ].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `human-verify-${safeFilename(sessionId)}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function responseKey(sessionId: string): string {
  return `${RESPONSE_KEY_PREFIX}:${sessionId}`;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "human-verify";
}
