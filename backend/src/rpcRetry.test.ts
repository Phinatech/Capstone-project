import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTransientRpcError, withRpcRetry } from "./utils/rpcRetry.js";

/** A sleep that returns at once, so the tests don't really wait out the backoff. */
const noSleep = async (): Promise<void> => {};

/** Fails `failures` times with `error`, then resolves to "ok". */
function flaky(failures: number, error: unknown) {
  let calls = 0;
  const work = async () => {
    calls += 1;
    if (calls <= failures) throw error;
    return "ok";
  };
  return { work, calls: () => calls };
}

const timeoutError = Object.assign(new Error("request timeout"), { code: "TIMEOUT" });
const revertError = Object.assign(new Error("execution reverted"), { reason: "already submitted for period" });

describe("isTransientRpcError", () => {
  it("treats a dropped connection as worth retrying", () => {
    assert.equal(isTransientRpcError(timeoutError), true);
    assert.equal(isTransientRpcError(new Error("failed to detect network")), true);
    assert.equal(isTransientRpcError(new Error("connect ECONNREFUSED 1.2.3.4:8545")), true);
  });

  it("does not retry a contract revert, which will fail identically", () => {
    assert.equal(isTransientRpcError(revertError), false);
    assert.equal(isTransientRpcError(new Error("bad data")), false);
  });
});

describe("withRpcRetry", () => {
  it("returns as soon as a retry succeeds", async () => {
    const { work, calls } = flaky(2, timeoutError);
    assert.equal(await withRpcRetry(work, 3, 0, noSleep), "ok");
    assert.equal(calls(), 3);
  });

  it("rethrows after the attempts run out", async () => {
    const { work, calls } = flaky(5, timeoutError);
    await assert.rejects(withRpcRetry(work, 3, 0, noSleep), /request timeout/);
    assert.equal(calls(), 3);
  });

  it("stops at the first non-transient failure instead of retrying a revert", async () => {
    const { work, calls } = flaky(5, revertError);
    await assert.rejects(
      withRpcRetry(work, 3, 0, noSleep),
      (e) => (e as { reason?: string }).reason === "already submitted for period",
    );
    assert.equal(calls(), 1);
  });

  it("works on a call that never fails", async () => {
    const { work, calls } = flaky(0, timeoutError);
    assert.equal(await withRpcRetry(work, 3, 0, noSleep), "ok");
    assert.equal(calls(), 1);
  });
});
