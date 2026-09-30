import React, { useCallback, useMemo, useRef, useState } from 'react';
import { contractPoolStartEth, seedPolicies, seedSettlements, startingBalanceEth } from '../data/policies';
import { getFarmers } from '../utils/users';
import { evaluatePolicy } from '../utils/oracle';
import { portfolioStats } from '../utils/analytics';
import { useNotifications } from './NotificationContext';
import { PolicyContext, type PolicyContextValue, type PurchaseInput } from './policyContextCore';
import { notifyPurchase, notifySettlement } from './policyNotifications';
import type { EvaluationResult, Policy } from '../types/insurance';
import type { User } from '../types/user';

interface PolicyState {
  policies: Policy[];
  balances: Record<string, number>;
}

function buildInitialState(): PolicyState {
  const balances: Record<string, number> = {};
  getFarmers().forEach((f) => balances[f.id] = startingBalanceEth);
  const policies = seedPolicies.map((p) => {
    const settlement = seedSettlements.find((s) => s.policyId === p.id);
    if (!settlement) return p;
    const result = { ...evaluatePolicy(p, 'reputation', null, false), evaluatedAt: settlement.evaluatedAt };
    if (result.triggered) balances[p.farmerId] = (balances[p.farmerId] ?? 0) + p.payoutEth;
    return { ...p, status: result.triggered ? 'paid' : 'no_payout', evaluation: result } as Policy;
  });
  return { policies, balances };
}

/** Policies, balances and payouts held in React state, seeded from src/data/. */
export function SimulatedPolicyProvider({ children, reason }: {children: React.ReactNode;reason?: string;}) {
  const [state, setState] = useState<PolicyState>(buildInitialState);
  const { notify } = useNotifications();
  const stateRef = useRef(state);
  stateRef.current = state;

  const purchasePolicy = useCallback(
    async (farmerId: string, input: PurchaseInput) => {
      await new Promise((resolve) => setTimeout(resolve, 900)); // stand-in for block confirmation
      const policy: Policy = {
        ...input,
        id: Math.max(0, ...stateRef.current.policies.map((p) => p.id)) + 1,
        farmerId,
        purchasedAt: new Date().toISOString().slice(0, 10),
        status: 'active'
      };
      setState((prev) => ({
        policies: [policy, ...prev.policies],
        balances: { ...prev.balances, [farmerId]: (prev.balances[farmerId] ?? startingBalanceEth) - input.premiumEth }
      }));
      notifyPurchase(notify, policy);
      return policy;
    },
    [notify]
  );

  const recordEvaluation = useCallback(
    (policyId: number, result: EvaluationResult) => {
      const target = stateRef.current.policies.find((p) => p.id === policyId);
      if (!target || target.status !== 'active') return;
      setState((prev) => {
        const balances = result.triggered ?
        {
          ...prev.balances,
          [target.farmerId]: (prev.balances[target.farmerId] ?? startingBalanceEth) + target.payoutEth
        } :
        prev.balances;
        return {
          balances,
          policies: prev.policies.map((p) =>
          p.id === policyId ? { ...p, status: result.triggered ? 'paid' : 'no_payout', evaluation: result } : p
          )
        };
      });
      notifySettlement(notify, target, result.aggregateMm, result.triggered);
    },
    [notify]
  );

  const balanceOf = useCallback(
    (userId: string) => state.balances[userId] ?? startingBalanceEth,
    [state.balances]
  );

  const value = useMemo<PolicyContextValue>(() => {
    const stats = portfolioStats(state.policies);
    return {
      source: { kind: 'simulated', reason },
      policies: state.policies,
      poolEth: contractPoolStartEth + stats.premiums - stats.payouts,
      balanceOf,
      walletOf: (user: User) => user.wallet,
      purchasePolicy,
      recordEvaluation
    };
  }, [state.policies, reason, balanceOf, purchasePolicy, recordEvaluation]);

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}
