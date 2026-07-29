export type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  staleUntil: number;
};

export class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Set item in cache
   * @param key cache key
   * @param value data value
   * @param ttlSeconds time to live in seconds (default 300s / 5 min)
   * @param staleSeconds grace period for stale data (default 600s / 10 min)
   */
  set<T>(key: string, value: T, ttlSeconds = 300, staleSeconds = 600): void {
    const now = Date.now();
    this.cache.set(key, {
      data: value,
      expiresAt: now + ttlSeconds * 1000,
      staleUntil: now + (ttlSeconds + staleSeconds) * 1000,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.staleUntil) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() > entry.expiresAt;
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds = 300,
    staleSeconds = 600
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      // Stale-While-Revalidate background refresh if stale
      if (this.isStale(key)) {
        fetchFn().then((newData) => {
          this.set(key, newData, ttlSeconds, staleSeconds);
        }).catch(() => {});
      }
      return cached;
    }

    const freshData = await fetchFn();
    this.set(key, freshData, ttlSeconds, staleSeconds);
    return freshData;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalCache = new MemoryCache();
