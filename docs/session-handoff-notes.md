# Session Handoff Notes

Updated: 2026-06-17

This file is a short memory aid for future sessions. It intentionally avoids repeating the main development spec in `semantic-map-frontend-dev.md`.

## Current Run State

- Frontend is a Vite + React + TypeScript app in `frontend/`.
- Backend is FastAPI in `backend/`, but it is no longer required for the current frontend workflow.
- Local frontend URL used in this session: `http://127.0.0.1:5173/`.
- Local backend URL for optional experiments: `http://127.0.0.1:8000/`.
- On this Windows machine, `node` works directly, but PowerShell blocks `npm.ps1`; use `npm.cmd install`, `npm.cmd run build`, and `npm.cmd run dev`.
- The frontend is now local-first: layer state, gradient presets, layer metadata, and mock score GeoJSON are handled in the browser. The Vite dev server no longer proxies `/api`.
- GitHub Pages static output is generated with `cd frontend; npm.cmd run build:pages` and served from `docs/index.html`.
- Static GitHub Pages deployments can select a RunPod backend with `?backend=https://POD-8000.proxy.runpod.net`; bare RunPod proxy hosts are normalized to HTTPS.
- If no backend is configured, prompt creation falls back to deterministic local mock layers. If a configured backend fails during prompt submission, all-layer refresh, or tile fetch, the affected layer falls back to deterministic local mock GeoJSON. Street-view image loading does not call `/api/...` on the static host; it fails with a clear "configured backend or packaged static pano dataset required" message until a curated static pano/data package is added.
- Backend/scoring code should not be run on the local Windows machine. Make backend changes by reading code and static inspection; run the real service only on RunPod.
- A hidden local Vite server was started during the 2026-04-30 work session for UI verification and later stopped at the user's request. In future Codex sessions, if the frontend needs to be started, use a visible `.bat`/`cmd.exe` window with a clear title so the running command is visible, for example:

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/k title UrbanFabric Frontend Dev && cd /d C:\Users\sheng\Desktop\Architecture\ML\urbanfabric\app\frontend && npm.cmd run dev -- --host 127.0.0.1 --port 5173"
```

## 2026-05-01 Session Changes

- Backend manifest serving was tightened for RunPod proxy changes:
  - `backend/semantic_map/remote_api.py` returns no-store headers for result manifests.
  - The manifest endpoint rewrites `tile_url_template` from the current backend URL/config instead of trusting an old stored template.
  - `frontend/src/state/localProject.ts` fetches remote manifests with `cache: "no-store"`.
- Embedding residency was changed from mmap-copy-per-chunk to VRAM-first by default:
  - `EMBEDDING_DEVICE=cuda` is now the RunPod default in `backend/semantic_map/backend_config.py`, `backend/start_runpod_backend.sh`, and `backend/cold_startup.sh`.
  - Startup warmup loads the full selected embedding shards into CUDA VRAM and reports `warmup_embedding_device_load`.
  - If preload does not fit, startup raises an explicit OOM message that names `EMBEDDING_DEVICE=cuda` as the cause and suggests a larger GPU, smaller selected data, or `EMBEDDING_DEVICE=cpu_mmap`.
  - `EMBEDDING_DEVICE=cpu_mmap` remains the fallback path for chunked mmap-to-GPU scoring.
- GPU execution is serialized inside one backend process:
  - `backend/semantic_map/text_cor_t_engine.py` has a process-local GPU lock around startup warmup and prompt scoring.
  - Prompt batching remains active, so compatible queued prompts are handled together instead of allowing concurrent workers to duplicate GPU memory.
  - Do not run multiple uvicorn workers/processes for this deployment unless an inter-process GPU scheduler is added; the current lock is not cross-process.
- Cosine precision decision:
  - Source embeddings are fp16, so fp32 cannot recover information already lost during embedding generation.
  - The scorer still casts views and text embeddings to fp32 for dot products because fp32 accumulation can reduce reduction error.
  - Do not force fp16 cosine unless a later benchmark accepts the precision/speed tradeoff.
- Tile-cache behavior was clarified:
  - A priority-tile request writes only the exact submitted priority tile.
  - Other z10-z13 tiles are generated on demand by the tile endpoint from completed `score.npy` / `zscore.npy` arrays unless `PREWRITE_ALL_TILES=true`.
  - Exporting missing tiles from cached `.npy` arrays is CPU/disk work and does not require Qwen, cosine scoring, CUDA, or extra VRAM.
- Frontend all-layer refresh was added:
  - `refreshAllScoringLayers()` in `frontend/src/state/localProject.ts` resubmits every existing layer prompt to RunPod without creating duplicate layers or changing layer-local colours/styles/order/visibility.
  - Cache hits relink the layer to the current manifest/tile template; misses queue normal backend scoring.
  - The UI button lives beside `Layers / Display Order` in `frontend/src/components/LayerPanel.tsx`, not beside the prompt input.
  - `frontend/src/components/PromptBar.tsx` is back to prompt input plus create button only.

## 2026-06-17 GitHub Pages Mobile Update

- Mobile compact breakpoint is `max-width: 700px`.
- On compact mobile startup, the app follows `prefers-color-scheme` for dark mode and default basemap until the user manually changes them. Manual markers are `semantic-map-theme-source=manual` and `semantic-map-basemap-source=manual`.
- The tutorial no longer auto-opens on compact mobile. Closing it on compact mobile scrolls back to the top.
- The first mobile viewport remains map-first, but `.split-main` uses a clamped height so the sidebar controls are visible below the map.
- The mobile map prompt/search input is a Google-Maps-style floating bubble at the top of the map. Other top-of-map controls are independent floating bubbles, not a full-width banner.
- Compact mobile does not render London and Shanghai side by side. It renders one city at a time and switches with a floating London/Shanghai segmented bubble.
- Compact mobile initializes each city close to a 500 m scale-bar view. MapLibre navigation/attribution controls are hidden, and the scale remains as a dark pill.
- On startup, when a backend URL is configured, `App.tsx` automatically attempts the same all-layer RunPod refresh as the manual layer refresh button. Failure is treated as fallback, not as a blocking UI error.
- `frontend/src/state/mobileDiagnostics.ts` starts from `main.tsx`, records mobile/browser/map failure signals, stores them under `semantic-map-mobile-diagnostics-v1`, exposes `window.__SEMANTIC_MAP_DIAGNOSTICS__`, and shows an in-page panel on `?diag=1` or `?debugDiagnostics=1`.
- `frontend/src/components/MapView.tsx` attaches diagnostics for MapLibre errors, move/zoom/idle snapshots, WebGL context loss/restoration, canvas size, and pixel ratio.
- `frontend/src/components/DemoErrorBoundary.tsx` now also records React crashes into mobile diagnostics.
- `frontend/src/state/localProject.ts` keeps no-backend prompt fallback as deterministic mock data and blocks backend-less pano image fetches with a clear static fallback message.

## Tablet Exhibit Mode

- The portable frontend package lives in `SemanticMapFrontendApp/`.
- `SemanticMapFrontendApp/start_demo.bat` prompts for RunPod URL and idle-reset timeout in seconds, writes `www/runtime-config.js`, then starts the static frontend with the RunPod URL locked and idle reset enabled.
- `SemanticMapFrontendApp/start_full.bat` writes a full-mode runtime config, starts the static frontend, keeps the RunPod URL visible/editable in the prompt panel, and disables idle reset.
- `SemanticMapFrontendApp/start_screensaver.bat` writes screensaver-mode runtime config, starts the static frontend, keeps full editing behavior, and exposes the street-view screensaver from an icon-only top button without clearing data.
- The root `start_demo.bat`, `start_full.bat`, and `start_screensaver.bat` start the Vite development frontend from `frontend/`. They write `frontend/public/runtime-config.js` and, in demo mode, run `frontend/Start-DemoWatchdog.ps1` through `frontend/Start-FrontendDev.ps1`. Use the `SemanticMapFrontendApp` launchers only for the packaged static app.
- `SemanticMapFrontendApp/www/` was refreshed from the 2026-06-08 development frontend build and now contains the London/Shanghai result routing, per-city priority tiles, dataset-scoped pano keys, shared high semantic tile zoom behavior, demo-only frontend monitor reporting, browser page reopen behavior, tutorial rewrite, street-view pano date/info UI, reference-pano layer creation, and the 2048x1024 London/Shanghai street-view screensaver pano set.
- Target Windows devices do not need Python, Node.js, npm, or a local backend. `SemanticMapFrontendApp/launcher/Start-SemanticMap.ps1` serves `SemanticMapFrontendApp/www/` over `127.0.0.1` and opens the default browser. All launchers derive paths from their own folder, so the package can be copied to a USB drive and moved to another Windows device.
- Demo mode starts an A-side watchdog as a hidden process. Development mode uses `frontend/Start-DemoWatchdog.ps1`; packaged mode uses `SemanticMapFrontendApp/launcher/Start-DemoWatchdog.ps1`. The watchdog probes the local frontend and RunPod `/api/ready`, forwards heartbeat/error events to B, exposes a local-only receiver at `http://127.0.0.1:51973` or the next available port, and stores no SMTP/Gmail credentials.
- Packaged launcher fix: `SemanticMapFrontendApp/launcher/Start-SemanticMap.ps1` must not pass `-BackendToken ""` to `Start-Process -ArgumentList`; Windows PowerShell treats an empty argument-list element as invalid. The launcher now appends `-BackendToken` only when a non-empty token exists.
- Special screensaver implementation notes and migration instructions live in `docs/screensaver-mode-implementation-and-migration.md`.
- The A-side watchdog receiver is local-only and lightweight: fast `OPTIONS`, bounded body reads, `text/plain` or JSON event payloads, 250 ms local processing, .NET `HttpClient` with cancellation timeouts for outbound posts, and a bounded queue for frontend events that are later flushed to B.
- CORS/preflight hardening: frontend GET requests to RunPod no longer set `Content-Type: application/json`; only POST JSON bodies do. Development and portable launchers normalize `http://*.proxy.runpod.net` to HTTPS, and backend CORS has credentials disabled because auth is header-based rather than cookie-based.
- If the local frontend server is reachable but a visible frontend page stops sending heartbeats, the A-side watchdog opens the frontend URL again and reports `frontend_browser_restarted` to B. Hidden/background pages are treated as browser timer throttling and do not trigger critical stale-heartbeat emails or automatic reopening.
- A real `pagehide` from closing/navigating is sent to the local watchdog with `navigator.sendBeacon` plus a keepalive fallback using `text/plain`; the watchdog reopens the page immediately. It deduplicates only the exact same pagehide event key for a short window, so duplicate beacon/fallback posts do not open two windows but closing the restarted page again still reopens it.
- The watchdog is parent-process-bound and exits when the demo launcher/static server exits, so closing the bat should not leave an orphan local monitor. A-side watchdog logs rotate at 5 MB with two backups.
- B-side demo alerting is enabled with `DEMO_ALERT_ENABLED=true`. Preferred Gmail delivery is `DEMO_ALERT_CHANNEL=gmail_api` plus `DEMO_ALERT_EMAIL_TO`, `DEMO_ALERT_EMAIL_FROM`, `DEMO_ALERT_GMAIL_CLIENT_ID`, `DEMO_ALERT_GMAIL_CLIENT_SECRET`, and `DEMO_ALERT_GMAIL_REFRESH_TOKEN`. SMTP remains as fallback. B writes alert JSONL under `/workspace/semantic_backend/alerts/alerts.jsonl` and sends email from the backend.
- B-side alert emails now include a lightweight analysis section with likely cause, observed signals, and suggested action. Backend defaults are 60 seconds for frontend/watchdog/job stale detection, 15 seconds for monitor checks, and 600 seconds for email cooldown. Pano warmup uses its own longer timeout.
- B-side monitor checks for heartbeats, jobs, workers, pano warmup, and disk are guarded independently; one failing check records `demo_monitor_check_failed` instead of killing the whole monitor loop. Non-ok heartbeat snapshots are logged as `info` unless they are explicit warning/critical/recovered events.
- Pano warmup alerting uses a separate 900-second default timeout (`DEMO_ALERT_PANO_WARMUP_TIMEOUT_SECONDS`) so backend startup does not email just because first-start Shanghai tar indexing takes longer than prompt job stage timeout.
- If A loses network, B should emit `watchdog_heartbeat_stale` after the watchdog timeout when a prior watchdog heartbeat exists. A also sends `watchdog_backend_connection_recovered` with outage details after it can post to B again. B-side stale-watchdog checks use the latest watchdog heartbeat/session, not every historical watchdog session in memory.
- Alert storage is bounded: B rotates `alerts.jsonl` at 20 MB with three backups by default and deduplicates direct-browser/forwarded-watchdog copies of the same event. A-side watchdog logs rotate at 5 MB with two backups.
- The project introduction modal now opens on frontend startup and can be reopened from the `Project intro` button above the prompt bar.
- The project introduction is now a multi-page, skippable tutorial. Tutorial copy and page targets live in `frontend/src/state/tutorialContent.ts`, not inline in `App.tsx`.
- Tutorial pages can target UI/map regions with `data-tour-target`. The modal scrolls the target into view and draws a temporary highlight frame around the prompt bar, layer panel, histogram, style editor, map, or street-view panel. Street-view targeting falls back to the map when no street-view panel is mounted.
- Setting runtime `idleResetEnabled=true` resets the app after idle timeout, clears street-view markers, and shows the intro modal. The last 30 seconds before reset show a prominent countdown warning.
- Tutorial open intentionally suspends the idle timer, so a demo can remain parked on the tutorial first page. Idle reset only runs from the main app after the tutorial is closed.
- Idle reset now publishes `window.__SEMANTIC_MAP_IDLE_RESET__` for field diagnostics. It records whether the timer is disabled or blocked by the tutorial, the next reset time, the last accepted activity event, and ignored synthetic/empty activity events.
- Idle activity detection accepts only trusted `pointerdown`, `keydown`, `touchstart`, and non-empty `wheel` events.
- Exhibit reset restores three default layers:
  - `the scene contains brick facade` / Magma
  - `the scene contains abundant vegetation` / Vegetation (`#582e1d`, `#000000`, `#50ff00`)
  - `the scene shows people interacting` / Turbo
