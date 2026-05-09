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
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(gradient ? copyGradient(gradient) : null);
    setSelectedStop(0);
    setPointRadius(clamp(layer?.style.point_radius ?? DEFAULT_POINT_RADIUS, 1, 10));
    setAbsoluteRadius(layer?.style.absolute_radius ?? false);
  }, [gradient?.id, layer?.id]);

  const stops = useMemo(() => [...(draft?.stops ?? [])].sort((a, b) => a.value - b.value), [draft]);
  const stop = stops[selectedStop] ?? stops[0] ?? null;
  const savedDraft = draft ? gradients.find((item) => item.id === draft.id) : null;
  const canDeletePreset = Boolean(savedDraft && !savedDraft.is_default);

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
      next.stops.sort((a, b) => a.value - b.value);
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

    const onMove = (moveEvent: PointerEvent) => {
      const value = clamp((moveEvent.clientX - rect.left) / rect.width, 0, 1);
      updateDraft((next) => {
        const target = next.stops[index];
        if (target) target.value = value;
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function addStop() {
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
    if (!currentDraft || !currentLayer) return;

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
    if (!currentDraft || !currentLayer) return;

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
      <div className="section-heading with-action">
        <div>
          <span>Colour Scheme</span>
          <strong>Gradient</strong>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => void applyToLayer()} title="Apply to layer">
            <Check size={16} />
            Apply
          </button>
          <button className="secondary-button" onClick={() => void savePreset()} title="Save preset">
            <Save size={16} />
            Save
          </button>
          <button className="danger-button compact-action" onClick={() => void deletePreset()} disabled={!canDeletePreset} title="Delete saved colour scheme">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <label>Color ramp</label>
      <div className="preset-picker">
        <button className="preset-trigger" onClick={() => setPresetOpen((open) => !open)}>
          <span className="preset-swatch">
            <span style={{ background: gradientCss({ ...draft, stops }) }} />
          </span>
          <span>{draft.name}</span>
          <ChevronDown size={16} />
        </button>
        {presetOpen ? (
          <div className="preset-menu">
            {gradients.map((preset) => (
              <button
                key={preset.id}
                className="preset-option"
                onClick={() => {
                  const next = copyGradient(preset);
                  setDraft(next);
                  setSelectedStop(0);
                  setPresetOpen(false);
                  void onApply({ ...next, score_min: layer.style.score_min, score_max: layer.style.score_max }, layer, pointRadius, absoluteRadius);
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
        ) : null}
      </div>

      <label htmlFor="gradient-name">Preset name</label>
      <input
        id="gradient-name"
        className="text-input"
        value={draft.name}
        onChange={(event) => updateDraft((next) => {
          next.name = event.target.value;
        })}
      />

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
        {stops.map((item, index) => (
          <button
            key={`${item.color}-${index}`}
            className={`gradient-stop${index === selectedStop ? " is-selected" : ""}`}
            style={{ left: `${item.value * 100}%`, "--stop-color": item.color } as CSSProperties}
            onClick={() => setSelectedStop(index)}
            onPointerDown={(event) => startStopDrag(event, index)}
            title={`${Math.round(item.value * 1000) / 10}% ${item.color}`}
          />
        ))}
      </div>

      <div className="gradient-tools">
        <button className="secondary-button" onClick={addStop}>
          <Plus size={16} />
          Stop
        </button>
        <button className="danger-button" onClick={deleteStop} disabled={stops.length <= 2}>
          <Trash2 size={16} />
          Stop
        </button>
      </div>

      <div className="point-style-controls">
        <Slider label="Size" min={1} max={10} step={0.1} value={pointRadius} onChange={(value) => setPointRadius(clamp(value, 1, 10))} />
        <label className="checkbox-row">
          <input type="checkbox" checked={absoluteRadius} onChange={(event) => setAbsoluteRadius(event.target.checked)} />
          <span>Absolute map size</span>
        </label>
      </div>

      <div className="stop-position-row">
        <label htmlFor="stop-position">Stop position</label>
        <div className="percent-input">
          <input
            id="stop-position"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Math.round(stop.value * 1000) / 10}
            onChange={(event) => updateStop((target) => {
              target.value = clamp(Number(event.target.value) / 100, 0, 1);
            })}
          />
          <span>%</span>
        </div>
      </div>

      <div className="color-top-row">
        <input className="native-color" type="color" value={stop.color} onChange={(event) => setHex(event.target.value)} />
        <input className="hex-input" value={stop.color} onChange={(event) => setHex(event.target.value)} />
      </div>
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
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
