# Semantic Map Frontend Development Notes

Updated: 2026-05-04

This document tracks the frontend and local-app architecture. The backend details live in `docs/backend-development-runpod.md`; short restart context lives in `docs/session-handoff-notes.md`.

## Product Direction

The app is local-first, closer to a local AI tool than to a hosted multi-user web app.

Local frontend responsibilities:

- Render the map and all UI.
- Own layer order, visibility, selected layer, metadata, point size, and colour schemes.
- Store user settings in local browser storage.
- Register remote scoring results as local layers.
- Keep basemap choice and display preferences local.

Remote RunPod backend responsibilities:

- Run GPU semantic scoring.
- Read the large embedding/model dataset on RunPod.
- Return job status, result manifests, and z/x/y GeoJSON tiles.
- Avoid storing per-user layer settings, colour presets, or map UI preferences.

## Current Frontend Stack

- `frontend/`
- Vite + React + TypeScript.
- MapLibre GL JS for the map.
- Local browser storage for app state.
- Remote RunPod calls are optional and controlled by the prompt bar `RunPod` checkbox and backend URL field.

Important command on this Windows machine:

```powershell
npm.cmd run build
```

PowerShell may block `npm.ps1`, so prefer `npm.cmd`.

## Local Storage

The frontend stores user-facing app state locally:

- `semantic-map-local-state-v1`
  - layers
  - selected layer
  - layer order
  - visibility
  - layer-local copied style
  - remote result metadata
- `semantic-map-local-gradients-v1`
  - saved colour presets
  - built-in presets are restored if missing
- `semantic-map-remote-backend-v1`
  - RunPod backend enabled flag
  - RunPod base URL
  - optional token
- `semantic-map-histogram-bucket-width`
  - histogram bucket width: `0.05`, `0.02`, or `0.01`
- `semantic-map-log-collapsed`
  - runtime log collapsed state

## Launchers, Development, And Tablet Exhibit Mode

The portable Windows frontend now lives under `SemanticMapFrontendApp/`:

