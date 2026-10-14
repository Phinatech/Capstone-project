/**
 * Simple in-memory cache for chain data.
 *
 * Caches responses from the blockchain so the frontend doesn't have to
 * make dozens of RPC calls on every page load. Each entry has a TTL
 * (time-to-live); expired entries are refreshed on the next request.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidateAll(): void {
  store.clear();
}

/** Wrap an async fetch with caching. */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;
  const data = await fn();
  setCached(key, data, ttlMs);
  return data;
}
