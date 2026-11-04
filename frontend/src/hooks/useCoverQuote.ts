import { useMemo } from 'react';
import { usePolicies } from '../contexts/PolicyContext';
import { maxHectares, minHectares, payoutForHectares } from '../data/policies';
import { coverLevel } from '../utils/coverLevels';
import type { WindowOption } from '../contexts/policyContextCore';

/** A form error: a translation key, with the values it names. */
export type FormError = {key: string;vars?: Record<string, string | number>;};

/** A farm size typed in either "2.5" or "2,5", or null if it isn't a size cover is sold for. */
export function parseHectares(text: string): number | null {
  const ha = Number(text.trim().replace(',', '.'));
  if (!text.trim() || !Number.isFinite(ha) || ha < minHectares || ha > maxHectares) return null;
  return Math.round(ha * 100) / 100;
}

/** A profile's farm size as the field's starting text, capped at what one policy covers. */
export function hectaresText(farmSizeHa: number | undefined): string {
  return farmSizeHa && farmSizeHa > 0 ? String(Math.min(farmSizeHa, maxHectares)) : '';
}

/**
 * What a purchase would be: the window's rainfall level (the insurer's, from
 * the Sokoto record), the payout the farm size is worth, and the premium the
 * contract charges on it.
 */
export function useCoverQuote(option: WindowOption | undefined, hectaresInput: string) {
  const { premiumRate } = usePolicies();
  const level = useMemo(() => coverLevel(option?.periods ?? []), [option]);
  const hectares = parseHectares(hectaresInput);
  const payoutEth = hectares === null ? 0 : payoutForHectares(hectares);
  return { level, hectares, payoutEth, premiumEth: payoutEth * premiumRate, premiumRate };
}

/** Premium as a share of the payout, e.g. "17.5". */
export const percent = (rate: number) => String(Number((rate * 100).toFixed(2)));
