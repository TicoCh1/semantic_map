import { ThemedSelect } from "./ThemedSelect";
import { GlassButton, GlassField } from "@form-glass/react";
import { Check } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { getLayerGeojson } from "../api/client";
import type { CityConfig, CityId, FeatureCollection, GradientPreset, SemanticLayer } from "../api/types";
import { gradientColorForScore, gradientCss } from "../state/color";

type HistogramPanelProps = {
  layer: SemanticLayer | null;
  gradient: GradientPreset | null;
  data?: FeatureCollection;
  city?: CityConfig;
  cities?: CityConfig[];
  onCityChange?: (cityId: CityId) => void;
  rangeMode?: "default" | "manual" | "smart";
  onResetRange?: (layer: SemanticLayer) => Promise<void>;
  onSmartRange?: (layer: SemanticLayer) => Promise<{ lower: number; upper: number }>;
  onRangeChange?: (layer: SemanticLayer, scoreMin: number, scoreMax: number) => Promise<void>;
  onPropertyChange?: (layer: SemanticLayer, property: string) => Promise<void>;
};

type HistogramBin = {
  count: number;
  color: string;
};

const BUCKET_WIDTH_STORAGE_KEY = "semantic-map-histogram-bucket-width";
const BUCKET_WIDTH_OPTIONS = [0.05, 0.02, 0.01];

