#!/usr/bin/env bash
# Run once on the CPU Pod against the volume that will later mount at /workspace.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -z "${PYTHON_BIN:-}" && -x "${WORKSPACE_ROOT:-/workspace}/embed-cpu-runtime/bin/python" ]]; then
  export PYTHON_BIN="${WORKSPACE_ROOT:-/workspace}/embed-cpu-runtime/bin/python"
else
  export PYTHON_BIN="${PYTHON_BIN:-python3}"
fi
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "Missing CPU Python interpreter: ${PYTHON_BIN}" >&2
  exit 1
fi
export PYTHON_BIN="$(command -v "${PYTHON_BIN}")"
exec bash "${SCRIPT_DIR}/04_run_dataset_embedding.sh" --prepare-cpu-only "$@"