- `SemanticMapFrontendApp/start_demo.bat`: double-click launcher for unattended/tablet demos. It prompts for the RunPod URL and idle-reset timeout in seconds, then starts the frontend with the RunPod URL locked and hidden.
- `SemanticMapFrontendApp/start_full.bat`: double-click launcher for normal/full use. It starts the frontend with the RunPod URL editable in the prompt panel and idle reset disabled.
- `SemanticMapFrontendApp/start_screensaver.bat`: double-click launcher for the full frontend plus the icon-triggered street-view screensaver. It does not enable demo idle reset and does not clear project data.
- The project-root `start_demo.bat`, `start_full.bat`, and `start_screensaver.bat` intentionally start the Vite development frontend from `frontend/`, not the portable package, so local development always uses the latest source.
- Root development launchers write `frontend/public/runtime-config.js`. They do not write into `SemanticMapFrontendApp/www/` unless the frontend is explicitly rebuilt and packaged.
- `SemanticMapFrontendApp/www/` was refreshed from the development frontend on 2026-06-08 and includes the dual-city frontend, demo monitor/browser reopen flow, tutorial rewrite, street-view pano date/info UI, reference-pano layer creation, and the 2048x1024 London/Shanghai street-view screensaver pano set.
- In demo mode, the root development launcher runs `frontend/Start-FrontendDev.ps1`, which starts `frontend/Start-DemoWatchdog.ps1`, writes the selected local watchdog URL into the dev runtime config, then starts Vite on `127.0.0.1:5173`.
- `frontend/Start-DemoWatchdog.ps1` is the development watchdog used by the root `.bat` files. `SemanticMapFrontendApp/launcher/Start-DemoWatchdog.ps1` is the packaged watchdog used only by the portable app.
- `SemanticMapFrontendApp/launcher/Start-SemanticMap.ps1` starts a small PowerShell static server for `SemanticMapFrontendApp/www/` and opens the system default browser. In demo mode only, it also starts `launcher/Start-DemoWatchdog.ps1` as a hidden local observer.
- The A-side demo watchdog does not store email credentials. It probes the local frontend and the RunPod `/api/ready` endpoint, then posts heartbeat/error events to B at `/api/demo/monitor/*`. B is responsible for email forwarding when `DEMO_ALERT_ENABLED=true`; Gmail delivery should use the B-side Gmail API channel rather than A-side secrets.
- In demo mode the A-side watchdog also exposes a local-only receiver at `http://127.0.0.1:51973` by default, or the next available port if that port is already occupied. The selected URL is written into `runtime-config.js` as `demoWatchdogUrl`. The frontend posts heartbeat/error payloads there, so A can detect a closed/crashed/stalled browser page even if B is still reachable.
- The watchdog local receiver is intentionally lightweight: it uses a bounded request body, answers `OPTIONS` quickly, accepts `text/plain` or JSON bodies, and processes local messages every 250 ms. It uses .NET `HttpClient` with cancellation timeouts for outbound probes/posts so a slow RunPod/backend request should not freeze the local listener.
- Frontend-to-local-watchdog posts use `Content-Type: text/plain;charset=UTF-8` to avoid browser CORS preflight and to make unload/page-close delivery more reliable. Backend posts still use JSON.
- Browser-to-RunPod GET requests intentionally avoid `Content-Type: application/json`; only POST requests with JSON bodies set that header. This keeps `/api/ready`, manifests, tiles, and pano/image fetches from triggering unnecessary CORS preflight requests.
- The development and portable demo launchers normalize RunPod proxy URLs to HTTPS. Entering `POD-8000.proxy.runpod.net` or `http://POD-8000.proxy.runpod.net` is written as `https://POD-8000.proxy.runpod.net` in runtime config.
- Local frontend events are queued and flushed to B by the watchdog. Frontend heartbeats update the watchdog's local state but are not synchronously forwarded one-by-one to B; watchdog heartbeats include the latest local frontend status, session, and pending event counts.
- If the local static server is reachable but the visible frontend page heartbeat stops, the watchdog opens the frontend URL again and forwards a `frontend_browser_restarted` warning to B. It does not kill browser processes; it opens a fresh tab/window through the system default browser.
- The watchdog is launched with the parent PowerShell process id and exits when the launcher/static-server process exits. Closing the demo bat should therefore stop the local watchdog instead of leaving a hidden orphan monitor behind.
- The watchdog local log is rotated at 5 MB by default with two backups. If the local heartbeat receiver cannot bind, the watchdog reports `frontend_local_monitor_unavailable` and disables browser auto-reopen instead of repeatedly opening tabs without a receiver.
- A frontend heartbeat with `status=hidden` or `visibility_state=hidden` is treated as browser background throttling. Hidden/background pages do not trigger critical stale-heartbeat emails and do not cause the watchdog to reopen the page.
- A real `pagehide` event from closing or navigating away is handled differently from an ordinary hidden tab: the frontend sends it to the local watchdog with `navigator.sendBeacon` plus a keepalive fallback, the watchdog immediately reopens the frontend URL, and it deduplicates only the exact same event key for a short window so repeated user closes can still reopen each time.
- The frontend itself starts a demo-only monitor when `runtime-config.js` has `mode: "demo"`. It reports JS errors, React error-boundary crashes, failed remote operations, browser offline/online state, main-thread stalls, pagehide events, and periodic heartbeats directly to B and to the local A-watchdog receiver.
- Target machines do not need Python, Node.js, npm, or a local backend for the packaged app; PowerShell is enough for the static server and A-side watchdog. All portable launcher paths are relative to `SemanticMapFrontendApp/`, so the folder can be copied to a USB drive and moved to another Windows machine.
- For future Codex-run frontend sessions, prefer a visible `cmd.exe`/`.bat` window with a clear title instead of a hidden background process, so the user can see exactly which frontend command is running.

Legacy root launchers were removed: `start_app.bat`, `start_backend.bat`, `start_frontend.bat`, and `start_runpod_backend.bat`.

The portable launchers write `SemanticMapFrontendApp/www/runtime-config.js` at startup instead of requiring Vite environment variables:

```js
window.__SEMANTIC_MAP_RUNTIME_CONFIG__ = {
  runpodUrl: "https://YOUR_POD-8000.proxy.runpod.net",
  lockRunpodUrl: true,
  idleResetEnabled: true,
  idleMs: 180000,
  defaultDatasetId: "london_224_8_45",
  defaultDatasetIds: ["london_224_8_45", "shanghai_224_8_45_2B"],
  defaultDatasetGroupId: "london_shanghai",
  demoWatchdogUrl: "http://127.0.0.1:51973"
};
```

Current behavior:

- When runtime `lockRunpodUrl=true` and `runpodUrl` is set, the frontend uses that RunPod URL, forces RunPod enabled, ignores URL edits, and hides the RunPod URL row from the prompt panel.
- When runtime `mode="screensaver"`, the app keeps full editing behavior but replaces the top intro button with an icon-only screensaver button. Clicking it opens the WebGL street-view screensaver overlay. This mode does not run demo idle reset and does not clear local project data.
- The project introduction modal is shown on frontend startup and can also be opened with the `Project intro` button at the top of the sidebar.
- The project introduction is a multi-page tutorial. Its content and target metadata live in `frontend/src/state/tutorialContent.ts`.
- The tutorial is usage-first: it introduces visual street-view comparison, free-form statement prompts, dual-city controls, score/style range adjustment, layer controls, and street-view inspection.
- When runtime `idleResetEnabled=true`, the app resets after the configured idle timeout and shows the introduction modal.
- The idle-reset timer is intentionally suspended while the introduction/tutorial modal is visible, so a demo can remain parked on the tutorial first page.
- Idle activity is limited to trusted `pointerdown`, `keydown`, `touchstart`, and non-empty `wheel` events. Synthetic events and empty wheel events are ignored so background scripts or browser noise do not keep the demo alive indefinitely.
- During the final 30 seconds before an idle reset, the app shows a prominent top-of-screen countdown warning.
- Idle reset clears all marked pano/street-view red points and revokes their object URLs.
- Idle reset remounts the introduction modal so the tutorial returns to its first page after an idle reset from the main app.
- For demo diagnostics, the frontend publishes `window.__SEMANTIC_MAP_IDLE_RESET__` with the current idle status, block reason, next reset time, last accepted activity event, and last ignored synthetic/empty activity event.
- Idle reset restores the exhibit default layers:
  - `the scene contains brick facade` with Magma
  - `the scene contains abundant vegetation` with Vegetation where stops are `#582e1d` at `0`, black at `0.5`, and `#50ff00` at `1`
  - `the scene shows people interacting` with Turbo
- Exhibit default layer style uses point size `3`, `zscore` as the histogram field, and `Absolute map size` disabled.
- Brick and people layers use histogram range `-1` to `3`; vegetation uses `-2.5` to `1.5`.
- The histogram bucket width is reset to `0.02`.
- After the default exhibit layers are present and RunPod `/api/ready` succeeds, the frontend submits the three default prompts once. Existing remote manifests or pending jobs are reused and are not resubmitted after idle reset.

## Prompt Flow

When RunPod is disabled, a new prompt creates deterministic local mock GeoJSON data.

When RunPod is enabled:

1. Frontend creates a remote scoring job with `POST /api/scoring/jobs`.
2. It sends `dataset_ids` for London and Shanghai plus one `priority_tiles[]` entry per visible city map.
3. It polls `GET /api/scoring/jobs/{job_id}`.
4. It writes progress events into the Runtime Log panel.
5. When ready, it registers each returned `results[].tile_url_template` under the matching city in `layer.source_paths`.
6. Styling remains local.

The frontend should not send colour schemes, layer order, visibility, or user settings to RunPod.

New user-created layers default to `zscore`, histogram range `-1` to `3`, point size `3`, and viewport-sized points (`Absolute map size` disabled).

Reference pano layers:

- A marked street-view pano can be dragged from the street-view strip or the pano info overlay onto the prompt panel.
- The drag payload is one pano reference object only. Dropping multiple references or an array payload is ignored; each reference layer is tied to exactly one `dataset_id:pano_id`.
- The frontend creates a normal local layer with `query_type="pano_reference"` and stores `reference_pano` metadata on the layer.
- Reference layers submit to the same `POST /api/scoring/jobs` endpoint with `query_type="pano_reference"` and a `reference_pano` object.
- Reference layers default to `zscore`, histogram range `2` to `6`, point size `3`, and viewport-sized points.
- When a reference layer is selected, the frontend loads the stored `reference_pano` image through the existing dataset-scoped pano endpoint and shows it in the street-view panel.
- There is intentionally no score lookup endpoint for the reference pano's exact score under its own layer. Full street-view mode continues to show scores only when they are available from loaded map tiles/layer values.
- Styling, visibility, order, and score-range edits remain local, the same as text-prompt layers.

