import { describe, expect, it } from 'vitest';
import {
  agentBook,
  commissionNgn,
  COMMISSION_RATE,
  newPaymentReference,
  summariseBook
} from './agentSales';
import type { AgentSale } from './agentSales';
import type { Policy } from '../types/insurance';

function sale(overrides: Partial<AgentSale> = {}): AgentSale {
  return {
    policyId: 1,
    agentId: 'agent-1',
    farmerId: 'farmer-1',
    farmerName: 'Amina Bello',
    lga: 'Wamakko',
    crop: 'Millet',
    windowId: 'julaug',
    thresholdMm: 300,
    premiumEth: 0.01,
    payoutEth: 0.1,
    premiumNgn: 32_612,
    payoutNgn: 326_122,
    commissionNgn: 3_261,
    ethNgnRate: 3_261_222,
    paymentMethod: 'cash',
    paymentReference: 'SKT-4821',
    soldAt: '2026-10-20T10:00:00.000Z',
    ...overrides
  };
}

const policyOf = (id: number, status: Policy['status']) => ({ id, status }) as Policy;

describe('commission', () => {
  it('takes ten percent of the premium', () => {
    expect(commissionNgn(32_612)).toBeCloseTo(3_261.2);
    expect(commissionNgn(0)).toBe(0);
  });

  // The backend recomputes commission from its own rate rather than trusting
  // the client, so a drift between the two would misreport every receipt.
  it('uses the same rate the backend applies', () => {
    expect(COMMISSION_RATE).toBe(0.1);
  });
});

describe('newPaymentReference', () => {
  it('produces codes an agent can read out loud', () => {
    const refs = Array.from({ length: 300 }, () => newPaymentReference());
    expect(refs.every((r) => /^SKT-\d{4}$/.test(r))).toBe(true);
    expect(new Set(refs).size).toBeGreaterThan(1);
  });
});

describe('agentBook', () => {
  it('joins each sale to its live policy status', () => {
    const book = agentBook(
      [sale({ policyId: 7 }), sale({ policyId: 9 })],
      [policyOf(7, 'paid')]
    );
    expect(book).toHaveLength(2);
    expect(book.find((e) => e.sale.policyId === 7)?.policy?.status).toBe('paid');
    expect(book.find((e) => e.sale.policyId === 9)?.policy).toBeUndefined();
  });

  it('orders the newest sale first regardless of input order', () => {
    const book = agentBook([
      sale({ policyId: 1, soldAt: '2026-10-01T10:00:00.000Z' }),
      sale({ policyId: 3, soldAt: '2026-10-25T10:00:00.000Z' }),
      sale({ policyId: 2, soldAt: '2026-10-10T10:00:00.000Z' })
    ], []);
    expect(book.map((e) => e.sale.policyId)).toEqual([3, 2, 1]);
  });

  it('does not mutate the sales it was handed', () => {
    const sales = [sale({ policyId: 1, soldAt: '2026-10-01T10:00:00.000Z' }),
      sale({ policyId: 2, soldAt: '2026-10-20T10:00:00.000Z' })];
    agentBook(sales, []);
    expect(sales.map((s) => s.policyId)).toEqual([1, 2]);
  });
});

describe('summariseBook', () => {
  it('counts a farmer once however many policies they bought', () => {
    // commissionNgn is stored per sale (the backend computes it), so the
    // overrides keep it consistent with their premium.
    const book = agentBook([
      sale({ policyId: 1, farmerId: 'farmer-1', premiumNgn: 10_000, commissionNgn: 1_000, payoutNgn: 100_000 }),
      sale({ policyId: 2, farmerId: 'farmer-2', premiumNgn: 10_000, commissionNgn: 1_000, payoutNgn: 100_000 }),
      sale({ policyId: 3, farmerId: 'farmer-1', premiumNgn: 10_000, commissionNgn: 1_000, payoutNgn: 100_000 })
    ], []);

    const summary = summariseBook(book);
    expect(summary.policiesSold).toBe(3);
    expect(summary.farmersInsured).toBe(2);
    expect(summary.premiumNgn).toBe(30_000);
    expect(summary.coverSoldNgn).toBe(300_000);
    expect(summary.commissionNgn).toBeCloseTo(3_000);
  });

  it('only counts naira paid out once a policy has actually been paid', () => {
    const book = agentBook([
      sale({ policyId: 1, payoutNgn: 100 }),
      sale({ policyId: 2, payoutNgn: 50 }),
      sale({ policyId: 3, payoutNgn: 25 })
    ], [policyOf(1, 'paid'), policyOf(2, 'active'), policyOf(3, 'no_payout')]);

    expect(summariseBook(book).paidOutNgn).toBe(100);
  });

  it('reports zeroes rather than NaN for an empty book', () => {
    const summary = summariseBook([]);
    expect(summary.policiesSold).toBe(0);
    expect(summary.farmersInsured).toBe(0);
    expect(summary.premiumEth).toBe(0);
    expect(summary.premiumNgn).toBe(0);
    expect(summary.coverSoldNgn).toBe(0);
    expect(summary.paidOutNgn).toBe(0);
  });
});
