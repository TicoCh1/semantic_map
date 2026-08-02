# Instrumented query backend

This `backend` directory is a drop-in replacement for the RunPod backend. It
adds an append-only execution audit trail and revisioned result storage while
preserving the established API routes.

## Canonical request API

Use `POST /api/scoring/jobs/batch` for both single and multi-query calls. A
single query is a `queries` array with one item. Every query item has the same
schema, whether it originates from the GitHub frontend, a research script, or
an ArcGIS export.

```json
{
  "client_request_id": "optional-client-label",
  "queries": [
    {
      "dataset_group_id": "london_shanghai",
      "dataset_ids": ["london_224_8_45", "shanghai_224_8_45_2B"],
      "prompt": "this scene contains a red brick facade",
      "query_type": "text",
      "zooms": [10, 11, 12, 13],
      "force_override": false
    }
  ]
}
```

The batch endpoint always returns one result per submitted array element. An
accepted element contains its job; a rejected element contains its index,
exception type and validation message. One rejected query does not hide job IDs
for accepted queries:

```json
{
  "request_id": "request_...",
  "received_at": "2026-08-01T12:00:00.000Z",
  "queries": [
    {"index": 0, "status": "accepted", "job": {"job_id": "..."}},
    {"index": 1, "status": "rejected", "error_type": "ValueError", "error": "Prompt is required for text scoring jobs."}
  ]
}
```

The established `POST /api/scoring/jobs` single-query route remains available
for backward compatibility. It immediately normalises to the same scheduler
and audit path. The ArcGIS merged-feature route also enters the scheduler via
the same batch function.

If no `priority_tile` or `priority_tiles` are supplied, the service creates a
deterministic city-centre tile at the highest requested zoom for every target
dataset. Thus every request has a priority tile before it enters the queue.
Explicit priority tiles must name a requested dataset (or occupy the matching
dataset position) and use one of the request zooms.

## Cache and override behaviour

`force_override` is `false` by default. With the default value, a fully cached
query returns a cache hit and does not enter a physical execution batch.

With `force_override: true`, cache lookup is bypassed. The query is scored
again into a new immutable `revisions/<revision>/` directory. The previous
revision remains readable while score arrays, manifest and priority tiles are
written and validated. Only after validation does the backend atomically
replace `current.json`, then it removes every superseded revision and legacy
root artifact so repeated overrides do not grow result storage. The manifest's
tile template includes `?revision=...`, so the GitHub frontend and
browser/IndexedDB caches use a new URL after an override.
To avoid two writers targeting the same cache key, a query that is already
active is still deduplicated to the active execution; that decision is logged
as `query_active_deduplicated`.

## Append-only logs

By default, events are written to:

```text
${LOG_ROOT:-/workspace/semantic_backend/logs}/query_execution/
  query-execution-YYYY-MM-DD.jsonl
```

The file is intentionally separate from `RESULT_ROOT`: cached `job.json` files
may be overwritten, while this JSONL stream never overwrites a historical
request or execution event. The startup script enables and fsyncs this log by
default. Configure it with:

```bash
export EXECUTION_LOG_ROOT=/workspace/semantic_backend/logs/query_execution
export EXECUTION_LOG_ENABLED=true
export EXECUTION_LOG_FSYNC=true
```

Each JSONL event contains an ISO-8601 millisecond timestamp and one of:

- `api_request_received`: complete API payload, server request ID and receipt time.
- `query_admitted`, `query_cache_hit`, or `query_active_deduplicated`: one independent query's cache decision and normalised request context.
- `execution_batch_started`: the physical scheduler batch, all query job IDs, request IDs, data scope and queue window.
- `execution_batch_scoring_complete`: shared scorer timings, including `gpu_cosine_seconds` (`prompt_cosine` or `reference_cosine`) and `scoring_total_seconds`.
- `query_first_priority_tile_written`: first returned priority tile, its timestamp and latency from API receipt.
- `query_dataset_tiles_complete`: one independent tile timing record for every target dataset/city.
- `query_execution_complete`: each independent query's full payload context, per-dataset tile timings, aggregate tile-write total and end-to-end backend latency from receipt.
- `execution_batch_complete`: complete physical job timing, including total tile-writing and execution duration.
- override revision activation, rejection, cancellation and failure events.

`gpu_cosine_seconds` is the scorer's matrix cosine stage. It is shared by all
fresh queries in a physical batch; it must therefore be analysed at the
`execution_batch_*` level rather than added once per query. Query-level
`backend_latency_from_received_seconds` includes queue waiting, shared scoring
and the query's position in serial tile materialisation.

`start_runpod_backend.sh` also tees Uvicorn stdout, stderr, tracebacks and access
logs to the Pod-local `${UVICORN_LOG_PATH}` (under `/tmp` by default), rotating
it at 100 MiB with three retained backups. Tile access logging therefore does
not synchronously append to the `/workspace` network volume.

`package_runpod_query_logs.sh` includes both the durable `LOG_ROOT` execution
logs and the current Pod-local Uvicorn log in downloaded archives.
