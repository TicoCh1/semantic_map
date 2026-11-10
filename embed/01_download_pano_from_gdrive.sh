#!/usr/bin/env bash
# Download the Rome/Vatican dataset folder into /workspace/pano.
# All direct child files are copied. Each .tar.gz is decompressed atomically,
# one at a time, and its compressed source is removed immediately on success.
set -euo pipefail

# Folder URL:
# https://drive.google.com/drive/folders/1LnbyjfTPubHCTafTHtPz3FSRqrWZqHt2
# This ID is not a secret and may be overridden without editing the script.
DRIVE_FOLDER_ID="${DRIVE_FOLDER_ID:-1LnbyjfTPubHCTafTHtPz3FSRqrWZqHt2}"

# Simple setup on your local computer:
#   rclone authorize "drive"
# Paste the complete one-line JSON token it prints between these single quotes.
# It contains a refresh token: never commit the filled-in script or share it.
RCLONE_DRIVE_TOKEN='PASTE_RCLONE_AUTHORIZE_DRIVE_JSON_HERE'

# Optional: only fill these when the token was generated with your own Google
# OAuth client. Leave both empty for the simple `rclone authorize "drive"` flow.
RCLONE_CLIENT_ID=''
RCLONE_CLIENT_SECRET=''

WORKSPACE_ROOT="${WORKSPACE_ROOT:-/workspace}"
PANO_DIR="${PANO_DIR:-${WORKSPACE_ROOT}/pano}"
RCLONE_REMOTE="${RCLONE_REMOTE:-embedding_drive}"
RCLONE_CONFIG="${RCLONE_CONFIG:-${HOME}/.config/rclone/embedding-rclone.conf}"
REMOTE_COPY_PREFIX="${REMOTE_COPY_PREFIX:-Copy of }"

if [[ "${RCLONE_DRIVE_TOKEN}" == "PASTE_RCLONE_AUTHORIZE_DRIVE_JSON_HERE" ]]; then
  echo "ERROR: set RCLONE_DRIVE_TOKEN at the top of this script first." >&2
  echo "Paste the complete JSON object returned by rclone authorize, not only access_token." >&2
  exit 1
fi
if [[ -n "${RCLONE_CLIENT_ID}" && -z "${RCLONE_CLIENT_SECRET}" ]] || [[ -z "${RCLONE_CLIENT_ID}" && -n "${RCLONE_CLIENT_SECRET}" ]]; then
  echo "ERROR: RCLONE_CLIENT_ID and RCLONE_CLIENT_SECRET must either both be set or both be empty." >&2
  exit 1
fi

if ! command -v rclone >/dev/null 2>&1 || ! command -v pv >/dev/null 2>&1; then
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: rclone, gzip, and pv are required, but apt-get is unavailable." >&2
    exit 1
  fi
  apt-get update
  apt-get install -y rclone gzip pv
fi

mkdir -p "${PANO_DIR}" "$(dirname "${RCLONE_CONFIG}")"

# Write the dedicated remote configuration directly. This avoids interactive
# `rclone config create` incompatibilities with the older rclone on some Pods.
umask 077
{
  printf '[%s]\n' "${RCLONE_REMOTE}"
  printf 'type = drive\n'
  if [[ -n "${RCLONE_CLIENT_ID}" ]]; then
    printf 'client_id = %s\n' "${RCLONE_CLIENT_ID}"
    printf 'client_secret = %s\n' "${RCLONE_CLIENT_SECRET}"
  fi
  printf 'scope = drive.readonly\n'
  printf 'root_folder_id = %s\n' "${DRIVE_FOLDER_ID}"
  printf 'token = %s\n' "${RCLONE_DRIVE_TOKEN}"
} > "${RCLONE_CONFIG}"
chmod 600 "${RCLONE_CONFIG}"

if [[ -z "${RCLONE_CLIENT_ID}" ]]; then
  echo "Using rclone's shared Google OAuth client (simple mode)."
  echo "If Google returns a shared-client quota error, switch to a personal client ID/secret."
fi

REMOTE_LIST="$(mktemp)"
RCLONE_FILTER="$(mktemp)"
cleanup() {
  rm -f -- "${REMOTE_LIST}" "${RCLONE_FILTER}"
}
trap cleanup EXIT

echo "Listing direct files in Google Drive folder ${DRIVE_FOLDER_ID}..."
rclone --config "${RCLONE_CONFIG}" lsf "${RCLONE_REMOTE}:" \
  --files-only \
  --max-depth 1 > "${REMOTE_LIST}"

remote_file_count="$(awk 'NF {count += 1} END {print count + 0}' "${REMOTE_LIST}")"
if [[ "${remote_file_count}" -eq 0 ]]; then
  echo "ERROR: the Drive folder is empty or no files are visible to this OAuth account." >&2
  exit 1
fi
echo "Drive files found: ${remote_file_count}"

