export const NEW_YORK_SCORING_DATASET_ID = "new_york_224_8_45";
export const NEW_YORK_MANHATTAN_PANO_DATASET_ID = "new_york_manhattan_224_8_45";
export const NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID = "new_york_outside_manhattan_224_8_45";

type Position = readonly [number, number];
type Ring = readonly Position[];
type Polygon = readonly Ring[];

// Simplified from outputs/qgis_city_study_extents/
// New_York_Manhattan_OSM_administrative_boundary.geojson (OSM/ODbL).
const MANHATTAN_POLYGONS: readonly Polygon[] = [
  [[[-74.0436327,40.688777],[-74.043465,40.6896421],[-74.0438883,40.6901864],[-74.0460174,40.6911182],[-74.0472041,40.6909398],[-74.0471981,40.6904236],[-74.0462749,40.6893396],[-74.0447779,40.6885981],[-74.0436327,40.688777]]],
  [[[-74.0407303,40.7001925],[-74.0397962,40.6989767],[-74.0402387,40.6988362],[-74.0399309,40.6985897],[-74.0383723,40.6986686],[-74.0389358,40.6996549],[-74.0407303,40.7001925]]],
  [[[-74.035443,40.685125],[-74.019577,40.679654],[-74.0082907,40.6864417],[-74.0074623,40.6886621],[-74.0002365,40.6994949],[-73.9959947,40.7037725],[-73.9935158,40.7046716],[-73.97912,40.706065],[-73.977116,40.706533],[-73.97226,40.709102],[-73.970159,40.706916],[-73.970129,40.705383],[-73.969312,40.705475],[-73.9692715,40.7070286],[-73.9704007,40.7086318],[-73.9700064,40.7105491],[-73.969061,40.711744],[-73.9689119,40.7131879],[-73.9673055,40.7170152],[-73.9679043,40.7173184],[-73.966666,40.7194968],[-73.9649308,40.7214952],[-73.9633389,40.7218977],[-73.961722,40.72487],[-73.9621293,40.7251589],[-73.961758,40.725784],[-73.9619238,40.7275427],[-73.9613803,40.729069],[-73.961465,40.730764],[-73.962406,40.732926],[-73.962112,40.734528],[-73.962978,40.738393],[-73.9621661,40.7413534],[-73.9607468,40.7441711],[-73.957853,40.7483993],[-73.9572708,40.7491674],[-73.9547578,40.7507797],[-73.952027,40.75383],[-73.941379,40.767089],[-73.935226,40.770609],[-73.935045,40.7711861],[-73.9375174,40.7725227],[-73.9378787,40.773831],[-73.937838,40.774832],[-73.936347,40.777138],[-73.934558,40.77825],[-73.933803,40.778272],[-73.931708,40.777998],[-73.930038,40.776398],[-73.928695,40.776757],[-73.922345,40.780811],[-73.9126153,40.7894243],[-73.9098375,40.7909643],[-73.912528,40.796118],[-73.919896,40.799392],[-73.921413,40.801369],[-73.922663,40.802119],[-73.927663,40.802399],[-73.930526,40.806614],[-73.932364,40.808519],[-73.932857,40.810327],[-73.932556,40.810886],[-73.932828,40.811948],[-73.932532,40.816053],[-73.932828,40.823366],[-73.933796,40.832958],[-73.93287,40.836453],[-73.930104,40.841494],[-73.929128,40.844264],[-73.927091,40.847353],[-73.920076,40.856589],[-73.913396,40.863342],[-73.910336,40.867669],[-73.909337,40.870314],[-73.909332,40.87254],[-73.908902,40.873034],[-73.908412,40.872698],[-73.907451,40.873398],[-73.906769,40.87598],[-73.908183,40.877538],[-73.908941,40.877642],[-73.909616,40.878754],[-73.911584,40.87914],[-73.912693,40.877768],[-73.914773,40.876719],[-73.915336,40.875808],[-73.917767,40.875669],[-73.919642,40.876327],[-73.921873,40.878372],[-73.924928,40.878899],[-73.933907,40.882012],[-73.9502981,40.8586258],[-73.9547924,40.8512835],[-73.9561557,40.8481811],[-73.9587238,40.8376892],[-73.963577,40.826642],[-74.014028,40.757551],[-74.023637,40.718068],[-74.02639,40.700102],[-74.035443,40.685125]]]
];

export function panoDatasetIdForPoint(
  scoringDatasetId: string,
  lon: number,
  lat: number
): string {
  if (
    scoringDatasetId === NEW_YORK_MANHATTAN_PANO_DATASET_ID
    || scoringDatasetId === NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID
  ) {
    return scoringDatasetId;
  }
  if (scoringDatasetId !== NEW_YORK_SCORING_DATASET_ID) return scoringDatasetId;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return scoringDatasetId;
  if (lon < -74.45 || lon > -73.45 || lat < 40.45 || lat > 41.05) return scoringDatasetId;
  return pointInMultiPolygon(lon, lat, MANHATTAN_POLYGONS)
    ? NEW_YORK_MANHATTAN_PANO_DATASET_ID
    : NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID;
}

export function alternatePanoDatasetId(datasetId: string | null | undefined): string | null {
  if (datasetId === NEW_YORK_MANHATTAN_PANO_DATASET_ID) return NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID;
  if (datasetId === NEW_YORK_OUTSIDE_MANHATTAN_PANO_DATASET_ID) return NEW_YORK_MANHATTAN_PANO_DATASET_ID;
  return null;
}

export function panoPointKey(datasetId: string, panoId: string, lon: number, lat: number): string {
  const coordinateKey = Number.isFinite(lon) && Number.isFinite(lat)
    ? `:${lon.toFixed(6)}:${lat.toFixed(6)}`
    : "";
  return `${datasetId}:${panoId}${coordinateKey}`;
}

function pointInMultiPolygon(lon: number, lat: number, polygons: readonly Polygon[]): boolean {
  return polygons.some((polygon) => {
    const outer = polygon[0];
    if (!outer || !pointInRing(lon, lat, outer)) return false;
    return !polygon.slice(1).some((hole) => pointInRing(lon, lat, hole));
  });
}

function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) continue;
    const [currentLon, currentLat] = currentPoint;
    const [previousLon, previousLat] = previousPoint;
    const crossesLatitude = (currentLat > lat) !== (previousLat > lat);
    if (!crossesLatitude) continue;
    const crossingLon = ((previousLon - currentLon) * (lat - currentLat)) / (previousLat - currentLat) + currentLon;
    if (lon < crossingLon) inside = !inside;
  }
  return inside;
}
