import { createContext, useContext } from 'react';
import type { EvaluationResult, Policy } from '../types/insurance';
import type { User } from '../types/user';

export interface PurchaseInput {
  lga: string;
  crop: string;
  windowId: string;
  thresholdMm: number;
  premiumEth: number;
  payoutEth: number;
}

/** A coverage window the app can sell: the contract's windows in chain mode, the seed list otherwise. */
export interface WindowOption {
  /** Selectable id. The on-chain window id as a string in chain mode. */
  id: string;
  label: string;
  /** False once the contract would reject a purchase (`sales closed for window`). */
  open: boolean;
  /** Part of the season this window insures, e.g. "Sep D2 – Oct D1". */
  covers: string;
  /** Human close date, e.g. "19 Nov 2026". */
  closes: string;
  /** Contract dekad ids this window sums, e.g. [2026092, 2026093, 2026101]. Empty where the window is not on-chain. */
  periods: number[];
}

/** Where policy data comes from: in-browser seed data, or the deployed contracts. */
export type DataSource =
{kind: 'simulated';reason?: string;} |
{kind: 'chain';chainId: bigint;local: boolean;};

export interface PolicyContextValue {
  source: DataSource;
  policies: Policy[];
  /** Coverage windows on sale, from the contract in chain mode. */
  windows: WindowOption[];
  /** ETH held by the insurance contract's payout pool. */
  poolEth: number;
  balanceOf: (userId: string) => number;
  /** The address that signs for this user (a local test account on a local chain). */
  walletOf: (user: User) => string;
  purchasePolicy: (farmerId: string, input: PurchaseInput) => Promise<Policy>;
  /** Simulated mode: stores an evaluation as the settlement. A no-op on-chain. */
  recordEvaluation: (policyId: number, result: EvaluationResult) => void;
  /** Chain mode only: sends checkAndSettle for the policy. */
  settleOnChain?: (policyId: number) => Promise<void>;
}

export const PolicyContext = createContext<PolicyContextValue | null>(null);

export function usePolicies(): PolicyContextValue {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error('usePolicies must be used inside PolicyProvider');
  return ctx;
}
