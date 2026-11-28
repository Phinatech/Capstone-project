import type { PolicyData } from "./chain.js";
import type { AgentSale } from "./agentStore.js";
import type { Role } from "./userStore.js";

/**
 * A chain policy joined with the agent sale receipt that names its farmer.
 *
 * On-chain a policy records only the buying wallet. When an agent sells cover
 * for a farmer, the receipt stored by the backend is the only record that ties
 * the policy to that farmer — so every portal (admin, agent and the farmer's
 * own) must read the attribution from here, or the farmer sees nothing and the
 * admin sees an unnamed policy.
 */
export type AttributedPolicy = PolicyData & {
  /** The agent who sold it, so their portal can follow the policy to settlement. */
  agentId?: string;
  farmerId?: string;
  farmerName?: string;
  lga?: string;
  crop?: string;
};

/** Attach sale-receipt identity to the policies bought through an agent. */
export function attributePolicies(policies: PolicyData[], sales: AgentSale[]): AttributedPolicy[] {
  const byPolicy = new Map<number, AgentSale>();
  for (const sale of sales) {
    // list() returns newest first; if a policy ever has two receipts, the
    // earliest one named the farmer, so keep the smallest soldAt.
    const kept = byPolicy.get(sale.policyId);
    if (!kept || (sale.soldAt ?? "") < (kept.soldAt ?? "")) byPolicy.set(sale.policyId, sale);
  }
  return policies.map((policy) => {
    const sale = byPolicy.get(policy.id);
    return sale
      ? {
          ...policy,
          agentId: sale.agentId,
          farmerId: sale.farmerId,
          farmerName: sale.farmerName,
          lga: sale.lga,
          crop: sale.crop,
        }
      : policy;
  });
}

/** Who is asking; undefined for a visitor who is not signed in. */
export interface Viewer {
  id: string;
  role: Role;
}

/**
 * The attributed policies trimmed to what `viewer` may see.
 *
 * The chain fields are public on any block explorer. The receipt fields — which
 * farmer a policy covers, their LGA and crop, and the agent who sold it — are
 * personal data held only by this server, so they go only to the people the
 * sale concerns:
 *
 * - the administrator: every receipt, because reconciliation is an admin job;
 * - the agent who sold it and the farmer it covers: their own receipts in full;
 * - any other agent: only the farmer's id, so the purchase form can refuse a
 *   second policy for that farmer and window *before* the agent pays for one
 *   on-chain (the server refuses the receipt either way);
 * - anyone else, including visitors who are not signed in: the chain record.
 */
export function attributePoliciesFor(
  policies: PolicyData[],
  sales: AgentSale[],
  viewer: Viewer | undefined
): AttributedPolicy[] {
  const attributed = attributePolicies(policies, sales);
  if (viewer?.role === "admin") return attributed;
  return attributed.map((policy) => {
    if (policy.farmerId === undefined) return policy;
    if (viewer && (policy.agentId === viewer.id || policy.farmerId === viewer.id)) return policy;
    const { agentId: _agentId, farmerId, farmerName: _farmerName, lga: _lga, crop: _crop, ...chain } = policy;
    return viewer?.role === "agent" ? { ...chain, farmerId } : chain;
  });
}
