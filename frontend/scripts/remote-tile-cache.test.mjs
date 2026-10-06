import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneResources} from '../src/state/sceneResources.ts';
import {isCompleteRemoteTile,unavailableRemoteTile} from '../src/state/remoteTileData.ts';
import {updateSemanticLayer} from '../src/state/semanticLayerRenderer.ts';

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
