type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export class CacheService {
  private readonly stores = new Map<string, Map<string, CacheEntry<unknown>>>();

  get<T>(namespace: string, key: string): T | null {
    const store = this.stores.get(namespace);
    const entry = store?.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
      store?.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(namespace: string, key: string, value: T, ttlMs: number): void {
    let store = this.stores.get(namespace);
    if (!store) {
      store = new Map<string, CacheEntry<unknown>>();
      this.stores.set(namespace, store);
    }

    store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async memo<T>(namespace: string, key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(namespace, key);
    if (cached !== null) return cached;

    const value = await loader();
    this.set(namespace, key, value, ttlMs);
    return value;
  }

  invalidate(namespace: string, key: string): void {
    this.stores.get(namespace)?.delete(key);
  }

  invalidatePrefix(namespace: string, prefix: string): void {
    const store = this.stores.get(namespace);
    if (!store) return;

    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  }

  clear(namespace: string): void {
    this.stores.get(namespace)?.clear();
  }
}

export function createCacheService() {
  return new CacheService();
}

export const cacheService = createCacheService();
