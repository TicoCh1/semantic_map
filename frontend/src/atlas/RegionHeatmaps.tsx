import { GlassSwitch } from "@form-glass/react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CityConfig, FeatureCollection, GradientPreset, PointShape, RemoteBackendConfig, RemoteLogEntry, SemanticLayer } from "../api/types";
import { getRemoteBackendConfig, REMOTE_LOG_EVENT } from "../api/client";
import { ExhibitIntroModal } from "../components/ExhibitIntroModal";
import { GradientEditor } from "../components/GradientEditor";
import { HistogramPanel } from "../components/HistogramPanel";
import { LayerPanel } from "../components/LayerPanel";
import { MapControls } from "../components/MapControls";
import { MapWorkspace } from "../components/MapWorkspace";
import type { LayerDataProvider } from "../components/MapView";
import { PromptBar } from "../components/PromptBar";
import { SavedSearch } from "../components/SavedPromptSearch";
import { makeLayer } from "../region/data";
import { useRegionPanos } from "../region/useRegionPanos";
import type { BasemapId } from "../state/basemaps";
import { DEFAULT_CITY_CONFIGS } from "../state/cities";
import { layerGradient, layerStyleFromGradient, newSemanticLayerStyle } from "../state/color";
import { deleteGradient, getGradientPresets, saveGradient } from "../state/localProject";
import { panoPointKey } from "../state/panoDatasets";
import { colorRangeForLayer } from "../state/mapStyle";
import { exhibitConfig } from "../state/exhibitConfig";
import type { TutorialPage } from "../state/tutorialContent";
import { atlasResource, boundaryLive, boundaryPreview, cities, loadGeography, loadQuery, names, ramp, stops, type Atlas, type City, type Index, type Query } from "./data";
import { BoundarySearch, type Boundary } from "./BoundarySearch";
import { defaultRange, restoreWorkspace, saveWorkspace } from "./workspace";
import { panoramaFeatures } from "./panoramas";
import { AreaInspector } from "./AreaInspector";
import { boundary, type Circle } from "./areaSearch";
import "./areaInspector.css";

const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
const gradient: GradientPreset = {
  id: "atlas-global-z", name: "Four-city similarity", is_default: true, score_min: 0, score_max: 1,
  opacity: 0.88, stops: stops.map((value, i) => ({ value, color: ramp[i] }))
};
const cityConfigs = DEFAULT_CITY_CONFIGS.map(city => ({ ...city, datasetId: `${city.id}_512_8_45_8B` }));
type Scores = Awaited<ReturnType<typeof loadQuery>>;
const label = (q: Query) => `${names[q.city]} · ${q.name}`;
const tour: TutorialPage[] = [
  { eyebrow: "Search", target: "prompt", title: "Choose a reference landmark",
    body: "Search the 40 saved regions by city or landmark. Each selection adds a layer to the same map.", items: [] },
  { eyebrow: "Map", target: "map", title: "Compare the four cities",
    body: "Saved landmarks use 150 m windows. The colour range spans the three cities outside the reference city. Numbered markers identify the five highest-ranked distinct matches.", items: [] },
  { eyebrow: "Street view", target: "map", title: "Inspect a street scene",
    body: "Click a coloured point to open its panorama. Zoom in or use Max detail to see individual captures. Each capture inherits the score of its 100 m grid cell.", items: [] }
];

function createLayer(q: Query) {
  const limits = defaultRange(q, "zscore");
  const layer = makeLayer(q.id, q.name, newSemanticLayerStyle(gradient, limits.lower, limits.upper), q.id, "zscore");
  layer.prompt = q.category === "preview" || q.category === "live" ? `${names[q.city]} · ${q.nodes} boundary samples` : `${names[q.city]} · ${q.radius_m} m · ${q.nodes.toLocaleString()} source panoramas`;
  layer.color_range_default = limits;
  return layer;
}

