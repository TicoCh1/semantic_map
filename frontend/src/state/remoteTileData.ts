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
export type RemoteTileViewport = { template: string; zoom: number; tiles: ReadonlyMap<string, FeatureCollection> };
const viewports = new WeakMap<FeatureCollection, RemoteTileViewport>();
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

function nearbyTiles(tiles: Tile[], tileKeys: string[], previous?: ReadonlyMap<string, FeatureCollection>) {
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

function planRemoteTiles(template: string, tiles: Tile[], previous?: RemoteTileViewport) {
  const zoom = tiles[0]?.z ?? REMOTE_MAX_DETAIL_ZOOM;
  const tileKeys = tiles.map(tile => `${tile.z}/${tile.x}/${tile.y}`);
  const retained = previous?.template === template && previous.zoom === zoom ? previous.tiles : undefined;
  const covered = Boolean(tileKeys.length && retained && tileKeys.every(key => retained.has(key)));
  const nearby = covered ? new Map<string, FeatureCollection>() : nearbyTiles(tiles, tileKeys, retained);
  const sourceKeys = [...tileKeys, ...nearby.keys()].sort();
  return { zoom, tileKeys, retained, covered, nearby, sourceKeys };
}

async function readRemoteTiles(
  resources: SceneResources<FeatureCollection>, template: string, tiles: Tile[],
  loadTile: (tile: Tile) => Promise<FeatureCollection>, plan: ReturnType<typeof planRemoteTiles>, needed?: () => boolean
) {
  const { tileKeys, retained, nearby, zoom } = plan;
  const collections = await Promise.all(tiles.map((tile, index) => {
    const key = tileKeys[index];
    return retained?.get(key) ?? resources.load(`tile:${template}:${key}`, () => loadTile(tile), {
      cacheable: isCompleteRemoteTile,
      needed
    });
  }));
  if (needed && !needed()) throw new DOMException('Viewport is no longer current', 'AbortError');
  const byTile = new Map<string, FeatureCollection>();
  for (const [index, key] of tileKeys.entries()) {
    if (isCompleteRemoteTile(collections[index])) byTile.set(key, collections[index]);
  }
  const complete = byTile.size === tileKeys.length;
  for (const [key, tile] of nearby) byTile.set(key, tile);
  return { viewport: { template, zoom, tiles: byTile } satisfies RemoteTileViewport, complete };
}

export async function loadRemoteTileViewport(
  resources: SceneResources<FeatureCollection>, template: string, tiles: Tile[],
  loadTile: (tile: Tile) => Promise<FeatureCollection>, previous?: RemoteTileViewport, needed?: () => boolean
): Promise<RemoteTileViewport> {
  const plan = planRemoteTiles(template, tiles, previous);
  if (previous && plan.covered) return previous;
  return (await readRemoteTiles(resources, template, tiles, loadTile, plan, needed)).viewport;
}

export type RemoteRenderTile = { key: string; tiles: ReadonlyMap<string, FeatureCollection>; data: FeatureCollection };
const MAX_RENDER_TILE_POINTS = 18_000;

/** Keep each worker index spatially local. A parent tile can carry four small
 * children, while dense parents retain independent child indexes. */
export function remoteRenderTiles(viewport: RemoteTileViewport, previous: readonly RemoteRenderTile[] = []): RemoteRenderTile[] {
  const parents = new Map<string, Map<string, FeatureCollection>>();
  for (const key of [...viewport.tiles.keys()].sort()) {
    const tile = viewport.tiles.get(key)!;
    if (!tile.features.length) continue;
    const [z, x, y] = key.split('/').map(Number);
    const parent = `${z - 1}/${Math.floor(x / 2)}/${Math.floor(y / 2)}`;
    const group = parents.get(parent) ?? new Map<string, FeatureCollection>();
    group.set(key, tile);
    parents.set(parent, group);
  }
  const cached = new Map(previous.map(tile => [tile.key, tile]));
  const makeTile = (key: string, tiles: ReadonlyMap<string, FeatureCollection>): RemoteRenderTile => {
    const before = cached.get(key);
    if (before?.tiles.size === tiles.size && [...tiles].every(([id, tile]) => before.tiles.get(id) === tile)) return before;
    return {
      key, tiles,
      data: { type: 'FeatureCollection', features: [...tiles].flatMap(([id, tile]) => identifiedFeatures(id, tile)) }
    };
  };
  return [...parents].flatMap(([key, tiles]) => {
    const count = [...tiles.values()].reduce((sum, tile) => sum + tile.features.length, 0);
    if (count <= MAX_RENDER_TILE_POINTS) return [makeTile(key, tiles)];
    return [...tiles].map(([id, tile]) => makeTile(id, new Map([[id, tile]])));
  });
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
  const previous = displayed && viewports.get(displayed);
  const plan = planRemoteTiles(template, tiles, previous);
  // At the same detail level MapLibre already clips the covered source to the
  // camera. Keep that source when zooming into a subset of its tiles.
  if (displayed && plan.covered) return Promise.resolve(displayed);

  // Keep nearby, already-loaded tiles in the render source. MapLibre clips
  // them off screen and can show them again immediately on a short return pan.
  let complete = false;
  return resources.load(`view:${template}:${plan.sourceKeys.join('|')}`, async (viewportNeeded) => {
    const loaded = await readRemoteTiles(resources, template, tiles, loadTile, plan, viewportNeeded);
    const { viewport } = loaded;
    complete = loaded.complete;
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: plan.sourceKeys.flatMap(key => {
        const tile = viewport.tiles.get(key);
        return tile ? identifiedFeatures(key, tile) : [];
      })
    };
    viewports.set(data, viewport);
    return data;
  // An expanded source already lives with its pane and can evict raw tiles.
  }, { scheduled: false, cacheable: () => complete && plan.nearby.size === 0, needed });
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
