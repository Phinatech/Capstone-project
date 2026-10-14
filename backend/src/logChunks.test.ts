import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blockChunks } from "./utils/logChunks.js";

describe("blockChunks", () => {
  it("covers the range in inclusive chunks of exactly `size` blocks", () => {
    assert.deepEqual(blockChunks(0, 99, 50), [
      [0, 49],
      [50, 99],
    ]);
  });

  it("ends with a shorter chunk at the head", () => {
    assert.deepEqual(blockChunks(10, 120, 50), [
      [10, 59],
      [60, 109],
      [110, 120],
    ]);
  });

  it("never spans more blocks than the RPC allows", () => {
    // An RPC capped at 50,000 blocks per request rejects anything longer.
    for (const [from, to] of blockChunks(11_828_462, 11_983_103, 50_000)) {
      assert.ok(to - from + 1 <= 50_000);
    }
  });

  it("handles a single block and an empty range", () => {
    assert.deepEqual(blockChunks(5, 5, 50), [[5, 5]]);
    assert.deepEqual(blockChunks(6, 5, 50), []);
  });

  it("rejects a chunk size that would never advance", () => {
    assert.throws(() => blockChunks(0, 10, 0), RangeError);
    assert.throws(() => blockChunks(0, 10, 1.5), RangeError);
  });
});
