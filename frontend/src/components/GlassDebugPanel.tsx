import { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_GLASS_FADE_CURVE, GLASS_SAMPLES, setGlassFadeCurve, syncGlassFadeMode, type GlassFadeCurve } from "../styles/glassFade";

const PARAMETERS = [
  { key: "blur", label: "Blur radius", min: 0, max: 64, step: 1, unit: "px" },
  { key: "fade-distance", label: "Fade distance", min: 0, max: 64, step: 1, unit: "px" },
  { key: "brightness", label: "Brightness", min: 0, max: 3, step: .01, unit: "" },
  { key: "contrast", label: "Contrast", min: 0, max: 2, step: .01, unit: "" }
] as const;
type Parameter = typeof PARAMETERS[number]["key"];
type Values = Record<Parameter, number>;

/** Temporary, session-only controls for the one global glass pipeline. */
export function GlassDebugPanel({ darkMode }: { darkMode: boolean }) {
  const panel = useRef<HTMLDetailsElement>(null);
  const defaults = useRef<Values | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [blurEnabled, setBlurEnabled] = useState(true);
  const [toneEnabled, setToneEnabled] = useState(true);
  const [fadeCurve, setFadeCurve] = useState<GlassFadeCurve>(DEFAULT_GLASS_FADE_CURVE);

  useLayoutEffect(() => {
    setGlassFadeCurve(fadeCurve);
    return () => setGlassFadeCurve(DEFAULT_GLASS_FADE_CURVE);
  }, [fadeCurve]);

  useLayoutEffect(() => {
    const style = getComputedStyle(panel.current!.closest(".split-pane")!);
    const initial = Object.fromEntries(PARAMETERS.map(({ key }) => {
      const profile = key === "brightness" || key === "contrast" ? darkMode ? "dark" : "light" : "default";
      return [key, parseFloat(style.getPropertyValue(`--glass-${profile}-${key}`))];
    })) as Values;
    defaults.current = initial;
    setValues(initial);
    return () => {
      for (const { key } of PARAMETERS) document.documentElement.style.removeProperty(`--glass-debug-${key}`);
      syncGlassFadeMode();
    };
  }, [darkMode]);

  useLayoutEffect(() => {
    if (!values) return;
    for (const { key, unit } of PARAMETERS) {
      const value = key === "blur" && !blurEnabled ? 0
        : (key === "brightness" || key === "contrast") && !toneEnabled ? 1 : values[key];
      document.documentElement.style.setProperty(`--glass-debug-${key}`, `${value}${unit}`);
    }
    syncGlassFadeMode();
  }, [values, blurEnabled, toneEnabled]);

  function update(key: Parameter, raw: string) {
    if (raw.trim() === "") return;
    const value = Number(raw);
    const parameter = PARAMETERS.find((entry) => entry.key === key)!;
    if (Number.isFinite(value)) setValues((current) => current && {
      ...current, [key]: Math.max(parameter.min, Math.min(parameter.max, value))
    });
  }

  return <details className="glass-debug-panel panel-section" ref={panel} open>
    <summary>Glass tuning <span>Temporary</span></summary>
    <p>Live across all glass surfaces. Theme changes and reloads reset tuning.</p>
    <div className="glass-debug-toggles">
      <label><input type="checkbox" checked={blurEnabled} onChange={(event) => setBlurEnabled(event.target.checked)} />Blur effect</label>
      <label><input type="checkbox" checked={toneEnabled} onChange={(event) => setToneEnabled(event.target.checked)} />Tone effect</label>
    </div>
    <label className="glass-debug-curve">Fade curve
      <select aria-label="Fade curve" value={fadeCurve} onChange={(event) => setFadeCurve(event.target.value as GlassFadeCurve)}>
        <option value="softmax">Softmax · smooth ends</option>
        <option value="smootherstep">Smootherstep · gentler middle</option>
        <option value="linear">Linear · original</option>
      </select>
    </label>
    {values && PARAMETERS.map(({ key, label, min, max, step, unit }) => <div className="glass-debug-row" key={key}>
      <label htmlFor={`glass-debug-${key}`}>{label}{unit && <span> ({unit})</span>}</label>
      <input id={`glass-debug-${key}`} type="range" aria-label={label} min={min} max={max} step={step}
        value={values[key]} onChange={(event) => update(key, event.target.value)} />
      <input type="number" aria-label={`${label} value`} min={min} max={max} step={step}
        value={values[key]} onChange={(event) => update(key, event.target.value)} />
    </div>)}
    <div className="glass-debug-footer"><small>{values?.["fade-distance"] === 0 ? "1 blur sample" : `${GLASS_SAMPLES.length} blur samples`} · No color fill</small>
      <button type="button" onClick={() => { setValues(defaults.current); setBlurEnabled(true); setToneEnabled(true); setFadeCurve(DEFAULT_GLASS_FADE_CURVE); }}>Reset glass</button>
    </div>
  </details>;
}
