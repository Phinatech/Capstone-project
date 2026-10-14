import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withCache } from "./utils/cache.js";

/** A node whose head moves through `heads`, then stays on the last one. */
function nodeAt(...heads: number[]) {
  let i = 0;
  return { headBlock: async () => heads[Math.min(i++, heads.length - 1)]! };
}

/** A chain read that returns `values` in turn and counts its calls. */
function reads<T>(...values: T[]) {
  let calls = 0;
  return { fn: async () => values[Math.min(calls++, values.length - 1)]!, calls: () => calls };
}

describe("withCache", () => {
  it("serves a cached read until its TTL runs out", async () => {
    const read = reads("a", "b");
    assert.equal(await withCache("ttl", 60_000, read.fn, nodeAt(100)), "a");
    assert.equal(await withCache("ttl", 60_000, read.fn, nodeAt(105)), "a");
    assert.equal(read.calls(), 1);
  });

  it("re-reads when the caller needs a block newer than the cached read", async () => {
    const read = reads("before", "after");
    await withCache("newer", 60_000, read.fn, nodeAt(100));
    assert.equal(await withCache("newer", 60_000, read.fn, { ...nodeAt(101), minBlock: 101 }), "after");
    assert.equal(read.calls(), 2);
  });

  it("waits for a node that is a block behind the caller's transaction", async () => {
    const read = reads("before", "after");
    await withCache("catch-up", 60_000, read.fn, nodeAt(100));
    assert.equal(await withCache("catch-up", 60_000, read.fn, { ...nodeAt(100, 101), minBlock: 101 }), "after");
  });

  it("keeps the cached read when the node has nothing newer", async () => {
    const read = reads("a", "b");
    await withCache("nothing-newer", 60_000, read.fn, nodeAt(100));
    const started = Date.now();
    assert.equal(await withCache("nothing-newer", 60_000, read.fn, { ...nodeAt(100), minBlock: 1_000_000 }), "a");
    assert.equal(read.calls(), 1);
    assert.ok(Date.now() - started < 400, "a block far ahead of the node isn't waited for");
  });
});
