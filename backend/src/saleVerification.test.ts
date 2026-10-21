import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSale, COMMISSION_RATE, type AgentSale } from "./utils/agentStore.js";
import { verifySaleAgainstPolicy } from "./utils/saleVerification.js";
import type { PolicyData } from "./utils/chain.js";

const validBody = {
  policyId: 19,
  agentId: "agent-1",
  farmerId: "farmer-1",
  farmerName: "Amina Bello",
  lga: "Wamakko",
  crop: "Millet",
  windowId: "julaug",
  thresholdMm: 300,
  premiumEth: 0.01,
  payoutEth: 0.1,
  premiumNgn: 32_612,
  payoutNgn: 326_122,
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
    payoutAmount: "0.1",
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
