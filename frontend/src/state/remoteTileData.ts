import type { FeatureCollection } from '../api/types';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import type { SceneResources } from './sceneResources';

export const REMOTE_MAX_DETAIL_ZOOM = 13;
const REMOTE_MIN_DETAIL_ZOOM = 10;
const TILE_ZOOM_HYSTERESIS = 0.08;

export function settledRemoteTileZoom(zoom: number, previous?: number): number {
  const next = Math.max(REMOTE_MIN_DETAIL_ZOOM, Math.min(REMOTE_MAX_DETAIL_ZOOM, Math.floor(zoom)));
  if (previous === undefined) return next;
  if (next > previous && zoom < previous + 1 + TILE_ZOOM_HYSTERESIS) return previous;
  if (next < previous && zoom > previous - TILE_ZOOM_HYSTERESIS) return previous;
  return next;
}

// A successful empty tile is content. A 202/404 placeholder must remain retryable.
const unavailable = new WeakSet<FeatureCollection>();

export function unavailableRemoteTile(): FeatureCollection {
  const data: FeatureCollection = { type: 'FeatureCollection', features: [] };
  unavailable.add(data);
  return data;
}

export function isCompleteRemoteTile(data: FeatureCollection): boolean {
  return !unavailable.has(data);
}

type Tile = { z: number; x: number; y: number };
type Viewport = { template: string; zoom: number; tiles: Map<string, FeatureCollection> };
const viewports = new WeakMap<FeatureCollection, Viewport>();
const emptyViewport: FeatureCollection = { type: 'FeatureCollection', features: [] };
const identifiedTiles = new WeakMap<FeatureCollection, { key: string; features: FeatureCollection['features'] }>();
const RETAINED_TILE_MARGIN = 2;
const RETAINED_TILE_LIMIT = 24;
const RETAINED_POINT_LIMIT = 32_000;

function identifiedFeatures(key: string, tile: FeatureCollection): FeatureCollection['features'] {
  const cached = identifiedTiles.get(tile);
  if (cached?.key === key) return cached.features;
  // Panorama IDs can repeat. Immutable tiles give each row a stable render ID.
  const features = tile.features.map((feature, index) => ({ ...feature, id: `${key}:${index}` }));
  identifiedTiles.set(tile, { key, features });
  return features;
}

function nearbyTiles(tiles: Tile[], tileKeys: string[], previous?: Map<string, FeatureCollection>) {
  const nearby = new Map<string, FeatureCollection>();
  if (!previous?.size) return nearby;
  const visible = new Set(tileKeys);
  const wanted = new Set<string>();
  for (const { z, x, y } of tiles) {
    const width = 2 ** z;
    for (let dx = -RETAINED_TILE_MARGIN; dx <= RETAINED_TILE_MARGIN; dx++) {
      for (let dy = -RETAINED_TILE_MARGIN; dy <= RETAINED_TILE_MARGIN; dy++) {
        wanted.add(`${z}/${(x + dx + width) % width}/${y + dy}`);
      }
    }
  }
  let points = 0;
  for (const [key, data] of previous) {
    if (visible.has(key) || !wanted.has(key) || points + data.features.length > RETAINED_POINT_LIMIT) continue;
    nearby.set(key, data);
    points += data.features.length;
    if (nearby.size === RETAINED_TILE_LIMIT) break;
  }
  return nearby;
}

export function loadRemoteViewport(
  resources: SceneResources<FeatureCollection>,
  template: string,
  tiles: Tile[],
  loadTile: (tile: Tile) => Promise<FeatureCollection>,
  displayed?: FeatureCollection,
  needed?: () => boolean
): Promise<FeatureCollection> {
  if (!tiles.length) return Promise.resolve(emptyViewport);
  const zoom = tiles[0].z;
  const tileKeys = tiles.map(tile => `${tile.z}/${tile.x}/${tile.y}`);
  const previous = displayed && viewports.get(displayed);
  const retained = previous?.template === template && previous.zoom === zoom ? previous.tiles : undefined;
  // At the same detail level MapLibre already clips the covered source to the
  // camera. Keep that source when zooming into a subset of its tiles.
  if (displayed && retained && tileKeys.every(key => retained.has(key))) return Promise.resolve(displayed);

  // Keep nearby, already-loaded tiles in the render source. MapLibre clips
  // them off screen and can show them again immediately on a short return pan.
  const nearby = nearbyTiles(tiles, tileKeys, retained);
  const sourceKeys = [...tileKeys, ...nearby.keys()].sort();
  let complete = false;
  return resources.load(`view:${template}:${sourceKeys.join('|')}`, async (viewportNeeded) => {
    const collections = await Promise.all(tiles.map((tile, index) => {
      const key = tileKeys[index];
      return retained?.get(key) ?? resources.load(`tile:${template}:${key}`, () => loadTile(tile), {
        cacheable: isCompleteRemoteTile,
        needed: viewportNeeded
      });
    }));
    if (!viewportNeeded()) throw new DOMException('Viewport is no longer current', 'AbortError');
    const byTile = new Map(tileKeys.flatMap((key, index) => {
      const tile = collections[index];
      return isCompleteRemoteTile(tile) ? [[key, tile] as const] : [];
    }));
    complete = byTile.size === tileKeys.length;
    for (const [key, tile] of nearby) byTile.set(key, tile);
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: sourceKeys.flatMap(key => {
        const tile = byTile.get(key);
        return tile ? identifiedFeatures(key, tile) : [];
      })
    };
    viewports.set(data, { template, zoom, tiles: byTile });
    return data;
    // Keep the tile cache for reuse across panes. An expanded source already
    // lives with its pane and can be large enough to evict its own raw tiles.
  }, { scheduled: false, cacheable: () => complete && nearby.size === 0, needed });
}

export function remoteViewportDiff(previous: FeatureCollection, next: FeatureCollection): GeoJSONSourceDiff | undefined {
  const from = viewports.get(previous);
  const to = viewports.get(next);
  if (!from || !to || from.template !== to.template || from.zoom !== to.zoom) return;
  const leaving = [...from.tiles].filter(([key, tile]) => to.tiles.get(key) !== tile);
  const entering = [...to.tiles].filter(([key, tile]) => from.tiles.get(key) !== tile);
  const changedPoints = [...leaving, ...entering].reduce((total, [, tile]) => total + tile.features.length, 0);
  // Large moves and changes of detail level are cheaper as full replacements.
  if (changedPoints > Math.min(64_000, next.features.length * 0.65)) return;
  return {
    add: entering.flatMap(([key, tile]) => identifiedFeatures(key, tile)),
    remove: leaving.flatMap(([key, tile]) => identifiedFeatures(key, tile).map(feature => feature.id!))
  };
}
