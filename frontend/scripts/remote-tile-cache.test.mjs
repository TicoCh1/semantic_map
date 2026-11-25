import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneResources} from '../src/state/sceneResources.ts';
import {isCompleteRemoteTile,loadRemoteViewport,remoteViewportDiff,unavailableRemoteTile} from '../src/state/remoteTileData.ts';
import {updateSemanticLayer,updateSemanticSource} from '../src/state/semanticLayerRenderer.ts';

test('Successful empty tiles and their views retain data identity through repeated small pans',async()=>{
  const cache=new SceneResources();let tileLoads=0,aggregates=0,uploads=0;
  const loaded={type:'FeatureCollection',features:[{properties:{zscore:2}}]};
  async function view(){let complete=true;return cache.load('same-tile-view',async()=>{
    const collections=await Promise.all(['points','empty'].map(key=>cache.load(key,async()=>{
      tileLoads++;return key==='points'?loaded:{type:'FeatureCollection',features:[]};
    },{cacheable:isCompleteRemoteTile})));
    complete=collections.every(isCompleteRemoteTile);aggregates++;
    return {type:'FeatureCollection',features:collections.flatMap(d=>d.features)};
  },{scheduled:false,cacheable:()=>complete})}
  const first=await view(),source={setData(){uploads++}},layer={type:'circle'};
  const map={getSource:()=>source,getLayer:()=>layer,setPaintProperty(){},setLayoutProperty(){},moveLayer(){}};
  for(let i=0;i<20;i++){const data=await view();assert.equal(data,first);updateSemanticLayer(map,'points',data,{'circle-radius':3})}
  assert.equal(tileLoads,2);assert.equal(aggregates,1);assert.equal(uploads,1);
});

for(const status of [202,404])test(`${status} placeholders are retried until real empty content is available`,async()=>{
  const cache=new SceneResources();let calls=0;
  const load=()=>cache.load('tile',async()=>{calls++;return calls===1?unavailableRemoteTile():{type:'FeatureCollection',features:[]}},
    {cacheable:isCompleteRemoteTile});
  assert.equal(isCompleteRemoteTile(await load()),false);
  const ready=await load();assert.equal(isCompleteRemoteTile(ready),true);
  assert.equal(await load(),ready);assert.equal(calls,2);
});

const tile = (x) => ({z: 13, x, y: 0});
const points = (count) => ({
  type: 'FeatureCollection',
  features: Array.from({length: count}, () => ({type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {id: 'shared-pano-id'}}))
});

test('zoom retains its covering source and cross-tile pans reuse the overlap after cache eviction', async () => {
  const cache = new SceneResources(1, 1, 8, data => data.features.length);
  const requests = [];
  const loader = async ({x}) => { requests.push(x); return points(x === 2 ? 10 : 1); };
  const first = await loadRemoteViewport(cache, 'revision-a', [tile(1), tile(2)], loader);
  const zoomed = await loadRemoteViewport(cache, 'revision-a', [tile(2)], loader, first);
  assert.equal(zoomed, first);
  const panned = await loadRemoteViewport(cache, 'revision-a', [tile(2), tile(3)], loader, first);
  assert.deepEqual(requests, [1, 2, 3]);
  assert.equal(panned.features[0], first.features[1]);
  const diff = remoteViewportDiff(first, panned);
  assert.deepEqual(diff.remove, ['13/1/0:0']);
  assert.deepEqual(diff.add.map(feature => feature.id), ['13/3/0:0']);
  assert.equal(new Set(panned.features.map(feature => feature.id)).size, panned.features.length);
  assert.equal(diff.add[0].properties.id, 'shared-pano-id');
  const replacement = await loadRemoteViewport(cache, 'revision-b', [tile(2)], loader, panned);
  assert.equal(remoteViewportDiff(panned, replacement), undefined);
});

test('an incomplete viewport retries and cannot supply coverage for a later zoom', async () => {
  const cache = new SceneResources();
  let calls = 0;
  const load = async () => ++calls === 1 ? unavailableRemoteTile() : points(1);
  const incomplete = await loadRemoteViewport(cache, 'revision', [tile(1)], load);
  const complete = await loadRemoteViewport(cache, 'revision', [tile(1)], load, incomplete);
  assert.equal(complete.features.length, 1);
  assert.equal(remoteViewportDiff(incomplete, complete), undefined);
  assert.equal(calls, 2);
});

test('a pending worker diff coalesces later viewport submissions and serializes a full replacement', async () => {
  const cache = new SceneResources();
  const load = async ({x}) => points(x === 2 ? 10 : 1);
  const first = await loadRemoteViewport(cache, 'revision-a', [tile(1), tile(2)], load);
  const next = await loadRemoteViewport(cache, 'revision-a', [tile(2), tile(3)], load, first);
  const replacement = await loadRemoteViewport(cache, 'revision-b', [tile(2)], load);
  const updates = [];
  let finish;
  const source = {
    updateData(diff) { updates.push(diff); return new Promise(resolve => { finish = resolve; }); },
    setData(data) { updates.push(data); return Promise.resolve(); }
  };
  let current;
  const map = {getSource: () => current, addSource: () => { current = source; }};
  updateSemanticSource(map, 'layer', first, remoteViewportDiff);
  updateSemanticSource(map, 'layer', next, remoteViewportDiff);
  updateSemanticSource(map, 'layer', first, remoteViewportDiff);
  updateSemanticSource(map, 'layer', replacement, remoteViewportDiff);
  assert.deepEqual(updates, [remoteViewportDiff(first, next)]);
  finish();
  await Promise.resolve();
  assert.equal(updates.length, 2);
  assert.equal(updates[1], replacement);
});