- Exhibit reset sets point size to `3`, absolute map size off, score field to `zscore`, and histogram bucket width to `0.02`.
- Brick and people ranges are `-1..3`; vegetation range is `-2.5..1.5`.
- The default exhibit prompts are submitted once only after `/api/ready` succeeds; existing remote results or pending jobs are reused across idle resets.

## Architecture Direction

- Target product shape is local-first, similar to a local AI tool:
  - Local frontend handles rendering, UI state, layer metadata, layer order, visibility, colour schemes, point styling, basemap selection, and local result cache.
  - Remote GPU server should only run semantic scoring and return score result data or a result manifest.
  - The remote GPU server should not be the source of truth for user colour schemes, layer order, visibility, or per-user map settings.
- Treat the current FastAPI backend as a local app backend/control layer, not as the future remote GPU server:
  - It may remain on the user's machine to read/write local project files, manage local caches, and proxy remote scoring calls.
  - It should not be deployed as a shared settings server unless the product goal changes.
  - Future real scoring can be connected behind this local API, or the local API can call a separate GPU scoring service.
- Preferred future request flow:
  - React app creates a local scoring request/job record.
  - Local backend or frontend sends the scoring payload to the remote GPU service.
  - GPU service returns GeoJSON, PMTiles/vector tile output, CSV, or a manifest with downloadable result paths.
  - Local app registers the returned result as a local layer and stores style/metadata locally.

