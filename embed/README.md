# Four-city Qwen8B panorama rerun

## Independent CORE 8B pipeline

The [consolidated experiment register](../docs/embedding-reranker-experiment-register-20261007.md)
records official-input validation, matched Qwen/CORE timing, retrieval-space
comparison, green-car/multi-view controls, system prompts and final blind audits.
Pilots and larger runs are merged; corpus-replacement and accuracy claims are
kept separate from a successful embedding pipeline deployment.

The official `Alibaba-NLP/core-emb-8b` checkpoint has a separate optimized
embedding pipeline. Use `run_core_panorama_embedding.py`,
`run_core_dataset_embedding.py`, and `run_core_text_embedding.py`; the original
Qwen entry points and serving configuration are unchanged. CORE uses its own
tokenizer/EOD pooling profile, output roots, and provenance. Do not combine CORE
text with Qwen image vectors. Deployment locations, operating commands, GPU
equivalence results, and storage limits are documented in
[`docs/core-embedding-pipeline.md`](../docs/core-embedding-pipeline.md).

## Heterogeneous public image datasets

The full operating contract, inclusion matrix, output schema, failure semantics
and known gaps are maintained in
[`docs/heterogeneous-dataset-embedding.md`](../docs/heterogeneous-dataset-embedding.md).

`run_dataset_embedding.py` is the dataset-aware path for Cityscapes,
Mapillary MSLS/MTSD/Vistas, OmniCity and BDD100K. It intentionally does not infer
projection from aspect ratio: catalog entries declare `perspective` or
`equirectangular`, because both Cityscapes perspective frames and spherical
panoramas may be 2:1.

Inventory discovery supports ordinary image files, ZIP members, TAR/TAR.GZ members, or one
level of ZIP nested inside ZIP (used by OmniCity). The persistent direct-offset
cache requires uncompressed TARs; unpack compressed TARs on CPU before inventory
creation. This also covers the archive
formats used by A2D2/CULane/RDD-style downloads once their actual mounted paths
are added to the catalog. Projection must still be declared from dataset
documentation or a trusted per-dataset manifest; mixed projections must be
split into separate catalog rules rather than guessed from width/height.
MSLS/MTSD have an explicit catalog policy resolving geometry from publisher
`pano`/`ispano` metadata. Their perspective fallback applies only where declared
(notably hidden MTSD test metadata); contradictory dimensions fail the source.

Perspective images are center-cropped to 1:1 and resized to 512x512.
Equirectangular images are converted to eight 512x512 perspective views at
0/45/90/135/180/225/270/315 degrees, pitch 0, and 45-degree FOV.

The old numeric `id/lon/lat/date` reference array is not used. Each source archive
(or nested ZIP) retains one output package under `packages/<package_id>/`:

- `embeddings.npy`: flat float16 `[RGB images, 4096]`;
- `image_map.jsonl`: source, transform, stable view ID and package-local row;
- `validation.tar`: paired transformed labels and source metadata;
- `checkpoint.json`: v4 identity, counts and committed byte offsets.

There is no fixed 8192-image output split. A 15,000-datapoint source package
remains one package. Files stream to disk; `CHECKPOINT_SOURCES=256` commits
within that same package. Resume truncates unpublished tails and restores the
committed NPY header. Keep source archives; RGB images are not exported.

`EMBED_BATCH=64` counts actual RGB images. Independent CPU preparation workers,
CUDA-native Qwen image input, learned-position/RoPE caching, one-batch GPU
lookahead and a bounded disk writer are integrated. Perspective crops preserve
CPU LANCZOS; panorama pixels stay on GPU after projection. Heterogeneous yaw
order is explicitly 0,45,...315 and checked against annotation geometry.

`validation_kind` is carried into every mapping row. Raster, box, polygon and
source-tag handling is implemented in `validation_projection.py` and connected
to inference by `dataset_validation_export.py`; the per-dataset
policy and non-projectable cross-view cases are documented in
`VALIDATION_TARGETS.md`.

Satellite imagery is never an embedding input. Disabled catalog entries remain
documented with `include_in_embedding: false`; enabled satellite rules are
excluded from inventory. If a stale/external inventory still contains a satellite
record, the runner writes it to `embedding_errors.jsonl`, skips it and continues.
The runner stores a catalog snapshot and refuses to resume from a stale inventory,
so an inventory created before this exclusion needs a fresh output root when
processing state already exists. Rebuilding a populated root is rejected.

