/**
 * Simple in-memory cache for chain data.
 *
 * Caches responses from the blockchain so the frontend doesn't have to
 * make dozens of RPC calls on every page load. Each entry has a TTL
 * (time-to-live); expired entries are refreshed on the next request.
 * Entries also record the block they were read at, so a caller that has just
 * sent a transaction can ask for data that includes it.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  /** Chain head when the data was read: it reflects at least this block. */
  block: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Right after a transaction our RPC node can be a block or two behind the
// caller's, so wait briefly for it; blocks far ahead (or bogus) aren't waited for.
const CATCH_UP_MS = 5_000;
const CATCH_UP_POLL_MS = 500;
const MAX_BLOCKS_AHEAD = 10;

function freshEntry<T>(key: string): CacheEntry<T> | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

export function getCached<T>(key: string): T | null {
  return freshEntry<T>(key)?.data ?? null;
}

export function setCached<T>(key: string, data: T, ttlMs: number, block = 0): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs, block });
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidateAll(): void {
  store.clear();
}

export interface ChainReadOptions {
  /** Head block of the RPC the reads go to. */
  headBlock: () => Promise<number>;
  /** Only serve data read at or after this block, e.g. the caller's own transaction's. */
  minBlock?: number;
}

/**
 * How long past its TTL a read may still be served while a fresh one is
 * fetched in the background. Beyond this, callers wait for the re-read.
 */
const MAX_STALE_MS = 10 * 60_000;

/** One read per key at a time: concurrent callers share it. */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Wrap an async chain read with caching. A cached read older than `minBlock`
 * is re-read, but only once our node has a newer block than it, so callers
 * can force at most one re-read per block.
 *
 * An expired read is still served, and refreshed in the background: a public
 * RPC can take a minute to answer under load, and making whichever visitor
 * arrives after the TTL wait for that (or see it fail) made every page slow.
 * Concurrent callers share one read rather than each starting their own,
 * which is what tipped the node into rate-limiting in the first place.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  { headBlock, minBlock = 0 }: ChainReadOptions
): Promise<T> {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.block >= minBlock) {
    const age = Date.now() - entry.expiresAt;
    if (age <= 0) return entry.data;
    if (age <= MAX_STALE_MS) {
      void reread(key, ttlMs, fn, headBlock, 0).catch((err) => console.error(`[cache] background refresh of ${key} failed:`, err));
      return entry.data;
    }
  }
  return reread(key, ttlMs, fn, headBlock, minBlock);
}

function reread<T>(key: string, ttlMs: number, fn: () => Promise<T>, headBlock: () => Promise<number>, minBlock: number): Promise<T> {
  // A caller waiting on its own transaction needs a read that starts after it,
  // so only plain refreshes join one already running.
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running && minBlock === 0) return running;
  const read = (async () => {
    const block = minBlock > 0 ? await waitForBlock(headBlock, minBlock) : await headBlock();
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (entry && block <= entry.block) {
      // Nothing newer to read yet: keep the read we have, and its block.
      setCached(key, entry.data, ttlMs, entry.block);
      return entry.data;
    }
    const data = await fn();
    setCached(key, data, ttlMs, block);
    return data;
  })();
  const tracked = read.finally(() => {
    if (inflight.get(key) === tracked) inflight.delete(key);
  });
  inflight.set(key, tracked);
  return tracked;
}

async function waitForBlock(headBlock: () => Promise<number>, minBlock: number): Promise<number> {
  let head = await headBlock();
  if (minBlock > head + MAX_BLOCKS_AHEAD) return head;
  const deadline = Date.now() + CATCH_UP_MS;
  while (head < minBlock && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, CATCH_UP_POLL_MS));
    head = await headBlock();
  }
  return head;
}