## Local-First Frontend Refactor

- Implemented in `frontend/src/state/localProject.ts`.
- `frontend/src/api/client.ts` now re-exports local project functions instead of using `fetch`.
- Stored in browser `localStorage`:
  - `semantic-map-local-state-v1` for layer state, layer metadata, order, visibility, selected layer, and copied layer styles.
  - `semantic-map-local-gradients-v1` for saved colour scheme presets.
- Mock semantic score GeoJSON is generated deterministically in the frontend from layer prompt/id and is not stored in the backend.
- `MapView.tsx` still calls `getLayerGeojson(layer.id)`, but that now resolves to local generated data.
- `frontend/vite.config.ts` no longer defines a `/api` proxy.
- The root Windows launchers are frontend-only. Backend startup is done on RunPod with `backend/start_runpod_backend.sh`.

## Histogram UI

- Added `frontend/src/components/HistogramPanel.tsx`.
- It is mounted between `LayerPanel` and `GradientEditor` in the sidebar.
- It reads the selected layer's local GeoJSON through `getLayerGeojson(layer.id)`, computes a score histogram, and colours each bin using the selected layer's current colour scheme.
- It supports `score` / `zscore` field selection.
- It supports user min/max range. Values outside the selected range are excluded, not clamped into the edge bars.
- It supports bucket widths `0.05`, `0.02`, and `0.01`, persisted in `semantic-map-histogram-bucket-width`.
- Histogram colouring uses the same absolute stop-position interpretation as the map:
  - stop value `0.2` means 20% of the score range, not 20% of the current stop span.
  - colours extend from the first/last stop to the score-range boundaries.
