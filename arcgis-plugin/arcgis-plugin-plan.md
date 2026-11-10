# ArcGIS Plugin Migration Plan

This note explores how to turn the full Semantic Map frontend, excluding demo-only behavior, into an ArcGIS-integrated tool that lets a user submit prompts, query the remote semantic backend, fetch result features, and create ArcGIS layers or datasets.

## Executive Summary

There are two realistic ArcGIS targets:

1. **ArcGIS Experience Builder custom widget**
   - Best fit if the goal is a web-based ArcGIS app.
   - Closest to the current frontend stack because Experience Builder widgets use React and TypeScript.
   - Output can be a client-side `FeatureLayer` or `GraphicsLayer` inside the ArcGIS web map.
   - Persisting results as durable ArcGIS Online or Enterprise data requires extra portal/feature-service work.

2. **ArcGIS Pro Add-In**
   - Best fit if the goal is desktop ArcGIS Pro.
   - Implemented with C#/.NET, WPF, MVVM, and ArcGIS Pro SDK DAML.
   - Best path if "make ArcGIS data" means creating a real feature class in the current project geodatabase.
   - Requires rewriting the UI shell and ArcGIS integration layer rather than reusing the React UI directly.

Recommendation:

- If you want the fastest migration from the existing frontend UI logic, start with an **Experience Builder custom widget**.
- If you want serious GIS workflow integration, attribute tables, project geodatabase persistence, symbology, export, and use inside ArcGIS Pro, build an **ArcGIS Pro Add-In**.
- Do not try to embed the current Vite/MapLibre app unchanged. The map, layer model, persistence model, and rendering layer should be replaced by ArcGIS-native map/layer APIs.

## Current App Concepts To Keep

Keep these parts from the full frontend:

- Prompt input.
- Dataset or dataset group selection.
- Remote backend URL and optional bearer token.
- RunPod enabled/disabled state, though in ArcGIS this should probably become "backend connection configured".
- Scoring job submission.
- Job polling and progress reporting.
- Result manifest/tile fetching.
- Layer name derived from prompt.
- Score/zscore field selection.
- Color ramp and point size controls.
- Layer refresh/re-run behavior.
- Optional pano metadata/image request flow if street-view inspection remains useful.

Remove or do not port these demo-specific parts:

- Demo watchdog.
- Browser auto-reopen.
- Idle reset.
- Tutorial highlight system.
- Portable Windows static frontend package.
- A-side/B-side demo alert email flow.
- Root `.bat` launcher assumptions.

Replace these parts with ArcGIS-native concepts:

| Current frontend concept | ArcGIS replacement |
| --- | --- |
| MapLibre map | ArcGIS MapView/SceneView or ArcGIS Pro active map |
| Local layer list | ArcGIS map contents / plugin-managed result registry |
| MapLibre GeoJSON source | ArcGIS FeatureLayer, GraphicsLayer, or feature class |
| Browser localStorage | Widget config, ArcGIS project settings, or local config file |
| Runtime config JS | Add-in settings / Experience Builder widget config |
| Gradient editor | ArcGIS renderer / visual variables / class breaks |
| Histogram panel | ArcGIS statistics query or local feature statistics |
| Street-view overlay | DockPane/view panel or widget panel |

## Recommended Architecture

Use a thin ArcGIS plugin that talks to the existing backend rather than moving scoring into ArcGIS.

```text
ArcGIS UI plugin
  prompt, settings, progress, result layers
        |
        | POST /api/scoring/jobs
        | GET  /api/scoring/jobs/{job_id}
        | GET  /api/scoring/results/{prompt_id}/...
        v
RunPod FastAPI semantic backend
  model loading, GPU scoring, tile/result storage
        |
        v
ArcGIS-native layer or dataset
  FeatureLayer / GraphicsLayer / feature class
```

The important migration is not the visual frontend shell. The important migration is the contract:

1. Submit prompt.
2. Track backend job.
3. Fetch result features in an ArcGIS-friendly format.
4. Convert features to an ArcGIS layer/dataset.
5. Apply ArcGIS symbology based on `score` or `zscore`.

## Data Strategy

The current backend is tile-oriented:

