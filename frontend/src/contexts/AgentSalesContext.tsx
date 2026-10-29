import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import type { AgentSale } from '../utils/agentSales';

// Empty by default so requests go through Vite's proxy and share the UI's
// origin, which is what lets the session cookie travel with them.
const API_URL = import.meta.env.VITE_API_URL ?? '';
const PENDING_KEY = 'sokoto-cover-agent-sales-pending';
const MIRROR_KEY = 'sokoto-cover-agent-sales-mirror';

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
   * Records a sale.
   *
   * `synced:false, retryable:true` means an outage: the sale is queued and
   * pushed again later, because the policy really was bought on-chain and
   * reporting the purchase as failed would be a lie.
   *
   * `synced:false, retryable:false` means the backend checked the receipt
   * against the contract and it does not match — re-posting it unchanged can
   * never succeed, so it is *not* queued and the agent needs to be told.
   */
  record: (sale: AgentSale) => Promise<{ synced: boolean; retryable: boolean; error?: string }>;
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

/**
 * The durable local ledger of every receipt this browser has recorded.
 *
 * The server's ledger lives on an ephemeral disk (Render's free plan) and can
 * lose receipts on restart — which would unlink every policy from its farmer
 * across the admin, agent and farmer portals. This mirror is what puts them
 * back: see `refresh`, which re-posts receipts the server no longer has.
 */
function readMirror(): AgentSale[] {
  try {
    const raw = window.localStorage.getItem(MIRROR_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AgentSale[]) : [];
  } catch {
    return [];
  }
}

function writeMirror(sales: AgentSale[]): void {
  try {
    window.localStorage.setItem(MIRROR_KEY, JSON.stringify(sales));
  } catch {

    /* storage unavailable */}
}

function remember(sale: AgentSale): void {
  writeMirror([...readMirror().filter((s) => s.policyId !== sale.policyId), sale]);
}

function forget(policyId: number): void {
  writeMirror(readMirror().filter((s) => s.policyId !== policyId));
}

/**
 * Reads the signed-in agent's book.
 *
 * No `agentId` is sent: the session cookie is the identity, and the server
 * answers only for the account it belongs to. Before F-1 the agent id came
 * from a query parameter, so reading anyone else's book was a matter of
 * editing a string in the URL.
 */
async function fetchSales(): Promise<AgentSale[]> {
  const res = await fetch(`${API_URL}/api/agent/sales`, { credentials: 'include' });
  if (!res.ok) throw new Error(`the sales ledger answered ${res.status}`);
  const body = (await res.json()) as { sales?: unknown };
  return Array.isArray(body.sales) ? (body.sales as AgentSale[]) : [];
}

/**
 * Statuses where re-posting the same receipt can never succeed: the record is
 * well-formed (400) or the backend checked it against the contract and it is
 * not true of the chain (422). Everything else — a network failure (0), an
 * outage (5xx), a rate limit (429) — can work on a later attempt.
 */
const PERMANENT_STATUSES = new Set([400, 422]);

class SaleError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof SaleError) return !PERMANENT_STATUSES.has(err.status);
  // Not a SaleError: the request never reached the server, so nothing was
  // evaluated and trying again is the only sensible option.
  return true;
}

/**
 * Posts one receipt. The `agentId` it sends is advisory — the server
 * overwrites it with the session's account before validating and storing, so
 * filing a sale under another agent's name is not possible from here.
 */
async function postSale(sale: AgentSale): Promise<void> {
  const res = await fetch(`${API_URL}/api/agent/sales`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale)
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new SaleError(body.error ?? `the sales ledger answered ${res.status}`, res.status);
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

  /** Pushes queued sales; returns the ones worth trying again later. */
  const flush = useCallback(async (queued: AgentSale[]): Promise<AgentSale[]> => {
    const failed: AgentSale[] = [];
    for (const sale of queued) {
      try {
        await postSale(sale);
      } catch (err) {
        // A receipt the backend has judged false against the contract will be
        // judged false forever. Dropping it keeps the banner honest — it would
        // otherwise read "2 receipts not yet recorded" for a record that can
        // never be recorded.
        if (isRetryable(err)) failed.push(sale);
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
      const sales = await fetchSales();
      // Heal the server's ledger from this browser's mirror: a receipt the
      // server no longer has (its disk is ephemeral) is posted again and
      // re-verified against the contract. Only what is missing is posted, so
      // no duplicates can be created.
      const stillWaiting = new Set(failed.map((s) => s.policyId));
      const missing = readMirror().filter(
        (s) => s.agentId === agentId && !stillWaiting.has(s.policyId) && !sales.some((x) => x.policyId === s.policyId)
      );
      let healed = sales;
      for (const sale of missing) {
        try {
          await postSale(sale);
          healed = [...healed.filter((x) => x.policyId !== sale.policyId), sale];
        } catch (err) {
          // A receipt the server judges false against the chain is dropped,
          // mirroring the pending queue's rule; anything else is retried on
          // the next load.
          if (!isRetryable(err)) forget(sale.policyId);
        }
      }
      if (!mounted.current) return;
      setSaved(healed);
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

  const record = useCallback(
    async (sale: AgentSale): Promise<{ synced: boolean; retryable: boolean; error?: string }> => {
      try {
        await postSale(sale);
        remember(sale);
        if (!mounted.current) return { synced: true, retryable: true };
        setSaved((prev) => [...prev.filter((s) => s.policyId !== sale.policyId), sale]);
        setPending((prev) => {
          const next = prev.filter((s) => s.policyId !== sale.policyId);
          writePending(next);
          return next;
        });
        return { synced: true, retryable: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The receipt could not be saved.';
        if (!isRetryable(err)) {
          // Queuing this would just fail the same way on every load. The policy
          // exists on-chain either way, so surface it instead of hiding it.
          return { synced: false, retryable: false, error: message };
        }
        const queued = [...readPending().filter((s) => s.policyId !== sale.policyId), sale];
        writePending(queued);
        remember(sale);
        if (mounted.current) setPending(queued);
        return { synced: false, retryable: true, error: message };
      }
    },
    []
  );

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