- The shared colour helper lives in `frontend/src/state/color.ts` as `gradientColorAt` / `gradientColorForScore`.

## Runtime Log And Remote Progress

- Added `frontend/src/components/LogPanel.tsx`.
- Remote job polling events are emitted from `frontend/src/state/localProject.ts`.
- The log displays backend stage, progress, current tile, tile count, and `stage_timings`.
- Runtime progress is still shown in the bottom log, and new remote compute jobs also appear in a map overlay popup.
- The map overlay only shows prompts that actually require backend compute or polling. If a prompt is already computed and returns `ready` from storage/cache immediately, it is not shown in the map overlay, but the bottom runtime log can still record the cache hit.
- `RemoteLogEntry.map_overlay` marks entries that should appear on the map. `MapView.tsx` receives `progressEntries` from `App.tsx` and renders the overlay.
- Dark-mode scrollbar styling is now defined for `.log-body`.
- Backend detailed scoring timings now include text embedding, credibility cache/load/compute, chunk copy, cosine similarity, score/zscore work, per-prompt result array packaging, and total scoring time. The timing key `build_result_rows` is retained for compatibility even though the production path no longer materializes per-pano Python row objects.
- Backend `scoring_total` does not include result-cache output or GeoJSON tile output. Those are currently covered by `tile_writing`.
- RunPod result writing now stores compact `score.npy` / `zscore.npy` arrays and defaults to writing only the requested priority GeoJSON tile before the manifest is ready. Missing tiles are generated on demand by the tile endpoint and returned with long-lived private cache headers. Set `PREWRITE_ALL_TILES=true` to restore full upfront z/x/y tile writing, and `WRITE_SCORES_JSONL=true` to also emit legacy `scores.jsonl`.
- The frontend also stores successful remote semantic GeoJSON tile responses in IndexedDB under `semantic-map-remote-tile-cache-v1`, keyed by full tile URL. This is separate from the short-lived in-memory map redraw cache and lets already loaded high-detail semantic tiles survive page refreshes.
- Backend prompt result ids are now readable `slug--short_hash` ids based on canonicalized prompt text. Case, repeated whitespace, punctuation, quotes, dash/slash/underscore variants, and similar text noise collapse to the same result cache. Legacy SHA-only result directories are still checked before recomputing.
- Completed scoring is durable on disk through `score.npy`, `zscore.npy`, and `manifest.json`; a later matching prompt request can write missing tiles from those arrays without rerunning cosine similarity.

