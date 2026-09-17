import { useEffect, useMemo, useState } from "react";
import type { CityConfig, RemoteBackendConfig, SemanticLayer } from "../api/types";

type ComparisonResult = {
  matched_count: number;
  results: { embedding: "old" | "new"; tile_url_template: string }[];
};

export function useEmbeddingComparison(
  enabled: boolean, config: RemoteBackendConfig | null | undefined,
  city: CityConfig | undefined, layer: SemanticLayer | undefined
) {
  const key = JSON.stringify([config?.baseUrl, city?.datasetId, layer?.prompt]);
  const [state, setState] = useState<{ key: string; result?: ComparisonResult; error?: string }>({ key: "" });
  useEffect(() => {
    if (!enabled || !config || !city || !layer) return;
    const controller = new AbortController();
    setState({ key });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.token) headers.Authorization = `Bearer ${config.token}`;
    fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/scoring/comparison`, {
      method: "POST", headers, signal: controller.signal,
      body: JSON.stringify({ prompt: layer.prompt, dataset_id: city.datasetId })
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || `Comparison failed (${response.status})`);
      if (!data.results?.some((r: { embedding: string }) => r.embedding === "old")
        || !data.results?.some((r: { embedding: string }) => r.embedding === "new")) {
        throw new Error("Both embedding versions are required for comparison.");
      }
      if (!controller.signal.aborted) setState({ key, result: data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ key, error: String(error.message || error) });
    });
    return () => controller.abort();
  }, [enabled, key, config?.token]);
  const result = enabled && state.key === key ? state.result : undefined;
  const paneLayers = useMemo(() => (["old", "new"] as const).map(embedding => {
    const ref = result?.results.find(r => r.embedding === embedding);
    if (!ref || !layer || !city || !config) return [];
    const url = new URL(ref.tile_url_template, config.baseUrl).href
      .replace(/%7B/gi, "{").replace(/%7D/gi, "}");
    return [{ ...layer, id: `${layer.id}:embedding-${embedding}`, visible: true,
      name: `${layer.name} · ${embedding === "old" ? "Old 2B" : "New 8B"}`,
      source_path: url, source_paths: { [city.id]: url }, status: "ready" as const }];
  }), [result, layer, city, config]);
  return { paneLayers, count: result?.matched_count,
    error: enabled && state.key === key ? state.error : undefined,
    loading: enabled && !!layer && !result && !(state.key === key && state.error) };
}
