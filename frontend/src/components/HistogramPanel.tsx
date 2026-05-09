import { Check } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { getLayerGeojson } from "../api/client";
import type { GradientPreset, SemanticLayer } from "../api/types";
import { gradientColorForScore, gradientCss } from "../state/color";

type HistogramPanelProps = {
  layer: SemanticLayer | null;
  gradient: GradientPreset | null;
  onRangeChange?: (layer: SemanticLayer, scoreMin: number, scoreMax: number) => Promise<void>;
  onPropertyChange?: (layer: SemanticLayer, property: string) => Promise<void>;
};

type HistogramBin = {
  count: number;
  color: string;
};

const BUCKET_WIDTH_STORAGE_KEY = "semantic-map-histogram-bucket-width";
const BUCKET_WIDTH_OPTIONS = [0.05, 0.02, 0.01];

export function HistogramPanel({ layer, gradient, onRangeChange, onPropertyChange }: HistogramPanelProps) {
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
    void getLayerGeojson(layer.id)
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
  }, [layer?.id, layer?.source_path, layer?.score_property]);

  useEffect(() => {
    const scoreMin = layer?.style.score_min ?? gradient?.score_min ?? 0;
    const scoreMax = layer?.style.score_max ?? gradient?.score_max ?? 1;
    setDraftMin(formatInputValue(scoreMin));
    setDraftMax(formatInputValue(scoreMax));
    setRangeError(null);
  }, [gradient?.score_min, gradient?.score_max, layer?.id, layer?.style.score_min, layer?.style.score_max]);

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

    for (const value of values) {
      if (value < rangeMin || value > rangeMax) continue;
      const rawIndex = Math.floor((value - rangeMin) / safeBucketWidth);
      const index = Math.min(Math.max(rawIndex, 0), binCount - 1);
      counts[index] += 1;
      visibleCount += 1;
    }

    const bins: HistogramBin[] = counts.map((count, index) => {
      const bucketStart = rangeMin + index * safeBucketWidth;
      const bucketEnd = Math.min(rangeMax, bucketStart + safeBucketWidth);
      const center = (bucketStart + bucketEnd) / 2;
      return {
        count,
        color: gradientColorForScore(gradient, center, rangeMin, rangeMax)
      };
    });

    return {
      bins,
      maxCount: Math.max(...counts, 1),
      rangeMin,
      rangeMax,
      midpoint: rangeMin + span / 2,
      dataMin: Math.min(...values),
      dataMax: Math.max(...values),
      visibleCount,
      bucketWidth: safeBucketWidth
    };
  }, [bucketWidth, gradient, layer, values]);

  const canApplyRange =
    Boolean(layer && onRangeChange) &&
    Number.isFinite(Number(draftMin)) &&
    Number.isFinite(Number(draftMax)) &&
    Number(draftMin) < Number(draftMax) &&
    !rangeSaving;

  async function applyRange() {
    const currentLayer = layer;
    if (!currentLayer || !onRangeChange) return;

    const scoreMin = Number(draftMin);
    const scoreMax = Number(draftMax);
    if (!Number.isFinite(scoreMin) || !Number.isFinite(scoreMax) || scoreMin >= scoreMax) {
      setRangeError("Min must be lower than max");
      return;
    }

    setRangeSaving(true);
    setRangeError(null);
    try {
      await onRangeChange(currentLayer, scoreMin, scoreMax);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : "Range update failed");
    } finally {
      setRangeSaving(false);
    }
  }

  function handleRangeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void applyRange();
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
              <select value={layer.score_property || "score"} onChange={(event) => void changeProperty(event.target.value)} disabled={propertySaving}>
                <option value="score">score</option>
                <option value="zscore">zscore</option>
              </select>
            </label>
            <label className="histogram-property-select histogram-bucket-select">
              <span>Bucket</span>
              <select value={histogram.bucketWidth} onChange={(event) => setBucketWidth(Number(event.target.value))}>
                {BUCKET_WIDTH_OPTIONS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <span>
              n={histogram.visibleCount}/{values.length} | {formatValue(histogram.dataMin)} to {formatValue(histogram.dataMax)}
            </span>
          </div>
          <div className="histogram-range-row">
            <label>
              <span>Min</span>
              <input
                type="number"
                step="0.5"
                value={draftMin}
                onChange={(event) => setDraftMin(event.target.value)}
                onKeyDown={handleRangeKeyDown}
              />
            </label>
            <label>
              <span>Max</span>
              <input
                type="number"
                step="0.5"
                value={draftMax}
                onChange={(event) => setDraftMax(event.target.value)}
                onKeyDown={handleRangeKeyDown}
              />
            </label>
            <button className="secondary-button compact-action" onClick={() => void applyRange()} disabled={!canApplyRange} title="Apply score range">
              <Check size={15} />
            </button>
          </div>
          {rangeError ? <div className="histogram-range-error">{rangeError}</div> : null}
          <div className="histogram-chart" aria-label={`${layer.name} score histogram`}>
            {histogram.bins.map((bin, index) => {
              const height = bin.count ? Math.max(4, (bin.count / histogram.maxCount) * 100) : 0;
              return (
                <div
                  key={index}
                  className="histogram-bar"
                  style={{
                    height: `${height}%`,
                    background: bin.color
                  }}
                  title={`${bin.count}`}
                />
              );
            })}
          </div>
          <div className="histogram-ramp" style={{ background: gradientCss(gradient) }} />
          <div className="histogram-axis">
            <span>{formatValue(histogram.rangeMin)}</span>
            <span>{formatValue(histogram.midpoint)}</span>
            <span>{formatValue(histogram.rangeMax)}</span>
          </div>
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
