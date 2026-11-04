import { describe, expect, it } from 'vitest';
import { coverLevel, percentile, windowHistory, COVER_RETURN_YEARS } from './coverLevels';
import { payoutForHectares } from '../data/policies';

const JULY_2027 = [2027071, 2027072, 2027073];
const WINDOWS = [
  [2027061, 2027062, 2027063],
  JULY_2027,
  [2027061, 2027062, 2027063, 2027071, 2027072, 2027073],
  [2027071, 2027072, 2027073, 2027081, 2027082, 2027083],
  [2027081, 2027082, 2027083, 2027091, 2027092, 2027093],
  [2026092, 2026093, 2026101]
];

describe('percentile', () => {
  it('interpolates between the two nearest values', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(percentile([50, 10, 40, 20, 30], 0.1)).toBeCloseTo(14);
    expect(percentile([7], 0.1)).toBe(7);
  });
});

describe('cover levels from the Sokoto record', () => {
  it('reads every year since 1981 for a window', () => {
    const totals = windowHistory(JULY_2027)!;
    expect(totals).toHaveLength(44);
    expect(totals.every((t) => t >= 0)).toBe(true);
  });

  it('sets each window to pay in about 1 year in 10, never more often', () => {
    for (const periods of WINDOWS) {
      const level = coverLevel(periods)!;
      expect(level.years).toBe(44);
      expect(level.firstYear).toBe(1981);
      expect(level.thresholdMm).toBeLessThan(level.typicalMm);
      // 44 years at 1 in 10: four or five dry years.
      expect(level.paidYears.length).toBeGreaterThanOrEqual(Math.floor(44 / COVER_RETURN_YEARS));
      expect(level.paidYears.length).toBeLessThanOrEqual(Math.ceil(44 / COVER_RETURN_YEARS));
    }
  });

  it('lists exactly the years that fell below the level', () => {
    const level = coverLevel(JULY_2027)!;
    const totals = windowHistory(JULY_2027)!;
    const below = totals.flatMap((t, i) => (t < level.thresholdMm ? [1981 + i] : []));
    expect(level.paidYears).toEqual(below);
  });

  it('is the same level whichever year the window is sold for', () => {
    expect(coverLevel([2026071, 2026072, 2026073])).toEqual(coverLevel(JULY_2027));
  });

  it('has no level for a window it has no record for', () => {
    expect(coverLevel([])).toBeNull();
    expect(coverLevel([2027074])).toBeNull();
  });
});

describe('cover by farm size', () => {
  it('pays 0.01 ETH per hectare, without float noise', () => {
    expect(payoutForHectares(1)).toBe(0.01);
    expect(payoutForHectares(2.5)).toBe(0.025);
    expect(payoutForHectares(0.3)).toBe(0.003);
    expect(payoutForHectares(5)).toBe(0.05);
  });
});
