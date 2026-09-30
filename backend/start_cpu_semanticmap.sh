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
export ACCESS_LOG_PATH="${ACCESS_LOG_PATH:-${WORKSPACE_ROOT}/semantic_backend/logs/access.jsonl}"
# Cloudflare official IPv4/IPv6 lists checked 2026-09-30; retain the complete chain.
# RunPod gateways observed on this deployment; localhost covers the local Nginx hop.
EDGE_PROXY_CIDRS="$(tr -d '\r' < "${BACKEND_DIR}/cloudflare_proxy_cidrs.txt" | paste -sd, -)"
export ACCESS_LOG_TRUSTED_PROXIES="${ACCESS_LOG_TRUSTED_PROXIES-127.0.0.1/32,::1/128,100.64.1.0/24,${EDGE_PROXY_CIDRS}}"
export PYTHONPATH="${BACKEND_DIR}${PYTHONPATH:+:${PYTHONPATH}}"
PYTHON_BIN="${CPU_PYTHON_BIN:-${WORKSPACE_ROOT}/semantic_backend/cpu_map_runtime/bin/python}"
exec "${PYTHON_BIN}" -m uvicorn semantic_map.cpu_api:create_app --factory --host 0.0.0.0 --port "${PORT}" --workers 1 --no-proxy-headers
