import { ThemedSelect } from "../components/ThemedSelect";
import { SemanticGlassProvider } from "../styles/SemanticGlassProvider";
import { GlassButton, GlassPanel as Glass, GlassInput, GlassSwitch, GlassLink } from "@form-glass/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { RotateCcw } from "lucide-react";
import type { CityConfig, FeatureCollection, GradientPreset, LayerStyle, PanoMapPoint } from "../api/types";
import { CityMapPane, type LayerDataProvider } from "../components/MapView";
import { GradientEditor } from "../components/GradientEditor";
import { HistogramPanel } from "../components/HistogramPanel";
import { StreetViewPanel } from "../components/StreetViewPanel";
import { SplitPane } from "../components/SplitPane";
import { BASEMAPS, type BasemapId } from "../state/basemaps";
import { layerStyleFromGradient } from "../state/color";
import { deleteGradient, getGradientPresets, saveGradient } from "../state/localProject";
import { loadRegion, makeLayer, sourceArea, targetPoints, type RegionBundle } from "./data";
import { useRegionPanos } from "./useRegionPanos";
import { getRemoteBackendConfig, isUsableRemoteBackendUrl } from "../api/client";

const empty: FeatureCollection={type:"FeatureCollection",features:[]};
const cityName=(id:string)=>id.startsWith("rome")?"Rome":"London";
const axisLabel=(mask:number)=>Array.from({length:8},(_,j)=>j+1).filter(axis=>mask&(1<<(axis-1))).map(axis=>`PCA ${axis}`).join(" + ");
const queryCase=new URLSearchParams(window.location.search).get("case");
const initialCase=queryCase==="stpauls"?"stpauls":"colosseo";

