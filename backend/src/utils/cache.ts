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
 * Wrap an async chain read with caching. A cached read older than `minBlock`
 * is re-read, but only once our node has a newer block than it, so callers
 * can force at most one re-read per block.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  { headBlock, minBlock = 0 }: ChainReadOptions
): Promise<T> {
  const entry = freshEntry<T>(key);
  if (entry && entry.block >= minBlock) return entry.data;
  const block = minBlock > 0 ? await waitForBlock(headBlock, minBlock) : await headBlock();
  if (entry && block <= entry.block) return entry.data; // nothing newer to read yet
  const data = await fn();
  setCached(key, data, ttlMs, block);
  return data;
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
