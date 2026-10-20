import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agentBook,
  commissionNgn,
  getAgentSales,
  getSaleForPolicy,
  newPaymentReference,
  recordSale,
  summariseBook
} from './agentSales';
import type { AgentSale } from './agentSales';
import type { Policy } from '../types/insurance';

// The ledger persists to localStorage, which the node test environment lacks.
const backing = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value)
  }
});

function sale(overrides: Partial<AgentSale> = {}): AgentSale {
  return {
    policyId: 1,
    agentId: 'agent-1',
    farmerId: 'farmer-1',
    farmerName: 'Amina Bello',
    lga: 'Wamakko',
    crop: 'Millet',
    windowId: 'julaug',
    thresholdMm: 85,
    premiumEth: 0.01,
    payoutEth: 0.1,
    premiumNgn: 32_612,
    payoutNgn: 326_122,
    commissionNgn: 3_261,
    ethNgnRate: 3_261_222,
    paymentMethod: 'cash',
    paymentReference: 'SKT-1234',
    soldAt: '2026-10-20T10:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => backing.clear());

describe('agent sales ledger', () => {
  it('takes ten percent of the premium as commission', () => {
    expect(commissionNgn(32_612)).toBeCloseTo(3_261.2);
    expect(commissionNgn(0)).toBe(0);
  });

  it('reads a sale back by policy id, and hides it from other agents', () => {
    recordSale(sale());
    expect(getSaleForPolicy(1)?.farmerName).toBe('Amina Bello');
    expect(getAgentSales('agent-1')).toHaveLength(1);
    expect(getAgentSales('agent-2')).toHaveLength(0);
  });

  it('replaces a sale rather than duplicating it when the same policy is re-recorded', () => {
    recordSale(sale());
    recordSale(sale({ premiumNgn: 40_000 }));
    expect(getAgentSales('agent-1')).toHaveLength(1);
    expect(getSaleForPolicy(1)?.premiumNgn).toBe(40_000);
  });

  it('lists the newest sale first', () => {
    recordSale(sale({ policyId: 1, soldAt: '2026-10-01T10:00:00.000Z' }));
    recordSale(sale({ policyId: 2, soldAt: '2026-10-20T10:00:00.000Z' }));
    expect(getAgentSales('agent-1').map((s) => s.policyId)).toEqual([2, 1]);
  });

  it('hands out readable, unique payment references', () => {
    const refs = new Set(Array.from({ length: 200 }, () => newPaymentReference()));
    expect([...refs].every((r) => /^SKT-\d{4}$/.test(r))).toBe(true);
    expect(refs.size).toBeGreaterThan(1);
  });
});

describe('summariseBook', () => {
  const policyOf = (status: Policy['status']) => ({ status }) as Policy;

  it('counts a farmer once however many policies they bought', () => {
    recordSale(sale({ policyId: 1, farmerId: 'farmer-1', premiumNgn: 10_000, payoutNgn: 100_000 }));
    recordSale(sale({ policyId: 2, farmerId: 'farmer-2', premiumNgn: 10_000, payoutNgn: 100_000 }));
    recordSale(sale({ policyId: 3, farmerId: 'farmer-1', premiumNgn: 10_000, payoutNgn: 100_000 }));

    const summary = summariseBook(agentBook([], 'agent-1'));
    expect(summary.policiesSold).toBe(3);
    expect(summary.farmersInsured).toBe(2);
    expect(summary.premiumNgn).toBe(30_000);
    expect(summary.coverSoldNgn).toBe(300_000);
  });

  it('only counts naira paid out once a policy has actually been paid', () => {
    const book = [
      { sale: sale({ policyId: 1, payoutNgn: 100 }), policy: policyOf('paid') },
      { sale: sale({ policyId: 2, payoutNgn: 50 }), policy: policyOf('active') },
      { sale: sale({ policyId: 3, payoutNgn: 25 }), policy: policyOf('no_payout') }
    ];
    expect(summariseBook(book).paidOutNgn).toBe(100);
  });

  it('matches a policy to its ledger entry through agentBook', () => {
    recordSale(sale({ policyId: 7, farmerId: 'farmer-4' }));
    const policies = [{ id: 7, status: 'paid' }] as unknown as Policy[];
    const book = agentBook(policies, 'agent-1');
    expect(book).toHaveLength(1);
    expect(book[0].policy?.status).toBe('paid');
    expect(summariseBook(book).paidOutNgn).toBe(book[0].sale.payoutNgn);
  });

  it('reports zeroes rather than NaN for an empty book', () => {
    const summary = summariseBook([]);
    expect(summary.policiesSold).toBe(0);
    expect(summary.farmersInsured).toBe(0);
    expect(summary.premiumNgn).toBe(0);
    expect(summary.paidOutNgn).toBe(0);
  });
});
