import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FALLBACK_ETH_NGN } from '../utils/currency';

/** One quote from GET /api/fx; a leg served from the backend's fallback says so. */
export interface FxQuote {
  ethUsd: number;
  usdNgn: number;
  /** Naira per 1 ETH. */
  ethNgn: number;
  ethUsdSource: 'live' | 'fallback';
  usdNgnSource: 'live' | 'fallback';
  quotedAt: string;
}

export interface FxContextValue {
  rate: FxQuote;
  loading: boolean;
  /** Set when the backend could not be reached; the quote is then the fallback. */
  error: string | null;
  /** True unless both legs were live: the UI labels those quotes approximate. */
  approximate: boolean;
  ethToNgn: (eth: number) => number;
  ngnToEth: (ngn: number) => number;
  refresh: () => void;
}

const fallbackQuote: FxQuote = {
  ethUsd: 2_500,
  usdNgn: FALLBACK_ETH_NGN / 2_500,
  ethNgn: FALLBACK_ETH_NGN,
  ethUsdSource: 'fallback',
  usdNgnSource: 'fallback',
  quotedAt: '1970-01-01T00:00:00.000Z'
};

const FxContext = createContext<FxContextValue | null>(null);

/**
 * Supplies the naira rate the agent flow quotes in. Farmers pay agents in
 * local currency while the contract settles in ETH, so both legs of that
 * trade are shown using one shared rate. Quotes come from the backend cache;
 * if it is unreachable the app still prices a purchase, from a fixed fallback
 * flagged as approximate, rather than blocking onboarding.
 */
export function FxProvider({ children }: {children: React.ReactNode;}) {
  const [rate, setRate] = useState<FxQuote>(fallbackQuote);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    try {
      const res = await fetch(`${apiUrl}/api/fx`, { signal });
      if (!res.ok) throw new Error(`the rate service answered ${res.status}`);
      const body = (await res.json()) as Partial<FxQuote>;
      if (typeof body.ethNgn !== 'number' || !Number.isFinite(body.ethNgn) || body.ethNgn <= 0) {
        throw new Error('the rate service returned an unusable quote');
      }
      setRate({ ...fallbackQuote, ...body } as FxQuote);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setRate(fallbackQuote);
      setError(err instanceof Error ? err.message : 'the exchange rate could not be read');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const value = useMemo<FxContextValue>(() => ({
    rate,
    loading,
    error,
    approximate: rate.ethUsdSource !== 'live' || rate.usdNgnSource !== 'live',
    ethToNgn: (eth: number) => (Number.isFinite(eth) ? eth * rate.ethNgn : Number.NaN),
    ngnToEth: (ngn: number) => (Number.isFinite(ngn) ? ngn / rate.ethNgn : Number.NaN),
    refresh: () => void load()
  }), [rate, loading, error, load]);

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export function useFx(): FxContextValue {
  const ctx = useContext(FxContext);
  if (!ctx) throw new Error('useFx must be used inside FxProvider');
  return ctx;
}
