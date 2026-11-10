import type { ImmutableObject } from "jimu-core";

export type ScoreField = "score" | "zscore";

export interface Config {
  backendUrl?: string;
  token?: string;
  datasetGroupId?: string;
  datasetIds?: string[];
  scoreField?: ScoreField;
  rangeMin?: number;
  rangeMax?: number;
  pageSize?: number;
  maxFeatures?: number;
  useCurrentExtent?: boolean;
}

export const DEFAULT_DATASET_IDS = ["london_224_8_45", "shanghai_224_8_45_2B"];

export const DEFAULT_CONFIG: Required<Omit<Config, "token">> & Pick<Config, "token"> = {
  backendUrl: "",
  token: "",
  datasetGroupId: "london_shanghai",
  datasetIds: DEFAULT_DATASET_IDS,
  scoreField: "zscore",
  rangeMin: -1,
  rangeMax: 3,
  pageSize: 50000,
  maxFeatures: 500000,
  useCurrentExtent: false
};

export type IMConfig = ImmutableObject<Config>;
