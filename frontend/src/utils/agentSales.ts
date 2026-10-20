/**
 * Agent sales: types and pure calculations for the naira half of a purchase.
 *
 * Persistence lives in the backend (`/api/agent/sales`) behind
 * `contexts/AgentSalesContext`; only the arithmetic and the shape of a record
 * live here, so they can be tested without a server or a browser.
 */
import type { PaymentMethod } from '../types/agent';
import type { Policy } from '../types/insurance';

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

/** Commission owed to the agent on a premium, in naira at the sale's rate. */
export function commissionNgn(premiumNgn: number): number {
  return premiumNgn * COMMISSION_RATE;
}

/** A reference code the agent can read out to a farmer without a receipt printer. */
export function newPaymentReference(): string {
  const tail = Math.floor(1000 + Math.random() * 9000).toString();
  return `SKT-${tail}`;
}

export interface AgentBookEntry {
  sale: AgentSale;
  /** The live on-chain policy, absent only if it has not indexed yet. */
  policy: Policy | undefined;
}

/** An agent's sales joined with live policy status, newest sale first. */
export function agentBook(sales: AgentSale[], policies: Policy[]): AgentBookEntry[] {
  return [...sales]
    .sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1))
    .map((sale) => ({ sale, policy: policies.find((p) => p.id === sale.policyId) }));
}

export interface AgentSummary {
  policiesSold: number;
  farmersInsured: number;
  premiumEth: number;
  premiumNgn: number;
  commissionNgn: number;
  /** Face value of the cover sold, in naira. */
  coverSoldNgn: number;
  /** Naira actually paid out to farmers on settled policies. */
  paidOutNgn: number;
}

export function summariseBook(book: AgentBookEntry[]): AgentSummary {
  const farmers = new Set<string>();
  const summary = book.reduce<AgentSummary>((acc, { sale, policy }) => ({
    policiesSold: acc.policiesSold + 1,
    farmersInsured: acc.farmersInsured,
    premiumEth: acc.premiumEth + sale.premiumEth,
    premiumNgn: acc.premiumNgn + sale.premiumNgn,
    commissionNgn: acc.commissionNgn + sale.commissionNgn,
    coverSoldNgn: acc.coverSoldNgn + sale.payoutNgn,
    paidOutNgn: acc.paidOutNgn + (policy?.status === 'paid' ? sale.payoutNgn : 0)
  }), { policiesSold: 0, farmersInsured: 0, premiumEth: 0, premiumNgn: 0, commissionNgn: 0, coverSoldNgn: 0, paidOutNgn: 0 });

  for (const { sale } of book) farmers.add(sale.farmerId);
  return { ...summary, farmersInsured: farmers.size };
}