Refresh-all behavior:

- The `Layers / Display Order` heading has a refresh button.
- Clicking it calls `refreshAllScoringLayers()` and resubmits every existing layer prompt to the RunPod scoring endpoint.
- It does not create duplicate layers and does not rewrite layer-local style, stops, opacity, score range, visibility, or order.
- If the backend has an existing result, the ready manifest is reloaded and the local layer is relinked to the current tile URL template.
- If the backend does not have the result, the same request path queues a new scoring job.
- Requests are submitted together so the backend prompt bucket can batch compatible GPU work.

Priority tile behavior:

- The frontend tracks one current priority tile per city map after `moveend` and `zoomend`.
- The priority tile zoom uses a shared semantic tile zoom: each city proposes `floor(map zoom)` clamped to backend zooms `10..13`, then both cities use the higher proposed zoom so London and Shanghai do not compare z10 against z11.
- `Max detail` forces the shared semantic tile zoom to `z=13`.
- A prompt submission captures both city priority tiles at that moment. Later pan/zoom changes affect future submissions only; they do not change an existing queued or running backend job.
- If a ready cached result is returned immediately, the map overlay progress popup is skipped. If later map movement requests a missing completed tile, the backend can generate that tile on demand from saved arrays.
- Priority tile means exactly one requested tile. The frontend should not expect the backend to prewrite all z10-z13 tiles from a priority request; missing middle/high-detail tiles are requested by normal map tile loading and generated on demand when cached score arrays exist.

## Runtime Log

`frontend/src/components/LogPanel.tsx` displays remote job progress.

Current behavior:

- Collapsible panel at the bottom of the sidebar.
- Shows status, current stage, progress percentage, current tile, tile count, and backend timing keys.
- A separate map overlay popup shows live progress for new prompts that require backend compute or polling.
- Cache hits that return `ready` immediately stay out of the map overlay, so the overlay does not flash for already-computed prompts.
- `RemoteLogEntry.map_overlay` controls whether a log entry should appear in the map overlay.
- Terminal overlay entries are dismissed automatically after a short delay.
- Dark mode now styles the log scrollbar explicitly so it no longer keeps a bright default scrollbar.

Relevant files:

- `frontend/src/components/LogPanel.tsx`
- `frontend/src/state/localProject.ts`
- `frontend/src/components/MapView.tsx`
- `frontend/src/styles/app.css`

## Project Tutorial

The project intro is now a multi-page, skippable tutorial rather than one hard-coded modal paragraph.

Current behavior:

- Tutorial content lives in `frontend/src/state/tutorialContent.ts`.
- `App.tsx` owns the modal state and page navigation.
- Each tutorial page can specify a `target`: `prompt`, `layers`, `histogram`, `style`, `map`, or `street-view`.
- Components expose tutorial anchors through `data-tour-target`.
- The modal scrolls the target into view, marks it with `tour-target-active`, and renders a fixed highlight frame above the app shell.
- If the street-view page is shown before a street-view panel exists, the highlight falls back to the map.

Tagged modules:

- `PromptBar.tsx`: `prompt`
- `LayerPanel.tsx`: `layers`
- `HistogramPanel.tsx`: `histogram`
- `GradientEditor.tsx`: `style`
- `MapView.tsx`: `map`
- `StreetViewPanel.tsx`: `street-view`

## Histogram

`frontend/src/components/HistogramPanel.tsx` sits between the layer order panel and the gradient editor.

Current behavior:

- Reads selected layer data through `getLayerGeojson(layer.id)`.
- Supports field selection: `score` or `zscore`.
- Supports user range min/max. The same range is used for histogram display and map colour application.
- Range filtering is factual: values outside `[min, max]` are excluded, not clamped into the edge buckets.
- Supports bucket width selection: `0.05`, `0.02`, or `0.01`.
- Colours each bucket using the selected layer's current gradient.