```text
GET /api/scoring/results/{prompt_id}/tiles/{z}/{x}/{y}.geojson
```

That is good for a MapLibre web map, but an ArcGIS plugin often wants a dataset-like object. There are three possible result modes.

### Mode 1: Current Extent Preview Layer

The plugin fetches only result tiles intersecting the current ArcGIS view extent and creates an in-memory preview layer.

Best for:

- Fast interaction.
- Large datasets.
- Web widgets.
- Avoiding huge one-time downloads.

ArcGIS output:

- Experience Builder: client-side `FeatureLayer` or `GraphicsLayer`.
- ArcGIS Pro: temporary layer or memory-backed feature set.

Tradeoff:

- The layer is not complete unless the user fetches all extents or explicitly exports.

### Mode 2: Persistent ArcGIS Dataset

The plugin fetches result features, writes them into a real ArcGIS dataset, and adds that dataset to the map.

Best for:

- ArcGIS Pro.
- Attribute table use.
- Selection/query/export.
- Long-lived project work.

ArcGIS output:

- File geodatabase feature class in the current ArcGIS Pro project.
- Optionally a hosted feature layer if using ArcGIS Online/Enterprise later.

Tradeoff:

- Large result sets require pagination, filtering, and progress UI.

### Mode 3: ArcGIS-Compatible On-Demand Layer

The plugin keeps the backend as the source of truth and loads visible features on demand as the map pans/zooms.

Best for:

- Very large results.
- Keeping backend tile behavior.
- Avoiding durable local copies.

ArcGIS output:

- Custom layer behavior in JS, or repeated updates to a client-side `FeatureLayer`.
- In ArcGIS Pro, a plugin-managed layer can refresh visible features, but a true custom data source is more complex.

Tradeoff:

- More plugin complexity.
- More edge cases around selection, identify, table view, and refresh.

Recommendation:

- Phase 1: implement **Mode 1** for preview.
- Phase 2: add **Mode 2** export/persist.
- Avoid Mode 3 until the ArcGIS UX requirements are clear.

## Backend Contract Changes

The existing job endpoints can stay:

```text
GET  /api/health
GET  /api/ready
POST /api/scoring/jobs
GET  /api/scoring/jobs/{job_id}
POST /api/scoring/jobs/{job_id}/cancel
GET  /api/scoring/results/{prompt_id}/manifest
GET  /api/scoring/results/{prompt_id}/tiles/{z}/{x}/{y}.geojson
```

Add ArcGIS-friendly feature export endpoints. These should not replace tile endpoints; they should sit beside them.

Suggested endpoints:

```text
GET /api/scoring/results/{prompt_id}/arcgis/schema
GET /api/scoring/results/{prompt_id}/features
GET /api/scoring/results/{prompt_id}/features/page
```

Example feature query:

```text
GET /api/scoring/results/{prompt_id}/features
  ?dataset_id=london_224_8_45
  &bbox=-0.5,51.2,0.2,51.8
  &field=zscore
  &min=-1
  &max=3
  &limit=50000
  &offset=0
```

Suggested response shape:

```json
{
  "prompt_id": "the-scene-contains-brick-facade--0f489da9054f",
  "dataset_id": "london_224_8_45",
  "spatial_reference": { "wkid": 4326 },
  "fields": [
    { "name": "objectid", "type": "oid" },
    { "name": "pano_id", "type": "string" },
    { "name": "dataset_id", "type": "string" },
    { "name": "prompt_id", "type": "string" },
    { "name": "score", "type": "double" },
    { "name": "zscore", "type": "double" },
    { "name": "date", "type": "string" }
  ],
  "features": [
    {
      "geometry": { "x": -0.1276, "y": 51.5072 },
      "attributes": {
        "objectid": 1,
        "pano_id": "126048",
        "dataset_id": "london_224_8_45",
        "prompt_id": "the-scene-contains-brick-facade--0f489da9054f",
        "score": 0.731,
        "zscore": 1.82,
        "date": "201906"
      }
    }
  ],
  "has_more": true,
  "next_offset": 50000
}
```

Backend details to add:

