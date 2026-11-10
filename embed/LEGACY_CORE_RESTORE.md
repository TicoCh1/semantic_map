# Legacy inference core restoration — 2026-09-15

Source of truth: cloud `/workspace/streetview_pano_qwen_timers.ipynb`.

The runtime now follows its per-image contiguous CHW pinned upload, GPU stack,
preallocated per-view grid sampling, per-embedding-batch contiguous HWC/PIL
conversion, and `torch.autocast` around the unchanged Qwen `process` call.
Qwen's default instruction remains `Represent the user's input.`

Necessary adapters retain native panorama dimensions, verified wrap cropping,
the already-committed run's periodic seam convention, source order, and fixed
eight-yaw geometry. Geometry/version, output precision, selection and run ownership
metadata are not changed. Existing committed shards are not rewritten.

The bounded CPU reader/decode workers additionally produce Q90 2048x1024 JPEGs
from a separate image copy. Native images feed projection. Atomic checkpoints
store the JPEGs in ordinary, uncompressed TAR files (`tarfile` mode `w`), along
with embeddings/references and durable SQLite progress.

Legacy timing fields are preserved: decode_from_tar, jpeg_decode, pil_to_cuda,
stack_panos, reproject_gpu, qwen_embed, parse_ref, io_write, gpu_wait_get,
cpu_wait_put and decoded_bad. CUDA event intervals surround projection and Qwen
processing, as in the notebook. The Qwen interval starts after PIL conversion.
The GPU worker harvests completed events; the reporter never calls CUDA.
Input identities come from the saved inventory, so parse_ref remains zero in
the compute loop. The indexed reader replaces the sequential TAR iterator, so
its read/queue timings refer to that equivalent work, not identical I/O access.

PERF text and JSON are emitted on a wall-clock interval, independent of batch
size. Supplemental projection_seconds and embedding_seconds are host timings,
with views_to_pil_seconds separately exposed; they must not be substituted for
the legacy event counters. CPU worker times overlap GPU work.

Validation before switch: 29 synthetic/cloud CPU tests passed, followed by
three focused tests after the final report change (30 distinct tests covered).
These checks use fake models, not a second production inference process.

Deployment replaces only pipeline_runtime.py and run_panorama_embedding.py,
after graceful exit, with timestamped backups. Resume uses the same OUTPUT_ROOT
and the existing 03_run_embedding.sh. No dependency installation is required.

## 8192-row repack

The subsequent user-authorized repack changed CHECKPOINT_PANOS to 8192 for
embedding NPY, reference NPY and matching uncompressed JPG TAR together.
25,664 committed London rows were compacted to 24,576 retained rows (three
complete shards); 1,088 trailing completed rows were requeued and their old
outputs deleted only after the new full shards were verified. Every retained
embedding/reference value, JPG byte and identity order was checked.
The run resumed with PANO_BATCH=128, EMBED_BATCH=1024, CHECKPOINT_PANOS=8192.
Original source TARs and /workspace/embedding were untouched.
Normal shutdown/city-end handling can still commit a smaller final checkpoint;
8192 is the full-shard size, not a reason to discard a city's final images.
