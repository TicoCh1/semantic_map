import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PANO_REFERENCE_DRAG_TYPE, type MarkedPano, type PanoReference } from "../api/types";

type StreetViewPanelProps = {
  panos: MarkedPano[];
  selectedPanoKey: string | null;
  scoreField: "score" | "zscore";
  onSelectPano: (panoKey: string) => void;
  onRemovePano: (panoKey: string) => void;
};

export function StreetViewPanel({ panos, selectedPanoKey, scoreField, onSelectPano, onRemovePano }: StreetViewPanelProps) {
  const [height, setHeight] = useState(320);
  const [valuesExpanded, setValuesExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const selected = useMemo(() => panos.find((pano) => panoKey(pano) === selectedPanoKey) ?? panos[0] ?? null, [panos, selectedPanoKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selected?.object_url) {
      viewerRef.current?.destroy();
      viewerRef.current = null;
      return;
    }

    viewerRef.current?.destroy();
    viewerRef.current = new Viewer({
      container,
      panorama: selected.object_url,
      navbar: ["zoom", "move", "fullscreen"],
      mousewheel: true,
      defaultZoomLvl: 45,
      loadingTxt: "Loading"
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [selected?.object_url]);

  useEffect(() => {
    if (!selected?.pano_id) return;
    chipRefs.current.get(panoKey(selected))?.scrollIntoView({
      block: "nearest",
      inline: "nearest"
    });
  }, [selected]);

  useEffect(() => {
    setValuesExpanded(false);
  }, [selected ? panoKey(selected) : null]);

  if (!panos.length) return null;

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = height;

    const onMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + startY - moveEvent.clientY;
      setHeight(Math.max(180, Math.min(Math.round(window.innerHeight * 0.72), nextHeight)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <section className="street-view-panel" style={{ height }} data-tour-target="street-view">
      <div className="street-view-resizer" onPointerDown={startResize}>
        <span />
      </div>
      <div className="street-view-main">
        <div className="street-view-canvas" ref={containerRef}>
          {!selected ? <div className="street-view-state">No pano selected</div> : null}
          {selected?.status === "loading" ? <div className="street-view-state">Loading pano</div> : null}
          {selected?.status === "failed" ? <div className="street-view-state">{selected.message || "Pano unavailable"}</div> : null}
          {selected ? (
            <PanoLayerValues
              pano={selected}
              scoreField={scoreField}
              expanded={valuesExpanded}
              onToggleExpanded={() => setValuesExpanded((current) => !current)}
              onReferenceDragStart={(event) => startPanoReferenceDrag(event, selected)}
            />
          ) : null}
        </div>
        <div className="street-view-strip">
          {panos.map((pano) => {
            const key = panoKey(pano);
            return (
              <button
                key={key}
                className={`street-view-chip${key === (selected ? panoKey(selected) : "") ? " is-selected" : ""}`}
                draggable={pano.status === "ready"}
                onDragStart={(event) => startPanoReferenceDrag(event, pano)}
                onClick={() => onSelectPano(key)}
                ref={(node) => {
                  if (node) chipRefs.current.set(key, node);
                  else chipRefs.current.delete(key);
                }}
                type="button"
              >
                <span>{pano.pano_id}</span>
                <small>{pano.status === "ready" ? formatPanoDate(panoCaptureDate(pano)) ?? "No date" : pano.status}</small>
                <X
                  size={14}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemovePano(key);
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function panoKey(pano: MarkedPano): string {
  if (pano.pano_key) return pano.pano_key;
  const scope = pano.dataset_id || pano.city_id || "default";
  return `${scope}:${pano.pano_id}`;
}

function PanoLayerValues({
  pano,
  scoreField,
  expanded,
  onToggleExpanded,
  onReferenceDragStart
}: {
  pano: MarkedPano;
  scoreField: "score" | "zscore";
  expanded: boolean;
  onToggleExpanded: () => void;
  onReferenceDragStart: (event: DragEvent) => void;
}) {
  const values = pano.layer_values?.length
    ? pano.layer_values
    : [
        {
          layer_id: pano.source_layer_id ?? "selected",
          layer_name: pano.source_layer_name ?? "Selected layer",
          visible: true,
          score: pano.score ?? null,
          zscore: pano.zscore ?? null,
          date: pano.date ?? null
        }
      ];
  const capturedAt = formatPanoDate(panoCaptureDate(pano));
  const city = formatPanoCity(pano);

  if (!expanded) {
    return (
      <div className="street-view-values street-view-values-compact" draggable={pano.status === "ready"} onDragStart={onReferenceDragStart}>
        <div className="street-view-window-row">
          <div className="street-view-compact-meta">
            <div>
              <span>City</span>
              <strong>{city}</strong>
            </div>
            <div>
              <span>Capture date</span>
              <strong>{capturedAt ?? "Unknown"}</strong>
            </div>
          </div>
          <button className="street-view-window-button" onClick={onToggleExpanded} title="Show pano scores" type="button">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="street-view-values street-view-values-expanded" draggable={pano.status === "ready"} onDragStart={onReferenceDragStart}>
      <div className="street-view-values-title">
        <span>Pano {pano.pano_id}</span>
        <div className="street-view-window-actions">
          <strong>{scoreField}</strong>
          <button className="street-view-window-button" onClick={onToggleExpanded} title="Hide pano scores" type="button">
            <Minimize2 size={13} />
          </button>
        </div>
      </div>
      <div className="street-view-values-list">
        {values.map((value) => {
          const numeric = value[scoreField];
          return (
            <div className="street-view-value-row" key={value.layer_id}>
              <span title={value.layer_name}>{value.layer_name}</span>
              <strong>{typeof numeric === "number" && Number.isFinite(numeric) ? numeric.toFixed(scoreField === "score" ? 4 : 3) : "-"}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startPanoReferenceDrag(event: DragEvent, pano: MarkedPano) {
  if (pano.status !== "ready") {
    event.preventDefault();
    return;
  }
  const reference = panoReferenceFromMarkedPano(pano);
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(PANO_REFERENCE_DRAG_TYPE, JSON.stringify(reference));
  event.dataTransfer.setData("text/plain", `${reference.dataset_id}:${reference.pano_id}`);
}

function panoReferenceFromMarkedPano(pano: MarkedPano): PanoReference {
  return {
    pano_id: pano.pano_id,
    dataset_id: String(pano.dataset_id || pano.city_id || "").trim(),
    city_id: pano.city_id ?? null,
    lon: typeof pano.lon === "number" && Number.isFinite(pano.lon) ? pano.lon : null,
    lat: typeof pano.lat === "number" && Number.isFinite(pano.lat) ? pano.lat : null,
    date: panoCaptureDate(pano)
  };
}

function panoCaptureDate(pano: MarkedPano): string | number | null {
  if (pano.date !== undefined && pano.date !== null && String(pano.date).trim() !== "") return pano.date;
  return pano.layer_values?.find((value) => value.date !== undefined && value.date !== null && String(value.date).trim() !== "")?.date ?? null;
}

function formatPanoCity(pano: MarkedPano): string {
  const city = String(pano.city_id || "").trim().toLowerCase();
  if (city === "london") return "London";
  if (city === "shanghai") return "Shanghai";
  const dataset = String(pano.dataset_id || "").trim().toLowerCase();
  if (dataset.includes("london")) return "London";
  if (dataset.includes("shanghai")) return "Shanghai";
  return pano.dataset_id || pano.city_id || "Unknown";
}

function formatPanoDate(value: string | number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const digits = raw.replace(/[^0-9]/g, "");
  if (/^\d{8}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (/^\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }
  if (/^\d{4}$/.test(digits)) {
    return digits;
  }
  return raw;
}