export function RegionApp(){
  const [caseId,setCaseId]=useState(initialCase),[bundle,setBundle]=useState<RegionBundle|null>(null),[error,setError]=useState("");
  const [mask,setMask]=useState(255),[field,setField]=useState("zscore");
  const [basemap,setBasemap]=useState<BasemapId>("openfreemap_positron");
  const [presets,setPresets]=useState<GradientPreset[]>([]),[gradient,setGradient]=useState<GradientPreset|null>(null);
  const [style,setStyle]=useState<LayerStyle|null>(null),[inspected,setInspected]=useState<PanoMapPoint|null>(null);
  const [scales,setScales]=useState([44000,4500]),[split,setSplit]=useState(50);
  const [dragging,setDragging]=useState(false);
  const [attributionHost,setAttributionHost]=useState<HTMLDivElement|null>(null);
  const [streetApi,setStreetApi]=useState("");
  const maps=useRef(new Map<number,MapLibreMap>());
  const streetView=useRegionPanos();
  const clearPanos=streetView.clear;
  useEffect(()=>{void getRemoteBackendConfig().then(config=>setStreetApi(config.baseUrl));},[]);
  useEffect(()=>{
    window.regionStreetViewState={selectedKey:streetView.selectedKey,panos:streetView.panos.map(pano=>({key:pano.pano_key,dataset:pano.pano_dataset_id||pano.dataset_id,id:pano.pano_id,status:pano.status,hasImage:!!pano.object_url}))};
  },[streetView.panos,streetView.selectedKey]);
  useEffect(()=>{void getGradientPresets().then(items=>{setPresets(items);setGradient(items[0]);setStyle({...layerStyleFromGradient(items[0]),absolute_radius:true,score_min:-1,score_max:3});});},[]);
  useEffect(()=>{
    let cancelled=false;setBundle(null);setError("");setMask(255);setField("zscore");setStyle(old=>old?{...old,score_min:-1,score_max:3}:old);setInspected(null);clearPanos();
    const url=new URL(window.location.href);url.searchParams.set("case",caseId);window.history.replaceState(null,"",url);
    void loadRegion(caseId).then(value=>{if(!cancelled)setBundle(value);}).catch(reason=>{if(!cancelled)setError(String(reason));});
    return()=>{cancelled=true;};
  },[caseId,clearPanos]);
  const meta=bundle?.meta;
  const sourceGeometry=useMemo(()=>meta?sourceArea(meta):empty,[meta]);
  const target=useMemo(()=>bundle?targetPoints(bundle,mask):empty,[bundle,mask]);
  const currentGradient=useMemo(()=>gradient&&style?{...gradient,stops:style.stops||gradient.stops,opacity:style.opacity,score_min:style.score_min,score_max:style.score_max}:gradient,[gradient,style]);
  const targetLayer=useMemo(()=>style?makeLayer("region-result",axisLabel(mask)||"No PCA axes",style,`${caseId}:${mask}`,field):null,[style,caseId,mask,field]);
  const sourceLayer=useMemo(()=>makeLayer("region-references","Reference panoramas",{gradient_id:"references",stops:[{value:0,color:"#2c7bb6"},{value:1,color:"#2c7bb6"}],gradient_name:"References",score_min:0,score_max:1,opacity:.9,point_radius:1.5,absolute_radius:true},caseId),[caseId]);
  const provider=useCallback<LayerDataProvider>(async(layer)=>layer.id==="region-references"?bundle?.meta.source_references||empty:target,[bundle,target]);
  const cities=useMemo(()=>{
    if(!meta)return [];
    const targetCenter: [number,number]=[(meta.bounds[0][0]+meta.bounds[1][0])/2,(meta.bounds[0][1]+meta.bounds[1][1])/2];
    return [meta.source_dataset_id,meta.target_dataset_id].map((datasetId,index):CityConfig=>({id:datasetId.split("_")[0],name:cityName(datasetId),datasetId,center:index?targetCenter:meta.source_center,initialZoom:index?11:15,bounds:index?{west:meta.bounds[0][0],south:meta.bounds[0][1],east:meta.bounds[1][0],north:meta.bounds[1][1]}:{west:meta.source_center[0]-.009,east:meta.source_center[0]+.009,south:meta.source_center[1]-.006,north:meta.source_center[1]+.006}}));
  },[meta]);
  const fit=useCallback((slot:number)=>{
    const map=maps.current.get(slot);if(!map||!meta)return;
    const padding=Math.min(slot?45:55,Math.min(map.getContainer().clientWidth,map.getContainer().clientHeight)*.12);
    if(slot===1)map.fitBounds(meta.bounds,{padding,duration:0});
    else {
      const feature=sourceGeometry.features[0];
      if(feature?.geometry.type!=="Polygon")return;
      const ring=feature.geometry.coordinates[0];
      map.fitBounds([[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1]))],[Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))]],{padding,duration:0});
    }
  },[meta,sourceGeometry]);
  const readySource=useCallback((map:MapLibreMap)=>{maps.current.set(0,map);const load=()=>fit(0);map.once("load",load);return()=>{map.off("load",load);maps.current.delete(0);};},[fit]);
  const readyTarget=useCallback((map:MapLibreMap)=>{maps.current.set(1,map);const load=()=>fit(1);map.once("load",load);return()=>{map.off("load",load);maps.current.delete(1);};},[fit]);
  const sourceScale=useCallback((scale:number)=>setScales(old=>[scale,old[1]]),[]);
  const targetScale=useCallback((scale:number)=>setScales(old=>[old[0],scale]),[]);
  const ignore=useCallback(()=>{},[]);
  const mark=useCallback((pano:PanoMapPoint)=>{setInspected(pano);streetView.mark(pano);},[streetView.mark]);
  const apply=useCallback(async(next:GradientPreset,_layer:unknown,radius:number,absolute:boolean)=>{setGradient(next);setStyle(old=>({...layerStyleFromGradient(next,old||undefined),point_radius:radius,absolute_radius:absolute,score_min:old?.score_min??-1,score_max:old?.score_max??3}));},[]);
  const save=useCallback(async(next:GradientPreset,layer:unknown,radius:number,absolute:boolean)=>{const saved=await saveGradient(next);setPresets(await getGradientPresets());await apply(saved,layer,radius,absolute);},[apply]);
  const remove=useCallback(async(next:GradientPreset)=>{await deleteGradient(next.id);const items=await getGradientPresets();setPresets(items);if(items[0]){setGradient(items[0]);setStyle(old=>({...layerStyleFromGradient(items[0],old||undefined),score_min:old?.score_min??-1,score_max:old?.score_max??3}));}},[]);
  const changeRange=useCallback(async(_layer:unknown,min:number,max:number)=>{setStyle(old=>old?{...old,score_min:min,score_max:max}:old);},[]);
  const changeField=useCallback(async(_layer:unknown,property:string)=>{setField(property);setStyle(old=>old?{...old,score_min:property==="zscore"?-1:0,score_max:property==="zscore"?3:1}:old);},[]);
  const dark=basemap==="openfreemap_dark";
  useEffect(()=>{
    window.regionComparisonState={ready:!!bundle,caseId,mask,field,scoreMin:style?.score_min??-1,scoreMax:style?.score_max??3,sourcePoints:meta?.source_points||0,targetPoints:meta?.point_count||0,visible:target.features.length,gradient:currentGradient?.name||""};
    window.regionComparisonView=(includeStats=false)=>Array.from(maps.current.entries()).map(([slot,map])=>{
      const data=(map.getStyle()?.sources[`${cities[slot]?.id}__${slot?"region-result":"region-references"}`] as {data?:FeatureCollection})?.data;
      const sample=data?.features.find(feature=>{
        if(feature.geometry.type!=="Point")return false;
        const pixel=map.project(feature.geometry.coordinates as [number,number]);
        return pixel.x>35&&pixel.x<map.getContainer().clientWidth-55&&pixel.y>75&&pixel.y<map.getContainer().clientHeight-55;
      });
      const layerId=`${cities[slot]?.id}__${slot?"region-result":"region-references"}`;
      const pixel=sample?.geometry.type==="Point"?map.project(sample.geometry.coordinates as [number,number]):null;
      const stats=includeStats&&slot===1&&data?.features.length?data.features.reduce((result,feature)=>{
        const z=Number(feature.properties.zscore);result.mean+=z/data.features.length;result.secondMoment+=z*z/data.features.length;
        if(z<(style?.score_min??-1)||z>(style?.score_max??3))result.outsideRange++;
        return result;
      },{mean:0,secondMoment:0,outsideRange:0}):null;
      return {slot,city:cities[slot]?.name,order:map.getLayersOrder(),points:data?.features.length,stats,referenceArea:!!map.getLayer("reference-selection-outline"),colour:map.getLayer(layerId)?map.getPaintProperty(layerId,"circle-color"):null,radius:map.getLayer(layerId)?map.getPaintProperty(layerId,"circle-radius"):null,center:map.getCenter().toArray(),zoom:map.getZoom(),sample:sample&&pixel?{pixel,id:sample.properties.id,score:sample.properties.score,zscore:sample.properties.zscore,hits:map.getLayer(layerId)?map.queryRenderedFeatures(pixel,{layers:[layerId]}).length:0}:null};
    });
  },[bundle,caseId,mask,field,style,meta,target,currentGradient,cities]);
  const selectedPano=streetView.panos.find(pano=>pano.pano_key===streetView.selectedKey);
  const useStreetApi=()=>{
    const url=new URL(window.location.href);url.searchParams.set("backend",streetApi.trim());window.history.replaceState(null,"",url);clearPanos();setInspected(null);
  };
  const controls=<div className="sidebar-content">
    <section className="panel-section"><div className="section-heading"><span>Region comparison</span><strong>{meta?.source_label||"Loading experiment…"}</strong></div>
      <p className="region-help">Source: {meta?.source_points.toLocaleString()||"—"} reference panoramas inside the saved {meta?.source_radius_m||500} m boundary. Target: {meta?.point_count.toLocaleString()||"—"} cached samples.</p>
      <p className="region-help">Blue source points are the actual references used for PCA. Source and target cameras move independently.</p>
    </section>
    <section className="panel-section"><div className="section-heading"><span>PCA selection</span><strong>Fixed factors · direct product</strong></div>
      <div className="region-axis-grid">{Array.from({length:8},(_,j)=><div key={j} className="region-axis"><div><GlassSwitch label={`PCA ${j+1}`} checked={!!(mask&(1<<j))} onChange={()=>setMask(mask^(1<<j))}/><small>{meta?((meta.axis_variances[j]/meta.axis_variances.reduce((a,b)=>a+b,0))*meta.explained_variance_fraction*100).toFixed(2):"—"}% variance</small></div><GlassButton aria-label={`Show only PCA ${j+1}`} onClick={()=>setMask(1<<j)}>Only</GlassButton></div>)}</div>
      <GlassButton className="secondary-button" onClick={()=>setMask(255)}>Select all 8</GlassButton>
      <p className="region-help">{meta?(meta.explained_variance_fraction*100).toFixed(1):"—"}% source variance retained. Selecting another axis adds a constraint to the raw product.</p>
    </section>
    <HistogramPanel layer={targetLayer} gradient={currentGradient} data={target} onRangeChange={changeRange} onPropertyChange={changeField}/>
    <p className="region-help">All {target.features.length.toLocaleString()} target points remain shown. The range maps the colour scheme; values outside it use the endpoint colours. Z-score standardizes the selected PCA product across the full target city.</p>
    <GradientEditor layer={targetLayer} gradient={currentGradient} gradients={presets} onApply={apply} onSavePreset={save} onDeletePreset={remove}/>
    <p className="region-help">Point size follows map zoom. Click a source or target point to load its panorama.</p>
    <section className="panel-section"><div className="section-heading"><span>Street view</span><strong>Panorama API</strong></div>
      <GlassInput label="Street view API URL" className="region-api-input" type="url" value={streetApi} onChange={event=>setStreetApi(event.target.value)}/>
      <GlassButton className="secondary-button" disabled={!isUsableRemoteBackendUrl(streetApi)} onClick={useStreetApi}>Use API</GlassButton>
      <p className="region-help">Uses the Semantic Map backend configuration. Images load when a point is selected.</p>
      {selectedPano?.status==="failed"&&<GlassButton className="secondary-button" onClick={()=>streetView.mark(selectedPano)}>Retry panorama</GlassButton>}
      {!!streetView.panos.length&&<GlassButton className="secondary-button" onClick={()=>{clearPanos();setInspected(null);}}>Close street view</GlassButton>}
    </section>
    {inspected&&<section className="panel-section"><div className="section-heading"><span>Selected panorama</span><strong>{inspected.city_id} · {inspected.pano_id}</strong></div><p className="region-help">{inspected.lat.toFixed(6)}, {inspected.lon.toFixed(6)}</p><GlassLink href={`https://www.google.com/maps/search/?api=1&query=${inspected.lat},${inspected.lon}`} target="_blank" rel="noreferrer">Open location</GlassLink></section>}
    <p className="region-help">All PCA and product scores were computed on RunPod. This view only displays the saved experiments.</p>
  </div>;
  return <SemanticGlassProvider dark={dark}><SplitPane className={`region-comparison${dark?" theme-dark":""}`} revealControls right={controls} footer={<div ref={setAttributionHost} className="map-attribution" data-glass-audit-ignore="vendor-attribution" aria-label="Map attribution"/>} left={<div className="map-shell region-map-shell" data-basemap={basemap}>
    <Glass className="map-toolbar" fade={["top", "right", "bottom", "left"]}><div className="map-summary"><span>Semantic Map</span><strong>Region comparison</strong></div>
      <label className="basemap-select region-case"><span>Experiment</span><ThemedSelect label="Region experiment" value={caseId} onValueChange={e =>setCaseId(e)}><option value="colosseo">Colosseum → London</option><option value="stpauls">St Paul's → Rome</option></ThemedSelect></label>
      <label className="basemap-select"><span>Basemap</span><ThemedSelect label="Basemap" value={basemap} onValueChange={e =>setBasemap(e as BasemapId)}>{BASEMAPS.map(base=><option key={base.id} value={base.id}>{base.name}</option>)}</ThemedSelect></label>
      <GlassButton className="secondary-button region-fit" onClick={()=>{fit(0);fit(1);}} title="Fit source and target maps"><RotateCcw size={14}/>Fit both</GlassButton>
    </Glass>
    {bundle&&style&&targetLayer?<div className="city-map-layout has-two-cities" style={{"--city-split":`${split}%`} as React.CSSProperties}>
      {cities.map((city,slot)=><CityMapPane key={`${caseId}-${slot}`} city={city} loadingKey={city.id} layers={slot?[targetLayer]:[sourceLayer]} gradients={currentGradient?[currentGradient]:[]} basemapId={basemap} selectedLayerId={slot?targetLayer.id:sourceLayer.id} onSelectLayer={ignore} markedPanos={streetView.panos} selectedPanoKey={streetView.selectedKey} onMarkPano={mark} onSelectPano={streetView.select} forceMaxDetail={false} onForceMaxDetailChange={ignore} sharedGroundScale={scales[slot]} onSharedGroundScaleChange={slot?targetScale:sourceScale} sharedRemoteTileZoom={13} onRemoteTileZoomChange={ignore} onSemanticLayerLoadingChange={ignore} splitIndex={slot} compactControls={false} resizing={dragging} attributionHost={attributionHost} dataProvider={provider} selectionArea={slot?undefined:sourceGeometry} onMapReady={slot?readyTarget:readySource} embeddingLabel={slot?`${city.name} · ${axisLabel(mask)||"No axes"}`:`${city.name} · ${meta?.source_radius_m} m source · ${meta?.source_points} references`} popupLabels={{score:slot?"Raw intensity":"Reference included",zscore:"Z-score"}}/>)}
      <div className="city-split-resizer" role="separator" aria-label="Resize city maps" aria-valuenow={split} tabIndex={0} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}} onPointerMove={e=>{if(!dragging)return;const bounds=e.currentTarget.parentElement!.getBoundingClientRect();setSplit(Math.max(28,Math.min(72,(e.clientX-bounds.left)/bounds.width*100)));}} onPointerUp={()=>setDragging(false)} onPointerCancel={()=>setDragging(false)} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight")setSplit(value=>Math.max(28,Math.min(72,value+(e.key==="ArrowLeft"?-2:2))));}}/>
    </div>:<div className="region-loading" role="status">{error||"Loading cached source points and PCA colour atlas…"}</div>}
    <StreetViewPanel panos={streetView.panos} selectedPanoKey={streetView.selectedKey} scoreField={field==="zscore"?"zscore":"score"} onSelectPano={streetView.select} onRemovePano={streetView.remove}/>
  </div>}/></SemanticGlassProvider>;
}

declare global {
  interface Window {
    regionComparisonState?: {ready:boolean;caseId:string;mask:number;field:string;scoreMin:number;scoreMax:number;sourcePoints:number;targetPoints:number;visible:number;gradient:string};
    regionComparisonView?: (includeStats?:boolean)=>unknown;
    regionStreetViewState?: {selectedKey:string|null;panos:{key?:string;dataset?:string|null;id:string;status:string;hasImage:boolean}[]};
  }
}
