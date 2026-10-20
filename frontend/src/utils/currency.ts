/** Naira amounts, shown alongside the ETH the contract actually settles. */
const ngn = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

const compact = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  notation: 'compact',
  maximumFractionDigits: 2
});

/** `₦326,090`. Non-finite input shows a dash rather than `₦NaN`. */
export function formatNgn(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return ngn.format(Math.round(value));
}

/** `₦3.26m`, for headline figures that would otherwise run long. */
export function formatNgnCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return compact.format(value);
}

/** Rate used for quotes until `/api/fx` answers; the UI labels it approximate. */
export const FALLBACK_ETH_NGN = 3_500_000;
