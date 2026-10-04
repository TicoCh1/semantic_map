import { GlassSwitch, DopplerRange } from "@form-glass/react";
import { Glass, GlassButton, GlassField } from "@form-glass/react";
import { Check, ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { GradientPreset, GradientStop, SemanticLayer } from "../api/types";
import {
  DEFAULT_POINT_RADIUS,
  clamp,
  copyGradient,
  gradientCss,
  normalizeHex,
  slugify
} from "../state/color";

type GradientEditorProps = {
  layer: SemanticLayer | null;
  gradient: GradientPreset | null;
  gradients: GradientPreset[];
  onApply: (gradient: GradientPreset, layer: SemanticLayer, pointRadius: number, absoluteRadius: boolean) => Promise<void>;
  onSavePreset: (gradient: GradientPreset, layer: SemanticLayer, pointRadius: number, absoluteRadius: boolean) => Promise<void>;
  onDeletePreset: (gradient: GradientPreset, layer: SemanticLayer) => Promise<void>;
};

export function GradientEditor({ layer, gradient, gradients, onApply, onSavePreset, onDeletePreset }: GradientEditorProps) {
  const [draft, setDraft] = useState<GradientPreset | null>(gradient);
  const [selectedStop, setSelectedStop] = useState(0);
  const [presetOpen, setPresetOpen] = useState(false);
  const [pointRadius, setPointRadius] = useState(DEFAULT_POINT_RADIUS);
  const [absoluteRadius, setAbsoluteRadius] = useState(false);
  const [hexDraft, setHexDraft] = useState("");
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ index: number; left: number; width: number } | null>(null);

  useEffect(() => {
    setDraft(gradient ? copyGradient(gradient) : null);
    setSelectedStop(0);
    setPointRadius(clamp(layer?.style.point_radius ?? DEFAULT_POINT_RADIUS, 1, 10));
    setAbsoluteRadius(layer?.style.absolute_radius ?? false);
  }, [gradient?.id, layer?.id]);

  const stops = useMemo(() => [...(draft?.stops ?? [])].sort((a, b) => a.value - b.value), [draft]);
  // Keep editor indices stable while stops cross; only sort the rendered/saved ramp.
  const stop = draft?.stops[selectedStop] ?? draft?.stops[0] ?? null;
  const savedDraft = draft ? gradients.find((item) => item.id === draft.id) : null;
  const canDeletePreset = Boolean(savedDraft && !savedDraft.is_default);
  const hasCollidingStops = stops.some((item, index) => index > 0 && item.value <= stops[index - 1].value);
  useEffect(() => setHexDraft(stop?.color ?? ""), [stop?.color, selectedStop, layer?.id]);

  if (!layer || !draft || !stop) {
    return (
      <section className="panel-section gradient-panel" data-tour-target="style">
        <div className="section-heading">
          <span>Colour Scheme</span>
          <strong>Gradient</strong>
        </div>
      </section>
    );
  }

  function updateDraft(mutator: (next: GradientPreset) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = copyGradient(current);
      mutator(next);
      return next;
    });
  }

  function updateStop(mutator: (stop: GradientStop) => void) {
    updateDraft((next) => {
      const target = next.stops[selectedStop] ?? next.stops[0];
      if (target) mutator(target);
    });
  }

  function startStopDrag(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    setSelectedStop(index);
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { index, left: rect.left, width: rect.width };
  }

  function addStop() {
    if (!stop) return;
    const nextStop = {
      value: clamp(stop.value + 0.08, 0, 1),
      color: stop.color
    };
    updateDraft((next) => {
      next.stops.push(nextStop);
      setSelectedStop(next.stops.length - 1);
    });
  }

  function deleteStop() {
    if (stops.length <= 2) return;
    updateDraft((next) => {
      next.stops.splice(selectedStop, 1);
      setSelectedStop(Math.max(0, selectedStop - 1));
    });
  }

  function presetIdForSave(current: GradientPreset) {
    const currentExisting = gradients.find((item) => item.id === current.id);
    if (currentExisting && !currentExisting.is_default) return current.id;

    const base = slugify(current.name || "custom_ramp");
    const existing = gradients.find((item) => item.id === base);
    if (!existing?.is_default) return base;

    let candidate = `${base}_custom`;
    let index = 2;
    while (gradients.some((item) => item.id === candidate)) {
      candidate = `${base}_custom_${index}`;
      index += 1;
    }
    return candidate;
  }

  async function applyToLayer() {
    const currentDraft = draft;
    const currentLayer = layer;
    if (!currentDraft || !currentLayer || hasCollidingStops) return;

    await onApply(
      {
        ...currentDraft,
        stops,
        opacity: currentLayer.style.opacity,
        score_min: currentLayer.style.score_min,
        score_max: currentLayer.style.score_max
      },
      currentLayer,
      pointRadius,
      absoluteRadius
    );
  }

  async function savePreset() {
    const currentDraft = draft;
    const currentLayer = layer;
    if (!currentDraft || !currentLayer || hasCollidingStops) return;

    const normalized: GradientPreset = {
      ...currentDraft,
      id: presetIdForSave(currentDraft),
      name: currentDraft.name.trim() || "Custom ramp",
      stops: stops,
      opacity: currentLayer.style.opacity,
      score_min: currentLayer.style.score_min,
      score_max: currentLayer.style.score_max,
      is_default: false,
      updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
    };
    await onSavePreset(normalized, currentLayer, pointRadius, absoluteRadius);
  }

  async function deletePreset() {
    const currentDraft = draft;
    const currentLayer = layer;
    if (!currentDraft || !currentLayer || !canDeletePreset) return;
    if (!window.confirm(`Delete colour scheme "${currentDraft.name}"? Layers using it will keep their current copied colours.`)) return;
    await onDeletePreset(currentDraft, currentLayer);
  }

  function setHex(value: string) {
    const normalized = normalizeHex(value);
    if (!normalized) return;
    updateStop((target) => {
      target.color = normalized;
    });
  }

  return (
    <section className="panel-section gradient-panel" data-tour-target="style">
      <div className="section-heading">
          <span>Colour Scheme</span>
          <strong>Gradient</strong>
      </div>

      <div className="preset-picker">
        <button className="preset-trigger" aria-label="Choose color ramp" aria-expanded={presetOpen} onClick={() => setPresetOpen((open) => !open)}>
          <span className="preset-swatch">
            <span style={{ background: gradientCss({ ...draft, stops }) }} />
          </span>
          <span>{draft.name}</span>
          <ChevronDown size={16} />
        </button>
        {presetOpen ? (
          <Glass className="preset-menu" fade={[]} material="control">
            <div className="glass-scroll-content">
            {gradients.map((preset) => (
              <button
                key={preset.id}
                className="preset-option"
                onClick={() => {
                  const next = copyGradient(preset);
                  setDraft(next);
                  setSelectedStop(0);
                  setPresetOpen(false);
                }}
              >
                <span className="preset-swatch">
                  <span style={{ background: gradientCss(preset) }} />
                </span>
                <span>{preset.name}</span>
                <small>{preset.is_default ? "Preset" : "Saved"}</small>
              </button>
            ))}
            </div>
          </Glass>
        ) : null}
      </div>

      <div className="ramp-editor">
      <div
        ref={stripRef}
        className="gradient-strip"
        style={{ background: gradientCss({ ...draft, stops }) }}
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const value = clamp((event.clientX - rect.left) / rect.width, 0, 1);
          updateDraft((next) => {
            next.stops.push({ value, color: stop.color });
            setSelectedStop(next.stops.length - 1);
          });
        }}
      >
        {draft.stops.map((item, index) => (
          <button
            key={index}
            className={`gradient-stop${index === selectedStop ? " is-selected" : ""}`}
            style={{ left: `${item.value * 100}%`, "--stop-color": item.color } as CSSProperties}
            onClick={() => setSelectedStop(index)}
            onPointerDown={(event) => startStopDrag(event, index)}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              const value = clamp((event.clientX - drag.left) / drag.width, 0, 1);
              updateDraft((next) => { next.stops[drag.index].value = value; });
            }}
            onLostPointerCapture={() => { dragRef.current = null; }}
            onPointerUp={(event) => { dragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 0.1 : 0.01;
              const value = event.key === "ArrowLeft" ? item.value - delta : event.key === "ArrowRight" ? item.value + delta
                : event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
              if (value === null) return;
              event.preventDefault();
              setSelectedStop(index);
              updateDraft((next) => { next.stops[index].value = clamp(value, 0, 1); });
            }}
            aria-label={`Color stop ${index + 1}`}
            aria-pressed={index === selectedStop}
            title={`${Math.round(item.value * 1000) / 10}% ${item.color}`}
          />
        ))}
      </div>
      <div className="ramp-endpoints"><span>Low</span><span>High</span></div>
      {hasCollidingStops ? <p className="stop-position-error" role="status">Move overlapping stops apart before applying.</p> : null}
      </div>

      <div className="stop-editor-heading">
        <span>Selected stop <strong>{selectedStop + 1}</strong></span>
        <div className="gradient-tools">
          <GlassButton className="secondary-button" onClick={addStop} title="Add color stop"><Plus size={14} />Add stop</GlassButton>
          <button className="danger-button compact-action" onClick={deleteStop} disabled={stops.length <= 2} title="Delete selected color stop"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="stop-editor-fields">
        <div className="stop-color-field"><span>Color</span>
          <div className="color-top-row">
            <input aria-label="Stop color" className="native-color" type="color" value={stop.color} onChange={(event) => setHex(event.target.value)} />
            <GlassField className="hex-glass-field"><input aria-label="Stop hex color" className="hex-input" value={hexDraft} maxLength={7}
              onChange={(event) => { setHexDraft(event.target.value); setHex(event.target.value); }}
              onBlur={() => setHexDraft(stop.color)} onKeyDown={(event) => { if (event.key === "Enter") { setHex(hexDraft); event.currentTarget.blur(); } }} /></GlassField>
          </div>
        </div>
        <label className="stop-position-field" htmlFor="stop-position"><span>Position</span><GlassField className="percent-input">
          <input
            id="stop-position"
            aria-label="Stop position"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Math.round(stop.value * 1000) / 10}
            onChange={(event) => updateStop((target) => {
              target.value = clamp(Number(event.target.value) / 100, 0, 1);
            })}
          />
          <span aria-hidden="true">%</span>
        </GlassField></label>
      </div>

      <div className="point-style-controls">
        <Slider label="Point size" min={1} max={10} step={0.1} value={pointRadius} onChange={(value) => setPointRadius(clamp(value, 1, 10))} />
        <GlassSwitch className="point-scale-switch" label="Scale points with map zoom" checked={absoluteRadius} onChange={setAbsoluteRadius} />
      </div>
      <div className="gradient-apply-row">
        <GlassButton className="secondary-button style-apply" disabled={hasCollidingStops} onClick={() => void applyToLayer()} title="Apply to layer"><Check size={16} />Apply style</GlassButton>
        <span>To selected layer</span>
      </div>
      <details className="preset-save">
        <summary><Save size={14} />Save as preset<ChevronDown size={14} /></summary>
        <div className="preset-save-fields">
          <label htmlFor="gradient-name">Preset name</label>
          <div className="preset-save-row">
            <GlassField><input id="gradient-name" className="text-input" value={draft.name} onChange={(event) => updateDraft((next) => { next.name = event.target.value; })} /></GlassField>
            <GlassButton className="secondary-button" disabled={hasCollidingStops} onClick={() => void savePreset()} title="Save preset"><Save size={15} />Save</GlassButton>
            <button className="danger-button compact-action" onClick={() => void deletePreset()} disabled={!canDeletePreset} title="Delete saved colour scheme"><Trash2 size={15} /></button>
          </div>
        </div>
      </details>
    </section>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-row">
      <span>{label}</span>
      <DopplerRange label={label} min={min} max={max} step={step} value={value} onChange={onChange} />
      <GlassField><input type="number" aria-label={`${label} value`} min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></GlassField>
    </div>
  );
}
