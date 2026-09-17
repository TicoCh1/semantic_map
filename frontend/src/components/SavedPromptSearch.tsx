import { useEffect, useState } from "react";
import type { RemoteBackendConfig } from "../api/types";

export function SavedPromptSearch({ config, disabled, onCreate }: {
  config: RemoteBackendConfig;
  disabled?: boolean;
  onCreate: (prompt: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPrompts([]);
    setError("");
    fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/scoring/prompts`, {
      signal: controller.signal,
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined
    }).then(async response => {
      if (!response.ok) throw new Error(`Could not load saved prompts (${response.status})`);
      const data = await response.json() as { prompts: { prompt: string; dataset_ids: string[] }[] };
      if (!controller.signal.aborted) setPrompts(data.prompts.filter(p => config.datasetIds.every(d => p.dataset_ids.includes(d))).map(p => p.prompt));
    }).catch(e => { if (!controller.signal.aborted) setError(String(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [config.baseUrl, config.token, config.datasetIds.join(",")]);
  const matches = prompts.filter(p => p.toLowerCase().includes(query.trim().toLowerCase()));
  async function choose(prompt: string) {
    if (disabled || busy) return;
    setBusy(true);
    setError("");
    try { await onCreate(prompt); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="saved-prompt-search">
    <strong>CPU mode · Saved prompts</strong>
    <small>8B · 4096 dimensions · Existing scores, standardized within each city</small>
    <input aria-label="Search saved prompts" placeholder="Search existing prompts…" value={query}
      disabled={disabled || busy || loading} onChange={e => setQuery(e.target.value)} />
    <small>{loading ? "Loading saved prompts…" : `${matches.length} saved prompts · Select one to open its map`}</small>
    {error && <div role="alert">{error}</div>}
    <div className="saved-prompt-results">
      {matches.slice(0, 40).map(prompt => <button key={prompt} type="button" disabled={disabled || busy}
        onClick={() => void choose(prompt)}>{prompt}</button>)}
      {!loading && !error && !matches.length && <span>No saved prompts match your search.</span>}
    </div>
    {matches.length > 40 && <small>Showing 40 results. Type more to narrow your search.</small>}
  </div>;
}
