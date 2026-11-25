import type { FeatureCollection } from '../api/types';
import type { GeoJSONSourceDiff } from 'maplibre-gl';
import type { SceneResources } from './sceneResources';

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
type Viewport = { template: string; tiles: Map<string, FeatureCollection> };
const viewports = new WeakMap<FeatureCollection, Viewport>();
const emptyViewport: FeatureCollection = { type: 'FeatureCollection', features: [] };
const identifiedTiles = new WeakMap<FeatureCollection, { key: string; features: FeatureCollection['features'] }>();

function identifiedFeatures(key: string, tile: FeatureCollection): FeatureCollection['features'] {
  const cached = identifiedTiles.get(tile);
  if (cached?.key === key) return cached.features;
  // Panorama IDs can repeat. Immutable tiles give each row a stable render ID.
  const features = tile.features.map((feature, index) => ({ ...feature, id: `${key}:${index}` }));
  identifiedTiles.set(tile, { key, features });
  return features;
}

export function loadRemoteViewport(
  resources: SceneResources<FeatureCollection>,
  template: string,
  tiles: Tile[],
  loadTile: (tile: Tile) => Promise<FeatureCollection>,
  displayed?: FeatureCollection
): Promise<FeatureCollection> {
  if (!tiles.length) return Promise.resolve(emptyViewport);
  const tileKeys = tiles.map(tile => `${tile.z}/${tile.x}/${tile.y}`);
  const previous = displayed && viewports.get(displayed);
  const retained = previous?.template === template ? previous.tiles : undefined;
  // At the same detail level MapLibre already clips the covered source to the
  // camera. Keep that source when zooming into a subset of its tiles.
  if (displayed && retained && tileKeys.every(key => retained.has(key))) return Promise.resolve(displayed);

  return resources.load(`view:${template}:${tileKeys.join('|')}`, async () => {
    const collections = await Promise.all(tiles.map((tile, index) => {
      const key = tileKeys[index];
      return retained?.get(key) ?? resources.load(`tile:${template}:${key}`, () => loadTile(tile), { cacheable: isCompleteRemoteTile });
    }));
    const byTile = new Map(tileKeys.map((key, index) => [key, collections[index]]));
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: collections.flatMap((tile, index) => identifiedFeatures(tileKeys[index], tile))
    };
    if (collections.every(isCompleteRemoteTile)) viewports.set(data, { template, tiles: byTile });
    return data;
  }, { scheduled: false, cacheable: data => viewports.has(data) });
}

export function remoteViewportDiff(previous: FeatureCollection, next: FeatureCollection): GeoJSONSourceDiff | undefined {
  const from = viewports.get(previous);
  const to = viewports.get(next);
  if (!from || !to || from.template !== to.template) return;
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
