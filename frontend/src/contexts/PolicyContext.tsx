import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { seedPolicies, seedSettlements, startingBalanceEth } from '../data/policies';
import { getFarmers, findUser } from '../utils/users';
import { evaluatePolicy, getWindow } from '../utils/oracle';
import { formatEth, formatMm } from '../utils/format';
import { useNotifications } from './NotificationContext';
import type { EvaluationResult, Policy } from '../types/insurance';

interface PurchaseInput {
  lga: string;
  crop: string;
  windowId: string;
  thresholdMm: number;
  premiumEth: number;
  payoutEth: number;
}

interface PolicyState {
  policies: Policy[];
  balances: Record<string, number>;
}

interface PolicyContextValue extends PolicyState {
  balanceOf: (farmerId: string) => number;
  purchasePolicy: (farmerId: string, input: PurchaseInput) => Policy;
  recordEvaluation: (policyId: number, result: EvaluationResult) => void;
}

const PolicyContext = createContext<PolicyContextValue | null>(null);

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

export function PolicyProvider({ children }: {children: React.ReactNode;}) {
  const [state, setState] = useState<PolicyState>(buildInitialState);
  const { notify } = useNotifications();
  const stateRef = useRef(state);
  stateRef.current = state;

  const purchasePolicy = useCallback(
    (farmerId: string, input: PurchaseInput) => {
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
      const window = getWindow(input.windowId).label;
      notify({
        kind: 'policy',
        userId: farmerId,
        title: `Policy #${policy.id} is active`,
        body: `${input.crop} cover in ${input.lga} for ${window}. Pays ${formatEth(input.payoutEth)} below ${formatMm(input.thresholdMm)}.`,
        href: `/farmer/policies/${policy.id}`,
        toast: false
      });
      notify({
        kind: 'policy',
        role: 'admin',
        title: 'New policy purchased',
        body: `${findUser(farmerId)?.name ?? 'A farmer'} bought policy #${policy.id} (${input.crop}, ${input.lga}) · premium ${formatEth(input.premiumEth)}.`,
        href: `/admin/policies/${policy.id}`
      });
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
      notify({
        kind: result.triggered ? 'payout' : 'evaluation',
        userId: target.farmerId,
        title: result.triggered ? `Payout sent: ${formatEth(target.payoutEth)}` : `Policy #${policyId} settled`,
        body: result.triggered ?
        `Rainfall of ${formatMm(result.aggregateMm)} fell below your ${formatMm(target.thresholdMm)} trigger. Funds are in your wallet.` :
        `Rainfall of ${formatMm(result.aggregateMm)} met your ${formatMm(target.thresholdMm)} trigger, so no payout was due.`,
        href: `/farmer/policies/${policyId}`
      });
    },
    [notify]
  );

  const balanceOf = useCallback(
    (farmerId: string) => state.balances[farmerId] ?? startingBalanceEth,
    [state.balances]
  );

  const value = useMemo(
    () => ({ ...state, balanceOf, purchasePolicy, recordEvaluation }),
    [state, balanceOf, purchasePolicy, recordEvaluation]
  );

  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}

export function usePolicies(): PolicyContextValue {
  const ctx = useContext(PolicyContext);
  if (!ctx) throw new Error('usePolicies must be used inside PolicyProvider');
  return ctx;
}