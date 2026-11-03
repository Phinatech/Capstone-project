/**
 * The locale dates are written in. I18nProvider sets it whenever the language
 * changes, so "3 Nov 2026" reads "3 Nuw, 2026" in Hausa and "3 nov. 2026" in
 * French, and "3 days ago" becomes "kwanaki 3 da suka gabata".
 */
let locale = 'en-NG';
let hausaFallback = false;

export function setFormatLocale(next: string): void {
  locale = next;
  // Chrome and Edge ship without Hausa locale data and quietly fall back to
  // English, so Hausa dates are written from the CLDR words below instead.
  hausaFallback = next.startsWith('ha') && Intl.DateTimeFormat.supportedLocalesOf([next]).length === 0;
}

/** Hausa date words, as CLDR (and so Firefox, Safari and Node) writes them. */
const HA_MONTHS = ['Jan', 'Fab', 'Mar', 'Afi', 'May', 'Yun', 'Yul', 'Agu', 'Sat', 'Okt', 'Nuw', 'Dis'];
const HA_WEEKDAYS = ['Lah', 'Lit', 'Tal', 'Lar', 'Alh', 'Jum', 'Asa'];
/** [past, one] [past, many] [future, one] [future, many]; `{n}` is the count. */
const HA_RELATIVE: Record<Intl.RelativeTimeFormatUnit, [string, string, string, string]> = {
  second: ['dakika {n} da ta gabata', 'dakiku {n} da suka gabata', 'cikin dakika {n}', 'cikin dakiku {n}'],
  minute: ['minti {n} da ya gabata', 'mintuna {n} da suka gabata', 'cikin minti {n}', 'cikin mintuna {n}'],
  hour: ['awa {n} da ta gabata', 'awanni {n} da suka gabata', 'cikin awa {n}', 'cikin awanni {n}'],
  day: ['jiya', 'kwanaki {n} da suka gabata', 'gobe', 'a cikin kwanaki {n}'],
  month: ['watan da ya gabata', 'watanni {n} da suka gabata', 'wata na gaba', 'a cikin watanni {n}'],
  year: ['bara', 'shekaru {n} da suka gabata', 'badi', 'a shekaru {n}']
} as Record<Intl.RelativeTimeFormatUnit, [string, string, string, string]>;

function hausaRelative(amount: number, unit: Intl.RelativeTimeFormatUnit): string {
  if (amount === 0) return 'yanzu';
  const n = Math.abs(amount);
  const forms = HA_RELATIVE[unit];
  return forms[(amount < 0 ? 0 : 2) + (n === 1 ? 0 : 1)].replace('{n}', String(n));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatEth(value: number): string {
  return `${Number(value.toFixed(4))} ETH`;
}

export function formatMm(value: number): string {
  return `${value.toFixed(1)} mm`;
}

export function formatGas(value: number): string {
  return value.toLocaleString('en-US');
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (hausaFallback) return `${d.getDate()} ${HA_MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (hausaFallback) return `${formatDate(value)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}

/** The header clock's date, e.g. "Tue, 3 Nov 2026", in the given time zone. */
export function formatClockDate(d: Date, timeZone: string): string {
  if (hausaFallback) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const [day, month, year] = [part('day'), part('month'), part('year')];
    return `${HA_WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${day} ${HA_MONTHS[month - 1]}, ${year}`;
  }
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** A month's short name (1 = January) in the reader's language. */
export function formatMonthShort(month: number): string {
  if (hausaFallback) return HA_MONTHS[month - 1] ?? String(month);
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

/** "11 Sep – 10 Oct 2026" in the reader's language; both dates are UTC calendar days. */
export function formatDayRange(start: Date, end: Date): string {
  const dayMonth = (d: Date) =>
  hausaFallback ? `${d.getUTCDate()} ${HA_MONTHS[d.getUTCMonth()]}` : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d);
  const full = (d: Date) =>
  hausaFallback ? `${dayMonth(d)}, ${d.getUTCFullYear()}` : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  const from = start.getUTCFullYear() === end.getUTCFullYear() ? dayMonth(start) : full(start);
  return `${from} – ${full(end)}`;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity]
];

export function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const say = (n: number, unit: Intl.RelativeTimeFormatUnit) => hausaFallback ? hausaRelative(n, unit) : rtf.format(n, unit);
  let amount = (d.getTime() - Date.now()) / 1000;
  if (Math.abs(amount) < 45) return say(0, 'second');
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(amount) < size) return say(Math.round(amount), unit);
    amount /= size;
  }
  return say(Math.round(amount), 'year');
}

export function pseudoHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = '0x';
  let state = h >>> 0;
  for (let i = 0; i < 64; i++) {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    out += (state >>> 28).toString(16);
  }
  return out;
}