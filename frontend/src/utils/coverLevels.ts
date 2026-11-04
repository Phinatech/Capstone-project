import history from '../data/rainfallHistory.json';

/**
 * Cover pays in a drought about as rare as this: 1 year in 10. The premium is
 * priced on it (about 11% of years paid, plus the agent's commission and a
 * margin), so the rainfall level is the insurer's to set, not the buyer's.
 */
export const COVER_RETURN_YEARS = 10;

export interface CoverLevel {
  /** The policy pays if the window's rainfall ends below this (whole mm). */
  thresholdMm: number;
  /** A normal year's rainfall for the window: the median since `firstYear`. */
  typicalMm: number;
  /** Years the window was dry enough to have paid, oldest first. */
  paidYears: number[];
  /** How many years of record the level was set from. */
  years: number;
  firstYear: number;
}

const dekads = history.dekads as Record<string, number[]>;

/** Linear-interpolated percentile (0–1) of `values`. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const k = (sorted.length - 1) * p;
  const lo = Math.floor(k);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (k - lo);
}

/**
 * Each year's rainfall over a window, from the Sokoto record (CHIRPS and NASA
 * POWER, weighted as the aggregator weights them). A window is its contract
 * dekads; the year in each period id is ignored, so "June D1" is June D1 of
 * every year on record. Null if any dekad isn't in the record.
 */
export function windowHistory(periods: number[]): number[] | null {
  if (periods.length === 0) return null;
  const series = periods.map((p) => dekads[String(p % 1000)]);
  if (series.some((s) => !s)) return null;
  return history.years.map((_, i) => series.reduce((sum, s) => sum + s![i]!, 0));
}

/**
 * The rainfall level a window is sold at: the total its dekads fell short of
 * in 1 year out of COVER_RETURN_YEARS since records began, and the years it
 * would have paid, so a buyer sees what the level means in seasons they lived.
 */
export function coverLevel(periods: number[]): CoverLevel | null {
  const totals = windowHistory(periods);
  if (!totals) return null;
  const thresholdMm = Math.round(percentile(totals, 1 / COVER_RETURN_YEARS));
  return {
    thresholdMm,
    typicalMm: Math.round(percentile(totals, 0.5)),
    paidYears: history.years.filter((_, i) => totals[i]! < thresholdMm),
    years: history.years.length,
    firstYear: history.years[0]!
  };
}
