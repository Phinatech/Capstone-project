/**
 * Persistent store for agent sales.
 *
 * The chain records the policy and the ETH premium but knows nothing about
 * the naira the farmer hands the agent in the field. That half of the trade
 * lives here: one JSON file behind an API, readable from any device the agent
 * signs in from, instead of a single browser's localStorage.
 *
 * Writes are serialised and atomic (temp file, then rename) so two purchases
 * landing together cannot truncate the ledger, and commission is computed
 * here rather than trusted from the client.
 */
import { filePersistence, type StorePersistence } from "./persistence.js";

export type PaymentMethod = "cash" | "bank_transfer" | "mobile_money";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "bank_transfer", "mobile_money"];

/** Share of the premium the agent keeps. The server applies it; clients can't set it. */
export const COMMISSION_RATE = 0.1;

export interface AgentSale {
  policyId: number;
  agentId: string;
  farmerId: string;
  farmerName: string;
  lga: string;
  crop: string;
  windowId: string;
  thresholdMm: number;
  premiumEth: number;
  payoutEth: number;
  /** Both naira figures are frozen at the rate live when the sale happened. */
  premiumNgn: number;
  payoutNgn: number;
  commissionNgn: number;
  ethNgnRate: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  soldAt: string;
}

export type SaleResult = { ok: true; sale: AgentSale } | { ok: false; error: string };

const MAX_TEXT = 80;

function text(value: unknown, field: string, max = MAX_TEXT): string {
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > max) throw new Error(`${field} must be at most ${max} characters`);
  return trimmed;
}

function number(value: unknown, field: string, { min = 0, max = 1e12, integer = false }: {
  min?: number;
  max?: number;
  integer?: boolean;
} = {}): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  if (integer && !Number.isSafeInteger(n)) throw new Error(`${field} must be a whole number`);
  if (n < min) throw new Error(`${field} must be at least ${min}`);
  if (n > max) throw new Error(`${field} must be at most ${max}`);
  return n;
}

/**
 * Validate a sale the client posted, filling in the commission from the
 * server's own rate. Returns `{ok:false, error}` rather than throwing so the
 * route can answer 400 with the reason.
 */
export function parseSale(input: unknown): SaleResult {
  try {
    const body = (input ?? {}) as Record<string, unknown>;
    const paymentMethod = typeof body.paymentMethod === "string" && PAYMENT_METHODS.includes(body.paymentMethod as PaymentMethod)
      ? (body.paymentMethod as PaymentMethod)
      : (() => {
          throw new Error(`paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}`);
        })();

    const soldAt = text(body.soldAt, "soldAt");
    if (Number.isNaN(Date.parse(soldAt))) throw new Error("soldAt must be a date");

    const paymentReference = text(body.paymentReference, "paymentReference", 24);
    if (!/^[\p{L}\p{N}-]+$/u.test(paymentReference)) {
      throw new Error("paymentReference may only contain letters, numbers and dashes");
    }

    const premiumNgn = number(body.premiumNgn, "premiumNgn");
    const premiumEth = number(body.premiumEth, "premiumEth");
    const payoutNgn = number(body.payoutNgn, "payoutNgn");
    const payoutEth = number(body.payoutEth, "payoutEth");
    if (payoutEth < premiumEth) throw new Error("payoutEth cannot be smaller than the premium");

    const thresholdMm = number(body.thresholdMm, "thresholdMm", { min: 0.01, max: 100_000 });
    const ethNgnRate = number(body.ethNgnRate, "ethNgnRate", { min: 1 });

    return {
      ok: true,
      sale: {
        policyId: number(body.policyId, "policyId", { min: 0, integer: true }),
        agentId: text(body.agentId, "agentId", 64),
        farmerId: text(body.farmerId, "farmerId", 64),
        farmerName: text(body.farmerName, "farmerName"),
        lga: text(body.lga, "lga", 60),
        crop: text(body.crop, "crop", 60),
        windowId: text(body.windowId, "windowId", 32),
        thresholdMm,
        premiumEth,
        payoutEth,
        premiumNgn,
        payoutNgn,
        // Derived here: a client cannot report itself a larger commission.
        commissionNgn: premiumNgn * COMMISSION_RATE,
        ethNgnRate,
        paymentMethod,
        paymentReference,
        soldAt: new Date(soldAt).toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid sale" };
  }
}

export interface AgentStore {
  list: (agentId?: string) => Promise<AgentSale[]>;
  findByPolicy: (policyId: number) => Promise<AgentSale | undefined>;
  upsert: (sale: AgentSale) => Promise<AgentSale>;
}

/**
 * A ledger backed by one JSON file. The path is a parameter so tests can point
 * at a temporary file without fighting the env-configured default.
 */
export function createAgentStore(target: string | StorePersistence): AgentStore {
  const storage = typeof target === "string" ? filePersistence(target) : target;
  const where = typeof target === "string" ? target : "the sales ledger";
  let cached: AgentSale[] | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();

  async function load(): Promise<AgentSale[]> {
    if (cached) return cached;
    try {
      const parsed: unknown = await storage.read();
      if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
      cached = parsed as AgentSale[];
      return cached;
    } catch (err) {
      // A missing file is an empty ledger; a corrupt one is data loss, so it
      // surfaces loudly instead of silently starting over.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        cached = [];
        return cached;
      }
      throw new Error(`${where} could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function write(sales: AgentSale[]): Promise<void> {
    await storage.write(sales);
    cached = sales;
  }

  /** Runs `task` after every write already queued, so file writes never overlap. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    async list(agentId?: string): Promise<AgentSale[]> {
      const sales = await load();
      const filtered = agentId ? sales.filter((s) => s.agentId === agentId) : sales;
      return filtered.sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1));
    },

    async findByPolicy(policyId: number): Promise<AgentSale | undefined> {
      return (await load()).find((s) => s.policyId === policyId);
    },

    upsert(sale: AgentSale): Promise<AgentSale> {
      return enqueue(async () => {
        const sales = await load();
        const next = sales.filter((s) => s.policyId !== sale.policyId);
        next.push(sale);
        next.sort((a, b) => (a.soldAt < b.soldAt ? -1 : 1));
        await write(next);
        return sale;
      });
    },
  };
}
