export type HumanVerificationTask = {
  task_id: string;
  dataset_id: string;
  city_id: string;
  pano_id: string;
  lon: number;
  lat: number;
  date?: number | null;
  prompt_id: string;
  result_revision?: string | null;
  score: number;
  zscore: number;
  ai_bucket: number;
  bucket_min?: number | null;
  bucket_max?: number | null;
  stratum_population: number;
  stratum_sample_count: number;
};

export type HumanVerificationStratum = {
  dataset_id: string;
  city_id: string;
  ai_bucket: number;
  bucket_min?: number | null;
  bucket_max?: number | null;
  population: number;
  sampled: number;
};

export type HumanVerificationStudy = {
  schema_version: number;
  study_id: string;
  prompt: string;
  score_property: "zscore";
  range_min: number;
  range_max: number;
  bucket_count: 5;
  bucket_width: number;
  tail_policy: "include_in_edge_buckets";
  samples_per_bucket_per_dataset: number;
  seed: number;
  dataset_ids: string[];
  dataset_group_id?: string | null;
  tasks: HumanVerificationTask[];
  strata: HumanVerificationStratum[];
};

export type HumanVerificationPresentation = HumanVerificationTask & {
  source_task_id: string;
  study_id: string;
  prompt: string;
  dataset_group_id?: string | null;
  sequence_number: number;
  is_encore: boolean;
};

export type HumanRatingRecord = HumanVerificationTask & {
  source_task_id?: string;
  study_id: string;
  prompt: string;
  dataset_group_id?: string | null;
  session_id: string;
  rater_id: string;
  task_order: number;
  human_rating: 1 | 2 | 3 | 4 | 5;
  elapsed_ms: number;
  rated_at: string;
};
