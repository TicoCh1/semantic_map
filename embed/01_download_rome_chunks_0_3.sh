#!/usr/bin/env bash
# Download only Rome/Vatican chunks 0 and 3, then continue normal extraction.
set -euo pipefail

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
PANO_DIR="${PANO_DIR:-${WORKSPACE_ROOT}/pano}"
RCLONE_REMOTE="${RCLONE_REMOTE:-embedding_drive}"
RCLONE_CONFIG="${RCLONE_CONFIG:-${HOME}/.config/rclone/embedding-rclone.conf}"
REMOTE_COPY_PREFIX="${REMOTE_COPY_PREFIX:-Copy of }"

if ! command -v curl >/dev/null 2>&1 || ! command -v pv >/dev/null 2>&1 || ! command -v gzip >/dev/null 2>&1; then
  apt-get update
  apt-get install -y curl ca-certificates pv gzip
fi

echo "Ensuring the current official rclone release is installed..."
curl -fsSL https://rclone.org/install.sh | bash
rclone version | head -n 1

if [[ ! -s "${RCLONE_CONFIG}" ]]; then
  echo "ERROR: missing authenticated rclone config: ${RCLONE_CONFIG}" >&2
  exit 1
fi

mkdir -p "${PANO_DIR}"

FILTER_FILE="$(mktemp)"
cleanup() {
  rm -f -- "${FILTER_FILE}"
}
trap cleanup EXIT

printf '%s\n' \
  '+ /Copy of Rome_Vatican_chunk_0.tar.gz' \
  '+ /Copy of Rome_Vatican_chunk_3.tar.gz' \
  '- *' > "${FILTER_FILE}"

echo "Downloading Rome/Vatican chunks 0 and 3 only..."
rclone --config "${RCLONE_CONFIG}" copy "${RCLONE_REMOTE}:" "${PANO_DIR}" \
  --max-depth 1 \
  --filter-from "${FILTER_FILE}" \
  --progress \
  --stats 5s \
  --transfers 2 \
  --checkers 2 \
  --multi-thread-streams 8 \
  --retries 10 \
  --low-level-retries 20

echo "Download finished. Normalizing Drive filenames..."
while IFS= read -r -d '' source_path; do
  source_name="$(basename "${source_path}")"
  normalized_name="${source_name#"${REMOTE_COPY_PREFIX}"}"
  target_path="${PANO_DIR}/${normalized_name}"

  if [[ -e "${target_path}" ]]; then
    source_size="$(stat -c '%s' "${source_path}")"
    target_size="$(stat -c '%s' "${target_path}")"
    if [[ "${source_size}" != "${target_size}" ]]; then
      echo "ERROR: refusing to overwrite different files:" >&2
      echo "  ${source_path}" >&2
      echo "  ${target_path}" >&2
      exit 1
    fi
    rm -f -- "${source_path}"
  else
    mv -- "${source_path}" "${target_path}"
  fi
done < <(find "${PANO_DIR}" -maxdepth 1 -type f -name "${REMOTE_COPY_PREFIX}*" -print0)

echo "Starting sequential extraction of all downloaded Rome archives..."
while IFS= read -r -d '' archive_path; do
  tar_path="${archive_path%.gz}"
  partial_path="${tar_path}.part"

  if [[ -f "${tar_path}" ]]; then
    echo "TAR already exists; removing duplicate archive: ${archive_path}"
    rm -f -- "${archive_path}"
    continue
  fi

  rm -f -- "${partial_path}"
  echo "Decompressing: ${archive_path} -> ${tar_path}"
  pv --force "${archive_path}" | gzip -dc > "${partial_path}"
  mv -- "${partial_path}" "${tar_path}"
  rm -f -- "${archive_path}"
  echo "Finished and removed: ${archive_path}"
done < <(find "${PANO_DIR}" -maxdepth 1 -type f -name 'Rome_Vatican_chunk_*.tar.gz' -print0 | sort -z)

for chunk_index in 0 1 2 3 4; do
  tar_path="${PANO_DIR}/Rome_Vatican_chunk_${chunk_index}.tar"
  if [[ ! -f "${tar_path}" ]]; then
    echo "ERROR: missing final TAR: ${tar_path}" >&2
    exit 1
  fi
done

echo "Done: Rome/Vatican chunks 0-4 are ready as TAR files."
