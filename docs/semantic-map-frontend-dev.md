# Semantic Map Frontend Development Notes

Updated: 2026-09-30

This document tracks the frontend and local-app architecture. The backend details live in `docs/backend-development-runpod.md`; short restart context lives in `docs/session-handoff-notes.md`.

## Current Local UI (2026-09-30)

The desktop, tablet and phone Semantic Map UI now share the same minimal glass
materials and neutral interface colours. Pre-release validation used the local
source and `frontend/dist/` build at `http://127.0.0.1:4173/`. Publishing this source
to `main` triggers the repository's GitHub Pages workflow; verify its deployment
result before treating the hosted UI as updated. The portable Windows package
was not refreshed in this UI session. Earlier published-release and backend
operation records describe their respective historical sessions.

### Shared glass pipeline

Load order in `frontend/src/main.tsx` is `app.css`, `minimal.css`, then `glass.css`.
`app.css` retains the base layout; `minimal.css` defines current layout and neutral
chrome; `glass.css` is the sole source of material recipes and backdrop effects.

| Material | Configured blur radius | Light tone | Dark tone | Purpose |
| --- | --- | --- | --- | --- |
| `surface` | 6 px | brightness 1.65, contrast 0.20 | brightness 0.32, contrast 0.85 | Toolbar, control drawer, modal, popups and street-view panel |
| `control` | 8 px | compensated brightness ~0.921212, contrast 1 | compensated brightness 1.425, contrast 1 | Fields, selected/hovered layer rows, Max detail, range and contact actions |
| `tutorial-focus` | 3 px | brightness 1, contrast 1 | brightness 1, contrast 1 | Full-viewport background blur on the welcome page only |

- Fade distance is **0 px** for all materials. Glass has no coloured background
  fill or opacity overlay: one effect blurs the backdrop, and another applies
  `contrast()` followed by `brightness()`. Foreground text remains sharp.
- Controls tone an already processed parent surface. The correction strength is
  `0.8`, with `target = 1 + (surfaceBrightness - 1) * 0.8` and
  `controlFilter = target / surfaceBrightness`. Target combined brightness
  multipliers are 1.52 in light mode and 0.456 in dark mode. A dark control must
  therefore lift the parent's brightness, rather than darkening it twice.
- Interface text, icons, buttons, focus outlines and selection states use neutral
  colours. Dark-mode text is white. Semantic histograms, ramps, colour swatches,
  maps and panorama images retain their data/image colours; do not grayscale the
  whole panel.
- Geometry is selected through `glassSurface({ material, shape, fade })`.
  Shapes are `rectangle`, `square`, `capsule` and `flush`; fade edges are top,
  right, bottom and left. Numerical material values belong in `glass.css`.
- Normal base corners are 12 px, capsules use their capsule radius, and the
  right-hand drawer is flush with square corners. Rounding belongs to the base
  control, not to an enlarged fade region. Content padding remains valid at
  zero fade.
- React surfaces own a direct `<GlassMaterial />`; native fields use
  `<GlassField>`. MapLibre and Photo Sphere Viewer controls use the same renderer
  through `applyGlassSurface()` and the vendor observers in `glass.ts`.
  Position each host relative to itself so its renderer cannot spread over
  surrounding text; the street-view contact action explicitly does this.
- Zero fade selects `data-glass-fade-mode="solid"`: one continuous rounded blur
  layer and tone layer, without tiled masks. This avoids fractional-pixel seams.
  The experimental positive-fade path remains implemented with eight progressive
  blur samples and a shared smooth curve, but is not enabled by default.
- `GlassDebugPanel.tsx` remains available for development but is not mounted in
  the product UI. New effects must pass `scripts/check-glass-pipeline.mjs`;
  component-specific backdrop filters, tint fills and material overrides are
  rejected by that check.

### Layout and controls

| Viewport width | Normal city view | Control panel |
| --- | --- | --- |
| Up to 700 px | One city; toolbar search and city buttons | Tap-controlled bottom sheet |
| 701–1023 px | Two map panes with source selectors | Tap-controlled bottom sheet |
| 1024 px and above | Two map panes with source selectors | Hover rail; click to pin or close |

Embedding comparison retains its two stacked panes on phones; difference mode
retains its single map. The ordinary phone city switch is hidden in those modes.

The phone toolbar puts search first, city buttons second, and **Max detail** in
its third row, in the former Basemap position. The phone Basemap selector is
removed from the visible UI. Desktop and tablet retain it, including OpenFreeMap
Positron. Max detail is a native button with `aria-pressed` on all devices; click,
Enter or Space toggles it. The enabled state uses a check icon and stronger
neutral outline; the disabled state uses a scan icon. The existing phone 1 km
scale guard and backend maximum-detail selection still apply.

