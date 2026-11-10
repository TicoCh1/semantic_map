// Cache the default park/gap combination for immediate slider feedback.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {clipLiveRegions,pointIndex} from '../src/potato-live-geometry.js';
const base=resolve(process.argv[2]||'public_pointcloud/data/london_potato_gis_20261002');
const read=name=>readFile(resolve(base,name),'utf8').then(JSON.parse);
const manifestFile=process.argv[3]||'live-manifest.json';
const spec=await read(manifestFile);
const bytes=await readFile(resolve(base,spec.points));
const count=pointIndex(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),spec.bounds,spec.groups);
const masks=await read(spec.masks.find(m=>m.barriers==='parks'&&m.minGreenAreaMeters2===30000&&m.gapMeters===80).mask);
spec.views=[];
for(const frame of spec.frames.filter(f=>f.gapMeters===80)){
  const result=clipLiveRegions(await read(frame.regions),masks,count);
  const key=`${frame.bandwidthMeters}-80-parks-30000-${Math.round(frame.supportMass*100)}`,file=`${spec.version}/view-${key}.json`;
  const metricFile=`${spec.version}/metric-${key}.json`;
  await writeFile(resolve(base,metricFile),JSON.stringify(result.metric));
  const {metric,...displayResult}=result;
  await writeFile(resolve(base,file),JSON.stringify(displayResult));
  spec.views.push({key,result:file,metric:metricFile});
  console.log(`${frame.bandwidthMeters} m / ${Math.round(frame.supportMass*100)}%: ${result.geo.features.length} pieces (${result.elapsedMs.toFixed(0)} ms)`);
}
await writeFile(resolve(base,manifestFile),JSON.stringify(spec));
