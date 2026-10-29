import type { PolicyData } from "./chain.js";
import type { AgentSale } from "./agentStore.js";

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
          farmerId: sale.farmerId,
          farmerName: sale.farmerName,
          lga: sale.lga,
          crop: sale.crop,
        }
      : policy;
  });
}
