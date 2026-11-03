import { formatDayRange } from './format';

/** A period id is YYYYMMD: 2026092 is 2026, September, second dekad (days 11–20). */
function dekadDays(period: number): [Date, Date] {
  const year = Math.floor(period / 1000);
  const month = Math.floor(period / 10) % 100;
  const dekad = period % 10;
  const first = 1 + (dekad - 1) * 10;
  const last = dekad === 3 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : first + 9;
  return [new Date(Date.UTC(year, month - 1, first)), new Date(Date.UTC(year, month - 1, last))];
}

/** The days a window's dekads cover, e.g. "11 Sep – 10 Oct 2026", in the reader's language. */
export function windowDays(periods: number[]): string {
  if (periods.length === 0) return '—';
  return formatDayRange(dekadDays(periods[0])[0], dekadDays(periods[periods.length - 1])[1]);
}
