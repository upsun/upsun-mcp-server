/**
 * Bounded in-memory cache that evicts the least recently used entry when full
 * and drops entries left unused for longer than the idle TTL.
 */
export class LruCache<V> {
  // Map iteration order is insertion order, so the first key is the least recently used.
  private readonly entries = new Map<string, { value: V; lastUsed: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly idleTtlMs: number
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    this.entries.delete(key);
    const now = Date.now();
    if (now - entry.lastUsed > this.idleTtlMs) {
      return undefined;
    }
    entry.lastUsed = now;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, lastUsed: Date.now() });
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
  }
}
