import { Glass, GlassButton } from "@form-glass/react";
import { GlassAction } from "../components/GlassAction";
import type { FeatureCollection } from "../api/types";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { atlasResource, boundaryLive, names, type City, type Coord, type Query } from "./data";

export type Boundary = { city: City; points: Coord[] };
type Analysis = { count: number; themes: { id?: string; label: string; color: string; count: number; coverage: number }[];
  points: {xy: Coord; id?: string; label: string}[] };
type Props = {
  maps: Map<string, MapLibreMap>; value: Boundary | null; onChange: (b: Boundary | null) => void;
  requestControls: (r: { open: boolean }) => void;
  onSamples: (features: FeatureCollection["features"]) => void;
  onResult: (q: Query, signal: AbortSignal) => Promise<void>;
};

export function BoundarySearch({maps, value, onChange, requestControls, onResult, onSamples}: Props) {
  const [drawing, setDrawing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [theme, setTheme] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyze" | "search" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const beforeEdit = useRef({value, analysis, theme, result});
  const pending = useRef<AbortController | null>(null);
  const host = [...maps.values()][0]?.getContainer().closest(".map-shell");

  function invalidate() {
    pending.current?.abort(); setBusy(null); setAnalysis(undefined); setTheme(null); setError(""); setResult("");
  }
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    const palette = new Map(analysis?.themes.map(t => [t.id ?? t.label, t.color]));
    onSamples((analysis?.points ?? []).map(({xy,id,label}) => ({
      type:"Feature", geometry:{type:"Point", coordinates:xy},
      properties:{category:label, categoryColor:palette.get(id ?? label), highlighted:!theme || theme===(id ?? label)}
    })));
  }, [analysis, theme, onSamples]);
  function start() {
    beforeEdit.current = {value, analysis, theme, result};
    invalidate(); setDrawing(true); requestControls({open:false});
  }
  function stop(cancel: boolean) {
    if(cancel) {
      const previous = beforeEdit.current;
      onChange(previous.value); setAnalysis(previous.analysis); setTheme(previous.theme); setResult(previous.result);
    }
    setDrawing(false); setError(""); requestControls({open:true});
  }
  useEffect(() => {
    if(!drawing)return;
    const disposers: (()=>void)[] = [];
    for(const [city,map] of maps) {
      const container = map.getContainer();
      const pick = (e: MouseEvent) => {
        if(e.target!==map.getCanvas())return;
        e.preventDefault(); e.stopImmediatePropagation();
        if(value && city!==value.city){setError("Add corners on the same city map.");return;}
        if(value && value.points.length>=64){setError("Use up to 64 corners.");return;}
        const rect=map.getCanvas().getBoundingClientRect();
        const {lng,lat}=map.unproject([e.clientX-rect.left,e.clientY-rect.top]);
        onChange({city:city as City, points:[...(value?.points??[]),[lng,lat]]}); setError("");
      };
      container.addEventListener("click",pick,true); container.classList.add("area-picking");
      disposers.push(()=>{container.removeEventListener("click",pick,true);container.classList.remove("area-picking");});
      if(value?.city!==city)continue;
      value.points.forEach((point,index)=>{
        const el=document.createElement("span");el.className="boundary-handle";el.textContent=String(index+1);
        const marker=new Marker({element:el,draggable:true}).setLngLat(point).addTo(map);
        marker.on("dragend",()=>{
          const {lng,lat}=marker.getLngLat();
          const points=value.points.slice();points[index]=[lng,lat];onChange({...value,points});setError("");
        });
        disposers.push(()=>marker.remove());
      });
    }
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")stop(true);};
    window.addEventListener("keydown",escape);
    return ()=>{disposers.forEach(dispose=>dispose());window.removeEventListener("keydown",escape);};
  },[drawing,maps,value,onChange,requestControls]);

  async function run(action:"analyze"|"search") {
    if(!value || busy || (action==="search" && !analysis?.count))return;
    pending.current?.abort();
    const controller=new AbortController();pending.current=controller;
    setBusy(action);setError("");setResult("");
    try {
      const selected = analysis?.themes.find(item => (item.id ?? item.label) === theme);
      const selection = selected?.id ? {theme_id:selected.id} : {theme:selected?.label ?? null};
      const response=await atlasResource(action,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(action==="search"?{...value,...selection}:value),signal:controller.signal});
      const data=await response.json();
      if(controller.signal.aborted)return;
      if(action==="analyze"){setAnalysis(data);setTheme(null);}
      else {
        await onResult(data,controller.signal);
        if (!controller.signal.aborted) {
          setResult(data.name);
          if (window.matchMedia("(max-width: 1023px)").matches) requestControls({open:false});
        }
      }
    } catch(e) {if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}
    finally {if(!controller.signal.aborted)setBusy(null);}
  }
  const analyzeDraft = () => {
    if (!value || value.points.length < 3 || busy) return;
    stop(false);
    void run("analyze");
  };
  const analyzeButton = <GlassAction disabled={(value?.points.length ?? 0) < 3 || !!busy}
    onClick={analyzeDraft}>Analyze</GlassAction>;
  const DrawButton = value ? GlassButton : GlassAction;
  const buttons=<>
    <GlassButton className="secondary-button" disabled={!value?.points.length} onClick={()=>onChange(value && value.points.length>1?{...value,points:value.points.slice(0,-1)}:null)}>Undo corner</GlassButton>
    <GlassButton className="secondary-button" onClick={()=>stop(true)}>Cancel</GlassButton>
    {analyzeButton}
  </>;
  return <section className="panel-section area-inspector boundary-search" aria-label="Boundary search">
    <div className="section-heading"><strong>Boundary search</strong><small>{boundaryLive ? "Live GPU · street panoramas" : "Local preview · sample data"}</small></div>
    {!drawing && !value && host && createPortal(<div className="mobile-boundary-launch"><GlassAction onClick={start}>Draw boundary</GlassAction></div>,host)}
    {drawing && <div className="area-actions">{analyzeButton}</div>}
    {drawing && host && createPortal(<div className="boundary-draw-position"><Glass className="boundary-draw-tools" material="control">
      <span role="status">{error || (value?`${names[value.city]} · ${value.points.length} corners · Drag to adjust`:"Click the map to add corners.")}</span>
      <div>{buttons}</div></Glass></div>,host)}
    {!drawing && <>
      {value && <small>{names[value.city]} · {value.points.length} corners{analysis && ` · ${analysis.count} samples`}</small>}
      <div className="area-actions">
        <DrawButton disabled={!maps.size} onClick={start}>{value?"Edit boundary":"Draw boundary"}</DrawButton>
        {value && !analysis && <GlassAction disabled={!!busy} onClick={()=>void run("analyze")}>{busy==="analyze"?"Analyzing…":"Analyze"}</GlassAction>}
        {value && <GlassButton className="secondary-button" onClick={()=>{invalidate();onChange(null);}}>Clear</GlassButton>}
      </div>
      {analysis && (analysis.count===0 ? <p role="status">No samples here. Move the boundary over visible points.</p> :
        <fieldset className="boundary-options" disabled={!!busy}><legend>Search using</legend>
          <label><input type="radio" name="boundary-class" checked={theme===null} onChange={()=>{setTheme(null);setResult("");}}/>Whole boundary</label>
          {analysis.themes.map(item=><label key={item.id ?? item.label}><input type="radio" name="boundary-class" checked={theme===(item.id ?? item.label)} onChange={()=>{setTheme(item.id ?? item.label);setResult("");}}/>
            <span><i className="boundary-key" aria-hidden="true" style={{backgroundColor:item.color}}/>{item.label}<span className="area-track"><i style={{width:(item.coverage*100)+"%",backgroundColor:item.color}}/></span></span>
            <span className="boundary-share">{(item.coverage*100).toFixed(0)}%</span></label>)}
          {analysis.themes.length>0 && analysis.themes[0].coverage<.35 && <small>Several classes share this area. Edit the boundary to focus it.</small>}
        </fieldset>)}
      {!!analysis?.count && <GlassAction disabled={!!busy} onClick={()=>void run("search")}>{busy==="search"?"Searching…":"Submit query"}</GlassAction>}
      {result && <small role="status">Added layer · {result}</small>}
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
