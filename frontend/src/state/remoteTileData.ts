import type { FeatureCollection } from '../api/types';

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
