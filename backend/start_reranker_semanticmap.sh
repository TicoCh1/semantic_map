#!/usr/bin/env bash
set -euo pipefail
BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "$0")" && pwd)}"
export WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
source "${BACKEND_DIR}/native_q90_defaults.sh"
export MODEL_VERSION=qwen3-vl-embedding-8b
source "${BACKEND_DIR}/city_catalog.sh"
backend_configure_cities
export DEFAULT_DATASET_ID DEFAULT_DATASET_IDS DEFAULT_DATASET_GROUP_ID
export RERANKER_ENABLED="${RERANKER_ENABLED:-true}"
export RERANKER_MODEL_DIR="${RERANKER_MODEL_DIR:-/workspace/models/Qwen3-VL-Reranker-2B}"
export RERANKER_BATCH_SIZE="${RERANKER_BATCH_SIZE:-4}"
export RERANKER_KEEP_RESIDENT="${RERANKER_KEEP_RESIDENT:-true}"
export RERANKER_INPUT_PIPELINE="${RERANKER_INPUT_PIPELINE:-cuda}"
export RERANKER_DECODE_WORKERS="${RERANKER_DECODE_WORKERS:-4}"
export RERANKER_RGB_CACHE_MIB="${RERANKER_RGB_CACHE_MIB:-256}"
export QWEN_REPO_DIR="${QWEN_REPO_DIR:-/tmp/semantic-reranker-qwen}"
export EMBEDDING_DEVICE=cpu_mmap
export SCORING_CHUNK_SIZE="${SCORING_CHUNK_SIZE:-512}"
export WARMUP_ON_STARTUP=false
export BACKFILL_HISTORICAL_QUERIES=false
export PREWRITE_ALL_TILES=false
export PYTHONPATH="${BACKEND_DIR}:${QWEN_REPO_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
export ACCESS_LOG_PATH="${ACCESS_LOG_PATH:-${WORKSPACE_ROOT}/semantic_backend/logs/access.jsonl}"
PYTHON_BIN="${RERANKER_PYTHON_BIN:-/tmp/semantic-reranker-runtime/bin/python}"
if [[ "${RERANKER_SERVING_MODE:-gpu}" == cpu ]]; then
    exec "$PYTHON_BIN" -m uvicorn semantic_map.cpu_api:create_app --factory --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --no-proxy-headers
fi
exec "$PYTHON_BIN" -m uvicorn semantic_map.runpod_api:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --no-proxy-headers