Desktop toolbar padding, group gaps, source selectors and title width are
compact; long layer titles ellipsize with the full title available on hover.
Scale/camera synchronization uses a small link icon with its full status in the
title and accessible label. Opening the desktop drawer constrains the toolbar's
available width. A `ResizeObserver` measures toolbar height and updates
`--map-toolbar-clearance` so navigation buttons and warnings clear wrapped rows.

The map fills the dynamic viewport. Phone/tablet sheets scroll internally, keep
attribution in a fixed footer, respect safe areas and use larger touch targets.
Touch does not trigger the desktop hover-open behavior. Explicit close,
outside-pointer dismissal and Escape clear hover/focus/pin state; tutorial
`revealControls` can intentionally keep the panel open. Layer handles support
touch drag and ArrowUp/ArrowDown ordering in addition to desktop drag/drop.

City label cards and in-map attribution bubbles are removed. MapLibre's source
attribution is mounted in the shared control footer through its public
`onAdd`/`onRemove` lifecycle and still follows basemap changes. The scale is a
plain labelled 3 px line at MapLibre's measured width, with no glass material or
bracket-shaped border. Phone scale placement avoids the control launcher.

### Validation and local preview

Run from `frontend/` on this Windows machine:

```powershell
npm.cmd run build -- --configLoader runner
npm.cmd run test:glass
npm.cmd run test:map
npm.cmd run preview -- --configLoader runner
```

`build` runs the glass-pipeline guard, TypeScript and Vite. The runner loader avoids
the Windows sandbox failure of Vite's default configuration bundling. Preview
serves `dist/` at port 4173; rebuild before reloading it after source edits.
Use `npm.cmd run dev -- --configLoader runner` for live source editing on 5173.

The September 30 UI work passed the production build and all 9 focused tests
(3 glass-curve/mask tests and 6 map source/resize tests). Browser checks covered
320×568 and 390×844 phones, 667×375 landscape, 768×1024 tablet, and 1024×768 and
1440×1000 desktop layouts. Checks included overflow, toolbar/navigation spacing,
panel reopening, tutorial scrolling, button mouse/keyboard toggling, keyboard
layer ordering and light/dark street-view failure states. Responsive checks used
browser viewport simulation; physical touch hardware was not verified.

Local visual evidence is under `artifacts/semantic-map-ui/`, including
`compact-toolbar-street-view-light.png`, `compact-toolbar-street-view-dark.png`
and `max-detail-phone-toggle.png`. Earlier `responsive-*.png` screenshots predate
the latest toolbar changes. Production builds still report the existing large
bundle warning; this UI work did not introduce code splitting or a new release.

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
npm.cmd run build -- --configLoader runner
```

PowerShell may block `npm.ps1`, so prefer `npm.cmd`.

## GitHub Pages, Mobile, And Static Fallback

The GitHub Pages build is a static frontend generated into `docs/`:

```powershell
cd frontend
npm.cmd run build:pages
```

Deployment assumptions:

- GitHub Pages can serve the project from `/docs/index.html` with `.nojekyll` and generated assets under `docs/assets/`.
- The normal `build:pages` command remains unchanged and builds only the existing map frontend. Build the isolated human-rating interface separately with `npm.cmd exec vite -- build --config vite.verify.config.mjs --configLoader runner --outDir ../../docs/verify --emptyOutDir true`; GitHub Pages then serves it under the repository URL's `/verify/` path.
- `runtime-config.js` is loaded as a normal static script and can provide defaults, but the URL query string can override the backend at runtime.
- `?backend=https://POD-8000.proxy.runpod.net` selects the RunPod backend for that browser session. Bare RunPod proxy hosts are normalized to HTTPS by the frontend.
- When no backend is configured, the default exhibit layers use real static fallback tiles hosted by the older `TicoCh1/semanticmapdemo` GitHub Pages deployment instead of copying the dataset into this repository.
- The default static fallback tile base is `https://ticoch1.github.io/semanticmapdemo/static-data`. Runtime config can override it with `staticFallbackDataBaseUrl` or `VITE_STATIC_FALLBACK_DATA_BASE_URL`.
- Static fallback tile templates are rewritten directly as `.../static-data/tiles/<data_key>/<city>/{z}/{x}/{y}.geojson`; do not trust the old static manifests' `tile_url_template`, because those manifests still contain historical RunPod proxy URLs.
- The current default fallback maps three exhibit layers to the old static data keys: brick facade, abundant vegetation, and social interaction. User-created prompts still require a RunPod backend for real scoring.
- Without backend, live search inputs are disabled and explain that static fallback mode is active. Adding `?backend=<RunPod URL>` restores live prompt submission.
- Without backend, arbitrary street-view pano image loading is disabled. Only packaged static reference pano images available in the old fallback dataset are loaded; other pano clicks keep map score popups but report that arbitrary pano lookup needs a backend.
- The static data strategy intentionally avoids copying the full dataset into this repo. If the old demo data should be retired later, either sync a curated `docs/static-data/` copy or move tiles to CDN/object storage such as R2/S3/Supabase Storage/Mapbox tilesets, then point the frontend at that URL.

