# Prompt Search Prototype Notes

## Why No z-level Import

The existing z/x/y GeoJSON output is a rendering optimization for MapLibre. The underlying result data is already dataset-shaped:

- pano records: `pano_id`, `lon`, `lat`, `date`, `row_index`
- result arrays: `score.npy`, `zscore.npy`
- manifest metadata: prompt, dataset, score stats, scoring versions

ArcGIS can consume the result as a normal point dataset, so the prototype fetches paged features directly instead of recreating the frontend tile hierarchy.

## Data Contract

Each exported feature has:

```text
geometry.x
geometry.y
objectid
pano_id
dataset_id
city_id
prompt_id
prompt
query_type
score
zscore
lon
lat
capture_date
```

`objectid` is stable for a dataset result because it is `row_index + 1`.

## First Plugin Target

Use an Experience Builder widget first:

- lower migration cost from the existing React frontend
- native ArcGIS `FeatureLayer`
- native popup, layer list, renderer, filtering, and query behavior
- no custom colour editor in v1

The widget currently keeps layer data client-side. Persisting into ArcGIS Online, Enterprise, or an ArcGIS Pro geodatabase is a later workflow.

## Deferred Street View

Pano preview should be a second pass. The backend routes already exist:

```text
GET /api/datasets/{dataset_id}/panos/{pano_id}
GET /api/datasets/{dataset_id}/panos/{pano_id}/image
```

The ArcGIS UX still needs a decision: popup action, side panel, or Pro DockPane preview.