Important colour rule:

- Gradient stop positions are absolute inside the selected score range.
- If stops are `0`, `0.1`, and `0.2`, the final stop colour applies from 20 percent of the selected score range through the right boundary.
- Map rendering and gradient preview must match this rule.

## Gradient And Point Style

`frontend/src/components/GradientEditor.tsx`

Current behavior:

- Colour schemes are layer-local copies.
- `Apply` copies the current draft gradient to the selected layer.
- `Save` stores a reusable preset in local storage.
- Built-in presets are not deletable.
- Custom saved presets can be deleted without changing existing layers.
- The colour stop handle is a single coloured draggable control using the stop colour.
- Size now ranges from `1` to `10` with `0.1` increments.
- `Absolute map size` remains a layer style checkbox.

## Map Rendering

`frontend/src/components/MapView.tsx`

Current behavior:

- The map can show London and Shanghai side by side with matched ground scale.
- London and Shanghai keep separate remote source templates in `layer.source_paths.london` and `layer.source_paths.shanghai`.
- Shared semantic tile zoom uses the higher of the two cities' requested z-levels to avoid mixed-zoom comparisons.
- Scale sync and remote semantic redraws are debounced to avoid rebuilding large GeoJSON sources on every wheel/zoom frame.
- Semantic point layers are restored after basemap style changes.
- Basemap switching uses a generation token so stale redraws cannot overwrite the latest style.
- Semantic points are treated as the priority overlay and are added above the basemap.
- The frontend reports the current center tile to App so remote jobs can request priority tile output.
- The reported priority tile is sampled at prompt-submit time; map movement after submission does not rewrite the running job's requested priority tile.
- `Max detail` forces remote tile reads to the highest backend-available zoom. The backend currently outputs z10-z13, so this uses z13, not true z14.
- MapView should avoid rebuilding semantic sources/layers for unrelated side-panel UI changes. Dark-mode toggles, runtime log changes, and sidebar resizing should not clear and re-add semantic point layers; actual map container size changes can still require a MapLibre canvas repaint.
- Semantic point clicks can mark pano locations. Marked locations are displayed as map markers independent of the semantic layers, and clicking a marker selects the associated pano.
- Before submitting semantic layers to MapLibre, MapView removes visually hidden duplicate overlays under a shared-coordinate assumption: scanning from top to bottom, it renders the topmost visible layer and then only lower layers whose point size is larger than all layers above them. If point sizes are equal, only the top layer is rendered because lower layers are completely covered.

## Street View Pano Panel

Target behavior:

- A draggable street-view window overlays the bottom of the map area, matching the sketched bottom panel behavior.
- The panel appears when the user marks one or more pano points from the map.
- The top edge of the panel is a vertical resize handle; dragging it changes the panel height.
- Every marked point should trigger a backend pano request so the pano is extracted/cached server-side.
- Only the currently selected marked pano is displayed in the street-view panel.
- The viewer should support immersive pano drag/zoom for standard 2:1 equirectangular streetview images.
- Marked panos should be shown in a compact strip/list so the user can switch the displayed pano.

Current implementation:

