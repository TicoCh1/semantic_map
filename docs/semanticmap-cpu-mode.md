# SemanticMap CPU mode

CPU mode serves previously computed prompt scores without importing Torch, Qwen,
or a scoring engine. The frontend discovers `mode: cpu` through `/api/capabilities`
and replaces free-form submission with a searchable list of saved prompts on desktop
and mobile. Unknown prompts, reference-image queries and force overrides are rejected
by the backend, including batch requests. Failed CPU requests do not create mock layers.

## Current data contract

The current catalog reads the completed four-city experiment directories under
`/workspace/semantic_backend/experiments/{city}_embedding_comparison_20260917`.
Each contains `prompts.json`, `alignment.npz`, `status.json`, and `score_new4096.npy`.
There are 348 prompts per city and 601,028 panorama records across four cities.
These are the saved 8B / 4096-dimensional scores with city-specific credibility;
z-scores are standardized within each city. They are not newly recomputed combined-city scores.
2048-dimensional and historical matrices remain untouched.

The server uses the aligned `(id, lon, lat, date)` records in exactly their saved score order.
It reuses the production `load_or_build_tile_index` and `write_geojson_tile_from_arrays`
functions, including the existing deterministic density sampling at zooms 10–13.
Tiles are generated on demand, then cached under
`/workspace/semantic_backend/cpu_map/results`; CPU tile indexes have their own directory.
Original results, embeddings, model weights and dataset archives are never overwritten.
Only 16 query/city score vectors are retained in the application cache.

## Start

```bash
python3.12 -m venv /workspace/semantic_backend/cpu_map_runtime
/workspace/semantic_backend/cpu_map_runtime/bin/python -m pip install -r /workspace/backend/requirements-cpu-map.txt
bash /workspace/backend/start_cpu_semanticmap.sh
```

The existing launcher also accepts `SEMANTICMAP_MODE=cpu`. The default remains GPU.
Use `CPU_PYTHON_BIN`, `CPU_EXPERIMENT_ROOT`, `CPU_CACHE_ROOT` or `PORT` to override paths
and the listening port. `BACKEND_TOKEN` is honored when supplied in the environment.
Native Q90 panorama images reuse the prepared SQLite indexes through
`native_q90_defaults.sh` and the existing panorama registry.

On Pod `3wzy1s5xoo6s4c`, the service runs on port 8000. The image's Nginx on 8001
also forwards to that service. Both public `/api/ready` URLs were verified to return
CPU mode and 348 prompts on 2026-09-17. Python's default HTTP User-Agent received a
Cloudflare 1010 response; a regular browser User-Agent and frontend browser requests work.
GitHub Pages connects via `?backend=https://3wzy1s5xoo6s4c-8000.proxy.runpod.net`.

## Validation

- CPU API unit tests: saved prompt search, batch rejection, unknown query/reference/override
  rejection, invalid revisions/tiles, identity and score preservation, cached tile reuse.
- Live four-city checks: generated tile scores equal their saved NPY values and all four
  corresponding panorama JPEGs can be read.
- Public API: CORS allows the GitHub Pages origin; all four manifests respond successfully.
- Frontend: TypeScript and Vite production build; desktop saved-prompt selection displays
  London/Shanghai score maps; mobile search layout checked separately.
- The pre-existing repeated priority-tile state update was fixed to avoid React render loops.

The CPU service uses about 1.2–1.4 GiB RSS with four cities loaded. Drive upload remains
independent and continues while maps are served. No timer or GPU compute task is started.
