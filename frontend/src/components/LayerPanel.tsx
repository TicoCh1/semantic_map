import { Glass } from "@form-glass/react";
import { useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, RefreshCw, Trash2 } from "lucide-react";
import type { GradientPreset, SemanticLayer } from "../api/types";
import { gradientCss, layerGradient } from "../state/color";

type LayerPanelProps = {
  layers: SemanticLayer[];
  gradients: GradientPreset[];
  selectedLayerId: string | null;
  onSelect: (layerId: string) => void;
  onToggle: (layer: SemanticLayer) => void;
  onDelete: (layer: SemanticLayer) => void;
  onReorder: (layerIds: string[]) => void;
  onRefreshAll: () => Promise<void>;
  refreshingAll?: boolean;
  disabled?: boolean;
  highlightHiddenEyes?: boolean;
};

export function LayerPanel({
  layers,
  gradients,
  selectedLayerId,
  onSelect,
  onToggle,
  onDelete,
  onReorder,
  onRefreshAll,
  refreshingAll = false,
  disabled = false,
  highlightHiddenEyes = false
}: LayerPanelProps) {
  const touchDrag = useRef<{ id: string; target: string; after: boolean } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function handleDrop(draggedId: string, targetId: string, placeAfter: boolean) {
    if (draggedId === targetId) return;
    const next = [...layers];
    const from = next.findIndex((layer) => layer.id === draggedId);
    const target = next.findIndex((layer) => layer.id === targetId);
    if (from < 0 || target < 0) return;
    const [moved] = next.splice(from, 1);
    const targetAfterRemoval = next.findIndex((layer) => layer.id === targetId);
    next.splice(placeAfter ? targetAfterRemoval + 1 : targetAfterRemoval, 0, moved);
    onReorder(next.map((layer) => layer.id));
  }

  return (
    <section className={`panel-section layer-panel${highlightHiddenEyes ? " is-all-hidden" : ""}`} data-tour-target="layers">
      <div className="section-heading with-action">
        <div>
          <span>Layers</span>
          <strong>Display Order</strong>
        </div>
        <div className="heading-actions">
          <button
            className={`refresh-icon-button layer-refresh-button${refreshingAll ? " is-spinning" : ""}`}
            disabled={disabled || refreshingAll}
            onClick={() => void onRefreshAll()}
            title="Refresh all layers"
            aria-label="Refresh all layers"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="layer-list">
        {layers.map((layer) => {
          const gradient = layerGradient(layer, gradients);
          return (
            <Glass
              key={layer.id}
              className={`layer-row${layer.id === selectedLayerId ? " is-selected" : ""}${layer.id === dropTarget ? " is-drop-target" : ""}`}
              data-layer-id={layer.id}
              fade={[]} material="control"
              draggable
              onClick={() => onSelect(layer.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/layer-id", layer.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/layer-id");
                const rect = event.currentTarget.getBoundingClientRect();
                handleDrop(draggedId, layer.id, event.clientY > rect.top + rect.height / 2);
              }}
            >

              <button
                className="icon-button visibility-button"
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle(layer);
                }}
              >
                {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                type="button"
                className="layer-drag-handle"
                aria-label={`Reorder ${layer.name}`}
                title="Drag to reorder · Arrow keys move up or down"
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                  event.preventDefault();
                  const index = layers.findIndex((item) => item.id === layer.id);
                  const target = layers[index + (event.key === "ArrowUp" ? -1 : 1)];
                  if (target) handleDrop(layer.id, target.id, event.key === "ArrowDown");
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse") return;
                  event.preventDefault(); event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  touchDrag.current = { id: layer.id, target: layer.id, after: false };
                }}
                onPointerMove={(event) => {
                  const drag = touchDrag.current;
                  if (!drag || drag.id !== layer.id) return;
                  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-layer-id]");
                  if (!row || !event.currentTarget.closest(".layer-list")?.contains(row)) return;
                  const rect = row.getBoundingClientRect();
                  drag.target = row.dataset.layerId!;
                  drag.after = event.clientY > rect.top + rect.height / 2;
                  setDropTarget(drag.target === drag.id ? null : drag.target);
                }}
                onPointerUp={() => {
                  const drag = touchDrag.current;
                  touchDrag.current = null; setDropTarget(null);
                  if (drag) handleDrop(drag.id, drag.target, drag.after);
                }}
                onPointerCancel={() => { touchDrag.current = null; setDropTarget(null); }}
              ><GripVertical className="drag-icon" size={18} /></button>
              <div className="layer-text">
                <div className="layer-title">{layer.name}</div>
                <div className="layer-prompt">{layer.status === "ready" ? layer.prompt : `${layer.prompt} - ${layer.status}`}</div>
              </div>
              <div className="layer-style-chip">
                <span style={{ background: gradient ? gradientCss(gradient) : "#d0d5dd" }} />
              </div>
              <button
                className="icon-button delete-button"
                title="Delete layer"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(layer);
                }}
              >
                <Trash2 size={15} />
              </button>
            </Glass>
          );
        })}
      </div>
    </section>
  );
}
