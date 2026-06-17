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
            <div
              key={layer.id}
              className={`layer-row${layer.id === selectedLayerId ? " is-selected" : ""}`}
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
              <GripVertical className="drag-icon" size={18} />
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
