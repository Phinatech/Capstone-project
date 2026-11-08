import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAX_WAIT_MS, withCache } from "./utils/cache.js";

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

  it("serves an expired read at once and refreshes it in the background", async () => {
    const read = reads("old", "new");
    await withCache("swr", 1, read.fn, nodeAt(100));
    await sleep(5);
    assert.equal(await withCache("swr", 1, read.fn, nodeAt(101)), "old", "nobody waits for the re-read");
    await sleep(5);
    assert.equal(read.calls(), 2, "the re-read ran behind the scenes");
    assert.equal(await withCache("swr", 60_000, read.fn, nodeAt(101)), "new");
  });

  it("still serves a read from hours ago at once, so a quiet night costs nobody a wait", async (t) => {
    const read = reads("last night", "this morning");
    await withCache("night", 1, read.fn, nodeAt(100));
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 8 * 60 * 60_000 });
    assert.equal(await withCache("night", 1, read.fn, nodeAt(101)), "last night");
  });

  it("stops a visitor waiting on a read that never answers", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const waiting = withCache("hung", 60_000, () => new Promise<string>(() => {}), nodeAt(100));
    const gaveUp = assert.rejects(waiting, /chain read took over/);
    t.mock.timers.tick(MAX_WAIT_MS);
    await gaveUp;
  });

  it("shares one read between callers that arrive together", async () => {
    let calls = 0;
    const slow = async () => {
      calls++;
      await sleep(20);
      return calls;
    };
    const results = await Promise.all([1, 2, 3].map(() => withCache("herd", 60_000, slow, nodeAt(100))));
    assert.deepEqual(results, [1, 1, 1]);
    assert.equal(calls, 1);
  });
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
