import { SceneResources } from "./sceneResources";

type Tile = { data: ArrayBuffer; cacheControl: string | null; expires: string | null; freshUntil: number };

/** Share bytes, not WebGL textures or MapLibre's per-viewport tile traversal.
 * Each worker gets a fresh transferable buffer, leaving the shared cache intact. */
export class SharedBasemapTiles {
  private resources = new SceneResources<Tile>(256, 32 * 1024 * 1024, 12, tile => tile.data.byteLength);
  private fetchTile: typeof fetch;
  private now: () => number;

  constructor(fetchTile: typeof fetch = (input, init) => fetch(input, init), now: () => number = Date.now) { this.fetchTile = fetchTile; this.now = now; }

  async read(url: string, signal: AbortSignal, init: RequestInit = {}): Promise<Tile> {
    if (signal.aborted) throw new DOMException("Tile consumer cancelled", "AbortError");
    const key = `${url}:${JSON.stringify(init.headers ?? {})}:${init.credentials ?? "same-origin"}`;
    const result = this.resources.load(key, async () => {
      // Consumer cancellation must not cancel a request still needed by a peer.
      const response = await this.fetchTile(url, init);
      if (!response.ok) throw new Error(`Basemap tile request failed (${response.status})`);
      const cacheControl = response.headers.get("cache-control"), expires = response.headers.get("expires");
      const maxAge = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i);
      const ttl = maxAge ? Math.max(0, Number(maxAge[1]) - Number(response.headers.get("age") ?? 0)) * 1000 : 300_000;
      return { data: await response.arrayBuffer(), cacheControl, expires, freshUntil: maxAge ? this.now() + ttl : expires ? Date.parse(expires) : this.now() + ttl };
    }, { fresh: tile => tile.freshUntil > this.now(), cacheable: tile => !/no-store|no-cache/i.test(tile.cacheControl ?? "") && tile.freshUntil > this.now() });
    const tile = await new Promise<Tile>((resolve, reject) => {
      const abort = () => reject(new DOMException("Tile consumer cancelled", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      result.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
    if (signal.aborted) throw new DOMException("Tile consumer cancelled", "AbortError");
    return { ...tile, data: tile.data.slice(0) };
  }
}
