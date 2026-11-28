import { useCallback, useRef, useState } from "react";
import { DopplerRange, GlassButton } from "@form-glass/react";
import type { Map as LibreMap, LngLatBoundsLike } from "maplibre-gl";
import type { Workspace } from "../components/WorkspaceSelect";
import { MapWorkspace } from "../components/MapWorkspace";
import { MapControls } from "../components/MapControls";
import { ExhibitIntroModal } from "../components/ExhibitIntroModal";
import { DEFAULT_CITY_CONFIGS } from "../state/cities";
import type { BasemapId } from "../state/basemaps";
import { scaleOpacities } from "../../../frontend_pcatsne/src/atlas-adapter";
import { TsnePointCloud } from "./pointCloud";
import type { CityId } from "../api/types";
import london from "./data/manifest.json";

const manifests: Record<CityId, typeof london> = { london };
const extraManifests = import.meta.glob<typeof london>("./data/*.json", { eager: true, import: "default" });
for (const city of DEFAULT_CITY_CONFIGS) {
  const manifest = extraManifests[`./data/${city.id}.json`];
  if (manifest) manifests[city.id] = manifest;
}

const assets = import.meta.glob<string>("./data/*.bin", { eager: true, query: "?url", import: "default" });
type Scale = "auto" | number;

function visibleScales(map: LibreMap, scale: Scale, manifest: typeof london): [number, number][] {
  if (scale !== "auto") return [[scale, 1]];
  const { clientWidth: w, clientHeight: h } = map.getCanvas();
  const width = map.unproject([0, h/2]).distanceTo(map.unproject([w, h/2]));
  const height = map.unproject([w/2, 0]).distanceTo(map.unproject([w/2, h]));
  const weights = scaleOpacities(manifest.scales, Math.min(width,height));
  return manifest.scales.flatMap(({km}, i) => weights[i] > 0.001 ? [[km,weights[i]] as [number,number]] : []);
}

const cities = DEFAULT_CITY_CONFIGS.filter(city => manifests[city.id]);
const scales: Scale[] = ["auto", ...london.scales.map(s => s.km)];
const tour = [{ eyebrow: "Map", target: null, title: "Cities at five scales", body: "Drag the scale slider to compare the same panoramas at 2, 4, 8, 16 and 32 km. At the left end, Auto follows map zoom.", items: [] }];
const noop = () => {};

