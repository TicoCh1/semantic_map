#!/usr/bin/env bash
# Create/update the same Qwen runtime used by the old cold_startup.sh notebook flow.
set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
QWEN_SOURCE_DIR="${QWEN_SOURCE_DIR:-${WORKSPACE_ROOT}/Qwen3-VL-Embedding}"
QWEN_VENV_DIR="${QWEN_VENV_DIR:-${QWEN_SOURCE_DIR}/.venv}"

if [[ ! -d "${QWEN_SOURCE_DIR}" ]]; then
  echo "ERROR: Qwen source repository not found: ${QWEN_SOURCE_DIR}" >&2
  echo "Set QWEN_SOURCE_DIR to the repo used with the original cold_startup.sh." >&2
  exit 1
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y gzip unzip rclone
fi

echo "Installing/updating the Qwen environment..."
HOST_PYTHON="$(command -v python)"
"${HOST_PYTHON}" -m pip install --upgrade pip uv
(
  cd "${QWEN_SOURCE_DIR}"
  bash scripts/setup_environment.sh
)

if [[ ! -f "${QWEN_VENV_DIR}/bin/activate" ]]; then
  echo "ERROR: Qwen setup did not create ${QWEN_VENV_DIR}/bin/activate" >&2
  exit 1
fi

# The upstream setup script creates this virtual environment with uv.  Such
# environments may intentionally omit pip, so install the extra notebook
# dependencies through the host's uv rather than calling `python -m pip` from
# inside the new environment.
"${HOST_PYTHON}" -m uv pip install --python "${QWEN_VENV_DIR}/bin/python" \
  huggingface-hub \
  modelscope \
  ipython \
  ipywidgets \
  jupyterlab_widgets \
  ipykernel \
  geopandas \
  pyogrio \
  shapely \
  scikit-learn

echo "Dependencies ready. Activate with: source ${QWEN_VENV_DIR}/bin/activate"