## RunPod Backend State

- Real RunPod scorer lives in `backend/semantic_map/text_cor_t_engine.py`.
- `backend/semantic_map/job_service.py` starts a prompt bucket worker and now performs startup warmup when `WARMUP_ON_STARTUP=true`.
- Startup warmup loads model, dataset records, embedding mmap handles, CUDA embedding tensors when `EMBEDDING_DEVICE=cuda`, credibility cache, and tile index before accepting the first prompt. Set `DEFAULT_DATASET_IDS=london_224_8_45,shanghai_224_8_45_2B` and `DEFAULT_DATASET_GROUP_ID=london_shanghai` to warm both city datasets into the same group scope the frontend will request.
- Prompt scoring now returns compact `PromptScoreResult.records`, `scores`, and `zscores` arrays instead of building a large tuple of per-pano `ScoredPano` Python objects. Dual-city requests compute London and Shanghai as one combined scoring corpus, then split and store one result per dataset.
- Prompt queue memory is bounded with `PROMPT_QUEUE_MAX_SIZE`.
- In-process terminal job records are pruned with `JOB_MEMORY_MAX_COUNT` and `JOB_MEMORY_TTL_SECONDS`; durable job/result files remain on disk.
- Frontend dual-city scoring now submits `dataset_ids` plus one `priority_tiles[]` entry per city, and stores returned result templates under `layer.source_paths.london` and `layer.source_paths.shanghai` while keeping legacy `source_path` as the primary fallback.
- The dual-city map uses matched ground scale, but semantic tile requests share the higher of the two city z-levels so London and Shanghai are not compared at different tile zooms.
- Pano selection and object URL bookkeeping are scoped by `dataset_id:pano_id`; backend pano routes also have dataset-scoped variants under `/api/datasets/{dataset_id}/panos/...`.
- Shanghai pano serving uses `/workspace/pano/shanghai_rootless.tar` by default via `PANO_TAR_RANGES_SHANGHAI_224_8_45_2B=shanghai_rootless`; this scans the full tar once and stores byte offsets in a dataset-scoped SQLite index.
- Backend scoring requests reject dataset ids outside `DEFAULT_DATASET_IDS`/`DEFAULT_DATASET_ID` to prevent unbounded dataset cache and VRAM growth from arbitrary client input.
- `backend/cold_startup.sh` writes `WARMUP_ON_STARTUP=true` into `.runpod_backend.env`.
- `backend/start_runpod_backend.sh` exports and prints `WARMUP_ON_STARTUP`.
- Tile index remains z10-z13. z13 is no deletion; z10-z12 are area-scaled from z13 base tiles.

## Reference Pano Scoring

