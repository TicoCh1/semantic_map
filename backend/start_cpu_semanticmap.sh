#!/usr/bin/env bash
set -euo pipefail
BACKEND_DIR="${BACKEND_DIR:-$(cd "$(dirname "$0")" && pwd)}"
export WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
source "${BACKEND_DIR}/native_q90_defaults.sh"
source "${BACKEND_DIR}/city_catalog.sh"
backend_configure_cities
export DEFAULT_DATASET_ID DEFAULT_DATASET_IDS DEFAULT_DATASET_GROUP_ID
export PORT="${PORT:-8000}"
export CUDA_VISIBLE_DEVICES=''
export SEMANTICMAP_MODE=cpu
export PYTHONPATH="${BACKEND_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
PYTHON_BIN="${CPU_PYTHON_BIN:-${WORKSPACE_ROOT}/semantic_backend/cpu_map_runtime/bin/python}"
exec "${PYTHON_BIN}" -m uvicorn semantic_map.cpu_api:create_app --factory --host 0.0.0.0 --port "${PORT}" --workers 1