- BBox filtering against pano lon/lat.
- Pagination.
- Optional score/zscore filtering.
- Optional max feature cap.
- Stable integer `objectid` per export response.
- Server-side field schema metadata.
- Optional result summary endpoint for min/max/count/histogram.

Important: do not make ArcGIS download every pano by default. A single prompt result may be too large for a smooth desktop or browser workflow.

## ArcGIS Pro Add-In Plan

### Development Shape

ArcGIS Pro add-ins are built with the ArcGIS Pro SDK for .NET. The plugin shell would be C#/.NET with DAML for UI registration and WPF/MVVM for panels.

Proposed folder if implemented later:

```text
arcgis-plugin/
  pro-addin/
    SemanticMapArcGISPro.sln
    SemanticMapArcGISPro/
      Config.daml
      Module.cs
      DockPane/
      Services/
      Models/
      Symbology/
```

### UI

Create a DockPane with:

- Backend URL.
- Optional bearer token.
- Dataset group selector.
- Prompt input.
- Score field selector: `score` or `zscore`.
- Range min/max.
- Color ramp selector.
- Result mode:
  - Preview current extent.
  - Create feature class.
- Submit button.
- Job progress list.
- Result layer list.

### Services

Suggested C# services:

```text
BackendClient
  health/ready checks
  submit scoring job
  poll job status
  fetch manifest
  fetch feature pages

ArcGISFeatureWriter
  create file geodatabase feature class
  define fields
  insert point features
  add result layer to active map

ArcGISPreviewLayerService
  create/update temporary result layer
  refresh visible extent

SymbologyService
  apply graduated color renderer
  apply point size
  switch score/zscore field

SettingsService
  store backend URL/token safely
  store default dataset and styling preferences
```

### Feature Class Schema

Use a point feature class, preferably WGS84 (`EPSG:4326`) unless the user explicitly wants the current map coordinate system.

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| OBJECTID | OID | ArcGIS-managed |
| pano_id | Text | Source pano id |
| dataset_id | Text | Dataset id |
| city_id | Text | Optional derived city |
| prompt_id | Text | Backend result id |
| prompt | Text | Original prompt, possibly truncated |
| query_type | Text | `text` or `pano_reference` |
| score | Double | Adjusted score |
| zscore | Double | Standardized score |
| capture_date | Text/Date | Depends on source precision |
| source_url | Text | Optional backend manifest/tile URL |
| created_at | Date | Export time |

### ArcGIS Pro Flow

```text
User opens DockPane
  -> enters prompt and dataset
  -> plugin submits backend job
  -> plugin polls progress
  -> plugin fetches ArcGIS feature pages
  -> plugin creates feature class in project geodatabase
  -> plugin inserts point features
  -> plugin adds layer to active map
  -> plugin applies zscore/score renderer
```

Implementation notes:

- Long ArcGIS Pro operations must be asynchronous and should show progress.
- ArcGIS map/data API calls normally need to run on the proper Pro SDK queued task context.
- Feature class creation should avoid name collisions by slugging prompt names and adding a timestamp or short prompt hash.
- The plugin should not write backend tokens into project files in plain text.
- If the user cancels a job, call the backend cancel endpoint and stop local import.

### Symbology

Start with a simple graduated color renderer:

- Field: `zscore` by default.
- Default range: `-1` to `3` for text prompts.
- Reference pano default range: `2` to `6`.
- Point size: default `3`.
- Color ramps:
  - Magma.
  - Turbo.
  - Vegetation.

Later:

- Preserve the existing custom gradient editor idea, but translate it into ArcGIS renderer class breaks or visual variables.
- Add histogram preview by computing local statistics from fetched features.

## Experience Builder Widget Plan

### Development Shape

Experience Builder custom widgets are TypeScript/React and use the ArcGIS Maps SDK for JavaScript, so this is the closest match to the current frontend.

Proposed folder if implemented later:

```text
arcgis-plugin/
  experience-builder/
    semantic-map-extension/
      manifest.json
      widgets/
        semantic-prompt-search/
          manifest.json
          src/
            runtime/
            setting/
            components/
            services/
```

### What Can Be Reused

Reusable with refactor:

- Backend job client logic from `frontend/src/state/localProject.ts`.
- TypeScript API types from `frontend/src/api/types.ts`.
- PromptBar concepts.
- Log/progress event model.
- Color helper logic from `frontend/src/state/color.ts`.
- Runtime config concepts.

Must be replaced:

- MapLibre map rendering.
- MapLibre layer/source code.
- Split-pane app layout.
- Browser-specific local project storage if Experience Builder config should own settings.

### ArcGIS JS Layer Strategy

For preview results:

- Fetch backend feature pages or GeoJSON tiles.
- Convert each point to an ArcGIS `Graphic`.
- Create a client-side `FeatureLayer` with `source`, `fields`, `objectIdField`, `geometryType`, and `spatialReference`.
- Add the layer to the selected map.
- Use renderer/visual variables for score/zscore color and point size.

For simple temporary display:

- Use `GraphicsLayer`.
- This is easy but weaker because `GraphicsLayer` has no schema and each graphic carries its own symbol.

Recommendation:

- Use client-side `FeatureLayer` for semantic results so attributes, popups, filters, renderers, and queries behave more like ArcGIS data.

### Experience Builder Flow

```text
Widget loads in an Experience Builder app
  -> reads selected map widget / JimuMapView
  -> user submits prompt
  -> widget submits backend job
  -> widget polls status
  -> widget fetches features for current extent or requested export
  -> widget adds client-side FeatureLayer to map
  -> widget applies renderer and popup template
```

### Persistence Caveat

Client-side `FeatureLayer` data is useful inside the current app session, but it is not automatically a durable hosted feature layer. To persist into ArcGIS Online or Enterprise, add a later export/publish path:

- Save features as GeoJSON.
- Publish as hosted feature layer through portal APIs.
- Or send features to an existing editable feature service via `applyEdits`.

This should be a later phase because it needs portal authentication, permissions, feature service schema management, and failure handling.

## Prompt Request Changes

Current frontend request body already fits the backend:

```json
{
  "dataset_group_id": "london_shanghai",
  "dataset_ids": ["london_224_8_45", "shanghai_224_8_45_2B"],
  "prompt": "the scene contains abundant vegetation",
  "query_type": "text",
  "zooms": [10, 11, 12, 13],
  "priority_tiles": []
}
```

For ArcGIS, add optional request metadata:

```json
{
  "client": "arcgis-pro-addin",
  "result_intent": "feature_import",
  "visible_extent": {
    "xmin": -0.5,
    "ymin": 51.2,
    "xmax": 0.2,
    "ymax": 51.8,
    "wkid": 4326
  }
}
```

The backend does not need this to score, but it can use it to write or prioritize the most relevant result pages/tiles first.

## Handling Large Data

Risk:

- A full prompt result over London and Shanghai may contain too many points for an immediate ArcGIS import.

Controls:

- Default to current extent.
- Add a max feature count.
- Add score/zscore filters.
- Page server responses.
- Let the user choose "preview" vs "persist".
- Warn before importing a very large feature class.
- Store import metadata so the same result can be refreshed without recomputing.

Suggested thresholds:

- Up to 50k points: client-side preview is reasonable.
- 50k to 500k points: feature class import with progress and cancellation.
- Above 500k points: require filtering, tiling, or explicit confirmation.

These thresholds need real benchmarking inside ArcGIS.

## Street View And Pano Inspection

For the first ArcGIS plugin, keep pano support optional.

Possible Pro add-in design:

- Click a semantic point.
- DockPane shows pano id, date, dataset id, score, zscore.
- Button: "Fetch pano image".
- Backend returns image bytes.
- DockPane displays the image.

Possible Experience Builder design:

- Popup action: "Open pano".
- Side panel displays the image.

Do not port the full Photo Sphere Viewer interaction until the prompt-to-layer workflow is stable.

## Security And Configuration

Do not hardcode:

- RunPod URL.
- Backend bearer token.
- Gmail/SMTP settings.
- Dataset paths.

Recommended storage:

- ArcGIS Pro Add-In: user settings plus Windows Credential Manager or another secure local secret store for tokens.
- Experience Builder: widget config for non-secret URL values; token supplied by user/session, or use a backend proxy with ArcGIS-managed auth if deployed inside an organization.

