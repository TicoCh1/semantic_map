import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import './potato-gis.css';
import { geographicPointsLayer } from './potato-gis-points.js';
import { LivePotatoRegions } from './potato-live.js';
import { saeInspector } from './potato-sae.js';

const base='./data/london_potato_gis_20261002/';
const $=(id)=>document.getElementById(id);
let manifest,liveManifest,liveRegions,points,revision=0,ready=false,updateTimer,downloadUrl,lastRenderKey,lastRenderStatus,currentGeo;
const cache=new Map();
function load(name,type='json') {
  if(cache.has(name)){
    const existing=cache.get(name);cache.delete(name);cache.set(name,existing);return existing;
  }
  if(!cache.has(name)) cache.set(name,fetch(base+name).then(r=>{
    if(!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return type==='json'?r.json():r.arrayBuffer();
  }));
  const frames=[...cache.keys()].filter(k=>k.includes('/bubbles-')||k.includes('/view-'));
  while(frames.length>8)cache.delete(frames.shift());
  return cache.get(name);
}
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/dark',
  center:[-.11559,51.51024],zoom:11.8,minZoom:8,maxZoom:18,attributionControl:true});
map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');
const saeKey='500-80-parks-30000-100';
const evidencePadding=()=>({left:innerWidth<=1100?30:Math.min(410,innerWidth*.28),right:Math.min(470,innerWidth*.55),top:70,bottom:100});
const sae=saeInspector({
  isAligned:()=>lastRenderKey===saeKey,
  async activate(){
    if(!ready)throw new Error('Map regions are still loading');
    $('bandwidth').value='500';$('bandwidth-output').textContent='500 m';$('density-mass').value='1';
    $('bubble-gap').value='80';$('gis-barriers').value='parks';$('min-green-area').value='30000';
    await changeRegions();
  },
  onSelect(id,feature){
    if(!ready)return;const f=feature||currentGeo?.features.find(f=>String(f.id)===id);
    const group=f?.properties.group;
    const shared=group!=null?currentGeo.features.filter(b=>String(b.properties.group)===String(group)):f?[f]:[];
    map.getSource('sae-selection').setData({type:'FeatureCollection',features:shared});
    $('sae-group-status').textContent=group!=null?`All ${shared.length} bubbles in semantic group S${group} are highlighted.`:'';
  },
  onFocus(id,feature){
    if(!ready)return;const f=feature||currentGeo?.features.find(f=>String(f.id)===id);
    if(f){
      const bounds=new maplibregl.LngLatBounds();
      const extend=coords=>{if(typeof coords[0]==='number')bounds.extend(coords);else coords.forEach(extend);};
      extend(f.geometry.coordinates);
      map.fitBounds(bounds,{padding:evidencePadding(),maxZoom:15,duration:450});
    }
  },
});
$('sae-explore').onclick=()=>void sae.explore().catch(error=>{$('gis-status').textContent=error.message;});
function fail(error){$('gis-status').setAttribute('role','alert');$('gis-status').textContent=`Unable to load GIS regions: ${error.message}`;}
function fit(){const b=manifest.bounds;const left=Math.min(400,map.getContainer().clientWidth*.35);map.fitBounds([[b.west,b.south],[b.east,b.north]],{padding:{top:50,bottom:70,left,right:50},duration:600});}
function selectedLayer(){
  return liveManifest.frames.find(l=>l.bandwidthMeters===Number($('bandwidth').value)&&l.gapMeters===Number($('bubble-gap').value)&&l.supportMass===Number($('density-mass').value));
}
function selectedMask(){
  const mode=$('gis-barriers').value;
  return liveManifest.masks.find(l=>l.barriers===mode&&l.gapMeters===Number($('bubble-gap').value)&&(mode==='water'||l.minGreenAreaMeters2===Number($('min-green-area').value)));
}
function selectedLandcover(){return manifest.landcoverBlobs.find(l=>l.minGreenAreaMeters2===Number($('min-green-area').value));}
function parkLandcover(landcover){
  return {...landcover,features:landcover.features.filter(feature=>feature.properties.kind==='park')};
}
function landcoverVisibility(){
  const mode=$('gis-barriers').value;
  for(const id of ['potato-parks','potato-landcover-shadow','potato-landcover-rim']){
    map.setLayoutProperty(id,'visibility',mode==='parks'?'visible':'none');
  }
  $('min-green-area').disabled=mode!=='parks';
}
async function changeRegions() {
  if(!ready) return;
  const updateStarted=performance.now();
  const version=++revision;
  const layer=selectedLayer();
  if(!layer)throw new Error('The requested smoothing frame is unavailable');
  const mode=$('gis-barriers').value,mask=selectedMask();
  const key=`${layer.bandwidthMeters}-${layer.gapMeters}-${mode}-${$('min-green-area').value}-${Math.round(layer.supportMass*100)}`;
  if(key===lastRenderKey){$('gis-status').textContent=lastRenderStatus;return;}
  $('gis-status').textContent=`Updating ${layer.bandwidthMeters} m contours…`;
  const cover=selectedLandcover();
  const saved=liveManifest.views?.find(v=>v.key===key);
  const geometry=saved?load(saved.result):Promise.all([load(layer.regions),mask?load(mask.mask):[]]).then(([frame,maskData])=>{
    if(version!==revision)return null;
    return liveRegions.compute(frame,maskData,mask?.mask||'none',key);
  });
  const [result,landcover]=await Promise.all([geometry,load(cover.landcover)]);
  if(!result||version!==revision)return;
  const {geo,labels}=result;
  // Keep the reviewed string ID in properties: tile feature IDs may be coerced.
  currentGeo={...geo,features:geo.features.map(f=>({...f,properties:{...f.properties,bubbleId:String(f.id)}}))};
  if(version!==revision) return;
  map.getSource('potato-regions').setData(currentGeo);map.getSource('potato-labels').setData(labels);
  map.getSource('potato-landcover').setData(parkLandcover(landcover));
  landcoverVisibility();
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);
  downloadUrl=URL.createObjectURL(new Blob([JSON.stringify(geo)],{type:'application/geo+json'}));
  $('geojson-download').href=downloadUrl;$('geojson-download').download=`potato-${key}.geojson`;
  const barriers=mode==='parks'?'Thames gap + parks':'Thames gap';
  const green=mode==='parks'?` · green ≥ ${cover.minGreenAreaMeters2/10000} ha · park clearance ${mask.greenClearanceMeters} m`:'';
  $('gis-status').textContent=`${manifest.rows.toLocaleString()} panoramas · ${geo.features.length} semantic pieces · ${layer.bandwidthMeters} m smoothing · ${Math.round(layer.supportMass*100)}% density · ${barriers}${green}`;
  $('gis-status').dataset.bandwidth=String(layer.bandwidthMeters);
  $('gis-status').dataset.renderMs=(performance.now()-updateStarted).toFixed(1);
  $('gis-status').dataset.densityMass=String(layer.supportMass);
  $('gis-status').dataset.gridCrs=liveManifest.coordinateSystem;
  $('gis-status').dataset.gridCellMeters=String(liveManifest.grid.cellSizeMeters);
  lastRenderKey=key;
  $('gis-status').setAttribute('role','status');
  lastRenderStatus=$('gis-status').textContent;
  sae.update();
  // Warm neighboring slider stops while the current geometry is on screen.
  for(const delta of [-20,-10,10,20]){
    const neighbor=liveManifest.frames.find(f=>f.bandwidthMeters===layer.bandwidthMeters+delta&&f.gapMeters===layer.gapMeters&&f.supportMass===layer.supportMass);
    if(neighbor){
      const neighborKey=`${neighbor.bandwidthMeters}-${neighbor.gapMeters}-${mode}-${$('min-green-area').value}-${Math.round(layer.supportMass*100)}`;
      const savedNeighbor=liveManifest.views?.find(v=>v.key===neighborKey);
      void load(savedNeighbor?.result||neighbor.regions).catch(()=>{});
    }
  }
}
async function initialize() {
  try {
    [manifest,liveManifest]=await Promise.all([load('manifest.json'),load('live-manifest.json')]);
    if(liveManifest.coordinateSystem!=='EPSG:27700')throw new Error('BNG density cache is being upgraded; reload when complete');
    const [extent,bytes,landcover,livePoints]=await Promise.all([load('extent.geojson'),load(manifest.pointRecords.groups,'binary'),load(selectedLandcover().landcover),load(liveManifest.points,'binary')]);
    liveRegions=new LivePotatoRegions(livePoints,liveManifest.bounds,liveManifest.groups);
    const geo={type:'FeatureCollection',features:[]},labels={type:'FeatureCollection',features:[]};
    const labelFont=map.getStyle().layers.find(l=>l.type==='symbol'&&Array.isArray(l.layout?.['text-font']))?.layout['text-font'] || ['Noto Sans Regular'];
    map.addSource('potato-regions',{type:'geojson',data:geo,promoteId:'bubbleId'});
    map.addSource('potato-labels',{type:'geojson',data:labels});
    map.addSource('potato-extent',{type:'geojson',data:extent});
    map.addSource('potato-landcover',{type:'geojson',data:parkLandcover(landcover),attribution:'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors · ODbL</a>'});
    map.addSource('sae-selection',{type:'geojson',data:geo});
    // Park blobs overlay the basemap. The Thames mask stays uncovered.
    map.addLayer({id:'potato-landcover-shadow',type:'line',source:'potato-landcover',layout:{'line-join':'round'},paint:{'line-color':'#061009','line-opacity':.55,'line-width':5,'line-blur':3}});
    map.addLayer({id:'potato-parks',type:'fill',source:'potato-landcover',filter:['==',['get','kind'],'park'],paint:{'fill-color':['get','color'],'fill-opacity':Number($('region-opacity').value)}});
    map.addLayer({id:'potato-landcover-rim',type:'line',source:'potato-landcover',layout:{'line-join':'round'},paint:{'line-color':['get','color'],'line-opacity':.9,'line-width':1.6,'line-blur':.4}});
    // Append overlays after every basemap layer, including roads and place names.
    map.addLayer({id:'potato-shadow',type:'line',source:'potato-regions',layout:{'line-join':'round'},paint:{'line-color':'#061009','line-opacity':.55,'line-width':5,'line-blur':3}});
    map.addLayer({id:'potato-fill',type:'fill',source:'potato-regions',paint:{'fill-color':['get','color'],'fill-opacity':Number($('region-opacity').value),'fill-antialias':true}});
    points=geographicPointsLayer(bytes,manifest.rows);points.visible=$('show-points').checked;map.addLayer(points);
    map.addLayer({id:'potato-rim',type:'line',source:'potato-regions',layout:{'line-join':'round'},paint:{'line-color':'#f5fff0','line-opacity':.5,'line-width':2.4,'line-blur':.7}});
    map.addLayer({id:'potato-boundaries',type:'line',source:'potato-regions',layout:{'line-join':'round'},paint:{'line-color':['get','color'],'line-opacity':.85,'line-width':1}});
    map.addLayer({id:'potato-test-extent',type:'line',source:'potato-extent',layout:{visibility:$('show-extent').checked?'visible':'none'},paint:{'line-color':'#dce9d1','line-width':1.2,'line-dasharray':[4,3]}});
    map.addLayer({id:'potato-group-labels',type:'symbol',source:'potato-labels',layout:{'text-field':['get','label'],'text-font':labelFont,'text-size':12,'text-allow-overlap':true},paint:{'text-color':'#f0f8e8','text-halo-color':'#102010','text-halo-width':1.5}});
    map.addLayer({id:'sae-selection-rim',type:'line',source:'sae-selection',paint:{'line-color':'#ffffff','line-width':4,'line-opacity':.95}});
    ready=true;$('bandwidth').disabled=false;$('bubble-gap').disabled=false;$('gis-barriers').disabled=false;$('density-mass').disabled=false;
    await changeRegions();
    $('sae-explore').disabled=false;
    await sae.initialize();
  } catch(error){fail(error);}
}
map.once('load',()=>void initialize());
map.on('error',e=>console.warn(e.error?.message));
map.on('click','potato-fill',e=>{
  const f=e.features?.[0];if(!f)return;
  const feature={type:'Feature',id:f.properties.bubbleId,geometry:f.geometry,properties:f.properties};
  void sae.open(feature).catch(error=>{$('gis-status').textContent=error.message;});
});
map.on('click','potato-parks',e=>{
  const f=e.features?.[0];if(!f)return;
  void sae.open({type:'Feature',id:f.id,geometry:f.geometry,properties:f.properties},true).catch(error=>{$('gis-status').textContent=error.message;});
});
for(const layer of ['potato-fill','potato-parks']){
  map.on('mouseenter',layer,()=>{map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
}
function scheduleRegions(){
  $('bandwidth-output').value=`${$('bandwidth').value} m`;
  revision++;clearTimeout(updateTimer);
  updateTimer=setTimeout(()=>void changeRegions().catch(fail),60);
}
$('bandwidth').addEventListener('input',scheduleRegions);
$('bandwidth').addEventListener('change',scheduleRegions);
$('bubble-gap').addEventListener('change',()=>void changeRegions().catch(fail));
$('density-mass').addEventListener('change',()=>void changeRegions().catch(fail));
$('gis-barriers').addEventListener('change',()=>void changeRegions().catch(fail));
$('min-green-area').addEventListener('change',()=>void changeRegions().catch(fail));
$('region-opacity').addEventListener('input',()=>{
  const value=Number($('region-opacity').value);$('opacity-output').textContent=`${Math.round(value*100)}%`;
  if(ready) for(const id of ['potato-fill','potato-parks'])map.setPaintProperty(id,'fill-opacity',value);
});
$('show-points').addEventListener('change',()=>{if(points){points.visible=$('show-points').checked;map.triggerRepaint();}});
$('point-colors').addEventListener('change',async()=>{
  if(!points) return;
  try {points.replace(await load(manifest.pointRecords[$('point-colors').value],'binary'));}catch(e){fail(e);}
});
$('show-extent').addEventListener('change',()=>{if(ready) map.setLayoutProperty('potato-test-extent','visibility',$('show-extent').checked?'visible':'none');});
$('fit-extent').addEventListener('click',()=>{if(ready) fit();});