export function TsneWorkspace({ initialDark, initialBasemap, onWorkspaceChange }: {
  initialDark: boolean; initialBasemap: BasemapId; onWorkspaceChange: (next: Workspace) => void;
}) {
  const [cityId, setCityId] = useState<CityId>("london");
  const manifest = manifests[cityId];
  const [dark, setDark] = useState(initialDark);
  const [basemap, setBasemap] = useState(initialBasemap);
  const [intro, setIntro] = useState(false);
  const scale = useRef<Scale>(32);
  const [selected, setSelected] = useState<Scale>(32);
  const [status, setStatus] = useState("Loading London…");
  const [error, setError] = useState("");
  const refresh = useRef<() => void>();
  const register = useCallback((map: LibreMap) => {
    const controller = new AbortController();
    const cloud = new TsnePointCloud();
    const pending = new Map<number,Promise<void>>();
    setStatus(`Loading ${manifest.city}…`);
    map.fitBounds(manifest.bounds as LngLatBoundsLike, {padding: {top:85,left:20,right:20,bottom:35}, duration:0});
    function load(km: number) {
      if (cloud.records.has(km)) return;
      if (pending.has(km)) return pending.get(km);
      const task = (async () => {
        const res = await fetch(assets[`./data/${cityId}-${km}km.bin`], {signal: controller.signal});
        if (!res.ok) throw new Error(`${manifest.city} point data returned HTTP ${res.status}.`);
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength !== manifest.scales.find(s=>s.km===km)!.count * 12) throw new Error(`Incomplete ${manifest.city} point data.`);
        cloud.records.set(km,bytes);
      })().finally(()=>pending.delete(km));
      pending.set(km,task);
      return task;
    }
    // Warm the other scales after the first paint. A rapid drag can then switch
    // the existing cloud without a network round trip at each slider stop.
    let warming = false;
    async function warmScales() {
      if (warming) return;
      warming = true;
      for (const { km } of manifest.scales) {
        if (controller.signal.aborted) return;
        try {
          await load(km);
        } catch {
          // A foreground selection retries the load and reports any error.
        }
      }
    }
    let revision = 0;
    async function draw() {
      const version = ++revision;
      if (!map.getLayer(cloud.id)) return;
      const weights = visibleScales(map, scale.current, manifest);
      try {
        setError("");
        if (weights.some(([km])=>!cloud.records.has(km))) setStatus(`Loading ${manifest.city}…`);
        await Promise.all(weights.map(([km])=>load(km)));
        if (controller.signal.aborted || revision !== version) return;
        cloud.weights = weights;
        map.triggerRepaint();
        if (!warming) map.once("render", () => { void warmScales(); });
        const active = weights.map(([km])=>km).join(" / ");
        setStatus(`${manifest.city} · ${active} km`);
      } catch (e) {
        if (controller.signal.aborted || revision !== version) return;
        setError(e instanceof Error ? e.message : `Could not load the ${manifest.city} map.`);
      }
    }
    refresh.current = draw;
    const attach = () => {
      if (!map.getLayer(cloud.id)) map.addLayer(cloud);
      void draw();
    };
    map.on("style.load", attach);
    if (map.isStyleLoaded()) attach();
    const updateAuto = () => { if (scale.current === "auto") void draw(); };
    map.on("zoom",updateAuto);
    map.on("resize",updateAuto);
    return () => {
      refresh.current = undefined;
      controller.abort();
      map.off("style.load",attach);
      map.off("zoom",updateAuto);
      map.off("resize",updateAuto);
    };
  }, [cityId, manifest]);
  function changeBasemap(id: BasemapId) {
    setBasemap(id);
    localStorage.setItem("semantic-map-basemap-source","manual");
    localStorage.setItem("semantic-map-basemap",id);
  }
  function changeScale(index: number) {
    const next = scales[index];
    if (scale.current === next) return;
    scale.current = next;
    setSelected(next);
    refresh.current?.();
  }
  const scaleControl = <div className="tsne-scale-control">
    <span>Scale</span>
    <DopplerRange label={`${manifest.city} t-SNE scale`} min={0} max={scales.length - 1} step={1}
      value={scales.indexOf(selected)} onPreview={changeScale} onChange={changeScale}/>
    <output>{selected === "auto" ? "Auto" : selected + " km"}</output>
  </div>;
  const sidebar = <MapControls dark={dark} onIntro={() => setIntro(true)} logs={[]} onClearLogs={noop}
    error={error} onDarkChange={enabled => {
      setDark(enabled);
      localStorage.setItem("semantic-map-theme-source","manual");
      localStorage.setItem("semantic-map-theme",enabled ? "dark" : "light");
      changeBasemap(enabled ? "openfreemap_dark" : "osm");
    }}>
    {scaleControl}
    <div className="section-heading tsne-status" role="status">{status}</div>
    {error && <GlassButton onClick={() => refresh.current?.()}>Retry</GlassButton>}
  </MapControls>;
  return <MapWorkspace dark={dark} sidebar={sidebar} revealControls={intro} cities={cities}
    tsne={{cityId, onCityChange: setCityId, status, scaleControl, register}} onWorkspaceChange={onWorkspaceChange}
    basemapId={basemap} onBasemapChange={changeBasemap}
    layers={[]} gradients={[]} selectedLayerId={null} onSelectLayer={noop}
    markedPanos={[]} selectedPanoKey={null} onMarkPano={noop} onSelectPano={noop} onRemovePano={noop}
    scoreField="zscore" progressEntries={[]}>
    <ExhibitIntroModal open={intro} version={0} onClose={()=>setIntro(false)} pages={tour} />
  </MapWorkspace>;
}
