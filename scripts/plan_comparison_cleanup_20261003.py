"""Record completed comparisons and plan the user's results-only local cleanup.

Read-only planning; deletion is performed separately from the saved manifest.
"""
from pathlib import Path
import collections
import csv
import datetime as dt
import json
import os
import re
import sqlite3
import zipfile

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
DOCS = APP / 'docs' / 'references'
DOCS.mkdir(parents=True, exist_ok=True)
INVENTORY = json.loads((Path(os.environ['TEMP']) / 'urbanfabric-size-audit.json').read_text(encoding='utf-8'))
PLAN = []
RETAIN = []
SOURCE_DESCRIPTIONS = {}
CSV_RESULTS = []


def read_json(rel):
    return json.loads((APP / rel).read_text(encoding='utf-8-sig'))


def check_csv(rel, minimum):
    with (APP / rel).open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    assert len(rows) >= minimum, (rel, len(rows))
    return len(rows)


completion = {
    'ucl_queries': check_csv('outputs/semantic_validation_20260731/ucl_legacy_activity_prompt_sweep/ucl_activity_spatial_block_metrics.csv', 85),
    'ucl_grid_sensitivity_rows': check_csv('outputs/semantic_validation_20260731/ucl_legacy_activity_prompt_sweep/grid_scale_sensitivity/ucl_activity_grid_scale_metrics.csv', 340),
    'road_queries': check_csv('outputs/semantic_validation_20260731/road_semantic_validation/road_query_logistic_regression_metrics.csv', 70),
    'green_result_rows': check_csv('outputs/semantic_validation_20260731/green_space_validation/green_space_ndvi_metrics.csv', 23),
    'height_queries': check_csv('outputs/semantic_validation_20260731/lidar_height_prompt_sweep/height_query_metrics.csv', 20),
    'construction_year_queries': check_csv('outputs/semantic_validation_20260731/construction_year_prompt_sweep_20/construction_year_prompt_sweep_metrics.csv', 20),
    'transport_queries': check_csv('outputs/semantic_validation_20260731/expressway_semantic_validation/transport_infrastructure_logistic_metrics.csv', 1),
    'non_qgis_completed_subset_rows': check_csv('outputs/semantic_validation_20260731/validation_metrics_partial_non_qgis.csv', 4),
    'four_city_final_audit': read_json('outputs/four_city_evaluation_20260908/final_audit.json'),
    'four_city_sigmoid_audit': read_json('outputs/four_city_evaluation_20260908/sigmoid_all_prompts/final_audit.json'),
    'four_city_completion': {city: read_json(f'outputs/four_city_evaluation_20260908/{city}/evaluation_complete.json') for city in ['london', 'new_york', 'rome', 'shanghai']},
}
assert completion['four_city_final_audit']['status'] == 'passed'
assert completion['four_city_sigmoid_audit']['status'] == 'passed'
assert all(v['status'] == 'complete' for v in completion['four_city_completion'].values())


def reason(rel):
    p = Path(rel)
    suffix = p.suffix.lower()
    if rel.startswith('app/frontend_pcatsne/dist/data/'):
        source = APP / 'frontend_pcatsne/public_pointcloud/data' / p.relative_to('app/frontend_pcatsne/dist/data')
        target = ROOT / p
        assert source.is_file() and source.stat().st_size == target.stat().st_size, rel
        return 'Explicitly authorized duplicate build data'
    if rel.startswith('app/outputs/semantic_validation_20260731/'):
        if suffix == '.tif':
            return 'Completed comparison: external satellite raster or derived NDVI input'
        if suffix == '.csv' and not any(t in p.name.lower() for t in ['metrics', 'best_', 'decile', 'summary']):
            return 'Completed comparison: raw semantic scores or row-level external reference inputs'
    if rel.startswith('app/data/external_validation/london/') and suffix not in ['.json', '.xlsx', '.md', '.txt']:
        return 'External reference dataset used by completed London analyses'
    if rel.startswith('app/outputs/four_city_validation_20260907/') and suffix in ['.gpkg', '.pbf', '.zip', '.npy', '.npz', '.geojson', '.tif']:
        return 'Four-city GIS reference dataset; downstream evaluation audited complete'
    if rel.startswith('app/outputs/four_city_evaluation_20260908/'):
        if suffix == '.gpkg' or p.name == 'panorama_seed.csv':
            return 'Completed four-city comparison: materialized geographic reference dataset'
        if suffix in ['.npy', '.npz']:
            return 'Completed four-city comparison: row-level scores, masks, identities or external proxy labels'
    if rel in ['london test/qgis/london_highway_.gpkg', 'london test/qgis/london_highway_connected_spa_featured.gpkg']:
        return 'OSM source-road/topology datasets explicitly used in completed road baseline audit'
    return None


