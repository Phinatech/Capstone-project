/**
 * Retries for calls that failed because the RPC node was briefly unreachable.
 *
 * Public Sepolia endpoints drop connections now and then; without a retry a
 * single `request timeout` loses a whole relayer tick, and a lost settle means
 * a policy stays unpaid for another hour. A genuine contract revert is not
 * retried: it carries a `reason` and will fail identically every time.
 */

/** Substrings that mark an error as "the node had a wobble". */
const TRANSIENT = [
  "timeout",
  "timed out",
  "failed to detect network",
  "econnreset",
  "econnrefused",
  "etimedout",
  "eai_again",
  "network error",
  "socket hang up",
  "bad response",
  "service unavailable",
  "502",
  "503",
];

// Deliberately absent: HTTP 429. ethers escalates those on its own schedule,
// and wrapping them here multiplies each logical call into a dozen requests,
// which is exactly how the endpoint got rate limited in the first place.

export function isTransientRpcError(error: unknown): boolean {
  const err = error as { reason?: string; message?: string; code?: string };
  // ethers puts the Solidity revert string in `reason`; that is deterministic.
  if (err.reason) return false;
  const text = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  return TRANSIENT.some((needle) => text.includes(needle));
}

/** A node saying "slow down" inside a normal JSON reply instead of with an HTTP 429. */
export function isRateLimitMessage(message: unknown): boolean {
  return typeof message === "string" && /too many requests|rate.?limit|capacity exceeded|quota/i.test(message);
}

/**
 * The JSON-RPC replies in a node's response body, one per request sent. Throws
 * when the node did not really answer, so the caller can try another node:
 * a body that is not a reply to these requests (0xrpc.io/1rpc.io sometimes
 * pass through an upstream's `{"error":"Method \"eth_call\" is not available
 * for unregistered accounts"}` with HTTP 200), or a reply saying "slow down".
 */
export function readJsonRpcReplies<T extends { id: unknown }>(
  requests: ReadonlyArray<{ id: unknown }>,
  body: unknown,
): T[] {
  const replies = (Array.isArray(body) ? body : [body]) as Array<Record<string, unknown> | null>;
  const ids = new Set(requests.map((r) => r.id));
  for (const reply of replies) {
    if (!reply || typeof reply !== "object" || !ids.has(reply.id) || !("result" in reply || "error" in reply)) {
      throw new Error(`RPC node sent something other than a JSON-RPC reply: ${JSON.stringify(reply)?.slice(0, 200)}`);
    }
    const message = (reply.error as { message?: unknown } | undefined)?.message;
    if (isRateLimitMessage(message)) throw new Error(`RPC node is rate limiting: ${String(message)}`);
  }
  return replies as unknown as T[];
}

/** An HTTP 429, or a node's "slow down" in its JSON reply, as thrown by a failed call. */
export function isRateLimitError(error: unknown): boolean {
  const err = error as { message?: unknown; shortMessage?: unknown };
  const text = `${String(err?.shortMessage ?? "")} ${String(err?.message ?? "")}`;
  return /\b429\b/.test(text) || isRateLimitMessage(text);
}

/**
 * Pauses and runs `work` again while it fails because every node is rate
 * limiting. Only the gateways that keep full event history (Tenderly's two
 * public ones) answer the log scans, so when a cold start's burst gets a 429
 * from both, waiting a few seconds is the only way forward; failing at once
 * turned the first page load after every Render wake-up into an error.
 * The waits are few and growing, so a real outage still fails within ~10 s.
 */
export async function withRateLimitBackoff<T>(
  work: () => Promise<T>,
  delaysMs: readonly number[] = [1_000, 3_000, 6_000],
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= delaysMs.length || !isRateLimitError(error)) throw error;
      await sleep(delaysMs[attempt]!);
    }
  }
}

/**
 * Returns a function that runs a call against each node in turn until one
 * answers, starting from the last one that did. Free public nodes rate-limit
 * or stall without warning; one of them must not be able to take the site down.
 */
export function createFailover(nodes: readonly string[]) {
  let preferred = 0;
  return async <T>(call: (node: string) => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let tried = 0; tried < nodes.length; tried++) {
      const index = (preferred + tried) % nodes.length;
      try {
        const result = await call(nodes[index]!);
        preferred = index;
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };
}

/**
 * Runs `work`, re-running it up to `attempts` times while the failures look
 * like a flaky node. Backoff doubles each time so the node gets room to recover.
 */
export async function withRpcRetry<T>(
  work: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientRpcError(error)) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