Responsive UI uses a phone breakpoint at `700px` and a touch-sheet breakpoint at `1023px`:

Material and layout contracts are described in [Current Local UI](#current-local-ui-2026-09-30).

- The map occupies the full dynamic viewport; controls are opened from the bottom-right launcher.
- The tutorial modal does not auto-open on compact mobile startup. If opened manually, closing it scrolls the page back to top.
- Mobile startup follows `prefers-color-scheme` for theme and default basemap until the user manually changes either setting. Manual changes are marked in local storage with `semantic-map-theme-source=manual` and `semantic-map-basemap-source=manual`.
- Phone search, city switching and the Max detail toggle button share one compact glass toolbar; tablet and desktop toolbars preserve two-city source selection.
- Compact mobile does not render London and Shanghai side by side. It renders one city at a time and exposes London/Shanghai buttons in the toolbar.
- Compact mobile uses MapLibre's default device pixel ratio again, so high-DPI phones render sharper basemap text and points. Mobile stability is handled by single-city rendering and the `Max detail` scale guard instead.
- Desktop and compact mobile initialize maps at a visible 500 m scale-bar view so the first render does not start at a heavy wide-area extent. The zoom calculation uses MapLibre's 512 px zoom-0 world scale and must stay aligned with `SCALE_CONTROL_MAX_WIDTH`.
- Narrow responsive layouts use percentage width rather than `100vw` to avoid horizontal scrollbar drift when the page itself has a vertical scrollbar.
- `Max detail` is an aria-pressed toggle button on all devices. On phones it occupies the former basemap row. When enabled, it is guarded to a 1 km scale-bar limit: enabling it while zoomed farther out automatically zooms in to about 1 km, and zooming out past about 1 km automatically turns it off. The current button does not use the old checkbox/glow animation.
- Compact mobile binds the basemap to the theme: dark mode uses OpenFreeMap Dark, light mode uses OpenStreetMap. The basemap selector is hidden on compact mobile; desktop and tablet retain it.
- Compact mobile hides the in-map city label chip because the London/Shanghai switch already communicates the active city.
- The mobile search placeholder rotates between `Search semantic prompt with statements`, `The scene contains brick facade`, and `The scene contains abundant vegetation`.
- Phone navigation buttons are hidden; the scale is a plain measured line with a label. Attribution is shown in the control panel footer on all viewport sizes; city label cards are removed.
- On startup, the frontend automatically attempts the same all-layer RunPod refresh as the manual layer refresh button when a backend URL is configured. It submits visible layers first in top-to-bottom display order, then submits hidden layers in the background. If the backend is unavailable, the app keeps running with local fallback layers instead of blocking the UI.
- The centered `Updating semantic layers...` overlay is tied to actual MapLibre semantic-layer drawing for currently visible layers, not to hidden-layer refreshes or RunPod job lifetime. It appears while no semantic layer has attached for the active city view and hides as soon as the first visible semantic content is attached; long-running RunPod jobs continue in the progress cards without blocking the map after content exists.
- If every layer eye is disabled, the map shows a separate all-layers-hidden message and the layer-panel eye buttons pulse. Hidden-layer backend refreshes do not trigger the updating overlay.
- The phone/tablet control sheet exposes the same prompt, layers, histogram, gradient editor and log as desktop, with touch targets of at least 44 px for standard controls.

Mobile diagnostics:

- `frontend/src/state/mobileDiagnostics.ts` starts from `main.tsx`.
- It records JS errors, unhandled rejections, resource failures, WebGL context lost/restored, MapLibre errors, pinch starts, map move/zoom/idle snapshots, canvas sizes, DPR, viewport, color scheme, heap samples when available, main-thread stalls, pagehide/beforeunload, and previous unclean exits.
- Diagnostics are stored in `localStorage` under `semantic-map-mobile-diagnostics-v1`.
- Open the static or dev app with `?diag=1` or `?debugDiagnostics=1` to show the in-page diagnostics panel.
- The console API is exposed as `window.__SEMANTIC_MAP_DIAGNOSTICS__` with `export()`, `clear()`, and `record()`.

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
- Requests are submitted sequentially in display-priority order: visible layers first from top to bottom, then hidden layers. Hidden-layer submissions are marked as background work so they do not trigger map updating overlays.

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
- The seven pages are Welcome, Search, Cities, Layers, Score and style, Map, and Street view. Welcome has `target: null`; later pages can target `prompt`, `layers`, `histogram`, `style`, `map`, or `street-view`.
- Only Welcome adds the full-viewport 3 px `tutorial-focus` blur; modal text is unaffected. The modal foreground uses an independent scroll container on short screens.
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
- Min/Max edits are drafts. `Set range` or Enter commits finite values with Min < Max; the button is disabled for invalid or unchanged drafts. The committed range drives both histogram display and map colour application.
- Range filtering is factual: values outside `[min, max]` are excluded, not clamped into the edge buckets.
- Supports bucket width selection: `0.05`, `0.02`, or `0.01`.
- Colours each bucket using the selected layer's current gradient.

Important colour rule:

- Gradient stop positions are absolute inside the selected score range.
- If stops are `0`, `0.1`, and `0.2`, the final stop colour applies from 20 percent of the selected score range through the right boundary.
- Map rendering and gradient preview must match this rule.

## Human Verification

Human verification is isolated in the independent `/verify/` page and does not add controls or behavior to the existing map frontend. The rater never authors or selects a prompt: the backend randomly chooses one prompt that already has completed score arrays, and the page displays that statement for human judgement.

Current behavior:

- Reuses `loadPanoImage()` and the existing Photo Sphere Viewer configuration, so raters inspect the original interactive 360-degree panorama rather than model projections.
- Requests `POST /api/verification/sample` without prompt text and keeps a rolling five-task panorama prefetch window. A 1-5 rating is written to local storage and advances immediately to the next unrated task; number keys 1-5 are shortcuts.
- Samples saved `zscore` results using equal allocation across five fixed-width model-score strata. The nominal span `[-1, 3]` gives internal cut points `-0.2`, `0.6`, `1.4`, and `2.2`. The edge strata are open-ended: values below `-1` remain in stratum 1 and values above `3` remain in stratum 5.
- Defaults to five samples per stratum per dataset and a backend-generated random seed. Sampling is random within each dataset/stratum, so this is disproportionate stratified random sampling rather than a population-representative sample.
- Stores a local browser backup and immediately submits each rating to the backend's idempotent SQLite store. Local CSV export remains available if a network request fails.
- Requires a reachable RunPod backend for the sample manifest and panorama bytes, but the sampling endpoint itself is CPU-only and never loads the semantic model or performs scoring.
- A shareable GitHub Pages URL uses the existing query field: `/verify/?backend=https%3A%2F%2FPOD-8000.proxy.runpod.net`.

## Gradient And Point Style

`frontend/src/components/GradientEditor.tsx`

Current behavior:

- Colour schemes are layer-local copies.
- `Apply style` copies the current draft gradient and point size to the selected layer.
- `Save as preset` expands the name/save controls; `Save` stores a reusable preset in local storage.
- Built-in presets are not deletable.
- Custom saved presets can be deleted without changing existing layers.
- The colour stop handle is a single coloured draggable control using the stop colour. Draft identity is preserved during dragging; applied/saved stops are sorted. Overlapping stop positions block Apply/Save. A partial hex edit does not replace the last valid colour until it is valid.
- Size now ranges from `1` to `10` with `0.1` increments.
- `Scale points with map zoom` is the current checkbox label (the existing `absolute_radius` style flag is retained).

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
- On compact mobile, MapView renders a single city at a time and switches between London and Shanghai through city buttons in the shared toolbar. The desktop dual-city comparison remains available outside the compact breakpoint.
- Compact mobile map initialization targets an approximately 500 m scale-bar view using the city's latitude to choose the starting zoom.
- MapView should avoid rebuilding semantic sources/layers for unrelated side-panel UI changes. Dark-mode toggles, runtime log changes, and sidebar resizing should not clear and re-add semantic point layers; actual map container size changes can still require a MapLibre canvas repaint.
- Continuous divider resizing is coalesced to one animation frame in `state/mapResize.ts`. `map.resize()` and `map.redraw()` complete in the same frame; a deferred `triggerRepaint()` would expose a cleared WebGL buffer. Resize observers are disposed when maps are replaced, and viewport tile updates are suppressed while resizing, then scheduled after release.
- `state/semanticLayerRenderer.ts` updates existing GeoJSON sources through `setData`, changes paint in place and moves layer stacking without removing live sources. Missing sources/layers are recreated after a basemap style reset. Preserve this lifecycle to avoid reintroducing divider flicker.
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
- If no backend is configured, pano image loading fails locally with a static fallback message instead of requesting `/api/...` from the static host. A future packaged static pano dataset can extend this path without requiring GitHub Pages to run a backend.
- When backend prompt submission, all-layer refresh, or remote semantic tile fetch fails, the frontend falls back to deterministic local mock GeoJSON for the affected layer so the portfolio/static page remains usable.
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
- The pano info overlay is rendered above the viewer controls using the shared glass renderer and neutral theme tokens.
- The street-view canvas and loading/failure placeholders are transparent over the parent glass panel, replacing the fixed deep-blue background. Metadata, viewer chrome, selected chips and the copy-contact action follow light/dark mode; panorama pixels keep their original colours.
- The copy-contact action uses the `control` material and a relative host. Its blur/tone renderer must remain within the button bounds so it cannot blur failure-message text.
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
- OpenFreeMap Positron (neutral light vector style).
- Sentinel-2 Cloudless 2016.

Removed:

- Landsat WELD, because it was not useful enough in practice.
- Google map/satellite raw URLs, because they require Google Maps Platform terms/API key/billing and should not be used unofficially.

## UI Details Fixed Recently

- Dark mode now covers the size slider, size number input, and related checkboxes.
- The dark mode label and map controls were made more legible.
- `Scale points with map zoom` text aligns with its checkbox.
- Prompt bar `RunPod` text now aligns with its checkbox.
- Histogram bars no longer show edge overflow artifacts from minimum bar width.
- Runtime log scrollbar has dark-mode styling.
- Histogram Min/Max number steppers use `0.5` increments.
- Histogram bars should not show white gaps when very small bucket widths are selected; the chart should draw bars without flex gaps.
- The page and sidebar scrollbars must adapt to dark mode.
- `Max detail` is an accessible glass toggle with enabled/disabled icons, not a checkbox; its title explains the high-detail setting and phone scale guard.
- Remote semantic GeoJSON tiles are cached in IndexedDB by full tile URL so high-detail tiles can be reused after page refreshes.
- The all-layer remote refresh control lives beside `Layers / Display Order`, not beside the prompt input. It uses the same refresh icon/spinner style as other compact icon controls.
- Remote result manifests are fetched with `cache: "no-store"` so a ready result relinks against the current RunPod proxy URL instead of a stale cached manifest.

## Files Most Likely To Matter

- `frontend/src/App.tsx`
- `frontend/src/components/MapView.tsx`
- `frontend/src/components/SplitPane.tsx`
- `frontend/src/components/StreetViewPanel.tsx`
- `frontend/src/components/LayerPanel.tsx`
- `frontend/src/components/PromptBar.tsx`
- `frontend/src/components/HistogramPanel.tsx`
- `frontend/src/components/GradientEditor.tsx`
- `frontend/src/components/LogPanel.tsx`
- `frontend/src/state/tutorialContent.ts`
- `frontend/src/state/localProject.ts`
- `frontend/src/state/demoMonitor.ts`
- `frontend/src/state/mobileDiagnostics.ts`
- `frontend/src/state/color.ts`
- `frontend/src/state/mapStyle.ts`
- `frontend/src/state/mapResize.ts`
- `frontend/src/state/semanticLayerRenderer.ts`
- `frontend/src/state/basemaps.ts`
- `frontend/src/styles/app.css`
- `frontend/src/styles/minimal.css`
- `frontend/src/styles/glass.css`
- `frontend/src/styles/glass.ts`
- `frontend/src/styles/glassFade.ts`
- `frontend/src/styles/GlassMaterial.tsx`
- `frontend/scripts/check-glass-pipeline.mjs`
- `frontend/scripts/glass-fade.test.mjs`
- `frontend/scripts/map-resize.test.mjs`
- `frontend/scripts/semantic-layer-renderer.test.mjs`
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
GET  /api/scoring/results/{dataset_id}/{prompt_id}/manifest
GET  /api/scoring/results/{dataset_id}/{prompt_id}/revisions/{revision}/tiles/{z}/{x}/{y}.geojson
# Legacy prompt-only routes remain available for persisted layer URLs.
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
