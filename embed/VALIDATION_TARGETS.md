# Validation target projection policy

Every derived image row retains its `source_index`, `dataset_id`, archive/member
locator, and exact transform. Validation targets must use that transform; image
shape or a 2:1 ratio is never used to guess projection.

As of 2026-09-20, the enabled catalog's adapters are connected to the embedding
runner through `dataset_validation_export.py`. Each native source package commits a
validation TAR through source-atomic byte-offset checkpoints; each view includes target provenance, status and scope. Missing
expected labels fail the source; hidden test labels are explicitly unavailable.
RGB inputs remain in memory and are not exported. Retain original image sources
and the recorded transforms for verification. Only raster labels requiring
geometric changes are exported; unchanged rasters use original references.
This applies to all configured image-form annotations, not only semantic masks.
Derived labels use lossless PNG or NPY for large integer/float rasters. Required
resampling preserves label values and effective precision without lossy compression.

| Dataset | Target actually available | Policy |
|---|---|---|
| Cityscapes | 2048x1024 class/instance/color rasters, polygons, PanopticParts TIFF | Split RGB and rasters into left/right 1024 squares, resize to 512. Rasters use nearest-neighbour; polygons are clipped and scaled. |
| Mapillary Vistas | Same-size semantic/instance/panoptic PNG targets | Apply the identical center crop; nearest-neighbour target resize. |
| Mapillary MTSD | Per-image JSON with `width`, `height`, `ispano`, object class and bbox | Use `ispano` to resolve geometry; affine clip for perspective or project source rectangles through the nearest source grid for eight panoramic views. |
| Mapillary MSLS | Easting, northing, cluster, control-panel flag, night flag and view direction | Source metadata/tags, not pixel truth. Keep on `source_index`; do not geometrically project. |
| OmniCity satellite | COCO polygons plus 512x512 floating-point height raster | Retained on disk for reference, but explicitly disabled in the embedding catalog. |
| OmniCity mono | COCO instance/building-plane/7-class land-use polygons on 512x512 images | Already square; polygon coordinates remain aligned. |
| OmniCity panorama | COCO polygons in the 1024x512 panorama coordinate system | Rasterize polygons at source resolution, then use the exact equirectangular ray grid with nearest-neighbour sampling for all eight views. |
| OmniCity v2 SVI | SVI is 1024x512, but matching `gt-landuse`/`gt_floor` are 256x256 satellite-view targets | Embed only `images/svi`; `images/sate` is excluded. Preserve satellite target association only; never embed or project satellite pixels as street-view truth. |
| BDD100K | Current Pod has 100K per-image JSON/drivable masks and 10K semantic masks | Export clipped boxes, flattened/clipped curve paths, matching raster crops and source tags. Hidden test labels remain unavailable. |
| A2D2 | Camera-aligned semantic raster | Same crop/tile as camera image, nearest-neighbour label transform. Full package is not mounted on this Pod; local preview confirms paired image/mask. |
| Global Streetscapes | Eight manually labelled contextual attributes | Source-image tags, not masks. See tag scope below. |
| RDD2022 | Pascal VOC boxes for D00/D10/D20/D40 | Clip and scale each box with the perspective crop/tile. |
| CULane | One lane per line as source-pixel x/y pairs | Clip polyline segments at the crop and scale coordinates. |

## Source tag scope

Global Streetscapes manual labels are platform, weather, view direction,
lighting condition, panoramic status, quality, glare, and reflection. Platform,
weather and lighting can normally be evaluated after pooling all derived views
back to the source. View direction and panoramic status describe the source
capture rather than a derived 45-degree view. Quality, glare and reflection may
be localized, so they also remain source-scoped unless the derived views are
manually relabelled.

BDD100K's weather, scene and time-of-day attributes are likewise source tags.
For source-tag evaluation, pool the two square tiles or eight panorama views by
`source_index`; do not duplicate one source answer as eight independent truths.

Vistas uses V2.0 rasters/polygons and config from the selected V2 archive. MTSD
retains full/partial annotation coverage and uses its official split manifest
for hidden-test exceptions. MSLS keeps its joined CSV metadata at source scope;
its `pano` flag selects one crop or eight panoramic views. MTSD has the same
explicit metadata policy; hidden-test images lacking camera metadata retain the
declared catalog fallback, recorded in exported policy. True panorama flags with
incompatible dimensions are explicit source errors and are never guessed away.
OmniCity exports per-task instance masks with category/annotation-ID tables;
mask background is zero even when the original annotation ID is zero. BDD
Bezier paths use adaptive 0.25-source-pixel flattening and preserve disconnected
clipped fragments. Panoptic-part TIFF IDs exceeding 16 bits are exported as NPY.
