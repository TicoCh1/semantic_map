# SemanticMap CPU mode

Updated: 2026-09-17. Released as `f107d46f`; the user authorized pushing to `main`,
both GitHub Pages workflows succeeded, and the online browser was tested after deployment.

[Open the deployed CPU frontend](https://ticoch1.github.io/semantic_map/?backend=https%3A%2F%2F3wzy1s5xoo6s4c-8000.proxy.runpod.net&release=f107d46f).

CPU mode serves previously computed prompt scores without importing Torch, Qwen,
or a scoring engine. The frontend discovers `mode: cpu` through `/api/capabilities`
and replaces free-form submission with a searchable list of saved prompts on desktop
and mobile. Unknown prompts, reference-image queries and force overrides are rejected
by the backend, including batch requests. Failed CPU requests do not create mock layers.


CPU search visual refinement (2026-09-17): the input uses the original app typography, rounded borders and light/dark palette. The catalog is a focus-triggered dropdown, filtered while typing, with arrow-key/Enter selection and Escape/blur dismissal. Selecting a saved prompt closes the dropdown. Technical banners and the permanent result list were removed; mobile reuses the original top search bubble. Desktop dark mode, mobile layout and keyboard selection were checked in the browser.

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
For the existing installed runtime, subsequent starts only need:

```bash
SEMANTICMAP_MODE=cpu bash /workspace/backend/start_runpod_backend.sh
```

Check for an existing listener before starting a second instance. The last observed
service was PID 1983 with log `/tmp/semanticmap-cpu-v2.log`; recheck after any restart.
The virtual environment lives on the volume but depends on Python 3.12 in the Pod image;
verify or recreate it after changing images. The CPU launcher does not source the GPU
`.runpod_backend.env`: supply any required `BACKEND_TOKEN` explicitly in its environment.

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

### Same-city embedding comparison (2026-09-17)

**View > Difference mode** displays one city as a single difference map. For each
aligned panorama, `score = new_score - old_score` and
`zscore = new_zscore - old_zscore`; the differences are not standardized again.
The existing Field selector chooses raw score or z-score difference. The fixed,
zero-centered blue/white/red ramp spans -3 to +3 for z-score differences and -0.2
to +0.2 for raw-score differences; values outside these ranges retain their actual
popup values but saturate at the end colors. Blue means lower in new, red higher.
Panorama popups label the values as deltas, and panorama retrieval remains available.

Comparison responses now also include `embedding=difference` result URLs. Difference
revisions depend on both input score revisions and use a separate tile cache. Tests
cover sign, magnitude, identity, and cache isolation. Live checks validated 23,257
points across four city tiles against the old/new values (float32 error < 1e-6).
Current CPU service: PID 4011, log `/tmp/semanticmap-cpu-difference.log`; previous
module backup `/workspace/backend/semantic_map/cpu_api.pre_difference_20260917.py`.

Choose **View > Old vs new embedding**, select a city, and open a saved prompt.
The left pane shows historical 2B scores and the right pane shows new 8B/4096
scores for that same prompt and city. Only the selected prompt is displayed in
comparison mode. Both panes share the selected layer's color ramp and score range;
pan, zoom, bearing and pitch are synchronized. Narrow phone layouts stack the panes.
Switch back to **Compare cities** to restore the normal multilayer city view.

`POST /api/scoring/comparison` accepts `prompt` and a single `dataset_id` and returns
old/new result references. Capability `embedding_comparison_dataset_ids` advertises
supported cities. Historical values come from `historical_score.npy`; new values
come from `score_new4096.npy`. Both already use the same `alignment.npz` identities
(ID, longitude, latitude, date); London includes only the retained 156,880 records.
Other matched counts: Shanghai 173,622, New York 138,882, Rome 131,644.

Old result URLs carry `embedding=old` and a separate revision/cache namespace.
Ordinary jobs continue using new scores by default. Z-scores are computed separately
for each embedding over the identical aligned city sample. Original scores remain
available through the existing score field selector. Comparison does not run inference.
The existing sidebar histogram continues to describe its normal selected layer;
it is not a two-version comparison histogram.

Validation: six CPU API tests, including identity/score preservation, opposite
ranking, cache separation and invalid variant/revision checks; live old/new tile
scores verified against saved matrices in all four cities. Browser tests cover
prompt/city switching and synchronized Rome navigation. Rome's latitude-corrected
ground scale is consistent: both 500 m bars measured 109.2 CSS pixels initially,
and both 200 m bars measured 87.4 pixels after zooming and panning.

CPU service after this deployment: PID 3231, log `/tmp/semanticmap-cpu-comparison.log`.
Recheck the process after future restarts. Previous module backup:
`/workspace/backend/semantic_map/cpu_api.pre_comparison_20260917.py`.

### New York panorama identity (2026-09-17)

The combined `new_york_512_8_45_8B` dataset contains panorama IDs shared by
Manhattan and outside-Manhattan sources (including ID `16758`). Panorama metadata
requests must carry the selected point's longitude, latitude and available capture
date for every dataset, not only the legacy split New York dataset IDs. The returned
image URL pins the resolved `entry_key`. A request with an ambiguous ID alone must
continue returning 409 rather than silently displaying another location's image.

Live regression check: ID `16758` at `(-74.0090948198, 40.721857038, 202604)`
resolved to Manhattan; `(-73.8934452765, 40.6609014193, 202212)` resolved to the
outside-Manhattan archive. Both image responses matched their indexed member and
entry key and decoded as 4096x2048 JPEGs. The ID-only request still returned 409.

- CPU API unit tests: saved prompt search, batch rejection, unknown query/reference/override
  rejection, invalid revisions/tiles, identity and score preservation, cached tile reuse.
- Live four-city checks: generated tile scores equal their saved NPY values and all four
  corresponding panorama JPEGs can be read.
- Public API: CORS allows the GitHub Pages origin; all four manifests respond successfully.
- Frontend: TypeScript and Vite production build; desktop saved-prompt selection displays
  London/Shanghai score maps; mobile search layout checked at 390×844. The deployed
  GitHub page also successfully searched and opened `brick house`, rendered both cities,
  and had no browser console errors in the final check.
- The pre-existing repeated priority-tile state update was fixed to avoid React render loops.

The CPU service uses about 1.2–1.4 GiB RSS with four cities loaded. Drive upload remains
independent and continues while maps are served. No timer or GPU compute task is started.
