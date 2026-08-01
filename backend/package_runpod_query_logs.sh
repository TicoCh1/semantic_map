#!/usr/bin/env bash
# Package all retained request evidence from a RunPod semantic-map backend.
#
# Default archive contents are deliberately lightweight and safe to download:
#   - job.json: latest persisted status/timing for every text or pano-reference job
#   - manifest.json: query/model/dataset metadata for every computed result
#   - scores.jsonl, if WRITE_SCORES_JSONL had been enabled
#   - LOG_ROOT, demo alerts, the standard Uvicorn/access log, and optional external logs
#   - redacted runtime configuration, retention notes, and inventories of large caches
#
# score.npy, zscore.npy, GeoJSON tiles and cached panorama images are NOT copied by
# default because they can be very large. They are inventoried. Any existing
# scores.jsonl is included by default; set INCLUDE_RESULT_DATA=1 to include
# binary score arrays, and set
# INCLUDE_TILE_DATA=1 or INCLUDE_PANO_CACHE=1 only when a large export is intended.
#
# Important: job.json is a result-cache record keyed by dataset and prompt ID. A
# repeated request with the same prompt overwrites this state; it is not an
# append-only request history. GET tile, manifest, feature and pano requests are
# retained in the Uvicorn/access log started by start_runpod_backend.sh.

set -euo pipefail

if [ -z "${WORKSPACE_ROOT:-}" ]; then
  if [ -d /workspace/embedding/london_224_8_45 ] || [ -d /workspace/Qwen3-VL-Embedding ]; then
    WORKSPACE_ROOT=/workspace
  else
    WORKSPACE_ROOT="${HOME}/workspace"
  fi
fi

BACKEND_DIR="${BACKEND_DIR:-${WORKSPACE_ROOT}/backend}"
ENV_FILE="${BACKEND_DIR}/.runpod_backend.env"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

RESULT_ROOT="${RESULT_ROOT:-${WORKSPACE_ROOT}/semantic_backend/results}"
LOG_ROOT="${LOG_ROOT:-${WORKSPACE_ROOT}/semantic_backend/logs}"
EXECUTION_LOG_ROOT="${EXECUTION_LOG_ROOT:-${LOG_ROOT}/query_execution}"
ALERT_LOG_PATH="${DEMO_ALERT_LOG_PATH:-${WORKSPACE_ROOT}/semantic_backend/alerts/alerts.jsonl}"
PANO_CACHE_ROOT="${PANO_CACHE_ROOT:-${WORKSPACE_ROOT}/semantic_backend/pano_cache}"
INCLUDE_RESULT_DATA="${INCLUDE_RESULT_DATA:-0}"
INCLUDE_TILE_DATA="${INCLUDE_TILE_DATA:-0}"
INCLUDE_PANO_CACHE="${INCLUDE_PANO_CACHE:-0}"
# Colon-separated paths to externally configured reverse-proxy, uvicorn or
# container logs that should be copied when they are readable.
EXTRA_REQUEST_LOG_PATHS="${EXTRA_REQUEST_LOG_PATHS:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_PATH="${1:-${WORKSPACE_ROOT}/semantic_backend/query-logs-${STAMP}.tar.gz}"

if [ "${OUTPUT_PATH#/}" = "${OUTPUT_PATH}" ]; then
  OUTPUT_PATH="${PWD}/${OUTPUT_PATH}"
fi

STAGING_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${STAGING_DIR}"
}
trap cleanup EXIT

copy_with_workspace_path() {
  local source_path="$1"
  local relative_path
  if [[ "${source_path}" == "${WORKSPACE_ROOT}/"* ]]; then
    relative_path="${source_path#"${WORKSPACE_ROOT}/"}"
  else
    relative_path="external/$(basename "${source_path}")"
  fi
  mkdir -p "${STAGING_DIR}/$(dirname "${relative_path}")"
  cp -p "${source_path}" "${STAGING_DIR}/${relative_path}"
}

