import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/state/localProject.ts', import.meta.url), 'utf8');
const start = source.indexOf('async function remoteRerankRange(');
const end = source.indexOf('export async function resumeRemoteScoringJobs', start);
assert.ok(start >= 0 && end > start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;
const paintSource = readFileSync(new URL('../src/state/mapStyle.ts', import.meta.url), 'utf8');
const paintCode = ts.transpileModule(paintSource.slice(paintSource.indexOf('export function colorExpression'),
  paintSource.indexOf('export function circleRadiusExpression')).replace('export function', 'function'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 }
}).outputText;

function fixture({ enabled = true, direct = true, mode = 'gpu', queued = false,
  centerMethod = 'logit_zero',
  correlations = {n:64,pearson_r:.7,spearman_rho:.8,bicor:.9,bicor_c:9,agreement_percent:80,status:'defined'},
  range = { mean: 3.21, lower: 1.21, upper: 5.21, field: 'zscore' } } = {}) {
  const calls = [];
  const layer = { id: 'layer', style: { score_min: -1, score_max: 3, opacity: .75, colors: ['blue', 'red'] } };
  const context = vm.createContext({
    performance, ACTIVE_REMOTE_POLLS: new Set(),
    resolveRemoteUrl: (_, path) => path,
    remoteAuthHeaders: () => ({}),
    fetchRemoteWithTimeout: async (path, options) => {
      calls.push({ path, options });
      return { status: 200, ok: true, json: async () => path.endsWith('capabilities')
        ? { enabled } : queued && options?.method === 'POST'
          ? { status: 'queued', job_id: 'calibration' }
          : { status: 'ready', job_id:'calibration', color_range: range,
            calibration: { center_method:centerMethod, correlations } } };
    },
    emitRemoteJobLog() {}, emitRemoteInfoLog() {}, delay: async () => {},
    loadStateSync: () => ({ layers: [layer] }),
    updateLayerSync: (_, update) => Object.assign(layer, update),
    sourcePathsFromReadyJob: () => direct ? { primarySourcePath: '/revision/tiles', sourcePaths: { london: '/revision/tiles' } } : undefined,
    getRemoteResultManifests: async () => [{ tile_url_template: '/manifest/tiles', zscore_property: 'zscore' }],
    sourcePathsFromManifests: () => ({ london: '/manifest/tiles' })
  });
  vm.runInContext(code, context);
  const job = { job_id: 'retrieval', prompt: 'trees', status: 'ready', query_type: 'text', results: [{ dataset_id: 'london', prompt_id: 'trees', result_revision: 'immutable' }] };
  return { calls, layer, run: () => context.pollRemoteScoringJob({ mode }, 'layer', job) };
}

test('No GPU skips calibration submission and retains existing colour bounds', async () => {
  const f = fixture({ enabled: false });
  await f.run();
  assert.equal(f.calls.length, 1);
  assert.equal(f.layer.status, 'ready');
  assert.equal(f.layer.style.score_min, -1);
  assert.equal(f.layer.style.score_max, 3);
});

for (const direct of [true, false]) {
  test(`Applies fitted bounds and preserves gradient settings via ${direct ? 'revision URLs' : 'manifest fallback'}`, async () => {
    const f = fixture({ direct });
    await f.run();
    assert.equal(f.layer.style.score_min, 1.21);
    assert.equal(f.layer.style.score_max, 5.21);
    assert.equal(f.layer.style.opacity, .75);
    assert.deepEqual(f.layer.style.colors, ['blue', 'red']);
    assert.equal(f.layer.score_property, 'zscore');
    assert.equal(f.layer.status, 'ready');
    assert.equal(f.calls[1].options.method, 'POST');
    assert.equal(JSON.parse(f.calls[1].options.body).results[0].result_revision, 'immutable');
    assert.equal(JSON.parse(f.calls[1].options.body).sampling, 'uniform_zscore_64');
    assert.equal(f.layer.rerank_calibration.correlations.agreement_percent, 80);
    assert.equal(f.layer.rerank_calibration.correlations.bicor, .9);
    assert.equal(f.layer.rerank_calibration.center_method, 'logit_zero');
  });
}

test('Empty sampled evidence retains the current bounds', async () => {
  const f = fixture({ range: null });
  await f.run();
  assert.equal(f.layer.style.score_min, -1);
  assert.equal(f.layer.style.score_max, 3);
  assert.equal(f.layer.status, 'ready');
});

for (const [centerMethod,mean] of [['all_negative_max_score',4],['all_positive_min_score',-5]]) {
  test(`Endpoint fallback is stored and paints the backend range: ${centerMethod}`, async () => {
    const f = fixture({centerMethod, range:{mean,lower:mean-2,upper:mean+2,field:'zscore'}});
    await f.run();
    assert.equal(f.layer.style.score_min,mean-2);
    assert.equal(f.layer.style.score_max,mean+2);
    assert.equal(f.layer.rerank_calibration.center_method,centerMethod);
    assert.equal(f.layer.rerank_calibration.color_range.mean,mean);
  });
}

test('Undefined correlations stay N/A while valid bounds are applied', async () => {
  const f = fixture({correlations:{n:64,pearson_r:null,spearman_rho:null,bicor:null,
    bicor_c:9,agreement_percent:null,status:'undefined'}});
  await f.run();
  assert.equal(f.layer.rerank_calibration.correlations.agreement_percent,null);
  assert.equal(f.layer.style.score_min,1.21);
});