Backend requirements:

- Keep bearer token auth.
- Keep CORS restricted to expected ArcGIS web origins for Experience Builder.
- For ArcGIS Pro desktop calls, CORS is not relevant because C# HTTP clients are not browser-constrained.

## Implementation Milestones

### Prototype Update: Prompt Search First

The first prototype now assumes ArcGIS can work from a normal point feature dataset, similar to the QGIS-facing shape. It does not import or render multiple z-levels. The plugin submits a prompt, waits for backend scoring, then pages through every result point for London and Shanghai with the ArcGIS feature export API.

Backend additions:

```text
GET /api/scoring/results/{prompt_id}/arcgis/schema
GET /api/scoring/results/{prompt_id}/features
GET /api/scoring/results/{prompt_id}/features/page
```

The Experience Builder prototype creates a client-side `FeatureLayer` and applies ArcGIS-native score/zscore symbology. Street-view preview is deferred; the layer attributes include `pano_id` and `dataset_id` so a later popup action can call the existing pano endpoints.

### Phase 0: Decide Target

- Choose ArcGIS Pro Add-In or Experience Builder widget.
- Decide whether result layers must be durable feature classes or only in-map preview layers.
- Decide whether pano inspection is required in v1.

### Phase 1: Backend ArcGIS Export API

- Add schema endpoint.
- Add paged feature export endpoint.
- Add bbox/score filtering.
- Add summary endpoint for count/min/max/histogram.
- Keep existing tile endpoints unchanged.

### Phase 2A: Experience Builder Prototype

- Create custom widget shell.
- Add backend settings panel.
- Add prompt submit/poll UI.
- Fetch current extent features.
- Create client-side FeatureLayer.
- Apply renderer and popup.

### Phase 2B: ArcGIS Pro Prototype

- Create Add-In with DockPane.
- Add backend settings and prompt UI.
- Submit/poll backend jobs.
- Fetch feature pages.
- Write point feature class to project geodatabase.
- Add layer to active map.
- Apply graduated color renderer.

### Phase 3: Result Management

- Refresh result layer.
- Re-run prompt.
- Delete imported result.
- Save import metadata.
- Add cancellation and error recovery.

### Phase 4: Advanced ArcGIS Behavior

- Hosted feature layer publishing.
- Portal item metadata.
- Layer style presets.
- Pano preview.
- Histogram/statistics panel.
- Multi-dataset result grouping.

## Key Decisions Still Needed

1. Is "ArcGIS plugin" specifically ArcGIS Pro desktop, or is an Experience Builder web widget acceptable?
2. Should results be temporary visualization layers, persistent geodatabase feature classes, or both?
3. Should v1 import only current extent, selected city, or full dataset?
4. Should result layers be editable by the user after import?
5. Should the plugin support pano image viewing in v1?
6. Will deployment be personal/local, or organization-wide through ArcGIS Enterprise/Online?

## Official References

- ArcGIS Experience Builder custom widget development: https://developers.arcgis.com/experience-builder/guide/getting-started-widget/
- ArcGIS Experience Builder overview: https://developers.arcgis.com/experience-builder/guide/overview-of-experience-builder/
- ArcGIS Maps SDK for JavaScript layer overview: https://developers.arcgis.com/javascript/latest/layers/
- ArcGIS Maps SDK for JavaScript `FeatureLayer`: https://developers.arcgis.com/javascript/latest/references/core/layers/FeatureLayer/
- ArcGIS Maps SDK for JavaScript `GraphicsLayer`: https://developers.arcgis.com/javascript/latest/references/core/layers/GraphicsLayer/
- ArcGIS Pro SDK for .NET: https://developers.arcgis.com/documentation/arcgis-pro-sdk/
- ArcGIS Pro SDK first add-in tutorial: https://developers.arcgis.com/documentation/arcgis-pro-sdk/tutorials/build-your-first-add-in/
- ArcGIS Pro feature class creation: https://pro.arcgis.com/en/pro-app/latest/help/data/feature-classes/create-a-feature-class.htm
