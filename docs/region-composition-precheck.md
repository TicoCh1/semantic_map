# Precomputed region atlas

The Region heatmaps view uses the same Backend URL and bearer token as Semantic Map. Choose one of 40 reference regions in the landmark search. Its layer covers all four cities. The map uses panorama points, the standard point-size controls and the existing Street View panel.

## Data contract

The CPU service streams the GPU release from `/workspace/experiments/spatial_semantic_matching_20261127/atlas_150m_release/`. Set `REGION_ATLAS_ROOT` to select a different mounted release. The service opens catalog arrays on the first precheck for each city. It needs the existing CPU dependencies.

| Method and path | Content |
| --- | --- |
| GET /api/region-atlas/index | Reference regions, actual source positions and counts, four-city normalization parameters, non-source ranges, five distinct hits per city |
| GET /api/region-atlas/query/{id} | One four-city score array in London, Rome, New York, Shanghai order |
| GET /api/region-atlas/city/{city} | Shared little-endian int32 longitude/latitude pairs in units of 0.00001 degrees |
| GET /api/region-atlas/panoramas/{city} | Shared panorama identity, location, capture date and occupied-cell membership |
| POST /api/region-atlas/precheck | A circle's capture count, effective count, short theme labels, full catalog prompts, KDE-weighted cover, city z and warning |

For each city the query file contains one float32 raw score per window followed by one uint16 per window. Its high bit marks source overlap and its remaining bits store the global percentile in hundredths. Metadata preserves the full precision of the transmitted raw values. The browser reconstructs z from the four-city reference mean and population standard deviation. The reference excludes source-city centers within 300 m. Top hits use the same exclusion and 600 m spatial suppression. Each window has a 150 m radius. Every occupied 100 m cell has a real panorama as its representative.

**Smart range** uses the minimum and maximum across all three non-source cities for the selected score field. All four maps share that range. Switching the field or resetting the range uses the corresponding pair of limits. Manual colour edits remain available. The histogram samples the left city. Its sample does not determine the colour bounds.

## Area composition

Use **Select area** in Map controls and click the center on either map. The initial radius is 150 m and can be adjusted from 50 to 600 m. The circle refreshes a lightweight inspection. Coverage is the fraction of KDE area with a concept score at least one city standard deviation above the city mean. Effective count is the inverse sum of squared normalized area weights. Themes suppress correlated prompts and repeated labels. The title on each short label gives its complete catalog prompt.

A broad or weakly defined circle shows a dilution warning. The action below the list opens the geographically nearest saved reference region in the source city and shows its distance. Both the scores and target window radius belong to that saved reference.

## Local acceptance and release

For local acceptance, set `REGION_ATLAS_ROOT` to the mounted test release and run `python -m uvicorn backend.semantic_map.region_atlas_api:local_app --factory --host 127.0.0.1 --port 8787`. Open the normal frontend with `?view=atlas&backend=http://127.0.0.1:8787`. The production CPU factory mounts the same router behind Semantic Map's existing backend token. GET responses support ETag revalidation.

For the approved release, stage the three backend modules (`cpu_api.py`, `region_atlas_api.py`, `region_inspect_api.py`) with the existing CPU application. Set `REGION_ATLAS_ROOT` to the release on the shared network volume. Confirm the index, a conditional score GET and one precheck on a staging port. Switch the CPU service to that code using its existing process supervisor, then publish the matching frontend build. Keep the prior code revision for rollback. The data volume is already shared with the GPU, so this rollout requires no index transfer or GPU inference.
