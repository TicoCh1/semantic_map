# UrbanFabric Semantic Map

UrbanFabric Semantic Map is a local-first semantic mapping prototype for exploring street-view image embeddings on an interactive map. The frontend runs locally in the browser, while an optional RunPod-hosted backend performs GPU semantic scoring and serves GeoJSON tiles.

The current product direction is:

- Local frontend owns map rendering, layer order, visibility, colors, point styling, selected layers, basemaps, and browser-local project state.
- Remote backend owns GPU scoring, dataset/model loading, job status, result manifests, pano image serving, and z/x/y GeoJSON tile output.
- User interface preferences and layer styling are intentionally not stored on the remote backend.

## Repository Layout

```text
frontend/        Vite + React + TypeScript frontend
frontend_pcatsne Dedicated binary WebGL PCA/t-SNE scale viewer
backend/         FastAPI RunPod backend and semantic scoring service
configs/         Default local layer and gradient configuration
data/mock/       Small mock GeoJSON data for local/demo behavior
src/semantic_map Legacy local Gradio prototype code
start_demo.bat   Windows development demo launcher
start_full.bat   Windows development full-mode launcher
start_screensaver.bat Windows development screensaver-mode launcher
```

Notebooks, private handoff documents, agent notes, logs, local runtime config, virtual environments, Node dependencies, generated screensaver panorama payloads, and the portable packaged frontend are intentionally excluded from version control.

## Frontend

The main frontend lives in `frontend/` and uses:

- Vite
- React
- TypeScript
- MapLibre GL JS
- Photo Sphere Viewer for street-view panoramas

On Windows, prefer `npm.cmd` because PowerShell may block `npm.ps1`.

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

The development server runs at:

```text
http://127.0.0.1:5173/
```

Build check:

```powershell
cd frontend
npm.cmd run build
```

## GitHub Pages Frontend

The React frontend can be published as a static GitHub Pages site. The repository supports both GitHub Pages source modes:

- Branch source: publish from `/docs`.
- GitHub Actions source: use `.github/workflows/github-pages.yml`.

To generate the branch-source `/docs` site locally:

```powershell
cd frontend
npm.cmd run build:pages
```

This writes the static app to `docs/index.html`, `docs/assets/`, `docs/runtime-config.js`, and `docs/.nojekyll`. Commit those generated files when using GitHub Pages branch source with the `/docs` folder.

After enabling GitHub Pages, the app can be opened from a repository Pages URL such as:

```text
https://ticoch1.github.io/semantic_map/
```

To point the static frontend at a specific RunPod backend, pass the backend URL as a query parameter:

```text
https://ticoch1.github.io/semantic_map/?backend=https%3A%2F%2FYOUR_POD-8000.proxy.runpod.net
```

The shorter RunPod proxy host form is also normalized by the frontend:

```text
https://ticoch1.github.io/semantic_map/?backend=YOUR_POD-8000.proxy.runpod.net
```

When `?backend=` is present, the frontend enables RunPod mode and uses that backend ahead of browser-local saved settings. Editing the RunPod URL in the prompt panel updates the current URL parameter; disabling RunPod removes the parameter and falls back to local mock behavior.

The backend must be reachable over HTTPS and must allow the GitHub Pages origin in CORS, for example `https://ticoch1.github.io`. Do not put long-lived backend tokens in the URL because query strings can be stored in browser history, logs, and screenshots.

Development launchers:

```powershell
.\start_full.bat
.\start_demo.bat
.\start_screensaver.bat
```

`start_screensaver.bat` starts the full frontend in screensaver runtime mode. The top-right icon button opens the special 8 by 5 street-view screensaver without clearing project data.

The portable Windows package lives in `SemanticMapFrontendApp/` and now has matching `start_full.bat`, `start_demo.bat`, and `start_screensaver.bat` launchers. It can be copied to a USB drive and run on another Windows device without Node.js, Python, npm, or absolute path edits.

## Backend

The backend lives in `backend/` and exposes a FastAPI app for RunPod deployment. It is designed for a Linux GPU environment with model files, embedding shards, pano archives, and generated result data mounted under `/workspace`.

The backend is not intended to run full scoring on a local Windows development machine. Local backend work should normally be limited to code review and static checks.

Core API shape:

```text
GET  /api/health
GET  /api/ready
POST /api/scoring/jobs
GET  /api/scoring/jobs/{job_id}
POST /api/scoring/jobs/{job_id}/cancel
GET  /api/scoring/results/{prompt_id}/manifest
GET  /api/scoring/results/{prompt_id}/tiles/{z}/{x}/{y}.geojson
GET  /api/datasets/{dataset_id}/panos/{pano_id}
GET  /api/datasets/{dataset_id}/panos/{pano_id}/image
```

RunPod startup helpers:

```bash
backend/cold_startup.sh
backend/start_runpod_backend.sh
```

Expected backend launch target:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

## Configuration

Runtime values such as RunPod URLs, backend tokens, Gmail credentials, SMTP settings, model paths, dataset paths, and result directories should be supplied through environment variables or generated local runtime config files. Do not commit real secrets or machine-specific runtime config.

Important environment variable names include:

```text
SEMANTIC_BACKEND_TOKEN
WORKSPACE_ROOT
MODEL_DIR
DATA_ROOT
DEFAULT_DATASET_ID
DEFAULT_DATASET_IDS
DEFAULT_DATASET_GROUP_ID
RESULT_ROOT
TILE_INDEX_ROOT
PANO_TAR_DIR
PANO_CACHE_ROOT
PANO_INDEX_PATH
PUBLIC_BASE_URL
SCORING_VERSION
TILE_INDEX_VERSION
WARMUP_ON_STARTUP
EMBEDDING_DEVICE
```

Demo alerting can also be configured on the backend with Gmail API or SMTP environment variables. Keep those values in RunPod secrets or local environment variables, never in Git.

## Development Notes

- The frontend can run fully local mock layers when RunPod is disabled.
- When RunPod is enabled, prompt submissions create asynchronous backend jobs and poll for progress.
- Result styling remains local even when result tiles are remote.
- GeoJSON z/x/y tiles are the current output format. MVT or PMTiles may be considered later.
- The backend batches compatible prompt jobs to make GPU scoring more efficient.
- The dedicated PCA/t-SNE scale viewer is documented in `docs/pcatsne-scale-viewer.md`.

## Security

Before publishing this repository, confirm that no secrets are staged:

```powershell
git status --short
```

Common files that should not be committed include:

```text
.env
client_secret*.json
*secret*.json
*token*.txt
refreshtoken.txt
frontend/public/runtime-config.js
frontend/public/screensaver-panos/
SemanticMapFrontendApp/config/last-runtime-config.json
SemanticMapFrontendApp/www/runtime-config.js
```

If a credential was ever committed or shared, rotate or revoke it instead of relying only on deletion.

## License

This project is licensed under the Apache License 2.0. See `LICENSE` for details.