copy_find_matches() {
  local root_path="$1"
  shift
  if [ ! -d "${root_path}" ]; then
    return
  fi
  while IFS= read -r -d '' source_path; do
    copy_with_workspace_path "${source_path}"
  done < <(find "${root_path}" -type f "$@" -print0)
}

write_inventory() {
  local label="$1"
  local root_path="$2"
  local output_path="$3"
  {
    printf '# %s\n' "${label}"
    printf '# Generated (UTC): %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if [ ! -d "${root_path}" ]; then
      printf '# Path does not exist: %s\n' "${root_path}"
    else
      printf '# Root: %s\n' "${root_path}"
      find "${root_path}" -type f -printf '%TY-%Tm-%TdT%TH:%TM:%TSZ\t%s\t%p\n' | LC_ALL=C sort
    fi
  } > "${output_path}"
}

if [ -d "${RESULT_ROOT}" ]; then
  copy_find_matches "${RESULT_ROOT}" \( -name job.json -o -name manifest.json \)
  # scores.jsonl is full score data, but if it exists it is the only readable
  # row-wise persisted result form and is useful for reproducibility.
  copy_find_matches "${RESULT_ROOT}" -name scores.jsonl
  if [ "${INCLUDE_RESULT_DATA}" = "1" ]; then
    copy_find_matches "${RESULT_ROOT}" \( -name score.npy -o -name zscore.npy \)
  fi
  if [ "${INCLUDE_TILE_DATA}" = "1" ]; then
    copy_find_matches "${RESULT_ROOT}" -path '*/tiles/*' -name '*.geojson'
  fi
fi

for source_path in "${ALERT_LOG_PATH}" "${ALERT_LOG_PATH}".[0-9]*; do
  if [ -f "${source_path}" ]; then
    copy_with_workspace_path "${source_path}"
  fi
done

if [ -d "${LOG_ROOT}" ]; then
  copy_find_matches "${LOG_ROOT}"
fi

if [ -d "${EXECUTION_LOG_ROOT}" ] && [ "${EXECUTION_LOG_ROOT}" != "${LOG_ROOT}" ]; then
  copy_find_matches "${EXECUTION_LOG_ROOT}"
fi

if [ "${INCLUDE_PANO_CACHE}" = "1" ]; then
  copy_find_matches "${PANO_CACHE_ROOT}"
fi

# Include compatible legacy/manual server-log locations outside LOG_ROOT.
for source_path in \
  "${WORKSPACE_ROOT}/semantic_backend/uvicorn.log" \
  "${WORKSPACE_ROOT}/semantic_backend/server.log" \
  "${WORKSPACE_ROOT}/semantic_backend/access.log"; do
  if [ -f "${source_path}" ]; then
    copy_with_workspace_path "${source_path}"
  fi
done

if [ -n "${EXTRA_REQUEST_LOG_PATHS}" ]; then
  IFS=':' read -r -a extra_paths <<< "${EXTRA_REQUEST_LOG_PATHS}"
  for source_path in "${extra_paths[@]}"; do
    if [ -f "${source_path}" ]; then
      copy_with_workspace_path "${source_path}"
    elif [ -d "${source_path}" ]; then
      copy_find_matches "${source_path}"
    fi
  done
fi

mkdir -p "${STAGING_DIR}/runtime"
if [ -f "${ENV_FILE}" ]; then
  # Keep configuration needed to interpret the records without exporting tokens,
  # passwords, email credentials or authorization values.
  sed -E '/^[[:space:]]*(export[[:space:]]+)?[^=]*(TOKEN|SECRET|PASSWORD|AUTHORIZATION|CLIENT_ID|CLIENT_SECRET|REFRESH_TOKEN|SMTP_USER|SMTP_PASSWORD|EMAIL_TO|EMAIL_FROM)[^=]*=/I s/=.*$/="***REDACTED***"/' \
    "${ENV_FILE}" > "${STAGING_DIR}/runtime/runpod_backend.env.redacted"
fi