test('Malformed statistics are omitted without losing valid colour bounds', async () => {
  const f = fixture({correlations:{pearson_r:2,spearman_rho:.8,bicor:.9,agreement_percent:150}});
  await f.run();
  assert.equal(f.layer.rerank_calibration.correlations,undefined);
  assert.equal(f.layer.style.score_min,1.21);
});

test('A queued calibration is polled before applying the returned z-score bounds', async () => {
  const f = fixture({ queued: true });
  await f.run();
  assert.equal(f.calls[2].path, '/api/scoring/calibration/jobs/calibration');
  assert.equal(f.layer.style.score_min, 1.21);
  assert.equal(f.layer.style.score_max, 5.21);
});

test('Returned GPU bounds become the actual map paint endpoints and midpoint', async () => {
  const f = fixture({ queued: true });
  await f.run();
  const context = vm.createContext({ clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) });
  vm.runInContext(paintCode, context);
  const paint = context.colorExpression({ score_min:-1, score_max:3,
    stops:[{value:0,color:'blue'}, {value:.5,color:'yellow'}, {value:1,color:'red'}] }, f.layer);
  assert.deepEqual(JSON.parse(JSON.stringify(paint)),
    ['interpolate', ['linear'], ['get','zscore'], 1.21,'blue',3.21,'yellow',5.21,'red']);
});

test('Cached retrieval layers stay resumable until range calibration finishes', async () => {
  const submitStart = source.indexOf('async function submitRemoteScoringForLayer(');
  const submitEnd = source.indexOf('export async function ensureExhibitDefaultRemoteLayers', submitStart);
  const submitCode = ts.transpileModule(source.slice(submitStart, submitEnd), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const layer = { id:'cached', prompt:'bridge', status:'ready' };
  let polled = false;
  const context = vm.createContext({
    cityConfigsForRemoteBackend: () => [{id:'london'}],
    updateLayerSync: (_, patch) => Object.assign(layer, patch),
    priorityTilesLabel: () => '', emitRemoteInfoLog() {}, emitRemoteJobLog() {},
    submitRemoteScoringJob: async () => ({job_id:'ready',status:'ready',query_type:'text'}),
    layerStatusFromRemoteJob: s => s, pendingJobSource: id => `remote://job/${id}`,
    pollRemoteScoringJob: () => { polled = true; }
  });
  vm.runInContext(submitCode, context);
  await context.submitRemoteScoringForLayer({}, layer);
  assert.equal(polled, true);
  assert.equal(layer.status, 'running');
  assert.equal(layer.source_path, 'remote://job/ready');
});

test('Reload resumes an older ready layer whose source still points at a pending job', async () => {
  const resumeEnd = source.indexOf('function layerStatusFromRemoteJob', end);
  const resumeCode = ts.transpileModule(source.slice(end, resumeEnd).replace('export async', 'async'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const layer = {id:'older',status:'ready',source_path:'remote://job/ready'};
  const calls = [];
  const context = vm.createContext({
    loadRemoteBackendConfigSync: () => ({enabled:true,baseUrl:'https://pod',mode:'gpu'}),
    loadStateSync: () => ({layers:[layer]}), isRemoteTileTemplate: () => false,
    parsePendingJobSource: () => 'ready', isLegacyPendingSource: () => false,
    updateLayerSync: (_,patch) => Object.assign(layer,patch),
    getRemoteScoringJob: async () => ({job_id:'ready',status:'ready'}),
    pollRemoteScoringJob: (...args) => calls.push(args)
  });
  vm.runInContext(resumeCode, context);
  await context.resumeRemoteScoringJobs();
  assert.equal(layer.status,'running');
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'older');
});

test('Default exhibit layers retain pending GPU job sources during state normalization', () => {
  const fallbackStart = source.indexOf('function applyStaticFallbackToExhibitLayers(');
  const fallbackEnd = source.indexOf('function normalizeState(', fallbackStart);
  const fallbackCode = ts.transpileModule(source.slice(fallbackStart, fallbackEnd), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const context = vm.createContext({
    loadRemoteBackendConfigSync: () => ({enabled:true,baseUrl:'https://pod'}),
    exhibitSpecForLayer: () => ({staticDataKey:'brick'}),
    layerSourcePathCandidates: layer => [layer.source_path],
    isRemoteTileTemplate: () => false, isStaticFallbackTileTemplate: () => false,
    parsePendingJobSource: () => 'ready', isLegacyPendingSource: () => false,
    staticFallbackSources: () => { throw new Error('Pending GPU jobs must not become static fallback'); }
  });
  vm.runInContext(fallbackCode,context);
  const state = {layers:[{source_path:'remote://job/ready',status:'running'}]};
  assert.equal(context.applyStaticFallbackToExhibitLayers(state),state);
});

test('CPU mode skips reranking even if the remote machine advertises a GPU', async () => {
  const f = fixture({ mode: 'cpu' });
  await f.run();
  assert.equal(f.calls.length, 0);
  assert.equal(f.layer.style.score_min, -1);
});

for (const range of [
  { mean: 3, lower: 1, upper: 5, field: 'score' },
  { mean: 8, lower: 1, upper: 5, field: 'zscore' },
  { mean: 3, lower: 5, upper: 1, field: 'zscore' },
  { mean: 3, lower: 1, upper: Infinity, field: 'zscore' }
]) {
  test(`Malformed calibration bounds are not used: ${JSON.stringify(range)}`, async () => {
    const f = fixture({ range });
    await f.run();
    assert.equal(f.layer.style.score_min, -1);
    assert.equal(f.layer.style.score_max, 3);
    assert.equal(f.layer.status, 'ready');
  });
}