export function RegionHeatmaps({ initialBasemap, initialDark, onWorkspaceChange }: { initialBasemap: BasemapId; initialDark: boolean; onWorkspaceChange: (atlas: boolean) => void }) {
  const [basemap, setBasemap] = useState(initialBasemap);
  const [dark, setDark] = useState(initialDark);
  const [atlas, setAtlas] = useState<Atlas>();
  const [layers, setLayers] = useState<SemanticLayer[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, Scores>>({});
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showSelf, setShowSelf] = useState(true);
  const [presets, setPresets] = useState<GradientPreset[]>([]);
  const [intro, setIntro] = useState(false);
  const [backend, setBackend] = useState<RemoteBackendConfig | null>(null);
  const [logs, setLogs] = useState<RemoteLogEntry[]>([]);
  const [visibleCities, setVisibleCities] = useState<CityConfig[]>([]);
  const [maps, setMaps] = useState(() => new Map<string, MapLibreMap>());
  const panos = useRegionPanos();
  const pending = useRef<AbortController | null>(null);
  const refreshRequest = useRef<AbortController | null>(null);
  const activeLayers = useRef(layers);
  activeLayers.current = layers;
  const readyLayers = useMemo(() => layers.filter(layer => layer.status === "ready"), [layers]);
  const [controlsRequest, setControlsRequest] = useState<{ open: boolean } | undefined>(() =>
    boundaryPreview || boundaryLive ? {open: !window.matchMedia("(max-width: 1023px)").matches} : undefined);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [focus, setFocus] = useState<Query>();
  const focusApplied = useRef<{query:Query;map:MapLibreMap}>();
  const [resetDraft, setResetDraft] = useState(0);
  const offlineHandled = useRef(false);
  const lastFixed = useRef<string>();
  useEffect(() => {
    if (!boundaryLive) return;
    let current = true;
    let misses = 0;
    const probe = async () => {
      let online = false;
      try { online = (await (await atlasResource("ready", {signal:AbortSignal.timeout(4000)})).json()).online === true; } catch { /* unavailable */ }
      misses = online ? 0 : misses + 1;
      if(current) setAvailable(last => online || (last===true && misses<2));
    };
    void probe();const timer = window.setInterval(probe, 5000);
    return () => {current=false;window.clearInterval(timer);};
  }, []);
  useEffect(() => {
    if (!focus) return;
    const map=maps.get(focus.city);
    if (!map || (focusApplied.current?.query===focus && focusApplied.current.map===map)) return;
    map.jumpTo({center:focus.coordinates,zoom:15});
    focusApplied.current={query:focus,map};
  }, [focus,maps]);
  const [polygon, setPolygon] = useState<Boundary | null>(null);
  const [classSamples, setClassSamples] = useState<FeatureCollection["features"]>([]);
  const [circle, setCircle] = useState<Circle | null>(null);
  const displayedId = readyLayers.find(layer => layer.visible)?.id;
  const query = atlas?.index.queries.find(q => q.id === displayedId);
  const selected = layers.find(l => l.id === selectedId) ?? null;
  const gradients = useMemo(() => [gradient, ...presets], [presets]);
  const activeGradient = useMemo(() => layerGradient(selected, gradients), [selected, gradients]);
  const options = useMemo(() => atlas?.index.queries.filter(q=>q.category!=="live").map(label) ?? [], [atlas]);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void atlasResource("index", {signal: controller.signal}).then(r => r.json()).then(async (index: Index) => {
      if (controller.signal.aborted) return;
      const linked = new URLSearchParams(location.search).get("query");
      const initial = index.queries.find(q => q.id === linked) ?? index.queries[0];
      const restored = boundaryPreview || boundaryLive ? {layers:[createLayer(initial)],selectedId:initial.id,showSelf:true}
        : restoreWorkspace(index.queries, linked, createLayer);
      const data: Record<string, Scores> = {};
      const errors: string[] = [];
      const loadScores = restored.layers.map(async layer => {
        try { data[layer.id] = await loadQuery(layer.id, index, controller.signal); }
        catch (reason) { layer.status = "failed"; errors.push(String(reason)); }
      });
      const [geography] = await Promise.all([loadGeography(index, controller.signal), Promise.all(loadScores)]);
      if (controller.signal.aborted) return;
      setScores(data); setLayers(restored.layers); setSelected(restored.selectedId); setShowSelf(restored.showSelf); setAtlas({index, geography});
      if (boundaryLive) {
        lastFixed.current = initial.id;
        setFocus(initial);
      }
      setError(errors.join(" · "));
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => { controller.abort(); pending.current?.abort(); refreshRequest.current?.abort(); };
  }, [revision]);
  useEffect(() => {
    void getRemoteBackendConfig().then(setBackend);
    void getGradientPresets().then(setPresets);
    const log = (event: Event) => setLogs(last => [(event as CustomEvent<RemoteLogEntry>).detail, ...last].slice(0, 200));
    window.addEventListener(REMOTE_LOG_EVENT, log);
    return () => window.removeEventListener(REMOTE_LOG_EVENT, log);
  }, []);
  useEffect(() => {
    if (!atlas) return;
    if (!boundaryPreview && !boundaryLive) saveWorkspace(layers, selectedId, showSelf);
    const url = new URL(location.href);
    if (selectedId) url.searchParams.set("query", selectedId); else url.searchParams.delete("query");
    history.replaceState(null, "", url);
  }, [atlas, layers, selectedId, showSelf]);

  async function choose(value: string) {
    const q = atlas?.index.queries.find(item => item.id === value || label(item) === value);
    if (!q || !atlas) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    try {
      const data = scores[q.id] ?? await loadQuery(q.id, atlas.index, controller.signal);
      if (controller.signal.aborted) return;
      setScores(previous => ({ ...previous, [q.id]: data }));
      setLayers(previous => {
        const layer = previous.find(l => l.id === q.id) ?? createLayer(q);
        return [{ ...layer, status: "ready", visible: true }, ...previous.filter(l => l.id !== q.id)];
      });
      setSelected(q.id);
      if (q.category !== "live") lastFixed.current=q.id;
      if (!boundaryPreview) {
        setPolygon(null);setClassSamples([]);setCircle(null);setResetDraft(i=>i+1);setFocus({...q});
      }
    } catch (reason) {
      if (!controller.signal.aborted) { setError(String(reason)); throw reason; }
    }
  }
  useEffect(() => {
    if (!boundaryLive || !atlas) return;
    if (available !== false) { offlineHandled.current=false; return; }
    if (offlineHandled.current) return;
    offlineHandled.current=true;
    setPolygon(null);setClassSamples([]);setResetDraft(i=>i+1);
    if (query?.category === "live") {
      const fixed=atlas.index.queries.find(q=>q.id===lastFixed.current) ?? atlas.index.queries[0];
      void choose(fixed.id).catch(reason=>setError(String(reason)));
    }
  }, [available,atlas,query]);
  async function refresh() {
    if (!atlas) { setRevision(n => n + 1); return; }
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true); setError("");
    try {
      const updated: Record<string, Scores> = {};
      const failures: string[] = [];
      await Promise.all(layers.map(async layer => {
        try { updated[layer.id] = await loadQuery(layer.id, atlas.index, controller.signal); }
        catch (reason) { failures.push(String(reason)); }
      }));
      if (controller.signal.aborted) return;
      for (const id of Object.keys(updated)) {
        if (!activeLayers.current.some(layer => layer.id === id)) delete updated[id];
      }
      setScores(previous => ({ ...previous, ...updated }));
      setLayers(previous => previous.map(l => updated[l.id] && l.status !== "ready" ? { ...l, status: "ready" } : l));
      setError(failures.join(" · "));
    } catch (reason) {
      if (!controller.signal.aborted) setError(String(reason));
    } finally {
      if (!controller.signal.aborted) setRefreshing(false);
    }
  }
  async function addBoundaryResult(q: Query, signal: AbortSignal) {
    if (!atlas) throw new Error("The map is still loading.");
    const index = {...atlas.index, queries:[...atlas.index.queries, q]};
    const data = await loadQuery(q.id, index, signal);
    if (signal.aborted) return;
    pending.current?.abort();
    setAtlas({...atlas,index});
    setScores(prev => ({...prev,[q.id]:data}));
    setLayers(prev => [createLayer(q), ...prev]);
    setSelected(q.id);
  }
  function patch(layer: SemanticLayer, update: Partial<SemanticLayer>) {
    setLayers(previous => previous.map(l => l.id === layer.id ? { ...l, ...update } : l));
  }
  function removeLayer(layer: SemanticLayer) {
    const next = layers.filter(l => l.id !== layer.id);
    setLayers(next);
    if (selectedId === layer.id) setSelected(next[0]?.id ?? null);
    setScores(previous => { const nextScores = { ...previous }; delete nextScores[layer.id]; return nextScores; });
  }
  async function style(next: GradientPreset, layer: SemanticLayer, radius: number, absolute: boolean, shape: PointShape) {
    patch(layer, { style: { ...layerStyleFromGradient(next, layer.style), point_radius: radius, absolute_radius: absolute, point_shape: shape } });
  }
  const provider = useCallback<LayerDataProvider>(async (layer, id, bounds) => {
    const data = scores[layer.id]?.[id as City];
    return data && atlas ? panoramaFeatures(id as City, atlas.geography[id as City], data, showSelf, bounds) : empty;
  }, [atlas, scores, showSelf]);
  const histogramCity = visibleCities[0];
  const histogram = useMemo((): FeatureCollection => {
    const city = histogramCity?.id as City;
    const values = selectedId && scores[selectedId]?.[city];
    if (!values || !atlas) return empty;
    return { type: "FeatureCollection", features: values.flatMap((cell, i) => !showSelf && cell.self ? [] : [{
      type: "Feature", geometry: { type: "Point", coordinates: atlas.geography[city].points[i] },
      properties: { score: cell.raw, zscore: cell.z }
    }]) };
  }, [atlas, scores, selectedId, histogramCity, showSelf]);
  const areas = useMemo(() => {
    const sourceCity = polygon?.city ?? circle?.city ?? query?.city;
    const points = polygon?.points;
    let area = empty;
    if (points && points.length === 2) {
      area = {type:"FeatureCollection", features:[{type:"Feature", properties:{}, geometry:{type:"LineString", coordinates:points}}]};
    } else {
      const rings = points ? (points.length >= 3 ? [[...points, points[0]]] : null)
        : circle ? boundary(circle) : query?.area;
      if (rings) area = {type:"FeatureCollection", features:[{type:"Feature", properties:{}, geometry:{type:"Polygon", coordinates:rings}}]};
    }
    if (polygon && classSamples.length) area = {...area,features:[...area.features,...classSamples]};
    return Object.fromEntries(cities.map(city => [city, city === sourceCity ? area : empty]));
  }, [query, circle, polygon, classSamples]);
  const register = useCallback((city: string, map: MapLibreMap) => {
    setMaps(previous => new Map(previous).set(city, map));
    return () => setMaps(previous => {
      if (previous.get(city) !== map) return previous;
      const next = new Map(previous); next.delete(city); return next;
    });
  }, []);
  useEffect(() => {
    if (!query || !atlas || !scores[query.id]) return;
    let current = true;
    const markers: Marker[] = [];
    for (const [id, map] of maps) {
      const city = id as City;
      for (const hit of query.targets[city].hits) {
        const el = document.createElement("button");
        el.type = "button"; el.className = "pano-map-marker region-rank-marker"; el.textContent = String(hit.rank);
        el.title = `${names[city]} #${hit.rank}${hit.nearest_landmark ? ` · ${hit.district} · ${hit.dist_m} m from ${hit.nearest_landmark}` : ""} · z ${hit.sim_z.toFixed(2)}`;
        el.setAttribute("aria-label", el.title);
        el.onclick = async event => {
          event.stopPropagation();
          map.easeTo({ center: hit.coordinates, zoom: 14, duration: 350 });
          if (boundaryPreview) return;
          const cell = atlas.geography[city].points.findIndex(([x,y]) => x === hit.coordinates[0] && y === hit.coordinates[1]);
          let fc: FeatureCollection;
          try { fc = await panoramaFeatures(city, atlas.geography[city], scores[query.id][city], true); }
          catch (reason) { if (current) setError(String(reason)); return; }
          if (!current) return;
          const feature = fc.features[cell];
          if (feature?.geometry.type !== "Point") return;
          const [lon, lat] = feature.geometry.coordinates, props = feature.properties;
          const dataset = cityConfigs.find(c => c.id === city)!.datasetId;
          panos.mark({ pano_id: String(props.pano_id), pano_key: panoPointKey(dataset, String(props.pano_id), lon, lat),
            cell_index: cell, date: Number(props.date), dataset_id: dataset,
            city_id: city, lon, lat, score: hit.sim_raw, zscore: hit.sim_z, source_layer_id: query.id, source_layer_name: query.name });
        };
        markers.push(new Marker({ element: el }).setLngLat(hit.coordinates).addTo(map));
      }
    }
    return () => { current = false; markers.forEach(marker => marker.remove()); };
  }, [atlas, maps, query, scores, panos.mark]);

  const inspectedPanos = useMemo(() => panos.panos.map(pano => {
    const cell = pano.cell_index;
    if (cell === undefined) return pano;
    return { ...pano, layer_values: layers.map(layer => {
      const value = scores[layer.id]?.[pano.city_id as City]?.[cell];
      return { layer_id: layer.id, layer_name: layer.name, visible: layer.visible,
        score: value?.raw ?? null, zscore: value?.z ?? null, date: pano.date };
    }) };
  }), [panos.panos, layers, scores]);

  const search = <SavedSearch options={options} loadError={!atlas ? error : undefined} disabled={!atlas} loading={!atlas && !error} landmarks onChoose={choose} />;
  const range = colorRangeForLayer(selected);
  const sidebar = <MapControls dark={dark} onIntro={() => setIntro(true)} error={error} logs={logs}
    onClearLogs={() => setLogs([])} onDarkChange={enabled => {
        setDark(enabled);
        localStorage.setItem("semantic-map-theme-source", "manual");
        localStorage.setItem("semantic-map-theme", enabled ? "dark" : "light");
        const next = enabled ? "openfreemap_dark" : "osm";
        setBasemap(next); localStorage.setItem("semantic-map-basemap", next);
      }}>
    {atlas && (boundaryPreview || (boundaryLive && available)) && <BoundarySearch key={resetDraft} maps={maps} value={polygon} onChange={setPolygon} onSamples={setClassSamples} onResult={addBoundaryResult} requestControls={setControlsRequest}/>}
    {boundaryLive && available === false && <small role="status">GPU offline · Choose a saved landmark below.</small>}
    {!boundaryPreview && <PromptBar searchSlot={search} backendConfig={backend} remoteConfigLocked={exhibitConfig.lockRunpodUrl} onConfigChange={config => {
      if (config.baseUrl !== backend?.baseUrl || config.token !== backend?.token || config.enabled !== backend?.enabled) {
        setAtlas(undefined); setLayers([]); setScores({}); setCircle(null); panos.clear(); setRevision(v => v+1);
      }
      setBackend(config);
    }} onCreate={choose} />}
    {!boundaryPreview && !boundaryLive && <AreaInspector atlas={atlas} maps={maps} circle={circle} onCircle={setCircle} onChoose={choose} requestControls={setControlsRequest} />}
    <LayerPanel layers={layers} gradients={gradients} selectedLayerId={selectedId} onSelect={setSelected}
      onToggle={l => patch(l, { visible: !l.visible })} onDelete={removeLayer} onRefreshAll={refresh} refreshingAll={refreshing}
      onReorder={ids => setLayers(ids.map(id => layers.find(l => l.id === id)!))}
      highlightHiddenEyes={!!layers.length && layers.every(l => !l.visible)} />
    <HistogramPanel layer={selected} gradient={activeGradient} city={histogramCity} data={histogram} range={range}
      onRangeChange={async (l, lower, upper) => patch(l, { color_range_override: { field: l.score_property, lower, upper } })}
      onResetRange={range.overridden ? async l => patch(l, { color_range_override: null }) : undefined}
      smartRangeTitle="Use the minimum and maximum across the three non-source cities"
      onSmartRange={async l => {
        const limits = defaultRange(atlas!.index.queries.find(q => q.id === l.id)!, l.score_property);
        patch(l, {color_range_override: {field: l.score_property, source: "smart", ...limits}});
        return limits;
      }}
      onPropertyChange={async (l, field) => {
        const limits = defaultRange(atlas!.index.queries.find(q => q.id === l.id)!, field);
        patch(l, { score_property: field, color_range_override: null, color_range_default: limits,
          style: {...l.style, score_min: limits.lower, score_max: limits.upper} });
      }} />
    <GradientEditor layer={selected} gradient={activeGradient} gradients={gradients} onApply={style}
      onSavePreset={async (g, l, r, a, s) => { const saved = await saveGradient(g); setPresets(await getGradientPresets()); await style(saved, l, r, a, s); }}
      onDeletePreset={async g => { await deleteGradient(g.id); setPresets(await getGradientPresets()); }} />
    <GlassSwitch label="Show cells within 300 m of source" checked={showSelf} onChange={setShowSelf} />
  </MapControls>;
  return <MapWorkspace dark={dark} revealControls={intro} controlsRequest={controlsRequest} sidebar={sidebar} cities={cityConfigs} onWorkspaceChange={onWorkspaceChange}
    layers={readyLayers} gradients={gradients} selectedLayerId={selectedId} onSelectLayer={setSelected}
    basemapId={basemap} onBasemapChange={id => { setBasemap(id); localStorage.setItem("semantic-map-basemap-source", "manual"); localStorage.setItem("semantic-map-basemap", id); }} onVisibleCitiesChange={setVisibleCities}
    regionHeatmaps={{ selector: search, focus, radiusMeters: query?.radius_m, description: boundaryPreview ? "Boundary preview · sample data" : query?.category==="live" ? "Custom boundary · GPU match" : undefined, dataProvider: provider, register, selectionAreas: areas }}
    markedPanos={inspectedPanos} selectedPanoKey={panos.selectedKey} onMarkPano={boundaryPreview ? () => {} : panos.mark}
    onSelectPano={panos.select} onRemovePano={panos.remove}
    scoreField={selected?.score_property === "score" ? "score" : "zscore"} progressEntries={[]}>
    <ExhibitIntroModal open={intro} version={0} onClose={() => setIntro(false)} pages={tour} />
  </MapWorkspace>;
}