- Implemented image-reference layers in source and refreshed the portable `SemanticMapFrontendApp/www/` package in this step.
- A ready pano in `StreetViewPanel.tsx` can be dragged from the pano strip or info overlay onto `PromptBar.tsx`.
- The drag payload uses `PANO_REFERENCE_DRAG_TYPE` and contains exactly one `PanoReference`; array/multi-reference drops are ignored.
- `localProject.ts` creates `query_type="pano_reference"` layers with stored `reference_pano`, default `zscore`, range `2..6`, point size `3`, and non-absolute radius.
- Selecting a pano-reference layer in `App.tsx` automatically loads the stored reference pano through the existing pano image request path and shows it in the street-view panel.
- No backend score lookup endpoint was added. The reference image is loaded by pano id/dataset id; exact reference-layer score display still depends on already loaded map tile/layer values.
- Backend `POST /api/scoring/jobs` now accepts `query_type="pano_reference"` and `reference_pano`. Text jobs remain the default query type.
- `job_service.py` gives reference jobs a separate scoring-version suffix and prompt-id namespace, then batches reference jobs separately from text prompts.
- `text_cor_t_engine.py` implements the `pano_cor.ipynb` aligned-view cosine path: lookup reference embedding, compare selected view k to selected view k, average views, zscore over the combined requested dataset group, then split London/Shanghai result storage.
- Reference scoring intentionally does not apply the text-prompt credibility multiplier.

## Street-View Info Panel

- The street-view pano info overlay defaults to compact mode with city and capture date.
- The window-style expand/minimize button switches between compact mode and full mode.
- Full mode shows pano id plus available per-layer score/zscore rows; exact values still depend on already loaded layer/tile data.
- The overlay is positioned above the photo-sphere viewer controls, has higher z-index than the viewer UI, and uses explicit light/dark backgrounds.

## Priority Tile And Prompt Batch Notes

- The frontend should report one priority tile per visible city map when using dual-city scoring. The tile zoom is `floor(map zoom)` clamped to backend zooms `10..13`; when `Max detail` is enabled, the priority tile uses `z=13`.
- `priority_tiles` are captured when a prompt is submitted. Later pan/zoom changes update the next submitted prompt's priority tiles, but they do not mutate an already queued/running job.
- The backend uses priority tiles only after combined scoring, when writing output. By default it writes each dataset's `score.npy`, `zscore.npy`, requested priority GeoJSON tile, then that dataset's manifest. Other visible tiles are generated on demand by the tile endpoint unless `PREWRITE_ALL_TILES=true`.
- Cache-hit prompts that return `ready` immediately do not rewrite a new priority tile. Missing tiles for completed results are still generated on demand when the map requests them.
- Prompt batching uses a worker window of `PROMPT_BATCH_WINDOW_MS=250` and a cap of `PROMPT_BATCH_MAX_SIZE=32`.
- If a user submits 10 prompts every 2-3 seconds, the first prompt will usually be taken immediately and scored alone. Later prompts only batch together if they accumulate while an earlier GPU pass is still running; otherwise each prompt is likely processed as its own small batch after the 250 ms bucket window.
- Compatible queued prompts are batched only when they share the same dataset group/model/effective-scoring/tile-index configuration. Cache hits return immediately and are not merged into new scoring work.

## Recent Implementation Details

- Colour schemes are now layer-local:
  - Each layer stores copied gradient stops in `layer.style.stops`.
  - `layer.style.gradient_id` records the source preset id, but rendering should use the layer-local copied stops.
  - Editing or saving one colour scheme must not silently update every layer that previously used the same preset.
- `Apply` means copy the current scheme onto the selected layer only.
- `Save` means persist a reusable preset into browser localStorage for the local frontend.
- Saved custom colour schemes can be deleted.
- Built-in colour presets must not be deleted; backend returns 400 for built-in preset deletion.
- Deleting a saved colour scheme should not destroy colours already copied onto layers.
- Layer deletion already exists in `LayerPanel.tsx` through each layer row's trash button.

## Colour Editor UI Decisions

- Keep only the native browser colour picker and hex input for colour stop editing.
- Removed/should remain removed:
  - extra large swatch at the left of the colour row,
  - RGB/HSV tabs,
  - large HSV wheel,
  - RGB/H/S/V slider panels.
- The user specifically preferred the compact native colour picker UI next to the hex code.
- Implemented colour-stop handle change:
  - The visible white/black "slider" under gradient-stop diamonds was an unintended button background inherited from global button/theme CSS.
  - `.gradient-stop` is now a single coloured draggable handle using each stop's `--stop-color`.
  - Existing stop drag/click behaviour and selected outline are preserved.
  - `.gradient-stop` hover/focus/dark-mode rules no longer inherit normal button backgrounds.
- Implemented dark-mode coverage change:
  - `Slider` controls in `GradientEditor.tsx`, including `input[type="range"]`, the numeric size input, and the `Absolute map size` checkbox, now have explicit dark-mode styling.
