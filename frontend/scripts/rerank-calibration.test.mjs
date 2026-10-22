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
  return { calls, layer, context, job, run: () => context.pollRemoteScoringJob({ mode }, 'layer', job) };
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

test('CPU saved jobs apply an embedded zero-centre calibration without contacting the GPU API', async () => {
  const f = fixture({mode:'cpu'});
  f.job.rerank_calibration = {job_id:'cached',color_range:{mean:0,lower:-2,upper:2,field:'zscore'},center_method:'logit_zero'};
  await f.run();
  assert.equal(f.calls.length,0);
  assert.equal(f.layer.style.score_min,-2);
  assert.equal(f.layer.style.score_max,2);
  assert.equal(f.layer.rerank_calibration.color_range.mean,0);
  assert.equal(f.layer.rerank_calibration_status,'ready');
});

function recoveryFixture(mode='gpu') {
  const f=fixture({mode});
  const config={baseUrl:'https://pod.example',enabled:true,mode};
  const refs=['london','shanghai','new_york','rome'].map(dataset=>({dataset_id:dataset,prompt_id:'trees',
    result_revision:'saved-'+dataset,manifest_url:`/api/scoring/results/${dataset}/trees/revisions/saved-${dataset}/manifest`,
    tile_url_template:`https://pod.example/api/scoring/results/${dataset}/trees/revisions/saved-${dataset}/tiles/{z}/{x}/{y}.geojson`}));
  Object.assign(f.layer,{id:'layer',prompt:'trees',created_at:'2026-10-22T00:00:00Z',query_type:'text',status:'ready',
    source_path:refs[0].tile_url_template,source_paths:Object.fromEntries(refs.map(r=>[r.dataset_id,r.tile_url_template])),
    remote_result_refs:refs});
  Object.assign(f.context,{URL,Date,loadRemoteBackendConfigSync:()=>config,
    isRemoteTileTemplate:path=>path.startsWith('https://'),utcNow:()=>new Date().toISOString(),
    remoteJsonHeaders:()=>({'Content-Type':'application/json'}),
    acceptedJobFromBatchResponse:body=>body.queries[0].job});
  const begin=source.indexOf('function immutableLayerResults(');
  const finish=source.indexOf('function layerStatusFromRemoteJob',begin);
  vm.runInContext(ts.transpileModule(source.slice(begin,finish).replace('export async','async'),
    {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,f.context);
  return {...f,refs,config};
}

async function finishRecovery(f) {
  await f.context.resumeRemoteScoringJobs();
  for(let i=0;i<30 && f.context.ACTIVE_REMOTE_POLLS.size;i++) await new Promise(setImmediate);
  assert.equal(f.context.ACTIVE_REMOTE_POLLS.size,0,'recovery should finish');
}

test('a ready GPU tile layer recovers calibration against its original immutable result references',async()=>{
  const f=recoveryFixture();
  Object.assign(f.layer,{rerank_calibration_status:'failed',rerank_calibration_retry_after:0});
  const sourceBefore=f.layer.source_path;
  await finishRecovery(f);
  assert.equal(f.layer.style.score_min,1.21);
  assert.equal(f.layer.style.score_max,5.21);
  assert.equal(f.layer.source_path,sourceBefore);
  assert.equal(f.layer.status,'ready');
  assert.equal(f.calls.length,2);
  assert.deepEqual(JSON.parse(f.calls[1].options.body).results.map(r=>r.result_revision),f.refs.map(r=>r.result_revision));
  assert.ok(f.calls.every(call=>!call.path.endsWith('/scoring/jobs/batch')));
});

test('transient calibration failure keeps retrieval ready and schedules a separate retry',async()=>{
  const f=fixture();
  f.context.fetchRemoteWithTimeout=async()=>({status:403,ok:false});
  await f.run();
  assert.equal(f.layer.status,'ready');
  assert.equal(f.layer.rerank_calibration_status,'failed');
  assert.ok(f.layer.rerank_calibration_retry_after>Date.now());
  assert.equal(f.layer.style.score_min,-1);
});

test('CPU tile recovery accepts cached calibration only when all four source revisions match',async()=>{
  const f=recoveryFixture('cpu');
  const calls=[];
  f.context.fetchRemoteWithTimeout=async(path,options)=>{
    calls.push({path,body:JSON.parse(options.body)});
    return {ok:true,status:200,json:async()=>({queries:[{status:'accepted',job:{...f.job,status:'ready',results:f.refs,
      rerank_calibration:{job_id:'saved-fit',color_range:{mean:4,lower:2,upper:6,field:'zscore'},center_method:'logit_zero'}}}]})};
  };
  await finishRecovery(f);
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/api/scoring/jobs/batch');
  assert.deepEqual(calls[0].body.queries[0].dataset_ids,f.refs.map(r=>r.dataset_id));
  assert.equal(f.layer.style.score_min,2);
  assert.equal(f.layer.style.score_max,6);
  assert.equal(f.layer.rerank_calibration_status,'ready');
});

test('CPU recovery refuses cached bounds for a changed source revision',async()=>{
  const f=recoveryFixture('cpu');
  f.context.fetchRemoteWithTimeout=async()=>({ok:true,status:200,json:async()=>({queries:[{job:{...f.job,status:'ready',
    results:f.refs.map((ref,i)=>i===0?{...ref,result_revision:'new-source'}:ref),
    rerank_calibration:{color_range:{mean:4,lower:2,upper:6,field:'zscore'}}}}]})});
  await finishRecovery(f);
  assert.equal(f.layer.style.score_min,-1);
  assert.equal(f.layer.rerank_calibration_status,'unavailable');
  assert.equal(f.layer.rerank_calibration,undefined);
});

test('old embedding tile URLs are never sent for new-embedding calibration recovery',async()=>{
  const f=recoveryFixture('cpu');
  f.layer.source_paths=Object.fromEntries(f.refs.map(ref=>[ref.dataset_id,ref.tile_url_template+'?embedding=old']));
  await finishRecovery(f);
  assert.equal(f.calls.length,0);
  assert.equal(f.layer.style.score_min,-1);
});

test('retry backoff and already calibrated layers do not issue repeated calibration requests',async()=>{
  const f=recoveryFixture();
  f.layer.rerank_calibration_retry_after=Date.now()+60_000;
  await finishRecovery(f);
  assert.equal(f.calls.length,0);
  f.layer.rerank_calibration_retry_after=0;
  f.layer.rerank_calibration={color_range:{mean:3,lower:1,upper:5,field:'zscore'}};
  await finishRecovery(f);
  assert.equal(f.calls.length,0);
});

test('embedding comparison keeps the new calibration off old and difference panes',()=>{
  const text=readFileSync(new URL('../src/state/useEmbeddingComparison.ts',import.meta.url),'utf8');
  const snippet=ts.transpileModule(text.slice(text.indexOf('export function useEmbeddingComparison('))
    .replace('export function','function'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const layer={id:'trees',prompt:'trees',name:'Trees',score_property:'zscore',style:{score_min:2,score_max:6},
    rerank_calibration:{color_range:{mean:4,lower:2,upper:6,field:'zscore'}},rerank_uncalibrated_range:{lower:-1,upper:3}};
  const config={baseUrl:'https://pod.example'},city={id:'london',datasetId:'london'};
  const key=JSON.stringify([config.baseUrl,city.datasetId,layer.prompt]);
  const context=vm.createContext({URL,useEffect(){},useMemo:callback=>callback(),
    useState:()=>[{key,result:{matched_count:1,results:['old','new','difference'].map(embedding=>({embedding,
      tile_url_template:`/tiles/{z}/{x}/{y}.geojson?embedding=${embedding}`}))}},()=>{}]});
  vm.runInContext(snippet,context);
  const [old,current,difference]=context.useEmbeddingComparison(true,config,city,layer).paneLayers.map(layers=>layers[0]);
  assert.equal(old.style.score_min,-1);assert.equal(old.style.score_max,3);
  assert.equal(old.rerank_calibration,null);
  assert.equal(current.style.score_min,2);assert.equal(current.style.score_max,6);
  assert.equal(current.rerank_calibration.color_range.mean,4);
  assert.equal(difference.style.score_min,-3);assert.equal(difference.style.score_max,3);
  assert.equal(difference.rerank_calibration,null);
});

test('only a listed retired default is migrated and its token is never forwarded',()=>{
  const begin=source.indexOf('function loadRemoteBackendConfigSync(');
  const end=source.indexOf('function saveRemoteBackendConfigSync(',begin);
  const snippet=ts.transpileModule(source.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let raw={baseUrl:'https://retired.example',token:'old-secret',enabled:true,datasetIds:['old']};
  let override='';
  const context=vm.createContext({REMOTE_BACKEND_KEY:'backend',readJson:()=>raw,writeJson:(_,next)=>{raw=next;},
    urlBackendOverride:()=>override,withCachedBackendCapabilities:config=>config,
    exhibitConfig:{lockRunpodUrl:false},normalizeBackendBaseUrl:url=>url.replace(/\/+$/,''),
    normalizeDatasetIds:value=>value??[],normaliseCityConfigs:value=>value??[],
    runtimeConfig:{retiredBackendUrls:['https://retired.example'],remoteBackendEnabled:true},
    DEFAULT_REMOTE_BACKEND_URL:'https://current.example',DEFAULT_REMOTE_DATASET_ID:'new',
    DEFAULT_REMOTE_DATASET_IDS:['new'],DEFAULT_REMOTE_DATASET_GROUP_ID:'four'});
  vm.runInContext(snippet,context);
  const migrated=context.loadRemoteBackendConfigSync();
  assert.equal(migrated.baseUrl,'https://current.example');assert.equal(migrated.token,'');
  raw={baseUrl:'https://custom.example',token:'custom-secret',enabled:true};
  assert.equal(context.loadRemoteBackendConfigSync().baseUrl,'https://custom.example');
  assert.equal(context.loadRemoteBackendConfigSync().token,'custom-secret');
  override='https://retired.example';
  assert.equal(context.loadRemoteBackendConfigSync().baseUrl,'https://retired.example');
});