def source_schema(path):
    result = {}
    if path.suffix == '.csv':
        with path.open(encoding='utf-8-sig', newline='') as f:
            result['columns'] = next(csv.reader(f), [])
    elif path.suffix == '.gpkg':
        with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as conn:
            result['layers'] = [dict(zip(['table', 'type', 'identifier', 'last_change', 'min_x', 'min_y', 'max_x', 'max_y', 'srs_id'], r)) for r in conn.execute('select table_name,data_type,identifier,last_change,min_x,min_y,max_x,max_y,srs_id from gpkg_contents')]
            for layer in result['layers']:
                table = layer['table'].replace('"', '""')
                layer['columns'] = [{'name': r[1], 'type': r[2]} for r in conn.execute(f'pragma table_info("{table}")')]
    elif path.suffix == '.zip':
        with zipfile.ZipFile(path) as z:
            result['members'] = [{'name': i.filename, 'bytes': i.file_size, 'modified': list(i.date_time)} for i in z.infolist()]
    return result


for rel, _, _ in INVENTORY['files']:
    rel = rel.replace('\\', '/')
    path = ROOT / rel
    relevant = rel.startswith(('app/frontend_pcatsne/dist/data/', 'app/outputs/semantic_validation_20260731/', 'app/data/external_validation/london/', 'app/outputs/four_city_validation_20260907/', 'app/outputs/four_city_evaluation_20260908/')) or rel in ['london test/qgis/london_highway_.gpkg', 'london test/qgis/london_highway_connected_spa_featured.gpkg']
    if not relevant:
        continue
    if not path.is_file():
        continue
    why = reason(rel)
    st = path.stat()
    record = {'path': rel, 'bytes': st.st_size, 'mtime_ns': st.st_mtime_ns, 'last_modified': dt.datetime.fromtimestamp(st.st_mtime).astimezone().isoformat(timespec='seconds')}
    if why:
        record['reason'] = why
        PLAN.append(record)
        if not rel.startswith('app/frontend_pcatsne/dist/data/'):
            SOURCE_DESCRIPTIONS[rel] = source_schema(path)
    elif rel.startswith(('app/outputs/semantic_validation_20260731/', 'app/outputs/four_city_validation_20260907/', 'app/outputs/four_city_evaluation_20260908/')):
        RETAIN.append(record)
        if path.suffix == '.csv':
            with path.open(encoding='utf-8-sig', newline='') as f:
                reader = csv.reader(f)
                header = next(reader, [])
                count = sum(1 for _ in reader)
            CSV_RESULTS.append({'path': rel, 'rows': count, 'columns': header})

# Preserve provenance already recorded by this project; do not copy geometry,
# row-level labels, credentials, or the external datasets into documentation.
provenance = {}
for prefix in ['outputs/semantic_validation_20260731', 'outputs/four_city_validation_20260907', 'outputs/four_city_evaluation_20260908', 'data/external_validation/london']:
    for path in (APP / prefix).rglob('*.json'):
        if path.stat().st_size > 500_000 or any(x in path.parts for x in ['arrays', 'labels', 'references']):
            continue
        if any(word in path.name for word in ['audit', 'metadata', 'method', 'source', 'registry', 'complete', 'final', 'manifest']) or path.name == 'city_config.json':
            value = json.loads(path.read_text(encoding='utf-8-sig'))
            def prune(v):
                if isinstance(v, dict):
                    return {k: prune(x) for k, x in v.items() if k not in ['geometry', 'coordinates', 'features', 'token', 'api_key', 'password']}
                if isinstance(v, list):
                    return [prune(x) for x in v]
                return v
            provenance[path.relative_to(APP).as_posix()] = prune(value)
url_sources = {}
for rel in ['scripts/download_london_validation_data.ps1', 'analysis/semantic_validation/plot_ucl_activity_query_sweep.py', 'analysis/semantic_validation/fetch_four_city_sources.py']:
    text = (APP / rel).read_text(encoding='utf-8')
    url_sources[rel] = sorted(set(re.findall(r'https?://[^\s\"\'<>]+', text)))

