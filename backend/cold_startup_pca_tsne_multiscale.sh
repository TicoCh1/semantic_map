#!/usr/bin/env bash
set -euo pipefail

# Cold-start helper for PCA_TSNE_london_multiscale.ipynb.
# It creates a dedicated notebook environment with RAPIDS/cuML, CuPy,
# openTSNE, and GeoJSON/table export dependencies. It does not modify the
# backend/Qwen runtime venv.

if [ -z "${WORKSPACE_ROOT:-}" ]; then
  if [ -d /workspace/embedding/london_224_8_45 ] || [ -d /workspace/Qwen3-VL-Embedding ]; then
    WORKSPACE_ROOT=/workspace
  else
    WORKSPACE_ROOT="${HOME}/workspace"
  fi
fi

DATA_ROOT="${DATA_ROOT:-${WORKSPACE_ROOT}/embedding}"
DEFAULT_DATASET_ID="${DEFAULT_DATASET_ID:-london_224_8_45}"
PCA_TSNE_ENV_DIR="${PCA_TSNE_ENV_DIR:-${WORKSPACE_ROOT}/semantic_notebooks/pca_tsne_multiscale_venv}"
PCA_TSNE_ENV_FILE="${PCA_TSNE_ENV_FILE:-${WORKSPACE_ROOT}/semantic_notebooks/pca_tsne_multiscale.env}"
PCA_TSNE_PYTHON="${PCA_TSNE_PYTHON:-python3}"
PCA_TSNE_RECREATE_ENV="${PCA_TSNE_RECREATE_ENV:-false}"
PCA_TSNE_KERNEL_NAME="${PCA_TSNE_KERNEL_NAME:-pca-tsne-multiscale-rapids}"
PCA_TSNE_KERNEL_DISPLAY="${PCA_TSNE_KERNEL_DISPLAY:-PCA/t-SNE RAPIDS Multiscale}"
RAPIDS_VERSION="${RAPIDS_VERSION:-26.4}"
RAPIDS_CUDA_MAJOR="${RAPIDS_CUDA_MAJOR:-}"
CUPY_INSTALL_CTK="${CUPY_INSTALL_CTK:-true}"
VERIFY_INSTALL="${VERIFY_INSTALL:-true}"

echo "Workspace root: ${WORKSPACE_ROOT}"
echo "Data root:      ${DATA_ROOT}"
echo "Dataset id:     ${DEFAULT_DATASET_ID}"
echo "Notebook venv:  ${PCA_TSNE_ENV_DIR}"
echo "Kernel name:    ${PCA_TSNE_KERNEL_NAME}"

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y build-essential python3-dev python3-venv wget ca-certificates
fi

if [ "${PCA_TSNE_RECREATE_ENV}" = "true" ]; then
  case "${PCA_TSNE_ENV_DIR}" in
    "${WORKSPACE_ROOT}/semantic_notebooks/"*|/tmp/pca_tsne_multiscale_venv*)
      rm -rf "${PCA_TSNE_ENV_DIR}"
      ;;
    *)
      echo "Refusing to delete unexpected PCA_TSNE_ENV_DIR=${PCA_TSNE_ENV_DIR}" >&2
      exit 1
      ;;
  esac
fi

mkdir -p "$(dirname "${PCA_TSNE_ENV_DIR}")" "$(dirname "${PCA_TSNE_ENV_FILE}")"

if [ ! -d "${PCA_TSNE_ENV_DIR}/bin" ]; then
  "${PCA_TSNE_PYTHON}" -m venv "${PCA_TSNE_ENV_DIR}"
fi

# shellcheck disable=SC1091
source "${PCA_TSNE_ENV_DIR}/bin/activate"

python -m pip install --upgrade pip setuptools wheel

python - <<'PY'
import sys

major, minor = sys.version_info[:2]
if (major, minor) < (3, 11):
    raise SystemExit(
        f"Python {major}.{minor} is too old for the current RAPIDS wheels. "
        "Use Python 3.11 or newer."
    )
print("Python:", sys.version.replace("\n", " "))
PY

detect_cuda_major() {
  if command -v nvidia-smi >/dev/null 2>&1; then
    nvidia-smi 2>/dev/null \
      | sed -n 's/.*CUDA Version: \([0-9][0-9]*\)\..*/\1/p' \
      | head -n 1
  fi
}

if [ -z "${RAPIDS_CUDA_MAJOR}" ]; then
  RAPIDS_CUDA_MAJOR="$(detect_cuda_major || true)"