# The Drive files currently begin with "Copy of ". Local files are normalized
# by removing that prefix. Exclude already completed local outputs so rerunning
# the script does not download the five ~60 GB archives again.
while IFS= read -r remote_name; do
  [[ -n "${remote_name}" ]] || continue
  local_name="${remote_name#"${REMOTE_COPY_PREFIX}"}"
  expected_path="${PANO_DIR}/${local_name}"
  if [[ "${local_name}" == *.tar.gz ]]; then
    expected_path="${expected_path%.gz}"
  fi
  if [[ -f "${expected_path}" ]]; then
    printf -- '- /%s\n' "${remote_name}" >> "${RCLONE_FILTER}"
  fi
done < "${REMOTE_LIST}"

echo "Copying all visible folder files into ${PANO_DIR} with authenticated rclone..."
rclone --config "${RCLONE_CONFIG}" copy "${RCLONE_REMOTE}:" "${PANO_DIR}" \
  --max-depth 1 \
  --filter-from "${RCLONE_FILTER}" \
  --progress \
  --stats 5s \
  --transfers 4 \
  --checkers 8 \
  --retries 3 \
  --low-level-retries 3

echo "Normalizing the Drive-generated '${REMOTE_COPY_PREFIX}' filename prefix..."
while IFS= read -r -d '' source_path; do
  source_name="$(basename "${source_path}")"
  normalized_name="${source_name#"${REMOTE_COPY_PREFIX}"}"
  target_path="${PANO_DIR}/${normalized_name}"
  if [[ "${source_path}" == "${target_path}" ]]; then
    continue
  fi
  if [[ -e "${target_path}" ]]; then
    source_size="$(stat -c '%s' "${source_path}")"
    target_size="$(stat -c '%s' "${target_path}")"
    if [[ "${source_size}" != "${target_size}" ]]; then
      echo "ERROR: refusing to overwrite different files:" >&2
      echo "  source: ${source_path} (${source_size} bytes)" >&2
      echo "  target: ${target_path} (${target_size} bytes)" >&2
      exit 1
    fi
    echo "Removing same-size duplicate after normalization: ${source_path}"
    rm -f -- "${source_path}"
  else
    mv -- "${source_path}" "${target_path}"
  fi
done < <(find "${PANO_DIR}" -maxdepth 1 -type f -name "${REMOTE_COPY_PREFIX}*" -print0)

decompressed=0
while IFS= read -r -d '' archive_path; do
  tar_path="${archive_path%.gz}"
  partial_path="${tar_path}.part"
  if [[ -f "${tar_path}" ]]; then
    echo "Keeping existing TAR and deleting duplicate archive: ${archive_path}"
    rm -f -- "${archive_path}"
    continue
  fi

  rm -f -- "${partial_path}"
  echo "Decompressing one archive: ${archive_path} -> ${tar_path}"
  echo "The pv line shows compressed bytes processed, speed, elapsed time, and ETA."
  pv --force "${archive_path}" | gzip -dc > "${partial_path}"
  mv -- "${partial_path}" "${tar_path}"
  rm -f -- "${archive_path}"
  decompressed=$((decompressed + 1))
  echo "Finished and removed compressed source: ${archive_path}"
done < <(find "${PANO_DIR}" -maxdepth 1 -type f -name 'Rome_Vatican_chunk_*.tar.gz' -print0 | sort -z)

tar_count=0
for chunk_index in 0 1 2 3 4; do
  tar_path="${PANO_DIR}/Rome_Vatican_chunk_${chunk_index}.tar"
  if [[ ! -f "${tar_path}" ]]; then
    echo "ERROR: missing Rome/Vatican TAR: ${tar_path}" >&2
    exit 1
  fi
  tar_count=$((tar_count + 1))
done

remaining_gz="$(find "${PANO_DIR}" -maxdepth 1 -type f -name 'Rome_Vatican_chunk_*.tar.gz' -print -quit)"
if [[ -n "${remaining_gz}" ]]; then
  echo "ERROR: compressed Rome/Vatican archive remains: ${remaining_gz}" >&2
  exit 1
fi

# Confirm every file listed by Drive now has its normalized local counterpart;
# archives are expected as .tar after successful decompression.
missing_count=0
while IFS= read -r remote_name; do
  [[ -n "${remote_name}" ]] || continue
  local_name="${remote_name#"${REMOTE_COPY_PREFIX}"}"
  expected_path="${PANO_DIR}/${local_name}"
  if [[ "${local_name}" == *.tar.gz ]]; then
    expected_path="${expected_path%.gz}"
  fi
  if [[ ! -f "${expected_path}" ]]; then
    echo "ERROR: missing downloaded output: ${expected_path}" >&2
    missing_count=$((missing_count + 1))
  fi
done < "${REMOTE_LIST}"
if [[ "${missing_count}" -ne 0 ]]; then
  exit 1
fi

echo "Done: ${remote_file_count} Drive file(s) verified locally."
echo "Rome/Vatican TAR files ready: ${tar_count}; newly decompressed this run: ${decompressed}."
