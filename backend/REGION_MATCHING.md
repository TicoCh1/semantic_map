# Region matching research worker

The local implementation adds a standalone, opt-in RunPod research API. It does
not mount routes into the existing saved-score or GPU scoring apps, edit their
launchers, load Qwen, or start a worker on import. No frontend integration is
included. On 2026-10-01, the user authorized selective deployment and smoke
testing on Pod `vgakgmrszzf1lr`. The new modules were deployed without restarting
existing services or modifying embedding inputs. See
`docs/region-matching-deployment-20261001.md` for the verification record.

The implementation uses corresponding-view dot products averaged across the
selected view slots. PCA operates jointly on their virtual concatenation scaled
by `1 / sqrt(view_count)`; it does not average the embedding vectors or normalize
PCA query blocks separately. All statistical modeling takes place in the backend.

## Compute devices

Both model and run requests accept `compute_device`:

- `auto` is the default. If Torch and usable CUDA are present, the weighted
  streaming PCA matrix products, QR, and final SVD run on GPU. Otherwise NumPy
  performs PCA on CPU without a Torch dependency. CUDA allocation failure during
  an automatic job retries on CPU and records the fallback in the manifest.
- `cpu` does not import Torch or probe a GPU.
- `cuda` requires CUDA and fails explicitly if it is unavailable or runs out of
  memory. It never silently changes the requested device.

Read `pca_compute`, `compute`, and `projection_compute` in completed manifests
to see actual device use and fallback events. On a projection cache hit,
`projection_compute` describes the device that created the cached projections;
the current run's device discovery does not mean projections were recomputed.
Geographic operations and quantile aggregation use CPU. They do not run in a
frontend or automatically move every operation onto a GPU.

