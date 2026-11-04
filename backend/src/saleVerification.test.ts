import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSale, COMMISSION_RATE, type AgentSale } from "./utils/agentStore.js";
import { findExistingCover, verifySaleAgainstPolicy } from "./utils/saleVerification.js";
import type { PolicyData } from "./utils/chain.js";

const validBody = {
  policyId: 19,
  agentId: "agent-1",
  farmerId: "farmer-1",
  farmerName: "Amina Bello",
  lga: "Wamakko",
  crop: "Millet",
  windowId: "18",
  thresholdMm: 300,
  hectares: 5,
  premiumEth: 0.01,
  payoutEth: 0.05,
  premiumNgn: 32_612,
  payoutNgn: 163_061,
  ethNgnRate: 3_261_222,
  paymentMethod: "cash",
  paymentReference: "SKT-4821",
  soldAt: "2026-10-20T10:00:00.000Z",
};

/** A sale built the way the API builds one, so overrides stay realistic. */
function sale(overrides: Partial<typeof validBody> = {}): AgentSale {
  const parsed = parseSale({ ...validBody, ...overrides });
  if (!parsed.ok) throw new Error(`fixture sale must parse: ${parsed.error}`);
  return parsed.sale;
}

/** The policy the contract would report for `validBody`. */
function chainPolicy(overrides: Partial<PolicyData> = {}): PolicyData {
  return {
    id: 19,
    farmer: "0xcCb3eaE69cE584a60d5d8F39cF7aC9F15efA584B",
    windowId: 18,
    droughtThresholdMm: 30_000, // 300 mm, stored in hundredths
    payoutAmount: "0.05",
    premiumPaid: "0.01",
    settled: false,
    ...overrides,
  };
}

describe("sale verification against the contract", () => {
  it("accepts a receipt that agrees with the policy", () => {
    assert.deepEqual(verifySaleAgainstPolicy(sale(), chainPolicy()), { ok: true });
  });

  it("rejects a sale for a policy the contract does not know", () => {
    const result = verifySaleAgainstPolicy(sale(), undefined);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /does not exist/);
  });

  it("rejects a premium the contract did not record", () => {
    // Same naira maths, half the ETH: the receipt quietly rewrites the price.
    const result = verifySaleAgainstPolicy(
      sale({ premiumEth: 0.005, premiumNgn: 16_306 }),
      chainPolicy()
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /premiumEth/);
  });

  it("rejects a payout the contract did not record", () => {
    const result = verifySaleAgainstPolicy(
      sale({ payoutEth: 0.2, payoutNgn: 652_244 }),
      chainPolicy()
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /payoutEth/);
  });

  it("rejects a window the contract did not record", () => {
    const result = verifySaleAgainstPolicy(sale({ windowId: "17" }), chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /windowId 17 does not match window #18/);
  });

  it("rejects a payout bigger than the farm size it was sold for", () => {
    // The chain agrees with the receipt, but 2 ha is only worth 0.02 ETH of cover.
    const result = verifySaleAgainstPolicy(sale({ hectares: 2 }), chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /0\.02 ETH that 2 ha is covered for/);
  });

  it("rejects a threshold the contract did not record", () => {
    const result = verifySaleAgainstPolicy(sale({ thresholdMm: 80 }), chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /thresholdMm/);
  });

  it("rejects a naira premium that does not follow from the ETH at the quoted rate", () => {
    // The internal-consistency hole: everything matches the chain except the
    // price the farmer actually paid.
    const result = verifySaleAgainstPolicy(sale({ premiumNgn: 60_000 }), chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /premiumNgn/);
  });

  it("rejects a naira payout that does not follow from the ETH at the quoted rate", () => {
    const result = verifySaleAgainstPolicy(sale({ payoutNgn: 900_000 }), chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /payoutNgn/);
  });

  it("blocks a 10x inflated premium, which is what inflates the commission", () => {
    const inflated = sale({ premiumNgn: 326_122 });
    assert.equal(inflated.commissionNgn, 326_122 * COMMISSION_RATE, "commission follows the premium");
    const result = verifySaleAgainstPolicy(inflated, chainPolicy());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /premiumNgn/);
  });

  it("tolerates the float noise a client produces multiplying 0.1 x 0.1", () => {
    // 0.1 * 0.1 is 0.010000000000000002 in IEEE 754; the chain stores 0.01.
    const parsed = parseSale({ ...validBody, premiumEth: 0.010000000000000002 });
    assert.ok(parsed.ok, "fixture must parse");
    if (!parsed.ok) return;
    assert.equal(verifySaleAgainstPolicy(parsed.sale, chainPolicy()).ok, true);
  });

  it("tolerates a client rounding the naira quote to whole naira", () => {
    // ₦32,612.22 shown as ₦32,612: half a percent at most, not an inflation.
    const result = verifySaleAgainstPolicy(sale({ premiumNgn: 32_612 }), chainPolicy());
    assert.deepEqual(result, { ok: true });
  });

  it("rejects a record attached to the wrong policy row", () => {
    const result = verifySaleAgainstPolicy(sale(), chainPolicy({ id: 20 }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /#19 resolved to policy #20/);
  });
});

describe("one policy per farmer per window", () => {
  const farmerWallet = "0x00000000000000000000000000000000000000F1";

  it("finds a sale another agent already recorded for the farmer in that window", () => {
    const earlier = sale({ policyId: 7, agentId: "agent-2" });
    assert.equal(findExistingCover(sale(), [earlier], [], farmerWallet), 7);
  });

  it("finds a policy the farmer bought from their own wallet", () => {
    const own = chainPolicy({ id: 8, farmer: farmerWallet.toLowerCase() });
    assert.equal(findExistingCover(sale(), [], [own], farmerWallet), 8);
  });

  it("allows the same farmer in another window, and another farmer in this one", () => {
    const otherWindow = sale({ policyId: 7, windowId: "17" });
    const otherFarmer = sale({ policyId: 8, farmerId: "farmer-2" });
    const theirOwn = chainPolicy({ id: 9, farmer: farmerWallet, windowId: 17 });
    assert.equal(findExistingCover(sale(), [otherWindow, otherFarmer], [theirOwn], farmerWallet), undefined);
  });

  it("never counts the sale's own policy, so a corrected receipt can be re-sent", () => {
    assert.equal(findExistingCover(sale(), [sale()], [chainPolicy({ farmer: farmerWallet })], farmerWallet), undefined);
  });
});
