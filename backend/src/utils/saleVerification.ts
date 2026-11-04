/**
 * Cross-checks a posted agent sale against the policy the contract recorded.
 *
 * Shape validation (`parseSale`) only proves a sale is well-formed; it says
 * nothing about being *true*. Because nothing authenticates the caller (F-10),
 * the chain is the only authority these records can be checked against — it is
 * the one source an agent cannot edit. Anything the sale claims about the
 * policy itself has to agree with it.
 *
 * The naira figures matter most: `commissionNgn` is derived from `premiumNgn`,
 * so pinning `premiumNgn` to `premiumEth × ethNgnRate` is what stops an agent
 * inflating its own cut.
 */
import { payoutForHectares, type AgentSale } from "./agentStore.js";
import type { PolicyData } from "./chain.js";

export type VerificationResult = { ok: true } | { ok: false; error: string };

/** ETH equality: same value read by two paths, so only float noise separates them. */
const ETH_TOLERANCE = 1e-9;

/** Naira equality: tight enough that rounding a quote cannot be turned into inflation. */
const NGN_TOLERANCE = 0.001;

function closeTo(actual: number, expected: number, tolerance: number, absolute = false): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  const allowed = absolute ? tolerance : Math.max(0.5, Math.abs(expected) * tolerance);
  return Math.abs(actual - expected) <= allowed;
}

/**
 * Verify one sale against the policy it claims to describe.
 *
 * `policy` is undefined when the chain does not know that id — a sale for a
 * policy that never existed can never be made true by retrying.
 */
export function verifySaleAgainstPolicy(
  sale: AgentSale,
  policy: PolicyData | undefined
): VerificationResult {
  if (!policy) {
    return { ok: false, error: `Policy #${sale.policyId} does not exist on the contract` };
  }

  // The route looks the policy up by id, but a record silently attached to the
  // wrong row would pass every remaining check here, so confirm the two refer
  // to the same policy before trusting anything else they say about each other.
  if (policy.id !== sale.policyId) {
    return { ok: false, error: `Policy #${sale.policyId} resolved to policy #${policy.id} on the contract` };
  }

  // One policy per farmer per window is enforced against the sale's window, so
  // that window has to be the one the contract actually sold.
  if (String(policy.windowId) !== sale.windowId) {
    return {
      ok: false,
      error: `windowId ${sale.windowId} does not match window #${policy.windowId}, which the contract recorded for policy #${sale.policyId}`,
    };
  }

  const premium = Number(policy.premiumPaid);
  if (!closeTo(sale.premiumEth, premium, ETH_TOLERANCE, true)) {
    return {
      ok: false,
      error: `premiumEth ${sale.premiumEth} does not match the ${policy.premiumPaid} ETH the contract recorded for policy #${sale.policyId}`,
    };
  }

  const payout = Number(policy.payoutAmount);
  if (!closeTo(sale.payoutEth, payout, ETH_TOLERANCE, true)) {
    return {
      ok: false,
      error: `payoutEth ${sale.payoutEth} does not match the ${policy.payoutAmount} ETH the contract recorded for policy #${sale.policyId}`,
    };
  }

  // Cover is sold by the hectare, so the payout has to be what the farm size
  // the agent checked is worth; a bigger payout for the same farm is refused.
  if (sale.hectares !== undefined && !closeTo(sale.payoutEth, payoutForHectares(sale.hectares), ETH_TOLERANCE, true)) {
    return {
      ok: false,
      error: `payoutEth ${sale.payoutEth} is not the ${payoutForHectares(sale.hectares)} ETH that ${sale.hectares} ha is covered for`,
    };
  }

  // The contract stores hundredths of a millimetre, the same rounding the
  // purchase form applies before it calls buyPolicy.
  if (Math.round(sale.thresholdMm * 100) !== policy.droughtThresholdMm) {
    return {
      ok: false,
      error: `thresholdMm ${sale.thresholdMm} does not match the ${policy.droughtThresholdMm / 100} mm threshold the contract recorded`,
    };
  }

  // Both naira figures must follow from the ETH amounts at the rate the sale
  // quotes. An internally consistent lie (0.01 ETH "costing" ₦1) is exactly
  // what this catches, and it is what makes commissionNgn trustworthy.
  const expectedPremiumNgn = sale.premiumEth * sale.ethNgnRate;
  if (!closeTo(sale.premiumNgn, expectedPremiumNgn, NGN_TOLERANCE)) {
    return {
      ok: false,
      error: `premiumNgn ${sale.premiumNgn} is not ${sale.premiumEth} ETH at the quoted rate of ${sale.ethNgnRate}`,
    };
  }

  const expectedPayoutNgn = sale.payoutEth * sale.ethNgnRate;
  if (!closeTo(sale.payoutNgn, expectedPayoutNgn, NGN_TOLERANCE)) {
    return {
      ok: false,
      error: `payoutNgn ${sale.payoutNgn} is not ${sale.payoutEth} ETH at the quoted rate of ${sale.ethNgnRate}`,
    };
  }

  return { ok: true };
}

/**
 * Another policy already covering this sale's farmer in the same window, if
 * there is one: a sale another agent recorded for them, or a policy the
 * farmer bought from their own wallet. One farm, one policy per window, so
 * cover can't be multiplied by buying it twice.
 *
 * The sale's own policy never counts against it, so re-submitting a receipt
 * (an upsert) still corrects it.
 */
export function findExistingCover(
  sale: AgentSale,
  sales: AgentSale[],
  policies: PolicyData[],
  farmerWallet: string | undefined
): number | undefined {
  const sold = sales.find((s) => s.farmerId === sale.farmerId && s.windowId === sale.windowId && s.policyId !== sale.policyId);
  if (sold) return sold.policyId;
  const wallet = farmerWallet?.toLowerCase();
  if (!wallet) return undefined;
  return policies.find((p) => p.farmer.toLowerCase() === wallet && String(p.windowId) === sale.windowId && p.id !== sale.policyId)?.id;
}
