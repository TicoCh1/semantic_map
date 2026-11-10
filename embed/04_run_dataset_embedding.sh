#!/usr/bin/env bash
# Heterogeneous public datasets: perspective center crop or 8x 45-degree pano views.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
QWEN_SOURCE_DIR="${QWEN_SOURCE_DIR:-${WORKSPACE_ROOT}/Qwen3-VL-Embedding}"
QWEN_VENV_DIR="${QWEN_VENV_DIR:-${QWEN_SOURCE_DIR}/.venv}"
PYTHON_BIN="${PYTHON_BIN:-${QWEN_VENV_DIR}/bin/python}"

args=(
  --catalog "${DATASET_CATALOG:-${SCRIPT_DIR}/dataset_catalog_runpod.json}"
  --output-root "${OUTPUT_ROOT:-${WORKSPACE_ROOT}/reruns/public_datasets_512_qwen8b}"
  --repo-dir "${QWEN_SOURCE_DIR}"
  --model-dir "${MODEL_DIR:-${WORKSPACE_ROOT}/models/Qwen3-VL-Embedding-8B}"
  --cache-root "${CACHE_ROOT:-${WORKSPACE_ROOT}/dataset_embedding_cache}"
  --precision "${PRECISION:-bf16}"
  --embed-batch "${EMBED_BATCH:-64}"
  --checkpoint-sources "${CHECKPOINT_SOURCES:-256}"
  --decode-workers "${DECODE_WORKERS:-4}"
  --prefetch-sources "${PREFETCH_SOURCES:-16}"
  --gpu-prepare-sources "${GPU_PREPARE_SOURCES:-4}"
  --volume-root "${OUTPUT_VOLUME_ROOT:-${WORKSPACE_ROOT}}"
  --volume-capacity-gb "${OUTPUT_VOLUME_CAPACITY_GB:-500}"
  --storage-reserve-gb "${STORAGE_RESERVE_GB:-10}"
)
if [[ -n "${CPU_CACHE_ROOT:-}" ]]; then
  args+=(--cpu-cache-root "${CPU_CACHE_ROOT}")
fi

if [[ ! -x "${PYTHON_BIN}" ]]; then
  echo "Missing Qwen Python environment: ${PYTHON_BIN}. Prepare the CUDA runtime or set PYTHON_BIN explicitly." >&2
  exit 1
fi
exec "${PYTHON_BIN}" -u "${SCRIPT_DIR}/run_dataset_embedding.py" "${args[@]}" "$@"