- Point size range is now `1` to `10` with `0.1` increments.
- Prompt bar `RunPod` checkbox text now aligns on the same line as the checkbox.
- MapView is memoized and no longer rebuilds semantic layers just because dark mode, side-panel logs, or selection callback identity changes. Resizing the split pane can still make MapLibre repaint the canvas because the map container dimensions change.
- MapView now prunes fully covered same-coordinate overlays before adding layers to MapLibre: from top to bottom it keeps the top visible layer and only lower layers with strictly larger point size.
- New user-created prompt layers default to `zscore`, range `-1..3`, point size `3`, and non-absolute radius.
- Histogram min/max number steppers now use `0.5` increments, dark-mode native number controls use dark colour scheme, histogram bars have no flex gap, and the side/page scrollbars are dark-mode aware.
- `Max detail` has a hover warning about slow rendering over large regions.

## Basemap Decisions

- Added basemap selector in `MapView.tsx`.
- Current basemaps are defined in `frontend/src/state/basemaps.ts`.
- Included:
  - OpenStreetMap raster tiles.
  - OpenFreeMap Dark style.
  - Sentinel-2 Cloudless 2016 from EOX.
- Removed:
  - Landsat WELD true-colour annual imagery through NASA GIBS. It is open/licensable enough for the prototype, but not useful enough in practice.
- CartoDB Dark / CARTO Dark Matter was not added:
  - CARTO basemaps are not treated here as OSM-like "free to use for anything"; CARTO docs indicate commercial usage needs an Enterprise license and non-commercial free use is limited.
- Google Maps and Google Satellite were not added:
  - Google Map Tiles API needs Google Maps Platform access, API key/billing, and Google terms. Do not use unofficial raw Google tile URLs.
- Sentinel details:
  - Copernicus Sentinel data is broadly open, but EOX Sentinel-2 cloudless 2018-2024 tiles are marked CC BY-NC-SA 4.0, so avoid those as default general-use basemaps.
  - EOX Sentinel-2 cloudless 2016 3857 layer is marked CC BY 4.0 and was used instead.
  - Working tile template used: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg`.
- Landsat details:
  - USGS Landsat data is public domain.
  - NASA GIBS is a free/open visualization service.
  - The wired Landsat layer is historical WELD annual imagery, not a Google-Satellite-equivalent current high-resolution basemap.
  - Working tile template used: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/all/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/1998-12-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`.
  - Despite acceptable licensing, it was removed from the app because the user found it not useful.

## Resolved Rendering Issue

- Frequent basemap switching could leave semantic point layers missing.
- Location: `frontend/src/components/MapView.tsx`, in the interaction between `map.setStyle(...)`, the old `ready` boolean, and the semantic layer redraw effect.
- Root cause:
  - MapLibre `setStyle` removes custom sources/layers.
  - The old draw effect could run during a render where `basemapId` had changed but `ready` still reflected the previous style.
  - Rapid switches could also let stale `style.load` handlers or stale async redraws win the timing race.
- Implemented follow-up fix:
  - Replaced the bare `ready` boolean handshake with a semantic redraw request using a monotonically increasing style generation token.
  - After each `setStyle`, semantic layers are treated as the priority overlay and restoration starts immediately, even before one-shot `style.load`/`idle` events arrive.
  - If the current MapLibre style is not ready for `addSource`/`addLayer`, redraw retries every 100 ms for up to 80 attempts.
  - Redraw work is guarded with the same generation token so stale async draws cannot clear or overwrite the latest style's layers.
  - All visible semantic layers are re-added after every basemap switch and are added after the basemap style, so they remain above the basemap.

## Files Most Likely To Matter Next

