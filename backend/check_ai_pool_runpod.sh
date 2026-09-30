#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Run shared-pool backend tests on the Linux Pod, not local Windows." >&2
  exit 2
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(dirname -- "${SCRIPT_DIR}")}"
PYTHON_BIN="${PYTHON_BIN:-${QWEN_REPO_DIR:-/tmp/Qwen3-VL-Embedding}/.venv/bin/python}"
cd "${WORKSPACE_ROOT}"
export PYTHONPATH="${WORKSPACE_ROOT}${PYTHONPATH:+:${PYTHONPATH}}"
"${PYTHON_BIN}" -m unittest -v backend.tests.test_ai_verification
