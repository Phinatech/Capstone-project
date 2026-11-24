import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createFailover,
  isRateLimitError,
  isRateLimitMessage,
  isTransientRpcError,
  readJsonRpcReplies,
  withRateLimitBackoff,
  withRpcRetry,
} from "./utils/rpcRetry.js";

describe("moving between RPC nodes", () => {
  /** A call that fails on the nodes named in `down`, and records each node it tried. */
  function callNodes(...down: string[]) {
    const tried: string[] = [];
    const call = async (node: string) => {
      tried.push(node);
      if (down.includes(node)) throw new Error(`${node} is down`);
      return node;
    };
    return { call, tried };
  }

  it("uses the first node while it answers", async () => {
    const { call, tried } = callNodes();
    assert.equal(await createFailover(["a", "b"])(call), "a");
    assert.deepEqual(tried, ["a"]);
  });

  it("moves on when a node fails, and stays on the one that answered", async () => {
    const { call, tried } = callNodes("a");
    const onNodes = createFailover(["a", "b", "c"]);
    assert.equal(await onNodes(call), "b");
    assert.equal(await onNodes(call), "b");
    assert.deepEqual(tried, ["a", "b", "b"], "a failed once and was not asked again");
  });

  it("reports the failure when every node is down", async () => {
    const { call, tried } = callNodes("a", "b");
    await assert.rejects(createFailover(["a", "b"])(call), /b is down/);
    assert.deepEqual(tried, ["a", "b"]);
  });

  it("recognises a rate limit sent in a normal reply, but not a contract revert", () => {
    assert.equal(isRateLimitMessage("Too Many Requests"), true);
    assert.equal(isRateLimitMessage("daily request quota reached"), true);
    assert.equal(isRateLimitMessage("execution reverted"), false);
    assert.equal(isRateLimitMessage(undefined), false);
  });
});

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

// What Tenderly's public gateway sent Render on 24 Nov 2026, as ethers throws it.
const tooManyRequests = Object.assign(new Error('server response 429 Too Many Requests (responseBody="rate limit exceeded")'), {
  shortMessage: "server response 429 Too Many Requests",
});
const relayedRateLimit = new Error("RPC node is rate limiting: rate limit exceeded");

describe("readJsonRpcReplies", () => {
  const requests = [{ id: 7 }];

  it("returns the replies to the requests sent, results and contract errors alike", () => {
    const ok = { jsonrpc: "2.0", id: 7, result: "0x10" };
    assert.deepEqual(readJsonRpcReplies(requests, ok), [ok]);
    const reverted = { jsonrpc: "2.0", id: 7, error: { code: 3, message: "execution reverted" } };
    assert.deepEqual(readJsonRpcReplies(requests, [reverted]), [reverted]);
  });

  it("rejects a 200 body that is not a JSON-RPC reply, so the next node is tried", () => {
    // What a fallback node passed through from its upstream on 24 Nov 2026.
    const refusal = {
      error: 'Method "eth_call" is not available for unregistered accounts.',
      path: "/eth-sepolia",
      status: 200,
    };
    assert.throws(() => readJsonRpcReplies(requests, [refusal]), /JSON-RPC reply/);
    assert.throws(() => readJsonRpcReplies(requests, { jsonrpc: "2.0", id: 8, result: "0x1" }), /JSON-RPC reply/);
    assert.throws(() => readJsonRpcReplies(requests, null), /JSON-RPC reply/);
  });

  it("treats a rate limit inside a reply as the node failing", () => {
    const limited = { jsonrpc: "2.0", id: 7, error: { code: -32005, message: "rate limit exceeded" } };
    assert.throws(() => readJsonRpcReplies(requests, limited), /rate limiting/);
  });
});

describe("isRateLimitError", () => {
  it("recognises an HTTP 429 and a rate limit in a JSON reply", () => {
    assert.equal(isRateLimitError(tooManyRequests), true);
    assert.equal(isRateLimitError(relayedRateLimit), true);
  });

  it("leaves timeouts, reverts and odd values alone", () => {
    assert.equal(isRateLimitError(timeoutError), false);
    assert.equal(isRateLimitError(revertError), false);
    assert.equal(isRateLimitError(undefined), false);
  });
});

describe("withRateLimitBackoff", () => {
  it("waits out a burst of 429s and returns the answer", async () => {
    const waits: number[] = [];
    const { work, calls } = flaky(2, tooManyRequests);
    assert.equal(await withRateLimitBackoff(work, [10, 20, 30], async (ms) => void waits.push(ms)), "ok");
    assert.equal(calls(), 3);
    assert.deepEqual(waits, [10, 20], "a growing pause before each new round");
  });

  it("gives up once the pauses run out", async () => {
    const { work, calls } = flaky(9, tooManyRequests);
    await assert.rejects(withRateLimitBackoff(work, [1, 1, 1], noSleep), /429/);
    assert.equal(calls(), 4);
  });

  it("does not wait on errors that are not rate limits", async () => {
    const { work, calls } = flaky(9, timeoutError);
    await assert.rejects(withRateLimitBackoff(work, [1, 1, 1], noSleep), /request timeout/);
    assert.equal(calls(), 1);
  });
});
