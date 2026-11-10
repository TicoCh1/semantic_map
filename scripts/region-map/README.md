# Independent PCA intensity map

This analysis artifact uses persisted eight-axis region queries, including
St Paul's Cathedral 500 m → Rome and Colosseum 500 m → London. Source and target
labels, map coordinates, variance and coverage are taken from the query metadata.
It does not add a feature to the production frontend.
The existing backend and services are not changed or restarted.

## Build

1. Run `scripts/export_region_intensity.py` **on RunPod only**, passing the
   experiment directory, the PCA-only run ID, and a separate output directory.
2. Copy `intensity.bin.gz` and `intensity-manifest.json` to a local output folder.
3. Run `node scripts/region-map/build.mjs <input-directory> [output.html]` locally.
   This only packages saved data and the project's installed MapLibre library.
4. Open the generated HTML manually in current Chrome or Edge. It includes the
   library and all scores. Online OpenFreeMap basemaps are optional; coordinates
   and saved intensities also work without a basemap. Do not automatically open
   an HTML preview in Codex.

## Score definition

The PCA basis is fixed to the original London source fit. All eight panorama
views retain the aligned-view representation used by image retrieval. PCA is
not refitted per selection. Source samples retain the original 25 m spatial
weights. For a selected subset, its original axis weights are renormalized and
the source weighted distance envelope is recalibrated to 90% source coverage:

`distance = sum(weight[j] * centered_projection[j]^2 / effective_variance[j])`

`intensity = 2^(-distance / source_weighted_Q90(distance))`

The exporter uses the existing backend `BlobProfile` and `weighted_quantile`
implementations. It precomputes all 255 nonempty axis selections on RunPod.
Full-axis scores are checked against every original cached score with absolute
error tolerance 1e-12; this export had maximum error **0.0**.

Intensity is compatibility, not probability, a signed PCA response, or sample
density. PCA axes represent variation, not individual clusters. This view has
no residual-space constraint and is therefore permissive: the first eight axes
retain 19.2749% of source variance and the full-axis envelope contains 97.0899%
of Rome samples. Thresholds above 0.5 reveal relative differences; they do not
turn the score into a probability or establish unique neighbourhood matches.

The browser chooses a precomputed array, filters display bins, and assigns
colours. It does not perform PCA, fitting, projection or backend scoring.
Subset intensity values use their own source envelope, so changing axes changes
the calibration; comparing two maps is a comparison of relative compatibility
in the respective subspaces. Intensity is quantized with `floor(256 * I)` capped
at 255, giving error less than 1/256. Byte threshold 128 preserves the exact
I >= 0.5 match boundary. Higher thresholds are restricted to bin boundaries.
Sample footprints are display markers; no similarity is inferred outside the
sampled locations. Map clicks report approximate bin-centre intensity values.

## Validation

`node scripts/region-map/check-map.cjs <output.html>` runs headless Chromium and writes a validation receipt and PNGs
next to the map. Its runtime paths currently use this workstation's bundled
Playwright and installed Chrome. It checks all eight individual axes, a subset,
all axes, the empty selection, a higher threshold, offline rendering and mobile
layout. It does not open a visible browser or a Codex preview tab.

Basemap sources: [OpenFreeMap quick start](https://openfreemap.org/quick_start/).
Renderer: [MapLibre API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/).
The generated folder retains `MAPLIBRE-LICENSE.txt` for the bundled library.