GPU linear algebra uses [PyTorch SVD](https://docs.pytorch.org/docs/stable/generated/torch.linalg.svd.html)
and availability checks; CPU linear algebra uses [NumPy SVD](https://numpy.org/doc/stable/reference/generated/numpy.linalg.svd.html).

## Deployment and startup

Use a dedicated Linux environment on RunPod, install
`backend/requirements-region-matching.txt`, and preserve a compatible GPU Torch
installation if one is already present. Do not modify the active backend's
environment. The service requires exclusive ownership of its output root and
one Uvicorn worker.

```bash
export REGION_MATCHING_ENABLED=true
# Set REGION_MATCHING_TOKEN securely in the environment; do not put it in URLs.
export REGION_MATCHING_DATA_ROOT=/workspace/reruns/pano512_8B_q90_20260915_b200/embedding
export REGION_MATCHING_ROOT=/workspace/semantic_backend/region_matching
export REGION_MATCHING_BLOCK_SIZE=512
export OPENBLAS_NUM_THREADS=2
export OMP_NUM_THREADS=2
python -m uvicorn backend.semantic_map.region_matching_api:create_app --factory --host 127.0.0.1 --port 8002 --workers 1
```

The dedicated environment is installed at
`/workspace/semantic_backend/region_matching_runtime` on the verified Pod.
With a dedicated `REGION_MATCHING_TOKEN` set, the selectively deployed launcher
`bash /workspace/backend/start_region_matching.sh` starts the same API on
localhost port 8002. It explicitly enables only this separate worker. The smoke
server was stopped after verification; a persistent API was not left running.
Coordinate future jobs with other backend calculations.
The default feature setting is disabled; enabling it also requires a nonempty
`REGION_MATCHING_TOKEN`. A separately configured proxy may expose the research
port later. Existing port 8000 and its API behavior remain unchanged.

## Request sequence

Use the `model_request` object in
`configs/region-matching-request.example.json` for
`POST /api/region-matching/models`, with the research token in an Authorization
header. The polygon is illustrative and must be replaced with the real selection.
Wait for its status to become `ready`; put its model ID into `run_request`, then
submit that object to `POST /api/region-matching/runs`.

Models persist PCA and complete source projections. Target projection caches are
reused for the same model, selected axis count, dataset revision, and date limits.
Weights and coverage can change without rereading target embedding payloads.
Increasing the selected axis count requires a new target projection cache. Set
`neighborhoods` to null for point scores only.

Native `*_identity.jsonl` sidecars are required and checked against reference
rows. Global rows use cumulative actual shard lengths, including London's
partial shard. The reader never loads RGB images or modifies input shards.

The initial neighborhood search uses a bounded grid over the observed target
extent, ranks a coverage shortlist, and compares its full observed PCA
distribution. It returns observed equal-area circular neighborhoods and evidence,
not an inferred cadastral district. If the candidate grid exceeds its configured
limit, the job fails explicitly; it does not silently truncate target coverage.

Completed models and runs are immutable. Cancelled or failed jobs do not expose
ready artifacts. A process restart marks interrupted jobs as failed; a later
request can reuse completed projection caches, but there is no automatic resume
of a partially executed solver. These limits are explicit in the design document.

## Verification state

Only static source and request inspection is permitted on the Windows machine.
Execution was performed on the user-specified RunPod, using its dedicated
environment. All 16 tests passed, including CUDA PCA/scorer/projection parity.
The three API tests were rerun after adding neighborhood GeoJSON checks and
passed. A bounded native-embedding smoke check used 128 Rome and 128 London
records with eight views and 4096 dimensions per view; automatic PCA used CUDA,
and its minimum subspace overlap with CPU PCA was 0.99999899. An actual Uvicorn
startup, readiness, capabilities, and token protection check also passed.

The included tests can be run in the dedicated RunPod environment, with
`backend/requirements-region-matching-tests.txt` installed for the HTTP client:

```bash
python -m unittest backend.tests.test_region_matching_compute backend.tests.test_region_matching_data backend.tests.test_region_matching_api
```

CUDA parity tests skip when CUDA is unavailable; they ran on the verified Pod.
The reusable real-data smoke script is `scripts/smoke_region_matching.py` and
must also run on RunPod. The sample test verifies execution and numerical
agreement, not city-scale latency or semantic matching quality. City-wide peak
memory, timings, shortlist recall, and human-reviewed matching quality still
require a separate experiment.

## Fixed-factor product atlas (2026-10-01)

The independent intensity-map exporter now accepts `--aggregation axis_product`.
This mode uses `calibrate_axis_product` from `region_matching_compute.py` and
reuses cached source/target projections. The research API's existing calibrated
mean behavior is unchanged; product mode is currently an experiment/export mode.
No application frontend integration or running-service deployment was performed.

For each axis, let `t_j = a_j . x - a_j . source_mean`, `z_j = t_j / sigma_j`,
and fix `q_j` to the source spatially weighted 90th percentile of `z_j ** 2`.
The existing individual factor is `I_j = 2 ** (-z_j ** 2 / q_j)`.
The product is `I_S = product(I_j ** exponent_j)` for selected axes, with
exponent 1 per axis in the two published product atlases. Exponents are never
normalized by their sum. The implementation sums in the log domain before
exponentiating, without root scaling or target min-max normalization.
Peak raw intensity is 1 at the source mean. The standalone product atlas now
defaults to display-only percentile colours over samples passing the current
threshold, so relative ranks use the full ramp. A min–max stretch and fixed
0–1 colours are also available. The legend/note show ranks and the raw range
as appropriate. None of these display modes changes scores.
Normalized weights are used only for the separate geographic distribution
comparison, not for the product exponent.

Each individual curve keeps its source calibration. Adding an axis cannot
increase intensity, but joint coverage at 0.5 is not calibrated back to 90%.
These are compatibility factors, not calibrated event probabilities. PCA
decorrelation does not establish statistical independence. A product favouring
the multivariate mean can remain high at target samples even when few source
samples occupy that mean. Neighborhood distribution comparison is a separate
stage, and retained-axis centrality does not constrain discarded directions.

The numerical experiments ran on Pod `vgakgmrszzf1lr` using an isolated code
copy at `/tmp/region-axis-product-20261001`. All 19 backend tests passed,
including GPU parity and new product/monotonicity tests. Both real-data exports
preserved individual-axis scores exactly and verified all 1,016 nonempty
subset-extension relations. Both standalone maps passed headless browser checks.
See `docs/region-axis-product-20261001.md` for results and reproduction commands.