fi
if [ -z "${RAPIDS_CUDA_MAJOR}" ]; then
  echo "Could not detect CUDA major from nvidia-smi; defaulting to CUDA 13 wheels."
  RAPIDS_CUDA_MAJOR=13
fi

case "${RAPIDS_CUDA_MAJOR}" in
  13)
    CUPY_PACKAGE="cupy-cuda13x"
    CUDF_PACKAGE="cudf-cu13==${RAPIDS_VERSION}.*"
    CUML_PACKAGE="cuml-cu13==${RAPIDS_VERSION}.*"
    ;;
  12)
    CUPY_PACKAGE="cupy-cuda12x"
    CUDF_PACKAGE="cudf-cu12==${RAPIDS_VERSION}.*"
    CUML_PACKAGE="cuml-cu12==${RAPIDS_VERSION}.*"
    ;;
  *)
    echo "Unsupported RAPIDS_CUDA_MAJOR=${RAPIDS_CUDA_MAJOR}; use 12 or 13." >&2
    exit 1
    ;;
esac

if [ "${CUPY_INSTALL_CTK}" = "true" ]; then
  CUPY_PACKAGE="${CUPY_PACKAGE}[ctk]"
fi

echo "RAPIDS version: ${RAPIDS_VERSION}.*"
echo "CUDA wheels:    cu${RAPIDS_CUDA_MAJOR}"
echo "CuPy package:   ${CUPY_PACKAGE}"
echo "cuDF package:   ${CUDF_PACKAGE}"
echo "cuML package:   ${CUML_PACKAGE}"

python -m pip install --prefer-binary \
  --extra-index-url=https://pypi.nvidia.com \
  "${CUPY_PACKAGE}" \
  "${CUDF_PACKAGE}" \
  "${CUML_PACKAGE}" \
  numpy \
  scikit-learn \
  openTSNE \
  pynndescent \
  annoy \
  hnswlib \
  pyarrow \
  pyproj \
  pandas \
  ipykernel \
  ipywidgets \
  jupyterlab_widgets

python -m ipykernel install --user \
  --name "${PCA_TSNE_KERNEL_NAME}" \
  --display-name "${PCA_TSNE_KERNEL_DISPLAY}"

cat > "${PCA_TSNE_ENV_FILE}" <<EOF
export WORKSPACE_ROOT="${WORKSPACE_ROOT}"
export DATA_ROOT="${DATA_ROOT}"
export DEFAULT_DATASET_ID="${DEFAULT_DATASET_ID}"
export PCA_TSNE_ENV_DIR="${PCA_TSNE_ENV_DIR}"
export PCA_TSNE_KERNEL_NAME="${PCA_TSNE_KERNEL_NAME}"
export RAPIDS_VERSION="${RAPIDS_VERSION}"
export RAPIDS_CUDA_MAJOR="${RAPIDS_CUDA_MAJOR}"
EOF

if [ "${VERIFY_INSTALL}" = "true" ]; then
  python - <<'PY'
import importlib.util

for name in ["cupy", "cudf", "cuml", "sklearn", "openTSNE", "pyarrow", "pyproj"]:
    print(f"{name:10}", "FOUND" if importlib.util.find_spec(name) else "missing")

import cupy as cp
import cudf
from cuml.decomposition import IncrementalPCA

print("cupy version:", cp.__version__)
print("cudf version:", cudf.__version__)
print("GPU count:", cp.cuda.runtime.getDeviceCount())
props = cp.cuda.runtime.getDeviceProperties(0)
gpu_name = props["name"].decode() if isinstance(props["name"], bytes) else props["name"]
print("GPU name:", gpu_name)
print("cupy test sum:", cp.arange(10, dtype=cp.float32).sum().get())

model = IncrementalPCA(n_components=2, batch_size=8, output_type="numpy")
X = cp.random.random((16, 4), dtype=cp.float32)
model.partial_fit(X)
print("cuML IncrementalPCA partial_fit: OK")
PY
fi

if [ ! -d "${DATA_ROOT}/${DEFAULT_DATASET_ID}" ]; then
  echo "WARNING: dataset directory not found: ${DATA_ROOT}/${DEFAULT_DATASET_ID}" >&2
fi

echo "Multiscale PCA/t-SNE notebook environment ready."
echo "Runtime env written to: ${PCA_TSNE_ENV_FILE}"
echo "Select Jupyter kernel: ${PCA_TSNE_KERNEL_DISPLAY}"
