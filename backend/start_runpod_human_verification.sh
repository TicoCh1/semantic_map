#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -gt 1 ]; then
  echo "Usage: bash $0 [city_id,city_id,...]" >&2
  exit 2
fi

if [ -z "${WORKSPACE_ROOT:-}" ]; then
  if [ -d /workspace/embedding ]; then
    WORKSPACE_ROOT=/workspace
  else
    WORKSPACE_ROOT="${HOME}/workspace"
  fi
fi

BACKEND_DIR="${BACKEND_DIR:-${WORKSPACE_ROOT}/backend}"
ENV_FILE="${BACKEND_DIR}/.runpod_backend.env"
CALLER_BACKEND_CITIES="${1:-${BACKEND_CITIES:-}}"
CALLER_PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
CALLER_VERIFY_PORT="${VERIFY_PORT:-${PORT:-}}"
CALLER_CITY_DATASET_MAP="${CITY_DATASET_MAP:-}"
CALLER_CITY_CATALOG_JSON="${CITY_CATALOG_JSON:-}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

BACKEND_CITIES="${CALLER_BACKEND_CITIES:-london,shanghai,new_york,rome}"
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
DATA_ROOT="${DATA_ROOT:-${WORKSPACE_ROOT}/embedding}"
RESULT_ROOT="${RESULT_ROOT:-${WORKSPACE_ROOT}/semantic_backend/results}"
PANO_TAR_DIR="${PANO_TAR_DIR:-${WORKSPACE_ROOT}/pano}"
PANO_CACHE_ROOT="${PANO_CACHE_ROOT:-${WORKSPACE_ROOT}/semantic_backend/pano_cache}"
PANO_INDEX_PATH="${PANO_INDEX_PATH:-${WORKSPACE_ROOT}/semantic_backend/pano_index/pano_index.sqlite}"
PANO_TAR_RANGES="${PANO_TAR_RANGES:-01:10002:100005,02:100006:200001,03:200002:300001,04:300002:400001,05:400002:500001,06:500002:}"
PANO_TAR_RANGES_SHANGHAI_224_8_45_2B="${PANO_TAR_RANGES_SHANGHAI_224_8_45_2B:-shanghai_rootless}"
PANO_TAR_RANGES_NEW_YORK_MANHATTAN_224_8_45="${PANO_TAR_RANGES_NEW_YORK_MANHATTAN_224_8_45:-New_York_Manhattan_chunk_0.tar,New_York_Manhattan_chunk_1.tar,New_York_Manhattan_chunk_2.tar,New_York_Manhattan_chunk_3.tar,New_York_Manhattan_chunk_4.tar}"
PANO_TAR_RANGES_NEW_YORK_OUTSIDE_MANHATTAN_224_8_45="${PANO_TAR_RANGES_NEW_YORK_OUTSIDE_MANHATTAN_224_8_45:-New_York_Option_A_outside_Manhattan_chunk_0.tar,New_York_Option_A_outside_Manhattan_chunk_1.tar,New_York_Option_A_outside_Manhattan_chunk_2.tar,New_York_Option_A_outside_Manhattan_chunk_3.tar,New_York_Option_A_outside_Manhattan_chunk_4.tar}"
PANO_TAR_RANGES_ROME_224_8_45="${PANO_TAR_RANGES_ROME_224_8_45:-Rome_Vatican_chunk_0.tar,Rome_Vatican_chunk_1.tar,Rome_Vatican_chunk_2.tar,Rome_Vatican_chunk_3.tar,Rome_Vatican_chunk_4.tar}"

PORT="${CALLER_VERIFY_PORT:-${PORT:-8000}}"
HOST="${HOST:-0.0.0.0}"
VERIFY_LOG_PATH="${VERIFY_LOG_PATH:-${TMPDIR:-/tmp}/semantic_backend/human-verification.log}"
if [ -n "${CALLER_PUBLIC_BASE_URL}" ]; then
  PUBLIC_BASE_URL="${CALLER_PUBLIC_BASE_URL}"
elif [ -n "${CALLER_VERIFY_PORT}" ] && [ -n "${RUNPOD_POD_ID:-}" ]; then
  PUBLIC_BASE_URL="https://${RUNPOD_POD_ID}-${PORT}.proxy.runpod.net"
elif [ -z "${PUBLIC_BASE_URL:-}" ] && [ -n "${RUNPOD_POD_ID:-}" ]; then
  PUBLIC_BASE_URL="https://${RUNPOD_POD_ID}-${PORT}.proxy.runpod.net"
fi

export WORKSPACE_ROOT BACKEND_DIR DATA_ROOT RESULT_ROOT
export BACKEND_CITIES CITY_DATASET_MAP CITY_CATALOG_JSON
export DEFAULT_DATASET_ID DEFAULT_DATASET_IDS DEFAULT_DATASET_GROUP_ID
export PANO_TAR_DIR PANO_CACHE_ROOT PANO_INDEX_PATH PANO_TAR_RANGES
export PANO_TAR_RANGES_SHANGHAI_224_8_45_2B
export PANO_TAR_RANGES_NEW_YORK_MANHATTAN_224_8_45
export PANO_TAR_RANGES_NEW_YORK_OUTSIDE_MANHATTAN_224_8_45
export PANO_TAR_RANGES_ROME_224_8_45
export PUBLIC_BASE_URL PORT
export PYTHONPATH="${WORKSPACE_ROOT}:${PYTHONPATH:-}"

mkdir -p "${RESULT_ROOT}/human_verification" "${PANO_CACHE_ROOT}" "$(dirname "${PANO_INDEX_PATH}")" "$(dirname "${VERIFY_LOG_PATH}")"

PYTHON_BIN="${QWEN_REPO_DIR}/.venv/bin/python"
if [ ! -x "${PYTHON_BIN}" ]; then
  echo "ERROR: Python runtime not found: ${PYTHON_BIN}" >&2
  echo "Run the existing backend cold startup once to prepare dependencies." >&2
  exit 1
fi

exec > >(tee -a "${VERIFY_LOG_PATH}") 2>&1

echo "Starting UrbanFabric Human Verification Service"
echo "Backend module: backend.semantic_map.human_verification_api:app"
echo "Cities:         ${BACKEND_CITIES}"
echo "Datasets:       ${DEFAULT_DATASET_IDS}"
echo "Results:        ${RESULT_ROOT}"
echo "Ratings DB:     ${RESULT_ROOT}/human_verification/ratings.sqlite3"
echo "Pano tar dir:   ${PANO_TAR_DIR}"
echo "Public URL:     ${PUBLIC_BASE_URL:-<not set>}"
echo "Listen:         ${HOST}:${PORT}"
echo "GPU/model path: disabled; this process only reads saved scores and panoramas"

cd "${WORKSPACE_ROOT}"
exec "${PYTHON_BIN}" -m uvicorn backend.semantic_map.human_verification_api:app \
  --host "${HOST}" \
  --port "${PORT}" \
  --access-log \
  --log-level info
