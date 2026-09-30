#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 1 ]; then
  echo "Usage: bash $0 [city_id,city_id,...]" >&2
  exit 2
fi

backfill_is_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
BACKEND_DIR="${BACKEND_DIR:-${WORKSPACE_ROOT}/backend}"
ENV_FILE="${BACKEND_DIR}/.runpod_backend.env"
CALLER_BACKFILL_CITIES="${1:-${BACKFILL_CITIES:-}}"
CALLER_CITY_DATASET_MAP="${CITY_DATASET_MAP:-}"
CALLER_CITY_CATALOG_JSON="${CITY_CATALOG_JSON:-}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

BACKEND_CITIES="${CALLER_BACKFILL_CITIES:-london,shanghai,new_york,rome}"
if [ -n "${CALLER_CITY_DATASET_MAP}" ]; then
  CITY_DATASET_MAP="${CALLER_CITY_DATASET_MAP}"
fi
if [ -n "${CALLER_CITY_CATALOG_JSON}" ]; then
  CITY_CATALOG_JSON="${CALLER_CITY_CATALOG_JSON}"
fi

# shellcheck source=backend/city_catalog.sh
source "${BACKEND_DIR}/city_catalog.sh"
backend_configure_cities

QWEN_REPO_DIR="${QWEN_REPO_DIR:-/tmp/Qwen3-VL-Embedding}"
MODEL_DIR="${MODEL_DIR:-${WORKSPACE_ROOT}/models/Qwen3-VL-Embedding-2B}"
DATA_ROOT="${DATA_ROOT:-${WORKSPACE_ROOT}/embedding}"
RESULT_ROOT="${RESULT_ROOT:-${WORKSPACE_ROOT}/semantic_backend/results}"
TILE_INDEX_ROOT="${TILE_INDEX_ROOT:-${WORKSPACE_ROOT}/semantic_backend/tile_index}"
LOG_ROOT="${LOG_ROOT:-${WORKSPACE_ROOT}/semantic_backend/logs}"
POD_TEMP_LOG_ROOT="${POD_TEMP_LOG_ROOT:-${TMPDIR:-/tmp}/semantic_backend/logs}"
BACKFILL_LOG_PATH="${BACKFILL_LOG_PATH:-${POD_TEMP_LOG_ROOT}/sequential-query-backfill.log}"
EXECUTION_LOG_ROOT="${BACKFILL_EXECUTION_LOG_ROOT:-${POD_TEMP_LOG_ROOT}/sequential_backfill_execution}"

# This command intentionally minimizes VRAM and never batches target cities.
EMBEDDING_DEVICE="cpu_mmap"
SCORING_CHUNK_SIZE="${BACKFILL_SCORING_CHUNK_SIZE:-8192}"
WARMUP_ON_STARTUP="false"
BACKFILL_HISTORICAL_QUERIES="false"
PROMPT_BATCH_WINDOW_MS="0"
PROMPT_BATCH_MAX_SIZE="1"
PROMPT_QUEUE_MAX_SIZE="1"
PREWRITE_ALL_TILES="false"
WRITE_SCORES_JSONL="false"
TEMPORARY_SCORER_ENABLED="false"
DEMO_ALERT_ENABLED="false"
EXECUTION_LOG_ENABLED="true"
EXECUTION_LOG_FSYNC="false"

export WORKSPACE_ROOT BACKEND_DIR QWEN_REPO_DIR MODEL_DIR DATA_ROOT RESULT_ROOT TILE_INDEX_ROOT LOG_ROOT
export BACKEND_CITIES CITY_DATASET_MAP CITY_CATALOG_JSON
export DEFAULT_DATASET_ID DEFAULT_DATASET_IDS DEFAULT_DATASET_GROUP_ID
export EMBEDDING_DEVICE SCORING_CHUNK_SIZE WARMUP_ON_STARTUP BACKFILL_HISTORICAL_QUERIES
export PROMPT_BATCH_WINDOW_MS PROMPT_BATCH_MAX_SIZE PROMPT_QUEUE_MAX_SIZE
export PREWRITE_ALL_TILES WRITE_SCORES_JSONL TEMPORARY_SCORER_ENABLED DEMO_ALERT_ENABLED
export EXECUTION_LOG_ROOT EXECUTION_LOG_ENABLED EXECUTION_LOG_FSYNC
export PYTHONPATH="${QWEN_REPO_DIR}:${WORKSPACE_ROOT}:${PYTHONPATH:-}"

PYTHON_BIN="${QWEN_REPO_DIR}/.venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  echo "ERROR: Python runtime not found: ${PYTHON_BIN}" >&2
  echo "Run the existing cold startup first: bash ${BACKEND_DIR}/cold_startup.sh" >&2
  exit 1
fi

IFS=',' read -r -a DATASET_ID_LIST <<< "${DEFAULT_DATASET_IDS}"
for DATASET_ID in "${DATASET_ID_LIST[@]}"; do
  DATASET_ID="$(backend_city_trim "${DATASET_ID}")"
  if [ -n "${DATASET_ID}" ] && [ ! -d "${DATA_ROOT}/${DATASET_ID}" ]; then
    echo "ERROR: dataset directory not found: ${DATA_ROOT}/${DATASET_ID}" >&2
    exit 1
  fi
done

if ! backfill_is_true "${BACKFILL_DRY_RUN:-false}" && ! backfill_is_true "${BACKFILL_ALLOW_CONCURRENT_BACKEND:-false}"; then
  if command -v pgrep >/dev/null 2>&1 && pgrep -f 'uvicorn[[:space:]]+backend\.main:app' >/dev/null 2>&1; then
    echo "ERROR: the normal semantic backend is already running." >&2
    echo "Stop it before this GPU backfill, or explicitly set BACKFILL_ALLOW_CONCURRENT_BACKEND=true." >&2
    exit 1
  fi
fi

mkdir -p "${RESULT_ROOT}" "${TILE_INDEX_ROOT}" "${EXECUTION_LOG_ROOT}" "$(dirname "${BACKFILL_LOG_PATH}")"
exec > >(tee -a "${BACKFILL_LOG_PATH}") 2>&1

echo "Starting sequential all-query backfill"
echo "Cities:          ${BACKEND_CITIES}"
echo "Datasets:        ${DEFAULT_DATASET_IDS}"
echo "Results:         ${RESULT_ROOT}"
echo "Embedding mode:  ${EMBEDDING_DEVICE}"
echo "Scoring chunk:   ${SCORING_CHUNK_SIZE}"
echo "Query batching:  disabled; one target city and one query at a time"
echo "Z-score scope:   normalized independently inside each target city"
echo "Pano service:    disabled; image queries use saved reference embeddings"
echo "Log:             ${BACKFILL_LOG_PATH}"

cd "${WORKSPACE_ROOT}"
exec "${PYTHON_BIN}" -m backend.semantic_map.sequential_query_backfill
