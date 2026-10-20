import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { AgentSale } from '../utils/agentSales';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const PENDING_KEY = 'sokoto-cover-agent-sales-pending';

export interface AgentSalesContextValue {
  /** The signed-in agent's book: saved sales plus any still waiting to sync. */
  sales: AgentSale[];
  /** How many sales exist only on this device; nonzero means not fully recorded. */
  unsynced: number;
  loading: boolean;
  /** Set when the sales ledger could not be reached at all. */
  error: string | null;
  salesFor: (policyId: number) => AgentSale | undefined;
  /**
   * Records a sale. Resolves `{synced:false}` instead of throwing when the API
   * is down: the policy has already been bought on-chain, so reporting the
   * purchase as failed would be a lie. The sale queues for a later retry.
   */
  record: (sale: AgentSale) => Promise<{ synced: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const AgentSalesContext = createContext<AgentSalesContextValue | null>(null);

function readPending(): AgentSale[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AgentSale[]) : [];
  } catch {
    return [];
  }
}

function writePending(sales: AgentSale[]): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(sales));
  } catch {

    /* storage unavailable */}
}

async function fetchSales(agentId: string): Promise<AgentSale[]> {
  const res = await fetch(`${API_URL}/api/agent/sales?agentId=${encodeURIComponent(agentId)}`);
  if (!res.ok) throw new Error(`the sales ledger answered ${res.status}`);
  const body = (await res.json()) as { sales?: unknown };
  return Array.isArray(body.sales) ? (body.sales as AgentSale[]) : [];
}

async function postSale(sale: AgentSale): Promise<void> {
  const res = await fetch(`${API_URL}/api/agent/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale)
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `the sales ledger answered ${res.status}`);
  }
}

/**
 * Reads and writes agent sales through the backend, so one agent's book looks
 * the same from any device. Sales the API refuses are held in a small local
 * retry queue and pushed again on the next load, which is why a failed save
 * shows up as pending rather than disappearing.
 *
 * Order matters on refresh: queued sales are pushed first, then the server's
 * view is pulled, so a sale that just synced is not missed by the read.
 */
export function AgentSalesProvider({ children }: {children: React.ReactNode;}) {
  const { user } = useAuth();
  const agentId = user?.role === 'agent' ? user.id : undefined;
  const [saved, setSaved] = useState<AgentSale[]>([]);
  const [pending, setPending] = useState<AgentSale[]>(readPending);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  /** Pushes queued sales; returns the ones the API still would not take. */
  const flush = useCallback(async (queued: AgentSale[]): Promise<AgentSale[]> => {
    const failed: AgentSale[] = [];
    for (const sale of queued) {
      try {
        await postSale(sale);
      } catch {
        failed.push(sale);
      }
    }
    writePending(failed);
    return failed;
  }, []);

  const refresh = useCallback(async () => {
    if (!agentId) return;
    const queued = readPending().filter((s) => s.agentId === agentId);
    const failed = await flush(queued);

    try {
      const sales = await fetchSales(agentId);
      if (!mounted.current) return;
      setSaved(sales);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'The sales ledger could not be read.');
    } finally {
      if (mounted.current) {
        setPending(failed);
        setLoading(false);
      }
    }
  }, [agentId, flush]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!agentId) {
      setSaved([]);
      setPending(readPending());
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [agentId, refresh]);

  const record = useCallback(async (sale: AgentSale): Promise<{ synced: boolean; error?: string }> => {
    try {
      await postSale(sale);
      if (!mounted.current) return { synced: true };
      setSaved((prev) => [...prev.filter((s) => s.policyId !== sale.policyId), sale]);
      setPending((prev) => {
        const next = prev.filter((s) => s.policyId !== sale.policyId);
        writePending(next);
        return next;
      });
      return { synced: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The receipt could not be saved.';
      const queued = [...readPending().filter((s) => s.policyId !== sale.policyId), sale];
      writePending(queued);
      if (mounted.current) setPending(queued);
      return { synced: false, error: message };
    }
  }, []);

  const value = useMemo<AgentSalesContextValue>(() => {
    const sales = [...saved, ...pending];
    return {
      sales,
      unsynced: pending.length,
      loading,
      error,
      salesFor: (policyId) => sales.find((s) => s.policyId === policyId),
      record,
      refresh
    };
  }, [saved, pending, loading, error, record, refresh]);

  return <AgentSalesContext.Provider value={value}>{children}</AgentSalesContext.Provider>;
}

export function useAgentSales(): AgentSalesContextValue {
  const ctx = useContext(AgentSalesContext);
  if (!ctx) throw new Error('useAgentSales must be used inside AgentSalesProvider');
  return ctx;
}
