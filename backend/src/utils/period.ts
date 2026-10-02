/**
 * Shared dekad period utilities.
 *
 * A dekad is a 10-day block: days 1-10, 11-20, and 21 to month end.
 * Period ids follow the convention YYYYMMD = year * 1000 + month * 10 + dekad,
 * e.g. 2026071 for 1-10 July 2026. Computed in UTC.
 *
 * This module is the single authoritative implementation. Both the backend
 * relayer and the blockchain seed script import from here.
 */

/** Dekad period id as YYYYMMD: year * 1000 + month (1-12) * 10 + dekad (1-3). */
export function periodId(year: number, month: number, dekad: number): number {
  return year * 1000 + month * 10 + dekad;
}

/** Current dekad period id for a given date (defaults to now). */
export function currentPeriod(now: Date = new Date()): number {
  const day = now.getUTCDate();
  const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
  return periodId(now.getUTCFullYear(), now.getUTCMonth() + 1, dekad);
}

/** UTC timestamp (seconds) of the first day of a dekad. */
export function dekadStart(year: number, month: number, dekad: number): number {
  const day = [1, 11, 21][dekad - 1];
  return Date.UTC(year, month - 1, day) / 1000;
}

/** UTC timestamp (seconds) of the last day of a dekad. */
export function dekadEnd(year: number, month: number, dekad: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDay = dekad === 1 ? 10 : dekad === 2 ? 20 : lastDay;
  return Date.UTC(year, month - 1, endDay, 23, 59, 59) / 1000;
}

/** Convert a dekad index (0 = 1-10 June) to a period id for a given year. */
export function dekadIndexToPeriodId(year: number, index: number): number {
  const month = 6 + Math.floor(index / 3);
  const dekad = (index % 3) + 1;
  return periodId(year, month, dekad);
}

/** Convert a dekad index (0 = 1-10 June) to a UTC start timestamp for a given year. */
export function dekadIndexToStart(year: number, index: number): number {
  const month = 6 + Math.floor(index / 3);
  const dekad = (index % 3) + 1;
  return dekadStart(year, month, dekad);
}
