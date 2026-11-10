// Extract geographic polygons from the same maximum-detail GIS tiles as the map.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {VectorTile}=require('@mapbox/vector-tile');
const Pbf=require('pbf');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=path.join(root,'frontend_pcatsne/public_pointcloud/data/london_potato_gis_20261002');
const cache=path.join(root,'outputs/potato-20261002/cache/landcover-tiles');
await fs.mkdir(cache,{recursive:true});
const manifest=JSON.parse(await fs.readFile(path.join(base,'manifest.json'),'utf8'));
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r;}
const tilejson=await (await get('https://tiles.openfreemap.org/planet')).json();
const z=tilejson.maxzoom,n=2**z;
const x=lon=>Math.floor((lon+180)/360*n);
const y=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
const b=manifest.bounds,tasks=[];
for(let tx=x(b.west);tx<=x(b.east);tx++)for(let ty=y(b.north);ty<=y(b.south);ty++)tasks.push([tx,ty]);
let next=0,complete=0;const features=[];
const version=tilejson.tiles[0].split('/').at(-4);
console.log(`Extracting water/park GIS geometry from ${tasks.length} tiles at z${z} (${version})`);
await Promise.all(Array.from({length:8},async()=>{
  while(next<tasks.length){
    const [tx,ty]=tasks[next++];const file=path.join(cache,`${version}-${z}-${tx}-${ty}.pbf`);
    let bytes;
    try{bytes=await fs.readFile(file);}catch(e){
      const url=tilejson.tiles[0].replace('{z}',z).replace('{x}',tx).replace('{y}',ty);
      bytes=Buffer.from(await (await get(url)).arrayBuffer());await fs.writeFile(file,bytes);
    }
    const tile=new VectorTile(new Pbf(bytes));
    for(const layerName of ['water','waterway','landuse','landcover','park']){
      const layer=tile.layers[layerName];if(!layer)continue;
      for(let i=0;i<layer.length;i++){
        const source=layer.feature(i),p=source.properties;
        if(p.brunnel==='tunnel')continue;
        const water=layerName==='water';
        const line=layerName==='waterway'&&['river','canal'].includes(p.class);
        const park=layerName==='park'||(layerName==='landuse'&&p.class==='park')||
          (layerName==='landcover'&&['park','nature_reserve','recreation_ground'].includes(p.subclass));
        if(!water&&!line&&!park)continue;
        if(!line&&source.type!==3)continue;
        if(line&&source.type!==2)continue;
        const geo=source.toGeoJSON(tx,ty,z);
        features.push({...geo,properties:{kind:water||line?'water':'park',sourceLayer:layerName,
          class:p.class,subclass:p.subclass,name:p.name||'',tile:`${z}/${tx}/${ty}`,vectorId:source.id,
          centerlineSupplement:line,widthMeters:line?(p.class==='river'?20:12):undefined,estimated:line}});
      }
    }
    if(++complete%25===0||complete===tasks.length)console.log(`${complete}/${tasks.length} GIS tiles decoded`);
  }
}));
const output=path.join(root,'outputs/potato-20261002/cache/vector-landcover.geojson');
await fs.writeFile(output,JSON.stringify({type:'FeatureCollection',features,
  urbanfabricSource:{source:'OpenFreeMap / OpenMapTiles / OpenStreetMap contributors',
    tilejson:'https://tiles.openfreemap.org/planet',tileTemplate:tilejson.tiles[0],
    retrievedAt:new Date().toISOString(),tileZoom:z,tiles:tasks.length,
    policy:'Same maximum-detail GIS vector tiles as the basemap; water, river/canal lines, landuse=park, park layer, landcover subclasses park/nature_reserve/recreation_ground; ordinary garden/grass/wood classes excluded; generalized tile geometry, not cadastral boundaries.'}}));
console.log(`${features.length} source features saved to ${output}`);