groups = collections.defaultdict(lambda: {'files': 0, 'bytes': 0, 'last_modified': ''})
for r in PLAN:
    p = r['path']
    group = '/'.join(p.split('/')[:3]) if p.startswith('app/outputs/') else '/'.join(p.split('/')[:4]) if p.startswith('app/frontend_pcatsne/') else '/'.join(p.split('/')[:3])
    g = groups[group]
    g['files'] += 1
    g['bytes'] += r['bytes']
    g['last_modified'] = max(g['last_modified'], r['last_modified'])

def dump(name, value):
    (DOCS / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

dump('cleanup-plan-20261003.json', {'root': str(ROOT), 'generated_at': dt.datetime.now().astimezone().isoformat(), 'completion': completion, 'groups': dict(groups), 'delete': PLAN, 'retained_results': RETAIN})
dump('comparison-reference-metadata-20261003.json', {'completion': completion, 'provenance': provenance, 'source_file_schemas': SOURCE_DESCRIPTIONS, 'source_urls_in_local_scripts': url_sources, 'retained_csv_results': CSV_RESULTS})

text = '''# Completed comparison references and local data retention — 2026-10-03

This is the dedicated reference page for this project's authorized cleanup.
Keep comparison metrics, figures, reports, conclusions, prompt definitions,
methodology and provenance. Remove downloaded external reference datasets,
their materialized GIS/label/grid inputs, and raw per-record scores after the
comparison is complete. This rule applies across the UrbanFabric root for this
cleanup. Current application assets, project-owned panorama/embedding/PCA
data, human-review records, source code, Git history and inputs without proven
completed comparisons remain protected. No remote files are changed.

The metadata companion records source versions and locations, download dates,
CRS, geometry extents, table schemas, exact prompt IDs, reference definitions,
evaluation masks and method caveats from saved project audits. It contains no
copy of external feature geometry or row-level scoring/label datasets.
Source URLs are historical citations from project records, not a fresh claim
of availability. Rerunning a deleted-input analysis requires fetching its
sources and recomputing its inputs; a current `latest` extract may differ from
the historical version. Historical completion files describe their own dates.

- [Machine-readable provenance, schemas and result inventory](comparison-reference-metadata-20261003.json)
- [Exact cleanup plan, file sizes and last modification times](cleanup-plan-20261003.json)
- [Execution receipt](cleanup-receipt-20261003.json)

## London legacy UCL building activity

Completed: 85 prompts (17 categories × 5 wordings), 85 spatial-block result
rows and 340 grid-scale sensitivity rows. Source: GLA/UCL legacy London
Building Stock Model all-London extract (`legacy_lbsm_all_london.zip`).
Target: local 3 × 3 blocks of 100 m BNG cells; dominant non-domestic activity
UPRN counts; Domestic uses MIX_CLASS 8/9/10 domestic UPRNs. Apply log1p to
counts. Compare mean raw panorama similarity per cell, exclude 1,134
missing-embedding sentinel records per batch, and summarize five deterministic
approximately 2 km held-out spatial blocks. This is agreement with a building
activity proxy, not visual ground truth. Best wording selections remain
exploratory, including grid-scale selections.

Results: `outputs/semantic_validation_20260731/ucl_legacy_activity_prompt_sweep/`.
Keep query/spatial-block/grid sensitivity metrics and best-query tables, all
figures, query catalogue and audits. Delete five raw score-batch CSVs and the
materialized reference-cell CSV. The original downloaded external archive is
also removed after provenance is recorded.

## London roads and transport infrastructure

Completed: 70 road-prompt result rows plus transport infrastructure metrics.
Source roads: OpenStreetMap-derived `london_highway_.gpkg` (EPSG:4326) and
`london_highway_connected_spa_featured.gpkg` (EPSG:27700), originally in
`urbanfabric/london test/qgis/`. Exact layer schemas and previous locations are
recorded before removal. Four-arm/T-junction proximity is 35 m; T junctions use
three arms with maximum angular gap 150–210 degrees. Other labels use recorded
highway/bridge/tunnel rules. Single-score logistic regression uses five
deterministic 2 km spatial-block folds and standardized-slope ridge penalty 10.
Elevated bridge/tunnel transport tests include reverse exclusion definitions;
keep those cautions when interpreting AUC/AP.

Results: `outputs/semantic_validation_20260731/road_semantic_validation/` and
`expressway_semantic_validation/`. Keep metrics, best-category tables, plots,
queries and audits; delete raw score CSVs, per-panorama baseline CSV and the
two cited OSM source/topology databases. Historical QGIS projects can retain
links to removed inputs; they are not standalone data backups.

## London green space, NDVI, height and construction age

Completed result tables: green/NDVI (23 rows), height (20 prompts), and
construction age (20 prompts). Sources: GLA designated open space (699 MOL
features), OSM parks (3,272), Sentinel-2 L2A B04/B08 acquired 2025-09-19,
Environment Agency DSM/DTM at approximately 10 m in EPSG:27700, GLA LBSM2
October 2024 and Historic England NHLE. Reference definitions, Sentinel item
IDs/asset URLs and exact dataset download URLs are preserved in the companion.
MOL/park proximity is inside or within 100 m; NDVI is a vegetation proxy.
Height uses DSM minus DTM and local P90/mean windows; tree canopy is included,
so it is not footprint-masked building height. LBSM2 age is a dwelling-weighted
proxy; nearby NHLE records do not prove panorama visibility.

The root `partial_non_qgis` tables retain their original subset qualification;
they are not renamed as complete all-theme validation. Their existing four
completed result rows and decile tables remain. Keep aggregate metrics, plots,
workbooks and audits; remove per-panorama/grid inputs, raw scores, satellite
rasters and downloaded external sources. Retain the small data dictionary.

## Four-city external GIS validation and evaluation

Cities: London, Shanghai, Rome/Vatican, New York Option A. The September 7
reference-preparation manifest predates scoring and is superseded for cleanup
completion by September 8 city `evaluation_complete.json` and the passed
evaluation `final_audit.json`: 9,837 classification rows and 2,232 ranking rows.
The 175-prompt sigmoid analysis also has a passed final audit (700 city/prompt
runs, 2,100 result rows). Preserve completion evidence and method versions.

References are mapped OSM/geographic proxies, not full visual truth. Metrics
were recomputed at actual panorama coordinates with boundary, source-edge,
unknown and tunnel masks. Primary supported prompts require at least 20
positives/negatives across at least five spatial blocks per class. Historical
scoring groups differ across cities; cross-city transfer is exploratory.
Same-version transfer is primarily London/New York; do not turn the isolated
Shanghai/Rome prompt into a general same-version benchmark.

Results: `outputs/four_city_evaluation_20260908/`; provenance:
`outputs/four_city_validation_20260907/`. Keep aggregate classification,
ranking, cross-city, spatial weighting and sigmoid tables, thresholds,
selected-result/provenance JSON, reports, plots and inspection evidence.
Remove downloaded PBFs, all materialized external-reference GPKGs,
per-panorama seed CSVs and label/distance/identity/score arrays in this completed
evaluation. External provider locations and source-layer audits remain.

## Other project areas assessed

The four September 17 embedding comparisons retain aggregate results and
identity/credibility data needed by the current CPU serving contract; their
large raw score matrices were already removed on September 28. Public-dataset
evaluation results and alignment QC images remain; no full external training
corpus is stored in their local result directory. Project-owned PCA/SAE,
PaCMAP, street panoramas and active frontend/region/presentation resources are
application/research assets, not external comparison reference datasets.
`outputs/qgis_city_study_extents` and remaining London/Shanghai QGIS working
datasets serve study boundaries and sampling development; their completion as
disposable comparisons is unproven, so the new rule does not infer deletion.
Downloaded dataset sample archives are handled only where a completed
comparison and a preserved source reference can be established.

## Planned removals

| Group | Files | GiB | Latest modification (Europe/London) |
| --- | ---: | ---: | --- |
'''
for name, g in sorted(groups.items(), key=lambda x: -x[1]['bytes']):
    text += f"| `{name}` | {g['files']} | {g['bytes']/1024**3:.3f} | {g['last_modified']} |\n"
text += '\nExecution status and exact reclaimed logical bytes are recorded separately in the receipt. No SHA hashes are used.\n'
(DOCS / 'completed-comparison-data-reference.md').write_text(text, encoding='utf-8')
print(json.dumps({'plan_files': len(PLAN), 'GiB': sum(r['bytes'] for r in PLAN)/1024**3, 'groups': dict(groups), 'retained_files': len(RETAIN), 'result_csv_tables': len(CSV_RESULTS)}, indent=2))
