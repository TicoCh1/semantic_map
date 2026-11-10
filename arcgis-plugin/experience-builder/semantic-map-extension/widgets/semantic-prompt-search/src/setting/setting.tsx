import { Immutable, React } from "jimu-core";
import type { AllWidgetSettingProps } from "jimu-for-builder";
import { Label, NumericInput, Option, Select, Switch, TextInput } from "jimu-ui";
import { MapWidgetSelector, SettingRow, SettingSection } from "jimu-ui/advanced/setting-components";
import { DEFAULT_CONFIG, DEFAULT_DATASET_IDS, type Config, type IMConfig, type ScoreField } from "../config";

type SettingProps = AllWidgetSettingProps<IMConfig>;

export default function Setting(props: SettingProps) {
  const config = props.config || Immutable(DEFAULT_CONFIG);

  function update<K extends keyof Config>(key: K, value: Config[K]) {
    props.onSettingChange({
      id: props.id,
      config: config.set(key, value)
    });
  }

  function updateMapWidgetIds(useMapWidgetIds: string[]) {
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds
    });
  }

  return (
    <div>
      <SettingSection title="Map">
        <SettingRow>
          <MapWidgetSelector useMapWidgetIds={props.useMapWidgetIds} onSelect={updateMapWidgetIds} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Backend">
        <SettingRow flow="wrap">
          <Label>Backend URL</Label>
          <TextInput value={config.backendUrl || ""} onChange={(event) => update("backendUrl", event.target.value)} />
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Dataset group</Label>
          <TextInput value={config.datasetGroupId || DEFAULT_CONFIG.datasetGroupId} onChange={(event) => update("datasetGroupId", event.target.value)} />
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Dataset IDs</Label>
          <TextInput
            value={(config.datasetIds || DEFAULT_DATASET_IDS).join(",")}
            onChange={(event) =>
              update(
                "datasetIds",
                event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Feature Import">
        <SettingRow flow="wrap">
          <Label>Score field</Label>
          <Select value={config.scoreField || DEFAULT_CONFIG.scoreField} onChange={(event) => update("scoreField", event.target.value as ScoreField)}>
            <Option value="zscore">zscore</Option>
            <Option value="score">score</Option>
          </Select>
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Range min</Label>
          <NumericInput value={config.rangeMin ?? DEFAULT_CONFIG.rangeMin} onChange={(value) => update("rangeMin", Number(value))} />
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Range max</Label>
          <NumericInput value={config.rangeMax ?? DEFAULT_CONFIG.rangeMax} onChange={(value) => update("rangeMax", Number(value))} />
        </SettingRow>
        <SettingRow tag="label" label="Current extent only">
          <Switch checked={config.useCurrentExtent ?? DEFAULT_CONFIG.useCurrentExtent} onChange={(_, checked) => update("useCurrentExtent", checked)} />
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Page size</Label>
          <NumericInput value={config.pageSize ?? DEFAULT_CONFIG.pageSize} onChange={(value) => update("pageSize", Number(value))} />
        </SettingRow>
        <SettingRow flow="wrap">
          <Label>Max features per city</Label>
          <NumericInput value={config.maxFeatures ?? DEFAULT_CONFIG.maxFeatures} onChange={(value) => update("maxFeatures", Number(value))} />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