- `frontend/src/components/StreetViewPanel.tsx` uses `@photo-sphere-viewer/core` for drag/zoom pano viewing.
- `frontend/src/App.tsx` stores marked pano state, selected pano key, in-flight request keys, and object URLs.
- `frontend/src/state/localProject.ts` requests pano metadata and image bytes from the RunPod backend with the configured bearer token.
- Every newly marked pano starts a backend request immediately; only the selected ready pano is mounted in the viewer.
- Removing a marked pano revokes its object URL and removes its map marker.
- Marked pano state is keyed by `dataset_id:pano_id`, not by layer id. When multiple visible score layers share the same dataset pano, clicking the same pano selects/updates the existing marker instead of creating duplicates; London and Shanghai pano ids do not collide.
- Pano map markers are center-anchored dots so the marker center stays on the clicked pano coordinate. Marker status updates must use `classList` and preserve MapLibre's own marker classes; replacing `element.className` breaks MapLibre marker positioning.
- Local mock layers include stable numeric `pano_id` values and share the same mock pano coordinates across layers; prompt/layer changes only alter mock scores.
- Clicking a pano marker selects that pano in the street-view panel and highlights the corresponding list row.
- Clicking a pano id in the street-view list selects/highlights the map marker; if the marker is outside the current map bounds, MapView pans to it.
- The street-view panel overlays selected pano per-layer values. The displayed value follows the sidebar histogram field (`score` or `zscore`).
- The pano info overlay defaults to compact mode, showing city and capture date. The window-style expand button switches to full mode, which shows pano id and per-layer score/zscore rows.
- Capture dates are formatted from `YYYYMMDD`, `YYYYMM`, or `YYYY` values when available; otherwise the compact overlay shows `Unknown`.
- The pano info overlay is rendered above the photo-sphere viewer controls and uses a white panel in light mode plus a dark panel in dark mode.
- Ready pano chips and the pano info overlay are draggable reference sources. Dropping one onto the prompt panel creates a pano-reference scoring layer.
- Selecting a pano-reference layer automatically reloads its stored reference pano into the street-view panel.
- When `Max detail` is enabled and semantic tile rendering takes long enough to be noticeable, MapView shows a prominent top warning: `When max detailed is enable, map render time might be significantly delayed when viewing a large area`.
- If the backend says the pano index is temporarily unavailable/warming, the frontend keeps the pano in loading state and retries metadata for about one minute before marking it failed.

## Street View Screensaver Mode

The special screensaver implementation is documented in `docs/screensaver-mode-implementation-and-migration.md`.

Current behavior:

- `frontend/src/components/ScreensaverOverlay.tsx` renders one full-window WebGL canvas with an 8 by 5 grid of perspective-projected street-view panes.
- The manifest is loaded from `/screensaver-panos/manifest.json` with `cache: "no-store"` so regenerated local assets are picked up immediately.
- The current packaged pano set has 80 images at `2048x1024`: 40 London images resized from `4096x2048` to JPEG quality 95, and 40 Shanghai source JPEGs copied directly from their native `2048x1024` bytes.
- The tile state machine uses `idle`, `pan`, `zoom`, and `switch` actions. Pan and zoom use constant-speed linear interpolation; switch fade transitions keep easing.
- Pan yaw steps are `45`, `90`, and `135` degrees with durations `2`, `3`, and `4` seconds. Pitch targets are `-20`, `-10`, and `0` degrees.
- Zoom FOV steps are `6`, `12`, and `18` degrees with durations `1`, `2`, and `3` seconds.
- Random idle delay starts at `1000ms`, and each tile must complete at least two non-idle browse actions before it can switch images.
- Any trusted keyboard, pointer, or touch input triggers a 900 ms fade-out before the overlay unmounts.
- The generated development pano payload under `frontend/public/screensaver-panos/` is ignored by Git. The portable package under `SemanticMapFrontendApp/` is also ignored as a generated artifact.

Current basemaps:

- OpenStreetMap raster.
- OpenFreeMap Dark.
- Sentinel-2 Cloudless 2016.

Removed:

- Landsat WELD, because it was not useful enough in practice.
- Google map/satellite raw URLs, because they require Google Maps Platform terms/API key/billing and should not be used unofficially.

## UI Details Fixed Recently

- Dark mode now covers the size slider, size number input, and related checkboxes.
- The dark mode label and map controls were made more legible.
- `Absolute map size` text aligns with its checkbox.
- Prompt bar `RunPod` text now aligns with its checkbox.
- Histogram bars no longer show edge overflow artifacts from minimum bar width.
- Runtime log scrollbar has dark-mode styling.
- Histogram Min/Max number steppers use `0.5` increments.
- Histogram bars should not show white gaps when very small bucket widths are selected; the chart should draw bars without flex gaps.
- The page and sidebar scrollbars must adapt to dark mode.
- `Max detail` shows a hover warning that rendering may be significantly delayed over a large region.
- Remote semantic GeoJSON tiles are cached in IndexedDB by full tile URL so high-detail tiles can be reused after page refreshes.
- The all-layer remote refresh control lives beside `Layers / Display Order`, not beside the prompt input. It uses the same refresh icon/spinner style as other compact icon controls.
- Remote result manifests are fetched with `cache: "no-store"` so a ready result relinks against the current RunPod proxy URL instead of a stale cached manifest.

