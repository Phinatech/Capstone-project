/**
 * Naira exchange rates for agent-assisted onboarding.
 *
 * Agents collect premiums from farmers in naira and pay the insurance
 * contract in ETH, so every quote the UI shows needs a rate. Two free
 * keyless providers supply the two legs:
 *
 *   - ETH/USD  CoinGecko
 *   - USD/NGN  er-api.com
 *
 * A leg that cannot be fetched falls back to a configured value rather than
 * failing the quote, and the response records which legs were live so the UI
 * can tell the agent the quote is approximate.
 */
import { config } from "../config.js";

export type RateSource = "live" | "fallback";

export interface FxRate {
  /** US dollars per 1 ETH. */
  ethUsd: number;
  /** Naira per 1 US dollar. */
  usdNgn: number;
  /** Naira per 1 ETH (`ethUsd * usdNgn`). */
  ethNgn: number;
  ethUsdSource: RateSource;
  usdNgnSource: RateSource;
  /** ISO time the live legs were published, or the time they were composed. */
  quotedAt: string;
}

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_last_updated_at=true";
const ER_API_URL = "https://open.er-api.com/v6/latest/USD";

/** Bounds that a provider answer has to fall inside to be believed. */
const ETH_USD_BOUNDS = { min: 10, max: 1_000_000 };
const USD_NGN_BOUNDS = { min: 1, max: 100_000 };

/**
 * Combine two legs into a quote, rejecting values outside the sanity bounds.
 * Exported so the arithmetic and the validation are testable without a network.
 */
export function composeFx(
  ethUsd: unknown,
  usdNgn: unknown,
  sources: { ethUsdSource: RateSource; usdNgnSource: RateSource; quotedAt?: string }
): FxRate {
  const usd = plausible(ethUsd, ETH_USD_BOUNDS) ? Number(ethUsd) : config.fxEthUsdFallback;
  const ngn = plausible(usdNgn, USD_NGN_BOUNDS) ? Number(usdNgn) : config.fxUsdNgnFallback;

  return {
    ethUsd: usd,
    usdNgn: ngn,
    ethNgn: usd * ngn,
    ethUsdSource: plausible(ethUsd, ETH_USD_BOUNDS) ? sources.ethUsdSource : "fallback",
    usdNgnSource: plausible(usdNgn, USD_NGN_BOUNDS) ? sources.usdNgnSource : "fallback",
    quotedAt: sources.quotedAt ?? new Date().toISOString(),
  };
}

function plausible(value: unknown, bounds: { min: number; max: number }): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= bounds.min && n <= bounds.max;
}

async function getJson(url: string, timeoutMs: number): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`provider responded ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/**
 * Quote both legs, in parallel, falling back per leg so a single slow
 * provider cannot stall or break the naira side of a purchase.
 */
export async function readFxRate(): Promise<FxRate> {
  const timeout = config.fxTimeoutMs;
  const [ethUsd, usdNgn] = await Promise.all([
    getJson(COINGECKO_URL, timeout)
      .then((body) => {
        const ethereum = (body.ethereum ?? {}) as Record<string, unknown>;
        return { value: ethereum.usd, source: "live" as RateSource };
      })
      .catch(() => ({ value: config.fxEthUsdFallback, source: "fallback" as RateSource })),
    getJson(ER_API_URL, timeout)
      .then((body) => {
        const rates = (body.rates ?? {}) as Record<string, unknown>;
        return { value: rates.NGN, source: "live" as RateSource };
      })
      .catch(() => ({ value: config.fxUsdNgnFallback, source: "fallback" as RateSource })),
  ]);

  return composeFx(ethUsd.value, usdNgn.value, {
    ethUsdSource: ethUsd.source,
    usdNgnSource: usdNgn.source,
  });
}
