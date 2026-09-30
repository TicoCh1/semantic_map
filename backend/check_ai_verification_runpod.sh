#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Run this check on the RunPod Linux runtime, not the local Windows machine." >&2
  exit 2
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(dirname -- "${SCRIPT_DIR}")}"
PYTHON_BIN="${PYTHON_BIN:-${QWEN_REPO_DIR:-/tmp/Qwen3-VL-Embedding}/.venv/bin/python}"
cd "${WORKSPACE_ROOT}"
required_files=(
  backend/__init__.py
  backend/semantic_map/__init__.py
  backend/tests/__init__.py
  backend/requirements-runpod.txt
  backend/tests/test_ai_verification.py
  backend/tests/test_ai_verification_projection.py
  backend/tests/test_human_verification_storage.py
  backend/tests/test_human_verification_sampling.py
  backend/tests/test_human_verification_api.py
)
for relative_path in "${required_files[@]}"; do
  if [[ ! -f "${relative_path}" ]]; then
    echo "Missing upload file: ${WORKSPACE_ROOT}/${relative_path}" >&2
    echo "Extract the complete AI verification upload ZIP into ${WORKSPACE_ROOT}, preserving backend/tests/." >&2
    exit 2
  fi
done
export PYTHONPATH="${WORKSPACE_ROOT}${PYTHONPATH:+:${PYTHONPATH}}"
# Check package resolution before installing dependencies or loading test modules.
"${PYTHON_BIN}" - <<'PY'
from pathlib import Path
import backend
import backend.tests

root = Path.cwd().resolve()
for module, relative in ((backend, 'backend/__init__.py'),
                         (backend.tests, 'backend/tests/__init__.py')):
    actual = Path(module.__file__).resolve()
    expected = (root / relative).resolve()
    if actual != expected:
        raise SystemExit(f'Wrong package import: {actual}; expected {expected}')
    print(f'Package path OK: {actual}', flush=True)
PY
"${PYTHON_BIN}" -m pip install -r backend/requirements-runpod.txt
"${PYTHON_BIN}" -m pip install httpx
"${PYTHON_BIN}" -m unittest -v \
  backend.tests.test_ai_verification \
  backend.tests.test_ai_verification_projection \
  backend.tests.test_human_verification_storage \
  backend.tests.test_human_verification_sampling \
  backend.tests.test_human_verification_api
