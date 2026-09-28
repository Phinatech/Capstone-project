import { coverageWindows, lgas } from '../data/policies';
import { getWindow, windowTotal } from './oracle';
import type { Policy } from '../types/insurance';

export interface PortfolioStats {
  premiums: number;
  payouts: number;
  exposure: number;
  lossRatio: number;
  policies: number;
  active: number;
  settled: number;
  paidCount: number;
  farmersCovered: number;
  avgPremium: number;
}

export function portfolioStats(policies: Policy[]): PortfolioStats {
  const premiums = policies.reduce((s, p) => s + p.premiumEth, 0);
  const paid = policies.filter((p) => p.status === 'paid');
  const payouts = paid.reduce((s, p) => s + p.payoutEth, 0);
  const active = policies.filter((p) => p.status === 'active');
  return {
    premiums,
    payouts,
    exposure: active.reduce((s, p) => s + p.payoutEth, 0),
    lossRatio: premiums > 0 ? payouts / premiums : 0,
    policies: policies.length,
    active: active.length,
    settled: policies.length - active.length,
    paidCount: paid.length,
    farmersCovered: new Set(policies.map((p) => p.farmerId)).size,
    avgPremium: policies.length ? premiums / policies.length : 0
  };
}

export function byWindow(policies: Policy[]) {
  return coverageWindows.map((w) => {
    const mine = policies.filter((p) => p.windowId === w.id);
    return {
      id: w.id,
      label: w.label,
      active: mine.filter((p) => p.status === 'active').reduce((s, p) => s + p.payoutEth, 0),
      paid: mine.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0),
      count: mine.length,
      rainfall: windowTotal('reference', w.start, w.end)
    };
  });
}

export function byLga(policies: Policy[]) {
  return lgas.
  map((lga) => {
    const mine = policies.filter((p) => p.lga === lga);
    return {
      lga,
      count: mine.length,
      premiums: mine.reduce((s, p) => s + p.premiumEth, 0),
      cover: mine.reduce((s, p) => s + p.payoutEth, 0)
    };
  }).
  filter((r) => r.count > 0).
  sort((a, b) => b.cover - a.cover);
}

export function byStatus(policies: Policy[]) {
  return [
  { key: 'active', label: 'Active', value: policies.filter((p) => p.status === 'active').length, color: 'var(--accent)' },
  { key: 'paid', label: 'Paid out', value: policies.filter((p) => p.status === 'paid').length, color: 'var(--clay)' },
  { key: 'no_payout', label: 'No payout', value: policies.filter((p) => p.status === 'no_payout').length, color: 'var(--muted)' }];

}

export function byCrop(policies: Policy[]) {
  const crops = Array.from(new Set(policies.map((p) => p.crop)));
  return crops.map((crop) => ({ crop, count: policies.filter((p) => p.crop === crop).length }));
}

/** How close each trigger sits to the 2023 gauge total for its window (below 1 = would pay). */
export function triggerMargins(policies: Policy[]) {
  return policies.map((p) => {
    const w = getWindow(p.windowId);
    const rain = windowTotal('reference', w.start, w.end);
    return { id: p.id, ratio: rain > 0 ? p.thresholdMm / rain : 0, thresholdMm: p.thresholdMm, rainfall: rain };
  });
}