Per-source decode/projection errors and per-model-batch inference errors are also
durably appended to `embedding_errors.jsonl` and do not stop the run. Existing
error rows are skipped on ordinary resume; use `--retry-errors` after fixing the
cause. Sources can straddle RGB batches; only all-view success commits a source.
A failed view discards earlier successful views from that source. Package writes stop on failure because
continuing without durable embeddings would falsely report success.

Resume validates every committed package and uses source sets, so retries can fill
earlier failures without duplicating successes. Model/config/label changes cannot
be silently appended to an existing run. Limited runs report `partial`.
The launcher enforces the configured output-volume quota (default 500 GB) with
10 GB reserve. Set `OUTPUT_VOLUME_ROOT` and `OUTPUT_VOLUME_CAPACITY_GB` for a
different output mount. RGB is not exported: model inputs stay in memory and
verification reconstructs them from original sources and recorded transforms.
Retain the original archives. Only geometry-changing raster labels are exported,
losslessly; unchanged raster labels retain source references.

Before mounting the GPU Pod, run `bash 03_prepare_dataset_cpu.sh`
on the CPU Pod. It builds `OUTPUT/cpu_cache/prepared.sqlite` with archive byte
offsets, resolved image geometry and transformed annotations. The GPU launcher
requires the completed `READY.json`; it performs read-only SQL lookups and RGB
decode/crop, without rebuilding SQL indexes, scanning ZIP directories or parsing
full annotation tables. Interrupted CPU builds resume committed sources.
`--check-cpu-cache` validates readiness without loading Qwen. Compressed nested ZIPs are
materialized once (stored nested ZIPs use original byte offsets); cached labels and container copies add to disk usage and are
included in quota checks. Keep the same `/workspace` mount path.

For a source inventory audit only (not sufficient for GPU startup):

```bash
python /workspace/embed/run_dataset_embedding.py \
  --catalog /workspace/embed/dataset_catalog_runpod.json \
  --output-root /workspace/reruns/public_datasets_512_qwen8b \
  --inventory-only
```

Run inference after attaching the same network volume to a CUDA Pod. The
equirectangular path uses the existing CUDA projector; the CPU implementation
remains the deterministic QC/reference path:

```bash
bash /workspace/embed/04_run_dataset_embedding.sh
```

The legacy four-city panorama entry point remains
`bash /workspace/embed/03_run_embedding.sh`.
It runs London (the 156,895-row ULEZ selection), Shanghai, New York and Rome,
creating native-source **512 px / 8 views / 45 degree FOV / Qwen3-VL-Embedding-8B**
vectors and **2048x1024 JPEG panoramas** together. Existing 224 embeddings and
original TARs are retained. Nothing switches the live backend to these outputs.

## Run and resume

Use a GPU Pod with the existing Qwen dependencies and 8B weights. On the current
CPU Pod the historical persistent venv points to a missing interpreter; select
a working GPU environment with `PYTHON_BIN` when needed. Do not rerun the data
download scripts: all 22 source TARs already exist.

First run the read-only check (with the real output mount and its provisioned quota):

```bash
export OUTPUT_ROOT=/workspace/reruns/pano512_8B_20260915
export OUTPUT_VOLUME_ROOT=/workspace
export OUTPUT_VOLUME_CAPACITY_GB=2000  # CURRENT allocation; replace if changed
bash /workspace/embed/03_run_embedding.sh --check
```

**The current 2,000 GB volume does not have enough free capacity.** This example
is a preflight, not a viable full-run storage configuration. Prepare adequate
output storage first, then set the three variables to its actual paths/quota and
run:

```bash
bash /workspace/embed/03_run_embedding.sh
```

Repeat exactly the same command to resume. `SIGINT`/`SIGTERM` finish and commit
completed work. A hard kill or disk failure redoes only uncommitted checkpoints;
no manual shard index or skip count is needed. Batch sizes and worker counts can
change on resume. Selection, source metadata, precision and output settings
cannot change in an existing run. Preserve source file sizes and mtimes when
moving storage; never mix runs with different models or geometry rules.

Optional `--inventory-only` validates the full source membership and London
selection without loading a model. It reads TAR headers and seeks over payloads;
this can take time on network storage, but creates a reusable offset inventory.
It audits selection coverage before computing embeddings. Small missing counts are reported; a city deficit of 1% or more (at least 100 rows), duplicate matches, or excess rows still fails preflight.
The serving index omitted some low London IDs in the previous audit, so the new
pipeline independently inventories the raw archives and reports any remaining
coverage mismatch. Small deficits can proceed with an explicit error report.

## Settings

