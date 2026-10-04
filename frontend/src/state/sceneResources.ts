/** Viewer-scoped shared content/request cache. Viewport tile selection stays
 * local to each pane; identical resources have one loader and one object. */
export class SceneResources<T> {
  private values = new Map<string, { value: T; weight: number }>();
  private pending = new Map<string, Promise<T>>();
  private queue: Array<() => void> = [];
  private active = 0;
  private weight = 0;
  private maxEntries: number;
  private maxWeight: number;
  private concurrency: number;
  private weigh: (value: T) => number;

  constructor(maxEntries = 192, maxWeight = 500_000, concurrency = 8, weigh: (value: T) => number = () => 1) {
    this.maxEntries = maxEntries; this.maxWeight = maxWeight;
    this.concurrency = concurrency; this.weigh = weigh;
  }

  load(key: string, loader: () => Promise<T>, options: { scheduled?: boolean; cacheable?: (value: T) => boolean; fresh?: (value: T) => boolean } = {}): Promise<T> {
    const cached = this.values.get(key);
    if (cached && (options.fresh?.(cached.value) ?? true)) {
      this.values.delete(key); this.values.set(key, cached);
      return Promise.resolve(cached.value);
    }
    if (cached) { this.weight -= cached.weight; this.values.delete(key); }
    const pending = this.pending.get(key);
    if (pending) return pending;
    // Defer the loader so pending is installed before nested requests start.
    const result = Promise.resolve().then(() => options.scheduled === false ? loader() : this.schedule(loader)).then(value => {
      if ((options.cacheable?.(value) ?? true)) {
        const weight = Math.max(1, this.weigh(value));
        if (weight <= this.maxWeight) {
          this.values.set(key, { value, weight }); this.weight += weight;
          while (this.values.size > this.maxEntries || this.weight > this.maxWeight) {
            const oldest = this.values.keys().next().value!;
            this.weight -= this.values.get(oldest)!.weight; this.values.delete(oldest);
          }
        }
      }
      return value;
    }).finally(() => { this.pending.delete(key); });
    this.pending.set(key, result);
    return result;
  }

  private schedule(loader: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.active++;
        Promise.resolve().then(loader).then(resolve, reject).finally(() => {
          this.active--; this.queue.shift()?.();
        });
      };
      if (this.active < this.concurrency) run(); else this.queue.push(run);
    });
  }
}
