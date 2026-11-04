import type { CoverageWindow } from '../types/insurance';

/** Product configuration: where cover is sold and on what terms. */
export const lgas = ['Wamakko', 'Kware', 'Bodinga', 'Tambuwal', 'Gwadabawa', 'Illela', 'Goronyo', 'Rabah'];

export const crops = ['Millet', 'Sorghum'];

/**
 * Cover is sold by farm size: the payout is this much test ETH per hectare.
 * The premium is the contract's own rate on that payout. Keep these in step
 * with backend/src/utils/agentStore.ts, which checks agent sales against them.
 */
export const coverPerHectareEth = 0.01;
/** Largest farm one policy covers: smallholder plots, checked by the agent. */
export const maxHectares = 5;
/** Smallest farm size a policy can be sold for. */
export const minHectares = 0.1;

/** The payout for a farm size, rounded so float noise never reaches the contract. */
export function payoutForHectares(hectares: number): number {
  return Math.round(hectares * coverPerHectareEth * 1e6) / 1e6;
}

export const coverageWindows: CoverageWindow[] = [
{ id: 'jun', label: 'June establishment', start: 0, end: 2 },
{ id: 'jul', label: 'July critical growth', start: 3, end: 5 },
{ id: 'junjul', label: 'June – July', start: 0, end: 5 },
{ id: 'julaug', label: 'July – August', start: 3, end: 8 },
{ id: 'augsep', label: 'August – September', start: 6, end: 11 }];
