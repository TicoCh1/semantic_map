import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { RemoteLogEntry } from "../api/types";

type LogPanelProps = {
  entries: RemoteLogEntry[];
  onClear: () => void;
};

export function LogPanel({ entries, onClear }: LogPanelProps) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem("semantic-map-log-collapsed") === "true");

  useEffect(() => {
    window.localStorage.setItem("semantic-map-log-collapsed", collapsed ? "true" : "false");
  }, [collapsed]);

  const latest = entries[0];

  return (
    <section className="panel-section log-panel">
      <div className="log-header">
        <button className="log-toggle" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          <span>Runtime Log</span>
          {latest ? <small>{latest.message}</small> : <small>No events</small>}
        </button>
        <button className="icon-button" onClick={onClear} disabled={!entries.length} title="Clear log">
          <Trash2 size={15} />
        </button>
      </div>
      {!collapsed ? (
        <div className="log-body">
          {entries.length ? (
            entries.map((entry) => (
              <div className={`log-entry is-${entry.status}`} key={entry.id}>
                <div className="log-entry-top">
                  <span>{formatTime(entry.timestamp)}</span>
                  <strong>{entry.current_stage || entry.status}</strong>
                  {typeof entry.progress === "number" ? <span>{Math.round(entry.progress * 100)}%</span> : null}
                </div>
                <div className="log-message">{entry.message}</div>
                <div className="log-detail">
                  {entry.current_tile ? <span>tile {entry.current_tile.z}/{entry.current_tile.x}/{entry.current_tile.y}</span> : null}
                  {entry.tiles_total ? <span>{entry.tiles_done ?? 0}/{entry.tiles_total} tiles</span> : null}
                  {formatTimings(entry.stage_timings) ? <span>{formatTimings(entry.stage_timings)}</span> : null}
                </div>
              </div>
            ))
          ) : (
            <div className="log-empty">No backend events yet</div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTimings(timings?: Record<string, number>): string {
  if (!timings) return "";
  return Object.entries(timings)
    .map(([key, value]) => `${key.replace(/_/g, " ")} ${value.toFixed(1)}s`)
    .join(" | ");
}