| Variable | Default | Meaning |
|---|---:|---|
| `PANO_BATCH` | 8 | Panoramas per projection/compute batch |
| `EMBED_BATCH` | 64 | Maximum views per model call; lower for limited VRAM |
| `DECODE_WORKERS` | 4 | CPU decode, geometry and JPEG workers |
| `PREFETCH_PANOS` | 16 | Bounded CPU lookahead |
| `CHECKPOINT_PANOS` | 8192 | Panoramas per full embedding/reference/JPG TAR shard; final or interrupted shards may be smaller |
| `REPORT_SECONDS` | 30 | Wall-clock log cadence, independent of batch size |
| `PRECISION` | bf16 | Inference dtype; disk embeddings always FP16 |
| `JPEG_QUALITY` | 90 | JPEG quality (85/90/95), 4:2:0 subsampling |
| `LONDON_SELECTION` | Existing audit CSV | Exact `id,lon,lat,date` whitelist |
| `PANO_DIR`, `MODEL_DIR`, `QWEN_SOURCE_DIR`, `PYTHON_BIN` | `/workspace` setup | Input/runtime locations |

Read-only `--check` reports CUDA and capacity separately. FUSE `df` describes the
shared storage pool, so quota checks require the actual provisioned GB and mount
root. The initial Q90 allowance is about **368.76 GB** (601,307 panoramas plus a
20 GB margin), not a guaranteed size bound. Disk exhaustion raises an error;
completed checkpoints remain resumable. Space planning must also account for
other tasks writing to the same volume.

## Geometry and concurrency

CPU workers decode each original only once. A separate resized copy becomes the
JPEG; native pixels feed GPU projection, grouped by their original dimensions.
The reader, CPU workers and one checkpoint writer overlap GPU computation with
bounded queues. Native PIL images are released after each model batch, not held
for a whole shard. At most one writer shard plus the current checkpoint remain
uncommitted (normally up to 1,024 panoramas with the defaults).

Exact 2:1 images are treated as complete spheres. Four original samples across
London, Rome and New York showed that 3584x1664/1665 images repeat their first
256 columns at x=3328 (overlap mean absolute error 0.26-0.58 on a 0-255 scale).
The decoder verifies that overlap on **every** such image, then crops to
3328x1664, including the extra bottom row in the 1665 variant. It never stretches
the 3584-wide stitched image into a sphere. Other non-2:1 images, ambiguous/blank overlap, corrupt JPEGs and malformed
identities are recorded and skipped, so an isolated bad image does not stop the
GPU job. Unknown geometry is never guessed or embedded as a stretched sphere.

View order remains `[45,90,135,180,225,270,315,0]`; file heading is retained as
metadata and does not rotate the view convention. Progress logs contain UTC
wall-clock timestamps, elapsed seconds, computed and durable counts, and CPU/
projection/model stage times. Stage durations can overlap and must not be summed
as total elapsed time. No progress reporter calls CUDA or clears notebook output.

## Output and recovery contract

Each city uses `<city>_512_8_45_8B`, under the **new owned output root**:

- `embedding/<dataset>/views_emb_shard_NNNNN.npy`: `[N,8,4096]`, FP16.
- `embedding/<dataset>/views_emb_shard_NNNNN_ref.npy`: `[N,5]`, FP64,
  `[id,lon,lat,date,heading]`; unknown heading is NaN. Full source coordinates are
  preserved; whitelist matching uses the supplied legacy FP32 representation.
- `embedding/<dataset>/views_emb_shard_NNNNN_identity.jsonl`: original archive,
  member and offset, namespace, geometry correction and new TAR member identity.
- `pano/<dataset>/panos_shard_NNNNN.tar`: the corresponding JPEGs. New York's
  overlapping numeric IDs stay distinct through original namespace and record ID.
- `checkpoints/<dataset>/checkpoint_NNNNN.json`: durable group commit marker.
- `inventory.sqlite3`, `run.json`, `london_selection.csv`: input inventory and
  configuration needed to resume; retain these when moving the run.
- `complete.json`: written once every inventory row is committed or explicitly
  recorded as failed. Status is `complete_with_errors` when unresolved issues exist.

Files are written to partial names, flushed, renamed, then marked complete.
Recovery checks file sizes and NPY headers and replays marker-to-inventory updates
if interrupted between those operations. Completed shards are never overwritten.
This is crash consistency, not detection of arbitrary same-size bit corruption.
Kernel file locks prevent simultaneous writers; there are no fixed PID assumptions.

Retiring originals, rebuilding the live panorama index/cache, reconciling historical
rating references and migrating/resizing a volume are separate operations. The
pipeline never deletes data or modifies the running verification service.

## Verification / historical scripts

```bash
cd /workspace/embed
python -m unittest test_panorama_pipeline -v
```

