import { format, formatDistanceToNowStrict } from 'date-fns';

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
  return Number.isNaN(d.getTime()) ? value : format(d, 'd MMM yyyy');
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, 'd MMM yyyy, HH:mm');
}

export function formatRelative(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (Date.now() - d.getTime() < 45_000) return 'just now';
  return `${formatDistanceToNowStrict(d)} ago`;
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