for source_path in \
  "${BACKEND_DIR}/start_runpod_backend.sh" \
  "${BACKEND_DIR}/cold_startup.sh" \
  "${BACKEND_DIR}/package_runpod_query_logs.sh" \
  "${BACKEND_DIR}/semantic_map/backend_config.py" \
  "${BACKEND_DIR}/semantic_map/job_service.py" \
  "${BACKEND_DIR}/semantic_map/remote_api.py"; do
  if [ -f "${source_path}" ]; then
    copy_with_workspace_path "${source_path}"
  fi
done

write_inventory "Retained result files (including large files not copied by default)" "${RESULT_ROOT}" "${STAGING_DIR}/runtime/result_root_inventory.tsv"
write_inventory "Pano-cache files: a cache hit/miss artefact, not an access log" "${PANO_CACHE_ROOT}" "${STAGING_DIR}/runtime/pano_cache_inventory.tsv"

{
  printf 'Generated (UTC): %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'Uvicorn processes at packaging time:\n'
  ps -eo pid,lstart,args 2>/dev/null | grep -E '[u]vicorn|[b]ackend\.main' || true
} > "${STAGING_DIR}/runtime/process_snapshot.txt"

cat > "${STAGING_DIR}/RETENTION_NOTES.txt" <<'EOF'
Backend request-retention guide
===============================

Persisted by the backend
------------------------
1. POST /api/scoring/jobs
   Writes job.json for every target dataset. The file includes the submitted
   text or reference panorama label, status, timestamps, stage timings and
   cache status. A London-Shanghai group job writes one copy under each city.
2. Result computation for a job
   Writes manifest.json plus score.npy and zscore.npy. scores.jsonl is written
   only when WRITE_SCORES_JSONL=true. GeoJSON tiles are written as they are
   prewritten or requested.
3. POST /api/scoring/arcgis/merged-features/page
   Submits every prompt through the same job service, so its prompt jobs leave
   the same job.json/manifest.json records and can be batched together.
4. Demo monitor events
   alerts.jsonl is written only when demo alerts are enabled and an event is
   logged. Heartbeats are held in memory and are not a durable request log.

Additional retention notes
--------------------------
* Repeated POSTs resolving to the same prompt/dataset cache key: the stored
  job/manifest is current state, not append-only history. In the instrumented
  backend, consult LOG_ROOT/query_execution/query-execution-YYYY-MM-DD.jsonl
  for the append-only API, query and physical batch history.
* GET job-status, manifest, tile, feature-page and pano requests plus Uvicorn
  stdout/stderr and tracebacks are retained in LOG_ROOT/uvicorn.log. The
  execution JSONL remains the structured source for scoring timings.
* Pano cache files show that an image was materialised, but do not record every
  image request or identify a requester.
EOF

{
  printf 'Generated (UTC): %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'Workspace root: %s\n' "${WORKSPACE_ROOT}"
  printf 'Result root: %s\n' "${RESULT_ROOT}"
  printf 'Pano cache root: %s\n' "${PANO_CACHE_ROOT}"
  printf 'Alert log: %s\n' "${ALERT_LOG_PATH}"
  printf 'Include result arrays: %s\n' "${INCLUDE_RESULT_DATA}"
  printf 'Include tiles: %s\n' "${INCLUDE_TILE_DATA}"
  printf 'Include pano cache: %s\n' "${INCLUDE_PANO_CACHE}"
  printf 'File count: '
  find "${STAGING_DIR}" -type f | wc -l
  printf '\nIncluded files:\n'
  (cd "${STAGING_DIR}" && find . -type f -printf '%P\t%s bytes\n' | sort)
} > "${STAGING_DIR}/README.txt"

mkdir -p "$(dirname "${OUTPUT_PATH}")"
tar -C "${STAGING_DIR}" -czf "${OUTPUT_PATH}" .

printf 'Created archive: %s\n' "${OUTPUT_PATH}"
printf 'Archive size: '
du -h "${OUTPUT_PATH}" | cut -f1