Tests use temporary synthetic TARs and a fake model. Real GPU inference throughput
and VRAM must be checked on the target GPU; CPU tests do not establish those.
`run_legacy_qwen_embedding.py` is retained as the historical implementation and is
**not called by 03**. Its old manual shard/224 workflow does not have these safeguards.
The `01_*` download scripts and `02_install_requirements.sh` retain their existing
behavior. The launcher selects the already available 8B weights for this run.

## Unattended fault tolerance (2026-09-15 revision)

There is **no cumulative bad-image limit**. For example, 1,000 scattered bad
images among 601,307 panoramas do not stop the run. The defaults stop only when
one stage has 100 consecutive failures, or at least 50% failures across a full
rolling window of 1,000 items. The identity, preparation and inference stages
have independent counters. These limits are configurable with
`--max-consecutive-errors`, `--error-window`, and `--max-error-fraction`.

- Source image reads retry up to 3 times before recording the item as failed.
- CPU decode/geometry errors are recorded per image and skipped.
- Projection/model batches that fail (including OOM) split recursively. A single
  panorama retries with one view per model call before being marked failed.
  Good items in a bad batch are retained, in source order, with aligned references.
- Transient file-write / SQLite operational errors retry up to 3 times. Completion
  markers remain authoritative. A persistent inability to store checkpoints,
  changed source files, invalid checkpoint ownership or unusable model/runtime
  remains fatal; swallowing those would waste GPU time without usable results.
- Failures are durable immediately in `inventory.sqlite3`. On normal completion,
  interruption or handled fatal exception, `failures.jsonl` and `error_report.zip`
  collect item identities, stage, error, retry events, coverage findings and summary.
- Ordinary restarts skip both committed successes and recorded failed items.
  `bash /workspace/embed/03_run_embedding.sh --retry-failed` retries only those
  failed image records; successful shards remain untouched. Malformed inventory
  names and absent source rows require an input/identity correction and a fresh
  inventory; this switch cannot repair missing source data.

An exit code of zero with `complete_with_errors` means the pass finished with
reported omissions, not that every requested input succeeded. `failed_panos` and
`unresolved_issues` distinguish these cases. No claim is made that arbitrary
process crashes, driver hangs or hardware failures can be handled by Python
exceptions; committed work still survives a process restart.

## Automatic persistent timing logs

Normal launches through `03_run_embedding.sh` now use a standard-library logging
supervisor. No manual `tee`, shell redirection or notebook output saving is needed.
Each launch/resume creates `/workspace/embed/logs/<UTC-time>-<unique-id>/`:

- `console.log`: combined child stdout/stderr, including Python tracebacks.
- `timing.jsonl`: UTC timestamps, monotonic session elapsed time, actual GPU name /
  VRAM / driver probe, CPU count, launch arguments, pipeline progress, independent
  30-second heartbeat and final exit code. Each timing record flushes/fsyncs both
  files. Regular terminal output is line-flushed between heartbeats.

`LOG_DIR` can select another persistent directory. `LOG_PYTHON_BIN` selects the
supervisor interpreter (default `python3`, standard library only); `PYTHON_BIN`
continues to select the Qwen environment. A missing Qwen interpreter or failed
import is logged before the pipeline itself starts. `--check` and `--help` remain
read-only and bypass automatic log-file creation.

Session elapsed time includes startup checks, model loading, inventory, compute,
checkpoint completion and shutdown. Pipeline records separately include stage
wall times, per-city embedding wall time, source-read time, CPU preparation worker
time, input waiting, projection, embedding and checkpoint-write times. CPU worker
and I/O durations overlap GPU work: do not sum them as end-to-end time. Host
timings are distinct from the restored legacy CUDA-event counters.
`projection_seconds` includes enqueue work; `views_to_pil_seconds` includes the
subsequent transfer wait. `embedding_seconds` includes conversion and processing.
Use `reproject_gpu` and `qwen_embed` for the legacy event boundaries; no extra GPU
synchronize is added by the reporting thread. See
[the current run handoff](../docs/embedding-runpod-current-run.md) for full timing
semantics, 8192-row repack details and measured performance.

A restarted process gets a new session, so durations are never silently reset in
an old log. For multiple attempts sum their session elapsed times, including
retries. Completed records remain resumable as before. If the child is killed,
the supervisor records its exit code (e.g. 137 for SIGKILL). A whole-Pod loss or
simultaneous supervisor kill cannot write a final event; the last durable heartbeat
is the recorded lower bound. Logging cannot guarantee storage persistence if the
volume itself fails. Mid-run log write errors are displayed and retried on later
records without deliberately stopping GPU computation.

Logging tests: `python -m unittest test_embedding_logging -v`.
