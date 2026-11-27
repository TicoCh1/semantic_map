import { GlassButton, GlassInput } from "@form-glass/react";
import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { names, type Atlas, type City } from "./data";
import { inspectArea, type Circle, type Composition } from "./areaSearch";

type Props = { atlas?: Atlas; maps: Map<string, MapLibreMap>; circle: Circle | null;
  requestControls: (request: { open: boolean }) => void; onCircle: (value: Circle | null) => void; onChoose: (id: string) => Promise<void> };

export function AreaInspector({ atlas, maps, circle, onCircle, onChoose, requestControls }: Props) {
  const [drawing, setDrawing] = useState(false);
  const [radius, setRadius] = useState("150");
  const [checked, setChecked] = useState<{ selection: Circle; data: Composition } | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);

  const valid = /^\d+$/.test(radius) && +radius >= 50 && +radius <= 600;
  const ready = checked?.selection === circle && valid && !drawing ? checked?.data : undefined;
  useEffect(() => {
    if (!drawing) return;
    const handlers: (() => void)[] = [];
    for (const [name, map] of maps) {
      const container = map.getContainer();
      container.classList.add("area-picking");
      const pick = (event: MouseEvent) => {
        if (event.target !== map.getCanvas()) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const rect = map.getCanvas().getBoundingClientRect();
        const p = map.unproject([event.clientX - rect.left, event.clientY - rect.top]);
        onCircle({ city: name as City, lon: p.lng, lat: p.lat, radius: Number(radius) });
        setDrawing(false);
        if (window.matchMedia("(max-width: 760px)").matches) requestControls({ open: true });
      };
      container.addEventListener("click", pick, true);
      handlers.push(() => { container.removeEventListener("click", pick, true); container.classList.remove("area-picking"); });
    }
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawing(false); };
    window.addEventListener("keydown", escape);
    return () => { handlers.forEach(f => f()); window.removeEventListener("keydown", escape); };
  }, [drawing, maps, radius, onCircle, requestControls]);
  useEffect(() => {
    setChecked(null); setError(""); setBusy(false);

    if (!circle || !valid || drawing) return;
    const request = new AbortController();
    const timer = window.setTimeout(() => {
      inspectArea(circle, request.signal).then(data => {
        if (!request.signal.aborted) setChecked({ selection: circle, data });
      }).catch(e => { if (!request.signal.aborted) setError(String(e.message)); });
    }, 180);
    return () => { clearTimeout(timer); request.abort(); };
  }, [circle, valid, drawing]);
  const nearest = circle && atlas?.index.queries.filter(q => q.city === circle.city).map(q => {
    const dx = (q.coordinates[0]-circle.lon) * Math.cos(circle.lat*Math.PI/180);
    return {q, km: 111.32*Math.hypot(dx, q.coordinates[1]-circle.lat)};
  }).sort((a,b) => a.km-b.km)[0];
  async function openNearest() {
    if (!nearest) return;
    setBusy(true);
    try { await onChoose(nearest.q.id); onCircle(null); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  return <section className="panel-section area-inspector" aria-label="Area composition">
    <div className="section-heading"><strong>Area composition</strong></div>
    <div className="area-actions">
      <GlassButton className="secondary-button" disabled={!atlas || !maps.size || !valid} onClick={() => {
        setDrawing(!drawing);
        if (!drawing && window.matchMedia("(max-width: 760px)").matches) requestControls({ open: false });
      }}>
        {drawing ? "Cancel selection" : circle ? "Move center" : "Select area"}
      </GlassButton>
      {(circle || drawing) && <GlassInput type="number" label="Radius (m)" aria-label="Radius in meters" min={50} max={600} value={radius}
        onChange={e => { const v=e.target.value; setRadius(v); if (circle && +v >= 50 && +v <= 600) onCircle({ ...circle, radius: +v }); }} />}
    </div>
    {drawing && <p role="status">Click the center on either map.</p>}
    {!valid && <p role="alert">Use a radius from 50 to 600 m.</p>}
    {circle && !drawing && <div aria-live="polite">
      <small>{names[circle.city]} · {circle.radius} m{ready && ` · ${ready.count} captures · ${ready.effective_count} effective`}</small>
      {ready ? <>
        {!!ready.themes.length && <div className="area-columns"><span>Feature</span><span>Cover</span><span>City z</span></div>}
        <ul>{ready.themes.map(theme => <li key={theme.label}>
          <span title={theme.prompt}>{theme.label}<span className="area-track"><i style={{ width: (100*theme.coverage) + "%" }} /></span></span>
          <span>{(100*theme.coverage).toFixed(0)}%</span><span>{theme.z.toFixed(1)}</span>
        </li>)}</ul>
        {!!ready.themes.length && <small>Cover = KDE-weighted share above city z ≥ 1.</small>}
        {ready.warning && <p>{ready.warning}</p>}
        {nearest && ready.count > 0 && <GlassButton className="secondary-button" disabled={busy} onClick={openNearest}>Open {nearest.q.name} · {nearest.km.toFixed(1)} km away</GlassButton>}
      </> : !error && valid && <p>Checking area…</p>}
      <GlassButton className="secondary-button" onClick={() => onCircle(null)}>Clear selection</GlassButton>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
