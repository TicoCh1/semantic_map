import { useCallback, useEffect, useRef, useState } from "react";
import { loadPanoImage } from "../api/client";
import type { MarkedPano, PanoMapPoint } from "../api/types";

function keyFor(point: PanoMapPoint): string {
  return point.pano_key || `${point.pano_dataset_id || point.dataset_id || point.city_id}:${point.pano_id}:${point.lon}:${point.lat}`;
}

function revoke(url?: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

// Keep the normal app's panorama API and viewer, with requests scoped to this
// experimental page. Late responses must not reopen removed panoramas.
export function useRegionPanos() {
  const [panos, setPanos] = useState<MarkedPano[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const current = useRef<MarkedPano[]>([]);
  const requests = useRef(new Map<string, symbol>());
  const alive = useRef(true);

  const replace = useCallback((next: MarkedPano[]) => {
    current.current = next;
    setPanos(next);
  }, []);
  const dispose = useCallback(() => {
    requests.current.clear();
    current.current.forEach(pano => revoke(pano.object_url));
    current.current = [];
  }, []);
  const clear = useCallback(() => {
    dispose();
    setPanos([]);
    setSelectedKey(null);
  }, [dispose]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; dispose(); };
  }, [dispose]);

  const remove = useCallback((key: string) => {
    const found = current.current.find(pano => pano.pano_key === key);
    revoke(found?.object_url);
    requests.current.delete(key);
    const next = current.current.filter(pano => pano.pano_key !== key);
    replace(next);
    setSelectedKey(old => old === key ? next[0]?.pano_key || null : old);
  }, [replace]);

  const mark = useCallback((point: PanoMapPoint) => {
    if (!alive.current) return;
    const key = keyFor(point);
    setSelectedKey(key);
    const previous = current.current.find(pano => pano.pano_key === key);
    if (previous?.status === "ready" || requests.current.has(key)) {
      // The shared pane reports layer values in a second callback. Merge those
      // without losing the loaded image or issuing a duplicate API request.
      replace(current.current.map(pano => pano.pano_key === key ? { ...pano, ...point, pano_key: key } : pano));
      return;
    }
    const loading: MarkedPano = { ...point, pano_key: key, status: "loading" };
    replace(previous ? current.current.map(pano => pano.pano_key === key ? loading : pano) : [...current.current, loading]);
    const request = Symbol(key);
    requests.current.set(key, request);
    void loadPanoImage(point.pano_id, point.pano_dataset_id || point.dataset_id, {
      lon: point.lon, lat: point.lat, date: point.date
    }).then(metadata => {
      if (!alive.current || requests.current.get(key) !== request) { revoke(metadata.object_url); return; }
      replace(current.current.map(pano => pano.pano_key === key ? {
        ...pano, ...metadata, pano_key: key, status: "ready",
        pano_dataset_id: metadata.pano_dataset_id || pano.pano_dataset_id
      } : pano));
    }).catch(error => {
      if (!alive.current || requests.current.get(key) !== request) return;
      replace(current.current.map(pano => pano.pano_key === key ? {
        ...pano, status: "failed", message: error instanceof Error ? error.message : "Street view request failed"
      } : pano));
    }).finally(() => {
      if (requests.current.get(key) === request) requests.current.delete(key);
    });
  }, [replace]);

  return { panos, selectedKey, select: setSelectedKey, mark, remove, clear };
}