- `frontend/src/state/tutorialContent.ts`: project intro tutorial pages and highlight targets.
- `frontend/src/components/MapView.tsx`: MapLibre map, basemap selector, semantic layer drawing.
- `frontend/src/state/basemaps.ts`: basemap definitions and tile/style URLs.
- `frontend/src/components/GradientEditor.tsx`: colour scheme editor, preset apply/save/delete, point size controls.
- `frontend/src/components/HistogramPanel.tsx`: histogram range, field, and bucket-width controls.
- `frontend/src/components/LogPanel.tsx`: runtime log panel.
- `frontend/src/components/PromptBar.tsx`: prompt input, RunPod toggle, remote backend URL.
- `frontend/src/components/LayerPanel.tsx`: layer ordering, visibility, layer delete.
- `frontend/src/state/color.ts`: layer-local gradient helpers.
- `frontend/src/state/mapStyle.ts`: MapLibre expressions for colour and circle radius.
- `frontend/src/state/localProject.ts`: local app state, remote job polling, log events.
- `frontend/src/state/demoMonitor.ts`: demo-only browser heartbeat/error/pagehide reporting to B and the local A-side watchdog.
- `frontend/Start-FrontendDev.ps1`: root `.bat` development launcher implementation.
- `frontend/Start-DemoWatchdog.ps1`: development A-side watchdog used by the root demo launcher.
- `backend/semantic_map/job_service.py`: remote prompt bucket, startup warmup, job progress.
- `backend/semantic_map/text_cor_t_engine.py`: real TextCorT scorer and detailed timings.
- `backend/semantic_map/remote_api.py`: FastAPI scoring, pano, and demo monitor endpoints.
- `backend/semantic_map/demo_alerts.py`: B-side alert log/email/Gmail API delivery and alert analysis.
- `backend/semantic_map/backend_config.py`: RunPod backend and demo alert environment variables.
- `backend/semantic_map/pano_service.py`: pano tar indexing and pano image cache/extraction for marked map points.
- `backend/semantic_map/schemas.py`: layer style schema including copied stops and point size fields.
- `backend/semantic_map/state_store.py`: default gradients, layer state migration, persistence.
- `backend/semantic_map/api.py`: layer/gradient CRUD and built-in gradient delete protection.

## Current Street-View Requirement

- The frontend lets users click semantic map points to mark multiple pano locations.
- Every newly marked pano requests its street-view image from the RunPod backend so the server cache is warmed for all marked points.
- Only the selected marked pano is shown in a draggable bottom street-view window over the map.
- Marked pano state is keyed by `dataset_id:pano_id` across layers. Multiple score layers over the same dataset should select/update one marker for the same pano, while London and Shanghai pano ids remain isolated.
- Pano map markers are center-anchored dots; avoid rotated pin shapes unless their visual tip is explicitly aligned to the map coordinate. Preserve MapLibre's marker classes when toggling marker state classes.
- Pano marker clicks select the street-view panel row; street-view row clicks select the map marker and pan the map if the marker is out of view.
- The selected pano displays per-layer score/zscore values in the street-view panel. The value column follows the histogram field selector.
- Max-detail slow rendering shows a prominent top warning after a short delay.
- The frontend retries pano metadata for about one minute when the backend reports the pano index is warming up.
- The frontend viewer uses `@photo-sphere-viewer/core`; this adds a Vite bundle-size warning but build still passes.
- The backend implements the useful part of `EXTRACT.ipynb` as `backend/semantic_map/pano_service.py`, not by running a notebook.
- The default London pano tar target is shards `01` through `06`; Shanghai is the single `/workspace/pano/shanghai_rootless.tar` package.
- Pano tar indexing starts as a background startup task and skips rebuilding when a current SQLite index already exists. It should not block FastAPI from reaching `Application startup complete`.
- If pano indexing is still running, `/api/panos/{pano_id}` returns an unavailable warming-up response and `/api/panos/{pano_id}/image` returns 503.
- Extraction seeks into uncompressed tar files by indexed offsets and copies original image bytes into `/workspace/semantic_backend/pano_cache`.

## Verification Commands

```powershell
npm.cmd run build
```

Run from `frontend/`.

Backend static check used locally:

```powershell
.venv\Scripts\python.exe -m compileall -q backend
```

PowerShell syntax checks used for the dev launchers/watchdog:

```powershell
$tokens = $null; $errors = $null
[System.Management.Automation.Language.Parser]::ParseFile("frontend\Start-FrontendDev.ps1", [ref]$tokens, [ref]$errors) | Out-Null
[System.Management.Automation.Language.Parser]::ParseFile("frontend\Start-DemoWatchdog.ps1", [ref]$tokens, [ref]$errors) | Out-Null
$errors
```

Useful API checks:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:5173/
```

The current frontend no longer requires `http://127.0.0.1:8000`. If backend/scoring code changes during future experiments, restart the uvicorn process running on port `8000`.

## Future Todo Notes

- Consider adding a startup alert-channel self-test. Full B-process death still needs an external uptime monitor, because A intentionally has no email secret and can only forward to B.
- Update `SemanticMapFrontendApp/www/` only when the user explicitly asks to package or refresh the portable app: rebuild `frontend/` and copy `frontend/dist/` into the portable package.
- The multi-page tutorial is implemented. Future tutorial work should be copy refinement, localization, or moving tutorial content from `tutorialContent.ts` to a runtime config if no-rebuild editing is needed.
