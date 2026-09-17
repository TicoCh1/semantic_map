#!/usr/bin/env bash
# Persistent profile for the validated 2026-09-16 native-Q90 / 8B release.
export DATA_ROOT=/workspace/reruns/pano512_8B_q90_20260915_b200/embedding
export MODEL_DIR=/workspace/models/Qwen3-VL-Embedding-8B
export BACKEND_CITIES=london,shanghai,new_york,rome
export CITY_DATASET_MAP='london=london_512_8_45_8B,shanghai=shanghai_512_8_45_8B,new_york=new_york_512_8_45_8B,rome=rome_512_8_45_8B'
export CITY_CATALOG_JSON='{"london":{"initial_zoom":13.3758,"name":"London","dataset_id":"london_512_8_45_8B","center":[-0.1276,51.5072],"bounds":{"west":-1.05,"east":0.7,"south":50.85,"north":52.05}},"shanghai":{"initial_zoom":13.8339,"name":"Shanghai","dataset_id":"shanghai_512_8_45_8B","center":[121.4737,31.2304],"bounds":{"west":120.85,"east":122.25,"south":30.65,"north":31.85}},"new_york":{"initial_zoom":13.6601,"name":"New York","dataset_id":"new_york_512_8_45_8B","center":[-74.006,40.7128],"bounds":{"west":-74.45,"east":-73.45,"south":40.45,"north":41.05}},"rome":{"initial_zoom":13.6337,"name":"Rome","dataset_id":"rome_512_8_45_8B","center":[12.4964,41.9028],"bounds":{"west":12.2,"east":12.8,"south":41.7,"north":42.1}}}'
export PANO_PREPARED_MANIFEST=/workspace/semantic_backend/cpu_preparation_20260916/pano_manifest.json
export SCORING_VERSION=text-cor-t-native-q90-8b-20260916
# Dataset-specific configuration marks panorama availability in the city API.
for _uf_city in london shanghai new_york rome; do
    _uf_suffix="${_uf_city^^}_512_8_45_8B"
    printf -v "PANO_TAR_RANGES_${_uf_suffix}" '%s' prepared-manifest
    export "PANO_TAR_RANGES_${_uf_suffix}"
done
unset _uf_city _uf_suffix
