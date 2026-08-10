#!/usr/bin/env bash

# Shared city-to-dataset mapping for the RunPod setup and launcher scripts.
# Add a city without changing this file by supplying both variables, for example:
#   BACKEND_CITIES=berlin CITY_DATASET_MAP='berlin=berlin_224_8_45' bash backend/start_runpod_backend.sh
# The frontend map metadata for a custom city is supplied separately through CITY_CATALOG_JSON.

CITY_DATASET_MAP_DEFAULT='london=london_224_8_45,shanghai=shanghai_224_8_45_2B,new_york=new_york_224_8_45,rome=rome_224_8_45'

backend_city_trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

backend_dataset_for_city() {
  local requested key dataset pair
  requested="$(backend_city_trim "$1")"
  IFS=',' read -r -a _backend_city_pairs <<< "${CITY_DATASET_MAP}"
  for pair in "${_backend_city_pairs[@]}"; do
    key="$(backend_city_trim "${pair%%=*}")"
    dataset="$(backend_city_trim "${pair#*=}")"
    if [[ -n "${key}" && "${requested}" == "${key}" && -n "${dataset}" ]]; then
      printf '%s' "${dataset}"
      return 0
    fi
  done
  return 1
}

backend_configure_cities() {
  CITY_DATASET_MAP="${CITY_DATASET_MAP:-${CITY_DATASET_MAP_DEFAULT}}"
  BACKEND_CITIES="${BACKEND_CITIES:-london,shanghai}"

  local city dataset
  local -a city_ids=()
  local -a dataset_ids=()
  local -A seen_cities=()

  IFS=',' read -r -a _backend_requested_cities <<< "${BACKEND_CITIES}"
  for city in "${_backend_requested_cities[@]}"; do
    city="$(backend_city_trim "${city}")"
    [[ -z "${city}" ]] && continue
    if [[ -n "${seen_cities[${city}]:-}" ]]; then
      continue
    fi
    if ! dataset="$(backend_dataset_for_city "${city}")"; then
      echo "ERROR: unknown city '${city}'. Add it to CITY_DATASET_MAP (city=dataset_id)." >&2
      return 1
    fi
    seen_cities["${city}"]=1
    city_ids+=("${city}")
    dataset_ids+=("${dataset}")
  done

  if [[ "${#city_ids[@]}" -eq 0 ]]; then
    echo "ERROR: BACKEND_CITIES must contain at least one configured city." >&2
    return 1
  fi

  BACKEND_CITIES="$(IFS=,; printf '%s' "${city_ids[*]}")"
  DEFAULT_DATASET_ID="${dataset_ids[0]}"
  DEFAULT_DATASET_IDS="$(IFS=,; printf '%s' "${dataset_ids[*]}")"
  DEFAULT_DATASET_GROUP_ID="$(IFS=_; printf '%s' "${city_ids[*]}")"
}
