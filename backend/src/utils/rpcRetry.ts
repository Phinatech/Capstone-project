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