export function HistogramPanel({ layer, gradient, data, city, cities, onCityChange, rangeMode, onResetRange, onSmartRange, onRangeChange, onPropertyChange }: HistogramPanelProps) {
  const [values, setValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMin, setDraftMin] = useState("0");
  const [draftMax, setDraftMax] = useState("1");
  const [rangeSaving, setRangeSaving] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [propertySaving, setPropertySaving] = useState(false);
  const [bucketWidth, setBucketWidth] = useState(readSavedBucketWidth);

  useEffect(() => {
    window.localStorage.setItem(BUCKET_WIDTH_STORAGE_KEY, String(bucketWidth));
  }, [bucketWidth]);

  useEffect(() => {
    const onReset = () => setBucketWidth(readSavedBucketWidth());
    window.addEventListener("semantic-map-exhibit-reset", onReset);
    return () => window.removeEventListener("semantic-map-exhibit-reset", onReset);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!layer) {
      setValues([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void (data ? Promise.resolve(data) : getLayerGeojson(layer.id, city?.id))
      .then((geojson) => {
        if (cancelled) return;
        const property = layer.score_property || "score";
        const nextValues = geojson.features
          .map((feature) => Number(feature.properties?.[property]))
          .filter((value) => Number.isFinite(value));
        setValues(nextValues);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Histogram unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data, city?.id, layer?.id, city ? layer?.source_paths?.[city.id] : layer?.source_path, layer?.score_property]);

  useEffect(() => {
    const scoreMin = layer?.style.score_min ?? gradient?.score_min ?? 0;
    const scoreMax = layer?.style.score_max ?? gradient?.score_max ?? 1;
    setDraftMin(formatInputValue(scoreMin));
    setDraftMax(formatInputValue(scoreMax));
    setRangeError(null);
  }, [city?.id, gradient?.score_min, gradient?.score_max, layer?.id, layer?.score_property,
    layer?.style.score_min, layer?.style.score_max, rangeMode]);

  const histogram = useMemo(() => {
    if (!layer || !gradient || !values.length) return null;

    const scoreMin = layer.style.score_min ?? gradient.score_min ?? 0;
    const scoreMax = layer.style.score_max ?? gradient.score_max ?? 1;
    const rangeMin = Math.min(scoreMin, scoreMax);
    const rangeMax = Math.max(scoreMin, scoreMax);
    const span = rangeMax - rangeMin || 1;
    const safeBucketWidth = BUCKET_WIDTH_OPTIONS.includes(bucketWidth) ? bucketWidth : BUCKET_WIDTH_OPTIONS[0];
    const binCount = Math.max(1, Math.ceil(span / safeBucketWidth));
    const counts = Array.from({ length: binCount }, () => 0);
    let visibleCount = 0;
    let below = 0;
    let above = 0;

    for (const value of values) {
      if (value < rangeMin) below += 1;
      else if (value > rangeMax) above += 1;
      else visibleCount += 1;
      if (!city && (value < rangeMin || value > rangeMax)) continue;
      const rawIndex = Math.floor((value - rangeMin) / safeBucketWidth);
      const index = Math.min(Math.max(rawIndex, 0), binCount - 1);
      counts[index] += 1;
    }

    const bins: HistogramBin[] = counts.map((count, index) => {
      const bucketStart = rangeMin + index * safeBucketWidth;
      const bucketEnd = Math.min(rangeMax, bucketStart + safeBucketWidth);
      const center = (bucketStart + bucketEnd) / 2;
      return {
        count,
        color: gradientColorForScore(gradient, city && index === binCount - 1 && above ? rangeMax
          : city && index === 0 && below ? rangeMin : center, rangeMin, rangeMax)
      };
    });

    return {
      bins,
      maxCount: Math.max(...counts, 1),
      rangeMin,
      rangeMax,
      midpoint: rangeMin + span / 2,
      dataMin: values.reduce((minimum, value) => Math.min(minimum, value), Infinity),
      dataMax: values.reduce((maximum, value) => Math.max(maximum, value), -Infinity),
      visibleCount,
      below,
      above,
      bucketWidth: safeBucketWidth
    };
  }, [bucketWidth, city, gradient, layer, values]);

  const canApplyRange =
    Boolean(layer && onRangeChange) &&
    draftMin.trim() !== "" && draftMax.trim() !== "" &&
    Number.isFinite(Number(draftMin)) &&
    Number.isFinite(Number(draftMax)) &&
    Number(draftMin) < Number(draftMax) &&
    !rangeSaving;

  async function applyRange() {
    const currentLayer = layer;
    if (!currentLayer || !onRangeChange || !canApplyRange) return;

    const scoreMin = Number(draftMin);
    const scoreMax = Number(draftMax);
    await saveRange(() => onRangeChange(currentLayer, scoreMin, scoreMax));
  }

  async function saveRange(apply: () => Promise<void>) {
    setRangeSaving(true);
    setRangeError(null);
    try {
      await apply();
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : "Range update failed");
    } finally {
      setRangeSaving(false);
    }
  }

  async function applySmartRange(currentLayer: SemanticLayer) {
    if (!onSmartRange) return;
    await saveRange(async () => {
      const range = await onSmartRange(currentLayer);
      setDraftMin(formatInputValue(range.lower));
      setDraftMax(formatInputValue(range.upper));
    });
  }

  function handleRangeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && canApplyRange) void applyRange();
  }

  async function changeProperty(property: string) {
    const currentLayer = layer;
    if (!currentLayer || !onPropertyChange || property === currentLayer.score_property) return;
    setPropertySaving(true);
    setRangeError(null);
    try {
      await onPropertyChange(currentLayer, property);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : "Score field update failed");
    } finally {
      setPropertySaving(false);
    }
  }

  return (
    <section className="panel-section histogram-panel" data-tour-target="histogram">
      <div className="section-heading">
        <span>Data</span>
        <strong>Histogram</strong>
      </div>
      {city && layer ? <div className="histogram-meta">
        {cities && cities.length > 1 && onCityChange ? (
          <label className="histogram-property-select">
            <span>City</span>
            <ThemedSelect label="Histogram city" value={city.id} onValueChange={onCityChange}>
              {cities.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </ThemedSelect>
          </label>
        ) : <span>{city.name}</span>}
        <span>{rangeMode === "smart" ? "Smart range" : rangeMode === "manual" ? "Manual range" : "Default range"}</span>
      </div> : null}

      {!layer ? (
        <div className="histogram-empty">No layer selected</div>
      ) : loading ? (
        <div className="histogram-empty">Loading</div>
      ) : error ? (
        <div className="histogram-empty">{error}</div>
      ) : !histogram || !gradient ? (
        <div className="histogram-empty">No score data</div>
      ) : (
        <>
          <div className="histogram-meta">
            <label className="histogram-property-select">
              <span>Field</span>
              <ThemedSelect label="Score field" value={layer.score_property || "score"} onValueChange={event => void changeProperty(event)} disabled={propertySaving}>
                <option value="score">score</option>
                <option value="zscore">zscore</option>
              </ThemedSelect>
            </label>
            <label className="histogram-property-select histogram-bucket-select">
              <span>Bucket</span>
              <ThemedSelect label="Histogram bucket width" value={histogram.bucketWidth} onValueChange={event => setBucketWidth(Number(event))}>
                {BUCKET_WIDTH_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </ThemedSelect>
            </label>
          </div>
          <div className="histogram-stats">
            <span><strong>{histogram.visibleCount.toLocaleString()}</strong> / {values.length.toLocaleString()} {city ? "sampled points in range" : "points"}</span>
            <span title="Full data range">{formatValue(histogram.dataMin)} to {formatValue(histogram.dataMax)}</span>
          </div>
          <div className="histogram-chart" role="img" aria-label={`${layer.name} score histogram. ${histogram.visibleCount} of ${values.length} points in range ${formatValue(histogram.rangeMin)} to ${formatValue(histogram.rangeMax)}. ${histogram.below} below range. ${histogram.above} above range.`}>
            {histogram.bins.map((bin, index) => {
              const height = bin.count ? Math.max(4, (bin.count / histogram.maxCount) * 100) : 0;
              const start = histogram.rangeMin + index * histogram.bucketWidth;
              return <div key={index} className="histogram-bar"
                style={{ height: `${height}%`, background: bin.color }}
                title={`${formatValue(start)} – ${formatValue(Math.min(histogram.rangeMax, start + histogram.bucketWidth))}: ${bin.count.toLocaleString()} points`} />;
            })}
          </div>
          <div className="histogram-ramp" style={{ background: gradientCss(gradient) }} />
          <div className="histogram-axis">
            <span>{formatValue(histogram.rangeMin)}</span>
            <span>{formatValue(histogram.midpoint)}</span>
            <span>{formatValue(histogram.rangeMax)}</span>
          </div>
          {city && (histogram.below || histogram.above) ? <div className="histogram-stats">
            <span>{histogram.below ? `${histogram.below.toLocaleString()} below range` : ""}</span>
            <span>{histogram.above ? `${histogram.above.toLocaleString()} above range` : ""}</span>
          </div> : null}
          <div className="histogram-range-row">
            <label>
              <span>Min</span>
              <GlassField><input
                type="number"
                step="0.5"
                value={draftMin}
                onChange={(event) => setDraftMin(event.target.value)}
                onKeyDown={handleRangeKeyDown}
              /></GlassField>
            </label>
            <label>
              <span>Max</span>
              <GlassField><input
                type="number"
                step="0.5"
                value={draftMax}
                onChange={(event) => setDraftMax(event.target.value)}
                onKeyDown={handleRangeKeyDown}
              /></GlassField>
            </label>
            <div className="histogram-range-actions">
              <GlassButton className="secondary-button range-apply" onClick={() => void applyRange()} disabled={!canApplyRange} title="Apply score range">
                <Check size={15} />
                Set range
              </GlassButton>
              {onSmartRange ? <GlassButton className="secondary-button range-apply" onClick={() => void applySmartRange(layer)}
                disabled={rangeSaving} title="Use the reranker range, or −1 to 3 when unavailable">
                Smart range
              </GlassButton> : null}
            </div>
          </div>
          {onResetRange ? <GlassButton className="secondary-button" disabled={rangeSaving}
            onClick={() => void saveRange(() => onResetRange(layer))}>Reset range</GlassButton> : null}
          {rangeError ? <div className="histogram-range-error">{rangeError}</div> : null}
        </>
      )}
    </section>
  );
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatInputValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.parseFloat(value.toFixed(4)).toString();
}

function readSavedBucketWidth(): number {
  const stored = Number(window.localStorage.getItem(BUCKET_WIDTH_STORAGE_KEY));
  return BUCKET_WIDTH_OPTIONS.includes(stored) ? stored : BUCKET_WIDTH_OPTIONS[0];
}
