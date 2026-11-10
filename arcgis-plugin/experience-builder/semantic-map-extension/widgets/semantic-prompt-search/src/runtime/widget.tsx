import { React, type AllWidgetProps } from "jimu-core";
import { Alert, Button, Label, NumericInput, Option, Select, Switch, TextArea, TextInput } from "jimu-ui";
import { JimuMapViewComponent, type JimuMapView } from "jimu-arcgis";
import webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import { type IMConfig, type ScoreField } from "../config";
import {
  datasetLabel,
  fetchAllFeatures,
  normalizeConfig,
  pollScoringJob,
  resultRefs,
  submitPromptJob,
  type SemanticBackendConfig
} from "./services/backendClient";
import { createSemanticFeatureLayer } from "./services/featureLayer";
import "./style.scss";

type WidgetProps = AllWidgetProps<IMConfig>;

interface AddedLayerSummary {
  id: string;
  title: string;
  count: number;
  total: number;
}

export default function Widget(props: WidgetProps) {
  const configured = normalizeConfig(props.config);
  const [activeMapView, setActiveMapView] = React.useState<JimuMapView | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [backendUrl, setBackendUrl] = React.useState(configured.backendUrl);
  const [token, setToken] = React.useState(configured.token);
  const [scoreField, setScoreField] = React.useState<ScoreField>(configured.scoreField);
  const [rangeMin, setRangeMin] = React.useState(configured.rangeMin);
  const [rangeMax, setRangeMax] = React.useState(configured.rangeMax);
  const [useCurrentExtent, setUseCurrentExtent] = React.useState(configured.useCurrentExtent);
  const [status, setStatus] = React.useState("Ready");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [layers, setLayers] = React.useState<AddedLayerSummary[]>([]);

  const selectedMapWidgetId = props.useMapWidgetIds?.[0];

  async function runPromptSearch() {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setError("Enter a prompt first.");
      return;
    }
    if (!backendUrl.trim()) {
      setError("Configure the UrbanFabric backend URL.");
      return;
    }
    if (!activeMapView?.view?.map) {
      setError("Connect the widget to an ArcGIS map.");
      return;
    }

    const config: SemanticBackendConfig = {
      ...configured,
      backendUrl: backendUrl.trim().replace(/\/+$/, ""),
      token,
      scoreField,
      rangeMin,
      rangeMax,
      useCurrentExtent
    };
    const bbox = useCurrentExtent ? bboxFromView(activeMapView) : undefined;

    setBusy(true);
    setError(null);
    setStatus("Submitting prompt...");
    try {
      const submitted = await submitPromptJob(config, cleanPrompt);
      const readyJob =
        submitted.status === "ready"
          ? submitted
          : await pollScoringJob(config, submitted.job_id, (message, job) => {
              const pct = Math.round((job?.progress || 0) * 100);
              setStatus(`${message} ${pct ? `(${pct}%)` : ""}`.trim());
            });

      const added: AddedLayerSummary[] = [];
      for (const result of resultRefs(readyJob)) {
        setStatus(`Fetching ${datasetLabel(result.dataset_id)} features...`);
        const page = await fetchAllFeatures(
          config,
          result,
          {
            field: scoreField,
            min: rangeMin,
            max: rangeMax,
            bbox,
            pageSize: config.pageSize,
            maxFeatures: config.maxFeatures
          },
          (message) => setStatus(message)
        );
        if (!page.features.length) continue;
        const title = `${cleanPrompt} - ${datasetLabel(result.dataset_id)}`;
        const layer = createSemanticFeatureLayer(page, {
          title,
          scoreField,
          rangeMin,
          rangeMax
        });
        activeMapView.view.map.add(layer);
        added.push({
          id: layer.id,
          title,
          count: page.features.length,
          total: page.total
        });
      }

      setLayers((current) => [...added, ...current].slice(0, 8));
      setStatus(added.length ? `Added ${added.length} semantic layer(s).` : "No matching features found.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Prompt search failed.";
      setError(message);
      setStatus("Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="semantic-prompt-search-widget">
      {selectedMapWidgetId ? (
        <JimuMapViewComponent useMapWidgetId={selectedMapWidgetId} onActiveViewChange={setActiveMapView} />
      ) : null}

      <div className="semantic-prompt-search-widget__section">
        <Label>Backend URL</Label>
        <TextInput value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="https://example.invalid" />
      </div>

      <div className="semantic-prompt-search-widget__section">
        <Label>Bearer token</Label>
        <TextInput value={token} type="password" onChange={(event) => setToken(event.target.value)} placeholder="Optional" />
      </div>

      <div className="semantic-prompt-search-widget__section">
        <Label>Prompt</Label>
        <TextArea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="the street feels enclosed by tall buildings"
          height={84}
        />
      </div>

      <div className="semantic-prompt-search-widget__grid">
        <div>
          <Label>Field</Label>
          <Select value={scoreField} onChange={(event) => setScoreField(event.target.value as ScoreField)}>
            <Option value="zscore">zscore</Option>
            <Option value="score">score</Option>
          </Select>
        </div>
        <div>
          <Label>Min</Label>
          <NumericInput value={rangeMin} onChange={(value) => setRangeMin(Number(value))} />
        </div>
        <div>
          <Label>Max</Label>
          <NumericInput value={rangeMax} onChange={(value) => setRangeMax(Number(value))} />
        </div>
      </div>

      <label className="semantic-prompt-search-widget__switch">
        <Switch checked={useCurrentExtent} onChange={(_, checked) => setUseCurrentExtent(checked)} />
        <span>Fetch current extent only</span>
      </label>

      <Button type="primary" disabled={busy || !prompt.trim()} onClick={() => void runPromptSearch()}>
        {busy ? "Searching..." : "Search prompt"}
      </Button>

      <div className="semantic-prompt-search-widget__status">{status}</div>
      {error ? (
        <Alert className="semantic-prompt-search-widget__alert" form="basic" type="error" text={error} />
      ) : null}

      {layers.length ? (
        <div className="semantic-prompt-search-widget__section">
          <Label>Added layers</Label>
          <ul className="semantic-prompt-search-widget__layers">
            {layers.map((layer) => (
              <li key={layer.id}>
                <span>{layer.title}</span>
                <small>
                  {layer.count.toLocaleString()} / {layer.total.toLocaleString()}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function bboxFromView(jimuMapView: JimuMapView): string | undefined {
  let extent = jimuMapView.view?.extent;
  if (!extent) return undefined;
  if (extent.spatialReference?.isWebMercator || extent.spatialReference?.wkid === 3857 || extent.spatialReference?.wkid === 102100) {
    extent = webMercatorUtils.webMercatorToGeographic(extent) as __esri.Extent;
  }
  if (extent.spatialReference?.wkid !== 4326) return undefined;
  return [extent.xmin, extent.ymin, extent.xmax, extent.ymax].map((value) => String(round(value))).join(",");
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
