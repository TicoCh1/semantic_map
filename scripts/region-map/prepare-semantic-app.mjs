// Presentation packaging only: reuse RunPod's exported coordinates and scores.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root=process.cwd();
const cases=[['colosseo','colosseo500m_london'],['stpauls','stpauls500m_rome']].map(([id,name])=>{
  const dir=path.join(root,'outputs',`${name}_pca8_20261001`);
  const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  const meta=read('intensity-map-product/intensity-manifest.json');
  const model=read('model-manifest.json'),run=read('run-manifest.json');
  const buffer=zlib.gunzipSync(fs.readFileSync(path.join(dir,'intensity-map-product/intensity.bin.gz')));
  if(buffer.length!==meta.payload_bytes)throw new Error('Atlas length mismatch');
  return {id,dir,meta,model,run,buffer};
});
function inside(point,ring){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
const output=path.join(root,'frontend/public/region-data');
fs.mkdirSync(output,{recursive:true});
const receipts=[];
for(const item of cases){
  const peer=cases.find(other=>other.meta.target_dataset_id===item.meta.source_dataset_id);
  if(!peer)throw new Error('No complete inverse-city coordinate cache');
  const a=item.model.source_snapshot,b=peer.run.target_snapshot;
  if(a.dataset_id!==b.dataset_id||a.count!==b.count||JSON.stringify(a.files)!==JSON.stringify(b.files))throw new Error('Inverse cache dataset revision differs');
  if(item.model.request.source_date_range||peer.run.request.target_date_range||item.model.excluded_rows||peer.run.excluded_rows||peer.meta.point_count!==a.count||item.model.raw_source_rows!==item.model.source_rows)throw new Error('Source cannot be reconstructed exactly from this cache');
  const polygon=item.model.request.source_geometry;
  if(polygon.type!=='Polygon'||polygon.coordinates.length!==1)throw new Error('Unsupported cached source boundary');
  const features=[];
  for(let row=0;row<peer.meta.point_count;row++){
    const coordinate=[peer.buffer.readDoubleLE(row*16),peer.buffer.readDoubleLE(row*16+8)];
    if(!inside(coordinate,polygon.coordinates[0]))continue;
    const id=String(peer.buffer.readDoubleLE(peer.meta.point_count*16+row*8));
    features.push({type:'Feature',geometry:{type:'Point',coordinates:coordinate},properties:{id,pano_id:id,dataset_id:a.dataset_id,global_row:row,reference:true,score:1,colour_value:1}});
  }
  if(features.length!==item.model.source_rows)throw new Error(`Reference count mismatch: ${features.length} / ${item.model.source_rows}`);
  for(const axis of item.model.source_axis_examples||[])for(const example of axis.examples){
    const p=example.point;
    if(!features.some(f=>f.properties.global_row===p.global_row&&f.properties.pano_id===p.pano_id&&f.geometry.coordinates[0]===p.lon&&f.geometry.coordinates[1]===p.lat))throw new Error('Recorded PCA reference example missing');
  }
  const folder=path.join(output,item.id);fs.mkdirSync(folder,{recursive:true});
  fs.copyFileSync(path.join(item.dir,'intensity-map-product/intensity.bin.gz'),path.join(folder,'intensity.bin.gz'));
  const receipt={case:item.id,model_id:item.meta.model_id,source_points:features.length,source_dataset_id:a.dataset_id,coordinate_cache_run:peer.meta.run_id,selection:'original source polygon; identical dataset revision; no date filter or exclusions',axis_examples_verified:(item.model.source_axis_examples||[]).reduce((sum,axis)=>sum+axis.examples.length,0)};
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify({...item.meta,source_references:{type:'FeatureCollection',features},reference_provenance:receipt}));
  receipts.push(receipt);
}
fs.mkdirSync(path.join(root,'outputs/region-comparison-20261002'),{recursive:true});
fs.writeFileSync(path.join(root,'outputs/region-comparison-20261002/reference-packaging.json'),JSON.stringify(receipts,null,2));
console.log(JSON.stringify(receipts));
