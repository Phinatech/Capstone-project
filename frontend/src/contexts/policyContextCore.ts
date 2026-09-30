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

/** Where policy data comes from: in-browser seed data, or the deployed contracts. */
export type DataSource =
{kind: 'simulated';reason?: string;} |
{kind: 'chain';chainId: bigint;local: boolean;};

export interface PolicyContextValue {
  source: DataSource;
  policies: Policy[];
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
