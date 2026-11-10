import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pointIndex,clipLiveRegions,insidePolygon,polygonBounds,polygonArea} from '../src/potato-live-geometry.js';
import {toBng,toWgs84} from '../src/potato-bng.js';
const rectangle=(x0,y0,x1,y1)=>[[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]]];
const frameOf=coordinates=>({type:'FeatureCollection',coordinateSystem:'EPSG:27700',features:[{type:'Feature',id:'a',geometry:{type:'Polygon',coordinates},properties:{group:1,label:'S1',color:'red'}}]});

test('BNG transformation matches installed Python PROJ at the London center',()=>{
  const expected=[530867.930321356,180717.6570053649],actual=toBng([-.11559,51.51024]);
  assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<.1);
  const back=toWgs84(expected);
  assert.ok(Math.abs(back[0]+.11559)<1e-6&&Math.abs(back[1]-51.51024)<1e-6);
});
test('BNG area is metric, preserves holes and is stable at large coordinates',()=>{
  assert.equal(polygonArea(rectangle(530000,180000,530050,180050)),2500);
  assert.equal(polygonArea([...rectangle(530000,180000,531000,181000),...rectangle(530100,180100,530200,180200)]),990000);
});
test('GIS subtraction splits in BNG, excludes points and converts only for display',()=>{
  const coordinates=rectangle(530000,180000,531000,181000),mask=rectangle(530450,179000,530550,182000);
  const records=new ArrayBuffer(4*18),view=new DataView(records);
  [[530250,180500],[530750,180500],[530500,180500],[532000,180500]].forEach(([x,y],i)=>{
    view.setFloat64(i*18,x,true);view.setFloat64(i*18+8,y,true);view.setUint16(i*18+16,0,true);
  });
  const count=pointIndex(records,{west:530000,east:533000,south:179000,north:182000},1);
  const result=clipLiveRegions(frameOf(coordinates),[{coordinates:mask,bbox:polygonBounds(mask)}],count);
  assert.equal(result.metric.features.length,2);
  assert.equal(result.geo.features.reduce((s,f)=>s+f.properties.matchingPoints,0),2);
  assert.equal(result.metric.features.reduce((s,f)=>s+f.properties.areaKm2,0),.9);
  assert.ok(!result.metric.features.some(f=>insidePolygon(530500,180500,f.geometry.coordinates)));
  for(const label of result.labels.features)assert.ok(result.geo.features.some(f=>insidePolygon(...label.geometry.coordinates,f.geometry.coordinates)));
  assert.ok(result.geo.features[0].geometry.coordinates[0][0][0]<1);
});
test('positive tiny fragments survive the final stage rather than leaving a blank',()=>{
  const result=clipLiveRegions(frameOf(rectangle(530000,180000,530002,180002)),[]);
  assert.equal(result.metric.features.length,1);
  assert.equal(result.metric.features[0].properties.areaKm2,4e-6);
});
test('longitude/latitude cannot enter the metric clipping pipeline',()=>{
  assert.throws(()=>clipLiveRegions({type:'FeatureCollection',features:[]},[]),/British National Grid/);
});
test('real London endpoint frames clip for both density policies',async()=>{
  const base=new URL('../public_pointcloud/data/london_potato_gis_20261002/',import.meta.url);
  const manifestFile=process.env.POTATO_TEST_MANIFEST||'live-manifest.json';
  const spec=JSON.parse(await readFile(new URL(manifestFile,base),'utf8'));
  assert.equal(spec.coordinateSystem,'EPSG:27700');assert.equal(spec.grid.cellSizeMeters,50);
  const bytes=await readFile(new URL(spec.points,base));
  const index=pointIndex(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),spec.bounds,spec.groups);
  const masks=JSON.parse(await readFile(new URL(spec.masks.find(m=>m.barriers==='parks'&&m.gapMeters===80&&m.minGreenAreaMeters2===30000).mask,base),'utf8'));
  for(const meters of [100,500])for(const mass of [.9,1]){
    const item=spec.frames.find(f=>f.bandwidthMeters===meters&&f.gapMeters===80&&f.supportMass===mass);
    const frame=JSON.parse(await readFile(new URL(item.regions,base),'utf8'));
    const result=clipLiveRegions(frame,masks,index);
    assert.ok(result.geo.features.length>0);
    for(const label of result.labels.features)assert.ok(result.geo.features.some(f=>f.properties.group===label.properties.group&&insidePolygon(...label.geometry.coordinates,f.geometry.coordinates)));
    console.log(`${meters} m / ${mass}: ${result.geo.features.length} pieces, ${result.elapsedMs.toFixed(0)} ms`);
  }
});

