#!/usr/bin/env bash
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
CALLER_PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"

if [ -f "${ENV_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

if [ -n "${CALLER_PUBLIC_BASE_URL}" ]; then
  export PUBLIC_BASE_URL="${CALLER_PUBLIC_BASE_URL}"
fi

QWEN_REPO_DIR="${QWEN_REPO_DIR:-/tmp/Qwen3-VL-Embedding}"
PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"
LOG_ROOT="${LOG_ROOT:-${WORKSPACE_ROOT}/semantic_backend/logs}"
DATA_ROOT="${DATA_ROOT:-${WORKSPACE_ROOT}/embedding}"
DEFAULT_DATASET_ID="${DEFAULT_DATASET_ID:-london_224_8_45}"
DEFAULT_DATASET_IDS="${DEFAULT_DATASET_IDS:-london_224_8_45,shanghai_224_8_45_2B}"
DEFAULT_DATASET_GROUP_ID="${DEFAULT_DATASET_GROUP_ID:-london_shanghai}"
RESULT_ROOT="${RESULT_ROOT:-${WORKSPACE_ROOT}/semantic_backend/results}"
TILE_INDEX_ROOT="${TILE_INDEX_ROOT:-${WORKSPACE_ROOT}/semantic_backend/tile_index}"
PANO_TAR_DIR="${PANO_TAR_DIR:-${WORKSPACE_ROOT}/pano}"
PANO_CACHE_ROOT="${PANO_CACHE_ROOT:-${WORKSPACE_ROOT}/semantic_backend/pano_cache}"
PANO_INDEX_PATH="${PANO_INDEX_PATH:-${WORKSPACE_ROOT}/semantic_backend/pano_index/pano_index.sqlite}"
PANO_TAR_RANGES="${PANO_TAR_RANGES:-01:10002:100005,02:100006:200001,03:200002:300001,04:300002:400001,05:400002:500001,06:500002:}"
PANO_TAR_RANGES_SHANGHAI_224_8_45_2B="${PANO_TAR_RANGES_SHANGHAI_224_8_45_2B:-shanghai_rootless}"
SCORING_VERSION="${SCORING_VERSION:-text-cor-t-qwen-cred-v1}"
TILE_INDEX_VERSION="${TILE_INDEX_VERSION:-xyz-z13-area-v1}"
WARMUP_ON_STARTUP="${WARMUP_ON_STARTUP:-true}"
EMBEDDING_DEVICE="${EMBEDDING_DEVICE:-cuda}"
TILE_ZOOMS="${TILE_ZOOMS:-10,11,12,13}"
if [ "${TILE_ZOOMS}" != "10,11,12,13" ]; then
  echo "Ignoring TILE_ZOOMS=${TILE_ZOOMS}; this backend build serves z=10,11,12,13."
  TILE_ZOOMS="10,11,12,13"
fi
TEMPORARY_SCORER_ENABLED="${TEMPORARY_SCORER_ENABLED:-false}"
if [ "${TEMPORARY_SCORER_ENABLED}" = "true" ] && [ "${ALLOW_TEMPORARY_SCORER:-}" != "1" ]; then
  echo "Ignoring TEMPORARY_SCORER_ENABLED=true; real TextCorT scoring is the default. Set ALLOW_TEMPORARY_SCORER=1 to override."
  TEMPORARY_SCORER_ENABLED="false"
fi
DEMO_ALERT_ENABLED="${DEMO_ALERT_ENABLED:-false}"
DEMO_ALERT_CHANNEL="${DEMO_ALERT_CHANNEL:-${ALERT_CHANNEL:-auto}}"
DEMO_ALERT_EMAIL_TO="${DEMO_ALERT_EMAIL_TO:-${ALERT_EMAIL_TO:-}}"
DEMO_ALERT_EMAIL_FROM="${DEMO_ALERT_EMAIL_FROM:-${ALERT_EMAIL_FROM:-}}"
DEMO_ALERT_GMAIL_CLIENT_ID="${DEMO_ALERT_GMAIL_CLIENT_ID:-${GMAIL_CLIENT_ID:-}}"
DEMO_ALERT_GMAIL_CLIENT_SECRET="${DEMO_ALERT_GMAIL_CLIENT_SECRET:-${GMAIL_CLIENT_SECRET:-}}"
DEMO_ALERT_GMAIL_REFRESH_TOKEN="${DEMO_ALERT_GMAIL_REFRESH_TOKEN:-${GMAIL_REFRESH_TOKEN:-}}"
DEMO_ALERT_GMAIL_USER_ID="${DEMO_ALERT_GMAIL_USER_ID:-me}"
DEMO_ALERT_SMTP_HOST="${DEMO_ALERT_SMTP_HOST:-${ALERT_SMTP_HOST:-}}"
DEMO_ALERT_SMTP_PORT="${DEMO_ALERT_SMTP_PORT:-${ALERT_SMTP_PORT:-587}}"
DEMO_ALERT_SMTP_USER="${DEMO_ALERT_SMTP_USER:-${ALERT_SMTP_USER:-}}"
DEMO_ALERT_SMTP_PASSWORD="${DEMO_ALERT_SMTP_PASSWORD:-${ALERT_SMTP_PASSWORD:-}}"
DEMO_ALERT_SMTP_STARTTLS="${DEMO_ALERT_SMTP_STARTTLS:-${ALERT_SMTP_STARTTLS:-true}}"
DEMO_ALERT_COOLDOWN_SECONDS="${DEMO_ALERT_COOLDOWN_SECONDS:-600}"

if [ -z "${PUBLIC_BASE_URL:-}" ] && [ -n "${RUNPOD_POD_ID:-}" ]; then
  export PUBLIC_BASE_URL="https://${RUNPOD_POD_ID}-${PORT}.proxy.runpod.net"
fi

export WORKSPACE_ROOT
export BACKEND_DIR
export QWEN_REPO_DIR
export DATA_ROOT
export DEFAULT_DATASET_ID
export DEFAULT_DATASET_IDS
export DEFAULT_DATASET_GROUP_ID
export RESULT_ROOT
export TILE_INDEX_ROOT
export PANO_TAR_DIR
export PANO_CACHE_ROOT
export PANO_INDEX_PATH
export PANO_TAR_RANGES
export PANO_TAR_RANGES_SHANGHAI_224_8_45_2B
export SCORING_VERSION
export TILE_INDEX_VERSION
export TILE_ZOOMS
export WARMUP_ON_STARTUP
export EMBEDDING_DEVICE
export TEMPORARY_SCORER_ENABLED
export DEMO_ALERT_ENABLED
export DEMO_ALERT_CHANNEL
export DEMO_ALERT_EMAIL_TO
export DEMO_ALERT_EMAIL_FROM
export DEMO_ALERT_GMAIL_CLIENT_ID
export DEMO_ALERT_GMAIL_CLIENT_SECRET
export DEMO_ALERT_GMAIL_REFRESH_TOKEN
export DEMO_ALERT_GMAIL_USER_ID
export DEMO_ALERT_SMTP_HOST
export DEMO_ALERT_SMTP_PORT
export DEMO_ALERT_SMTP_USER
export DEMO_ALERT_SMTP_PASSWORD
export DEMO_ALERT_SMTP_STARTTLS
export DEMO_ALERT_COOLDOWN_SECONDS
export PORT
export PYTHONPATH="${QWEN_REPO_DIR}:${WORKSPACE_ROOT}:${PYTHONPATH:-}"

mkdir -p "${LOG_ROOT}" "${RESULT_ROOT}" "${TILE_INDEX_ROOT}" "${PANO_CACHE_ROOT}" "$(dirname "${PANO_INDEX_PATH}")"

if [ ! -f "${QWEN_REPO_DIR}/.venv/bin/activate" ]; then
  echo "ERROR: Qwen runtime venv not found: ${QWEN_REPO_DIR}/.venv" >&2
  echo "Run cold startup first: bash ${BACKEND_DIR}/cold_startup.sh" >&2
  exit 1
fi

IFS=',' read -r -a DATASET_ID_LIST <<< "${DEFAULT_DATASET_IDS}"
for DATASET_ID in "${DATASET_ID_LIST[@]}"; do
  DATASET_ID="$(echo "${DATASET_ID}" | xargs)"
  if [ -z "${DATASET_ID}" ]; then
    continue
  fi
  if [ ! -d "${DATA_ROOT}/${DATASET_ID}" ]; then
    echo "ERROR: dataset directory not found: ${DATA_ROOT}/${DATASET_ID}" >&2
    exit 1
  fi
done

source "${QWEN_REPO_DIR}/.venv/bin/activate"
cd "${WORKSPACE_ROOT}"

echo "Starting Semantic Tile Service"
echo "Backend module: backend.main:app"
echo "Dataset:        ${DATA_ROOT}/${DEFAULT_DATASET_ID}"
echo "Dataset group:  ${DEFAULT_DATASET_IDS}"
echo "Group id:       ${DEFAULT_DATASET_GROUP_ID:-<auto>}"
echo "Results:        ${RESULT_ROOT}"
echo "Tile index:     ${TILE_INDEX_ROOT}"
echo "Pano tar dir:   ${PANO_TAR_DIR}"
echo "Shanghai pano:  ${PANO_TAR_RANGES_SHANGHAI_224_8_45_2B}"
echo "Scoring:        ${SCORING_VERSION}"
echo "Temporary:      ${TEMPORARY_SCORER_ENABLED}"
echo "Tile zooms:     ${TILE_ZOOMS}"
echo "Tile version:   ${TILE_INDEX_VERSION}"
echo "Startup warmup: ${WARMUP_ON_STARTUP}"
echo "Embedding dev:  ${EMBEDDING_DEVICE}"
echo "Demo alerts:    ${DEMO_ALERT_ENABLED} (channel: ${DEMO_ALERT_CHANNEL}, to: ${DEMO_ALERT_EMAIL_TO:-<not set>})"
echo "Public URL:     ${PUBLIC_BASE_URL:-<not set>}"
echo "Listen:         ${HOST}:${PORT}"

exec python -m uvicorn backend.main:app --host "${HOST}" --port "${PORT}"
