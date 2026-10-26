import { lgas } from '../data/policies';
import type { WindowOption } from '../contexts/policyContextCore';
import type { Policy } from '../types/insurance';

/** Rainfall a window's periods total, in mm; null until every dekad has a reading. */
export type RainfallOf = (periods: number[]) => number | null;

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

/**
 * Cover written per window, with the rainfall the oracles actually recorded
 * for it. Windows nobody has bought are left out rather than drawn as empty
 * bars, and rainfall stays null until every dekad in the window has a reading.
 */
export function byWindow(policies: Policy[], windows: WindowOption[], rainfallOf: RainfallOf) {
  return windows.
  filter((w) => policies.some((p) => p.windowId === w.id)).
  map((w) => {
    const mine = policies.filter((p) => p.windowId === w.id);
    return {
      id: w.id,
      label: `#${w.id} · ${w.covers}`,
      active: mine.filter((p) => p.status === 'active').reduce((s, p) => s + p.payoutEth, 0),
      paid: mine.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0),
      count: mine.length,
      rainfall: rainfallOf(w.periods)
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

/**
 * Each policy's trigger against the rainfall its window actually recorded,
 * above 1 = the window would pay out. Policies whose window is still missing
 * a reading are left out, since there is no total to compare against yet.
 */
export function triggerMargins(policies: Policy[], windows: WindowOption[], rainfallOf: RainfallOf) {
  const periodsById = new Map(windows.map((w) => [w.id, w.periods]));
  const rows: { id: number;ratio: number;thresholdMm: number;rainfall: number;}[] = [];
  for (const p of policies) {
    const rain = rainfallOf(periodsById.get(p.windowId) ?? []);
    if (rain === null || rain <= 0) continue;
    rows.push({ id: p.id, ratio: p.thresholdMm / rain, thresholdMm: p.thresholdMm, rainfall: rain });
  }
  return rows;
}