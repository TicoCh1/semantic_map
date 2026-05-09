import { SendHorizontal } from "lucide-react";
import { useState, type DragEvent } from "react";
import { saveRemoteBackendConfig } from "../api/client";
import { PANO_REFERENCE_DRAG_TYPE, type PanoReference, type RemoteBackendConfig } from "../api/types";

type PromptBarProps = {
  disabled?: boolean;
  backendConfig: RemoteBackendConfig | null;
  remoteConfigLocked?: boolean;
  onConfigChange: (config: RemoteBackendConfig) => void;
  onCreate: (prompt: string) => Promise<void>;
  onCreateReference?: (reference: PanoReference) => Promise<void>;
};

export function PromptBar({ disabled, backendConfig, remoteConfigLocked = false, onConfigChange, onCreate, onCreateReference }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [referenceDragOver, setReferenceDragOver] = useState(false);

  async function submit() {
    const trimmed = prompt.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setPrompt("");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateConfig(patch: Partial<RemoteBackendConfig>) {
    if (!backendConfig) return;
    const saved = await saveRemoteBackendConfig({ ...backendConfig, ...patch });
    onConfigChange(saved);
  }

  function canAcceptReferenceDrag(event: DragEvent): boolean {
    return Boolean(onCreateReference && Array.from(event.dataTransfer.types).includes(PANO_REFERENCE_DRAG_TYPE));
  }

  function handleReferenceDragOver(event: DragEvent) {
    if (!canAcceptReferenceDrag(event) || disabled || submitting) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setReferenceDragOver(true);
  }

  function handleReferenceDragLeave(event: DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setReferenceDragOver(false);
    }
  }

  async function handleReferenceDrop(event: DragEvent) {
    if (!onCreateReference || disabled || submitting) return;
    event.preventDefault();
    setReferenceDragOver(false);
    const reference = parsePanoReferenceDrop(event.dataTransfer);
    if (!reference) return;
    setSubmitting(true);
    try {
      await onCreateReference(reference);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className={`panel-section prompt-bar${referenceDragOver ? " is-reference-drop-target" : ""}`}
      data-tour-target="prompt"
      onDragOver={handleReferenceDragOver}
      onDragLeave={handleReferenceDragLeave}
      onDrop={(event) => void handleReferenceDrop(event)}
    >
      <label htmlFor="prompt-input">Prompt</label>
      {backendConfig && !remoteConfigLocked ? (
        <div className="backend-config-row">
          <label className="checkbox-row">
            <input type="checkbox" checked={backendConfig.enabled} onChange={(event) => void updateConfig({ enabled: event.target.checked })} />
            <span>RunPod</span>
          </label>
          <input
            className="backend-url-input"
            value={backendConfig.baseUrl}
            spellCheck={false}
            onChange={(event) => void updateConfig({ baseUrl: event.target.value })}
          />
        </div>
      ) : null}
      <div className="prompt-input-row">
        <textarea
          id="prompt-input"
          value={prompt}
          placeholder="The scene contains an animal"
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void submit();
          }}
        />
        <button className="primary-icon-button" disabled={disabled || submitting || !prompt.trim()} onClick={() => void submit()} title="Create layer">
          <SendHorizontal size={18} />
        </button>
      </div>
    </section>
  );
}

function parsePanoReferenceDrop(dataTransfer: DataTransfer): PanoReference | null {
  const raw = dataTransfer.getData(PANO_REFERENCE_DRAG_TYPE);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as Partial<PanoReference> | Partial<PanoReference>[];
    if (Array.isArray(payload)) return null;
    const panoId = String(payload.pano_id || "").trim();
    const datasetId = String(payload.dataset_id || "").trim();
    if (!panoId || !datasetId) return null;
    return {
      pano_id: panoId,
      dataset_id: datasetId,
      city_id: typeof payload.city_id === "string" ? payload.city_id : null,
      lon: typeof payload.lon === "number" && Number.isFinite(payload.lon) ? payload.lon : null,
      lat: typeof payload.lat === "number" && Number.isFinite(payload.lat) ? payload.lat : null,
      date: typeof payload.date === "string" || typeof payload.date === "number" ? payload.date : null
    };
  } catch {
    return null;
  }
}
