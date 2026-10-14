/**
 * Rainfall feeds for the relayer: each turns a source's data into dekad
 * totals in mm, leaving out dekads it doesn't have complete data for yet.
 */
import { dekadDays } from "./period.js";

/** A source's rainfall in mm for each of `periods` it has complete data for. */
export type Feed = (periods: number[]) => Promise<Map<number, number>>;

/** Daily rainfall in mm by YYYYMMDD from `start` to `end`; days without data are left out. */
export type DailyFetch = (start: string, end: string) => Promise<Map<string, number>>;

/** A dekad's total rainfall in mm, or null while any of its days is still missing. */
export function dekadTotal(daily: Map<string, number>, period: number): number | null {
  let total = 0;
  for (const day of dekadDays(period)) {
    const mm = daily.get(day);
    if (mm === undefined) return null;
    total += mm;
  }
  return Math.round(total * 100) / 100;
}

/**
 * A feed over a daily-rainfall API. Days it has already fetched are only asked
 * for again after `minIntervalMs`, for APIs with a tight request quota; a newly
 * due dekad is fetched right away.
 */
export function dailyFeed(fetchDaily: DailyFetch, minIntervalMs = 0, now = () => Date.now()): Feed {
  let cache: { at: number; start: string; end: string; daily: Map<string, number> } | undefined;
  return async (periods) => {
    const totals = new Map<number, number>();
    if (periods.length === 0) return totals;
    const days = periods.flatMap(dekadDays);
    const start = days[0]!;
    const end = days.at(-1)!;
    if (!cache || now() - cache.at >= minIntervalMs || start < cache.start || end > cache.end) {
      cache = { at: now(), start, end, daily: await fetchDaily(start, end) };
    }
    for (const period of periods) {
      const mm = dekadTotal(cache.daily, period);
      if (mm !== null) totals.set(period, mm);
    }
    return totals;
  };
}
