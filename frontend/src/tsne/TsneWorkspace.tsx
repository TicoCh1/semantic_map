import { useEffect, useRef, useState } from "react";
import { GlassPanel as Glass, GlassButton } from "@form-glass/react";
import { Map as LibreMap, ScaleControl, AttributionControl, type LngLatBoundsLike } from "maplibre-gl";
import { WorkspaceSelect, type Workspace } from "../components/WorkspaceSelect";
import { ThemedSelect } from "../components/ThemedSelect";
import { SemanticGlassProvider } from "../styles/SemanticGlassProvider";
import { installBasemapTransport, sceneTileRequest } from "../state/basemapTransport";
import { scaleOpacities } from "../../../frontend_pcatsne/src/atlas-adapter";
import { TsnePointCloud } from "./pointCloud";
import london from "./data/manifest.json";

const assets = import.meta.glob<string>("./data/*.bin", { eager: true, query: "?url", import: "default" });
type Scale = "auto" | number;

function visibleScales(map: LibreMap, scale: Scale): [number, number][] {
  if (scale !== "auto") return [[scale, 1]];
  const { clientWidth: w, clientHeight: h } = map.getCanvas();
  const width = map.unproject([0, h/2]).distanceTo(map.unproject([w, h/2]));
  const height = map.unproject([w/2, 0]).distanceTo(map.unproject([w/2, h]));
  const weights = scaleOpacities(london.scales, Math.min(width,height));
  return london.scales.flatMap(({km}, i) => weights[i] > 0.001 ? [[km,weights[i]] as [number,number]] : []);
}

export function TsneWorkspace({dark, onWorkspaceChange}: {dark: boolean; onWorkspaceChange: (next: Workspace) => void}) {
  const container = useRef<HTMLDivElement>(null);
  const scale = useRef<Scale>(32);
  const [selected, setSelected] = useState<Scale>(32);
  const [status, setStatus] = useState("Loading London…");
  const [error, setError] = useState("");
  const refresh = useRef<() => void>();
  useEffect(() => {
    if (!container.current) return;
    const controller = new AbortController();
    const cloud = new TsnePointCloud();
    const pending = new Map<number,Promise<void>>();
    installBasemapTransport();
    const map = new LibreMap({
      container: container.current, bounds: london.bounds as LngLatBoundsLike,
      fitBoundsOptions: {padding: {top:85,left:20,right:20,bottom:35}},
      minZoom: 8, maxZoom: 18, maxPitch: 0, dragRotate: false,
      transformRequest: sceneTileRequest, attributionControl:false,
      style: {
        version: 8,
        sources: {
          streets: {
            type: "raster", tileSize: 256, maxzoom: 19,
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          }
        },
        layers: [
          { id: "background", type: "background", paint: {"background-color": dark ? "#101418" : "#efefed"} },
          { id: "streets", type: "raster", source: "streets", paint: {
            "raster-saturation": -1, "raster-opacity": dark ? 0.45 : 0.42, "raster-brightness-max": dark ? 0.36 : 1
          }}
        ]
      }
    });
    map.addControl(new ScaleControl({unit:"metric"}),"bottom-left");
    map.addControl(new AttributionControl({compact:true}),"bottom-right");
    const sizeObserver = new ResizeObserver(()=>map.resize());
    sizeObserver.observe(container.current);
    function load(km: number) {
      if (cloud.records.has(km)) return;
      if (pending.has(km)) return pending.get(km);
      const task = (async () => {
        const res = await fetch(assets[`./data/london-${km}km.bin`], {signal: controller.signal});
        if (!res.ok) throw new Error(`London point data returned HTTP ${res.status}.`);
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength !== london.scales.find(s=>s.km===km)!.count * 12) throw new Error("Incomplete London point data.");
        cloud.records.set(km,bytes);
      })().finally(()=>pending.delete(km));
      pending.set(km,task);
      return task;
    }
    let revision = 0;
    async function draw() {
      const version = ++revision;
      if (!map.getLayer(cloud.id)) return;
      const weights = visibleScales(map, scale.current);
      try {
        setError("");
        if (weights.some(([km])=>!cloud.records.has(km))) setStatus("Loading London…");
        await Promise.all(weights.map(([km])=>load(km)));
        if (controller.signal.aborted || revision !== version) return;
        cloud.weights = weights;
        map.triggerRepaint();
        const active = weights.map(([km])=>km).join(" / ");
        setStatus(`London · ${active} km`);
      } catch (e) {
        if (controller.signal.aborted || revision !== version) return;
        setError(e instanceof Error ? e.message : "Could not load the London map.");
      }
    }
    refresh.current = draw;
    map.on("style.load",()=>{ if (!map.getLayer(cloud.id)) map.addLayer(cloud); void draw(); });
    const updateAuto = () => { if (scale.current === "auto") void draw(); };
    map.on("zoom",updateAuto);
    map.on("resize",updateAuto);
    return () => { refresh.current=undefined; controller.abort(); sizeObserver.disconnect(); map.remove(); };
  },[dark]);
  return <SemanticGlassProvider dark={dark}>
    <main className={`split-pane tsne-workspace${dark ? " theme-dark" : ""}`}>
      <div ref={container} className="tsne-map" aria-label="London t-SNE map" />
      <Glass className="map-toolbar tsne-toolbar" fade={["top","right","bottom","left"]}>
        <WorkspaceSelect value="tsne" onChange={v=>{if(v==="atlas"||v==="cities")onWorkspaceChange(v);}} />
        <label className="basemap-select tsne-scale"><span>Scale</span>
          <ThemedSelect label="London t-SNE scale" value={selected} onValueChange={v=>{
            scale.current = v === "auto" ? "auto" : Number(v);
            setSelected(scale.current); refresh.current?.();
          }}>
            <option value="auto">Auto (zoom)</option>
            {london.scales.map(s=><option key={s.km} value={s.km}>{s.km + " km"}</option>)}
          </ThemedSelect>
        </label>
        <small role="status" className="tsne-status">{error || status}</small>
        {error && <GlassButton onClick={()=>refresh.current?.()}>Retry</GlassButton>}
      </Glass>
    </main>
  </SemanticGlassProvider>;
}