## Files Most Likely To Matter

- `frontend/src/App.tsx`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/LayerPanel.tsx`
- `frontend/src/components/PromptBar.tsx`
- `frontend/src/components/HistogramPanel.tsx`
- `frontend/src/components/GradientEditor.tsx`
- `frontend/src/components/LogPanel.tsx`
- `frontend/src/state/tutorialContent.ts`
- `frontend/src/state/localProject.ts`
- `frontend/src/state/demoMonitor.ts`
- `frontend/src/state/color.ts`
- `frontend/src/state/mapStyle.ts`
- `frontend/src/state/basemaps.ts`
- `frontend/src/styles/app.css`
- `frontend/Start-FrontendDev.ps1`
- `frontend/Start-DemoWatchdog.ps1`

## Frontend To RunPod Contract

The frontend expects these remote endpoints:

```text
GET  /api/health
GET  /api/ready
POST /api/scoring/jobs
GET  /api/scoring/jobs/{job_id}
POST /api/scoring/jobs/{job_id}/cancel
GET  /api/scoring/results/{prompt_id}/manifest
GET  /api/scoring/results/{prompt_id}/tiles/{z}/{x}/{y}.geojson
GET  /api/panos/{pano_id}
GET  /api/panos/{pano_id}/image
GET  /api/datasets/{dataset_id}/panos/{pano_id}
GET  /api/datasets/{dataset_id}/panos/{pano_id}/image
```

Text scoring request body:

```json
{
  "dataset_group_id": "london_shanghai",
  "dataset_ids": ["london_224_8_45", "shanghai_224_8_45_2B"],
  "prompt": "the scene contains abundant vegetation",
  "query_type": "text",
  "zooms": [10, 11, 12, 13],
  "priority_tiles": [
    {"dataset_id": "london_224_8_45", "z": 13, "x": 4092, "y": 2723},
    {"dataset_id": "shanghai_224_8_45_2B", "z": 13, "x": 6859, "y": 3356}
  ]
}
```

Reference pano scoring request body:

```json
{
  "dataset_group_id": "london_shanghai",
  "dataset_ids": ["london_224_8_45", "shanghai_224_8_45_2B"],
  "prompt": "Reference pano 126048 (london)",
  "query_type": "pano_reference",
  "reference_pano": {
    "pano_id": "126048",
    "dataset_id": "london_224_8_45",
    "city_id": "london",
    "lon": -0.1276,
    "lat": 51.5072,
    "date": 201906
  },
  "zooms": [10, 11, 12, 13],
  "priority_tiles": [
    {"dataset_id": "london_224_8_45", "z": 13, "x": 4092, "y": 2723},
    {"dataset_id": "shanghai_224_8_45_2B", "z": 13, "x": 6859, "y": 3356}
  ]
}
```

Job polling should read:

- `status`
- `progress`
- `message`
- `current_stage`
- `current_tile`
- `tiles_done`
- `tiles_total`
- `stage_timings`
- `manifest_url`
- `tile_url_template`
- `results[]` with per-dataset `dataset_id`, `manifest_url`, and `tile_url_template`
- `query_type` and `reference_pano` for pano-reference jobs/manifests

## Open Work

- Consider MVT or PMTiles after GeoJSON tile behavior is stable.
- Add layer rename if needed.
- Consider splitting the pano viewer into a lazy-loaded chunk if bundle size becomes a problem.
- Consider export/import of local project state.
- Consider adding a small local status/log viewer for the A-side watchdog. The current demo monitor is intentionally headless and forwards alerts to B for email delivery.
- Only update the portable frontend package when the user explicitly asks to package or refresh `SemanticMapFrontendApp`: run `npm.cmd run build` from `frontend/`, then copy the contents of `frontend/dist/` into `SemanticMapFrontendApp/www/`. The runtime config remains `www/runtime-config.js`, written by the launchers at startup.
- Consider moving tutorial content from `frontend/src/state/tutorialContent.ts` to a runtime `config.json` if portable builds need tutorial edits without rebuilding the frontend.
