#!/usr/bin/env bash
# Explicitly opt in to the independent region matching research API.
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
runtime="${REGION_MATCHING_RUNTIME:-/workspace/semantic_backend/region_matching_runtime}"
: "${REGION_MATCHING_TOKEN:?Set a dedicated region matching token before starting this API}"
export REGION_MATCHING_ENABLED=true
export REGION_MATCHING_DATA_ROOT="${REGION_MATCHING_DATA_ROOT:-/workspace/reruns/pano512_8B_q90_20260915_b200/embedding}"
export REGION_MATCHING_ROOT="${REGION_MATCHING_ROOT:-/workspace/semantic_backend/region_matching}"
export OPENBLAS_NUM_THREADS="${OPENBLAS_NUM_THREADS:-2}"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-2}"
exec "$runtime/bin/python" -m uvicorn backend.semantic_map.region_matching_api:create_app \
    --factory --host "${REGION_MATCHING_HOST:-127.0.0.1}" \
    --port "${REGION_MATCHING_PORT:-8002}" --workers 1
