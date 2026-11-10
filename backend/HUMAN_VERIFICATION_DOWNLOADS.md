# CPU human verification with saved-result downloads

`backend.semantic_map.human_verification_api:app` now supports downloads by default.
The existing human verification launcher and rating/sample endpoints continue to work.
This process does not import the scoring engine, start a scoring worker, load embedding
tensors, or run historical query backfill, even if the GPU backend environment enables it.

After uploading the updated backend files, restart the existing human verification
process using its usual process manager and the same environment/volume mounts:

```bash
bash /workspace/backend/start_runpod_human_verification.sh london,shanghai,new_york,rome
```

Do not start the GPU launcher `start_runpod_backend.sh` for this mode. Stop the old
human verification process through its existing supervisor before restarting on the same port.
This local code change does not itself update an already-running server.

## Capabilities and authentication

`GET /api/capabilities` and `GET /api/ready` report `downloads_enabled: true` and
`query_submission_enabled: false`. The existing `mode: human_verification` is retained.
Every new result endpoint uses the existing `SEMANTIC_BACKEND_TOKEN` policy:
send `Authorization: Bearer <token>` when a token is configured. As with the existing
backend, an unset token means authentication is not required. Downloads are restricted
to `DEFAULT_DATASET_IDS` selected by the city launcher.

Authenticated POST requests to `/api/scoring/jobs`, `/api/scoring/jobs/batch`, and
`/api/scoring/arcgis/merged-features/page` return HTTP 403 with
`detail.code: query_submission_disabled`. This includes requests for previously computed
prompts: use the GET catalog/download endpoints instead. Human ratings remain writable.

## Download endpoints

| Endpoint | Content |
| --- | --- |
| `GET /api/scoring/results?dataset_id=...` | Saved-result catalog; omit filter for all enabled datasets |
| `GET /api/scoring/results/{dataset_id}/{prompt_id}/manifest` | Saved metadata and the current backend's tile URL |
| `GET /api/scoring/results/{dataset_id}/{prompt_id}/download.csv` | All scored panorama rows with coordinates and scores |
| `GET /api/scoring/results/{dataset_id}/{prompt_id}/files/{filename}` | Existing `manifest.json`, `score.npy`, `zscore.npy`, or optional `scores.jsonl` |
| `GET /api/scoring/results/{dataset_id}/{prompt_id}/tiles/{z}/{x}/{y}.geojson` | Existing active-result tiles only |
| `GET /api/scoring/results/{dataset_id}/{prompt_id}/revisions/{revision}/tiles/{z}/{x}/{y}.geojson` | Existing revision-specific tiles |

Manifest, file, and CSV endpoints accept `?revision=...`. Catalog URLs include the active
revision when one exists, preventing a later pointer change from silently selecting another
result. Legacy directories without `current.json` are supported. Missing files/tiles return
404; inconsistent/missing score/reference data returns 409. Nothing is computed to fill gaps.
An externally removed revision becomes unavailable and is never silently replaced.

The catalog lists results with both saved score arrays and a matching manifest, reports
available artifact byte sizes, and counts incomplete/unreadable result directories separately.
It does not scan tiles or inspect every array row; CSV validation occurs before streaming.
Catalog byte sizes exclude tiles, references and on-demand CSV serialization.

CSV columns are `dataset_id,prompt_id,result_revision,row_index,pano_id,lon,lat,capture_date,score,zscore`.
The export retains **every saved score row** without viewport, zoom, density, or score filtering.
Reference shards `DATA_ROOT/{dataset_id}/views_emb_shard_*_ref.npy` are read in numeric shard
order, matching scoring row order; their total count must match both arrays and the manifest.
Reference files must match those used when the saved scores were generated; equal row counts
alone cannot detect a replaced/reordered source dataset.
Duplicate pano IDs are preserved. Join by dataset/row and verify coordinates for GIS analysis.
Original reference shards are required for CSV export, but embedding tensors and GPUs are not.
CSV is streamed in small batches with memory-mapped input arrays, without creating an export
copy on the server. Use file endpoints for byte-for-byte array downloads; CSV is a derived export.

## Example commands (server shell or a client with network access)

```bash
BASE_URL="http://127.0.0.1:${PORT:-8000}"
curl --fail --show-error --silent "$BASE_URL/api/capabilities"
curl --fail --show-error --silent \
  -H "Authorization: Bearer ${SEMANTIC_BACKEND_TOKEN:-}" \
  "$BASE_URL/api/scoring/results" -o saved-results.json
```

Choose an entry's `csv_url` from `saved-results.json`, then download it with the same header:

```bash
CSV_PATH=$(python -c 'import json; print(json.load(open("saved-results.json"))["results"][0]["csv_url"])')
curl --fail --show-error --location \
  -H "Authorization: Bearer ${SEMANTIC_BACKEND_TOKEN:-}" \
  "$BASE_URL$CSV_PATH" -o saved-result.csv
```

The first-entry command requires a non-empty catalog. URLs in the catalog are relative to
the backend origin. Use its public origin instead of localhost when downloading remotely.
