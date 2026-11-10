#!/usr/bin/env bash
# Four cities, native-source 512/8/45 Qwen8B + 2048x1024 JPG.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
QWEN_SOURCE_DIR="${QWEN_SOURCE_DIR:-${WORKSPACE_ROOT}/Qwen3-VL-Embedding}"
QWEN_VENV_DIR="${QWEN_VENV_DIR:-${QWEN_SOURCE_DIR}/.venv}"
PYTHON_BIN="${PYTHON_BIN:-${QWEN_VENV_DIR}/bin/python}"
args=(
  --repo-dir "${QWEN_SOURCE_DIR}"
  --model-dir "${MODEL_DIR:-${WORKSPACE_ROOT}/models/Qwen3-VL-Embedding-8B}"
  --pano-root "${PANO_DIR:-${WORKSPACE_ROOT}/pano}"
  --output-root "${OUTPUT_ROOT:-${WORKSPACE_ROOT}/reruns/pano512_8B_20260915}"
  --selection "${LONDON_SELECTION:-${WORKSPACE_ROOT}/semantic_backend/audits/london_ulez_2021_20260915_5pWR1r/london_ulez_2021_points.csv}"
  --precision "${PRECISION:-bf16}"
  --jpeg-quality "${JPEG_QUALITY:-90}"
  --pano-batch "${PANO_BATCH:-8}"
  --embed-batch "${EMBED_BATCH:-64}"
  --decode-workers "${DECODE_WORKERS:-4}"
  --prefetch-panos "${PREFETCH_PANOS:-16}"
  --checkpoint-panos "${CHECKPOINT_PANOS:-8192}"
  --report-seconds "${REPORT_SECONDS:-30}"
)
if [[ -n "${OUTPUT_VOLUME_ROOT:-}" ]]; then args+=(--volume-root "${OUTPUT_VOLUME_ROOT}"); fi
if [[ -n "${OUTPUT_VOLUME_CAPACITY_GB:-}" ]]; then args+=(--volume-capacity-gb "${OUTPUT_VOLUME_CAPACITY_GB}"); fi
# Help/preflight remain read-only. Normal runs always get persistent logs, even
# when the Qwen interpreter or its imports fail before the pipeline starts.
for arg in "$@"; do
  if [[ "$arg" == "--check" || "$arg" == "--help" || "$arg" == "-h" ]]; then
    exec "${PYTHON_BIN}" -u "${SCRIPT_DIR}/run_panorama_embedding.py" "${args[@]}" "$@"
  fi
done
exec "${LOG_PYTHON_BIN:-python3}" -u "${SCRIPT_DIR}/run_logged_embedding.py" \
  --log-dir "${LOG_DIR:-${SCRIPT_DIR}/logs}" --interval "${REPORT_SECONDS:-30}" \
  -- "${PYTHON_BIN}" -u "${SCRIPT_DIR}/run_panorama_embedding.py" "${args[@]}" "$@"
