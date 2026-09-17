import { Search, ArrowUpRight, LoaderCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { RemoteBackendConfig } from "../api/types";

export function SavedPromptSearch({ config, disabled, onCreate }: {
  config: RemoteBackendConfig;
  disabled?: boolean;
  onCreate: (prompt: string) => Promise<void>;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
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
  const visible = matches.slice(0, 40);
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);
  async function choose(prompt: string) {
    if (disabled || busy) return;
    setBusy(true);
    setOpen(false);
    setQuery(prompt);
    setError("");
    try { await onCreate(prompt); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="saved-prompt-search" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  }}>
    <div className="saved-search-field">
      {busy ? <LoaderCircle size={17} className="saved-search-spinner" /> : <Search size={17} />}
      <input role="combobox" aria-label="Search saved prompts" aria-autocomplete="list"
        aria-expanded={open && !loading && !busy} aria-controls={listId}
        aria-activedescendant={open && visible[active] ? `${listId}-${active}` : undefined}
        placeholder={loading ? "Loading prompts…" : "Search saved prompts…"} value={query}
        disabled={disabled || busy || loading} onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === "Escape") { setOpen(false); return; }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); setOpen(true);
            setActive(i => Math.max(0, Math.min(visible.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
          }
          if (e.key === "Enter" && open && visible[active]) { e.preventDefault(); void choose(visible[active]); }
        }} />
      <span className="saved-search-badge" title="Browse previously computed prompts">Saved</span>
    </div>
    {error && <div className="saved-search-error" role="alert">{error}</div>}
    {open && !loading && !busy && <div className="saved-search-dropdown">
      <div className="saved-search-caption">{matches.length ? `${matches.length} saved prompts` : "No matching prompts"}</div>
      <div id={listId} className="saved-prompt-results" role="listbox" aria-label="Saved prompts">
        {visible.map((prompt, i) => <button key={prompt} id={`${listId}-${i}`} role="option"
          aria-selected={i === active} className="saved-search-option" type="button" disabled={disabled}
          onMouseEnter={() => setActive(i)} onClick={() => void choose(prompt)}>
          <span>{prompt}</span><ArrowUpRight size={15} aria-hidden="true" />
        </button>)}
      </div>
      {!matches.length && <div className="saved-search-empty">Try another word. Only saved prompts are available.</div>}
    </div>}
  </div>;
}
