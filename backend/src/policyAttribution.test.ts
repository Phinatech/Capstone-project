import assert from "node:assert/strict";
import { test } from "node:test";
import { attributePolicies } from "./utils/policyAttribution.js";
import type { PolicyData } from "./utils/chain.js";
import type { AgentSale } from "./utils/agentStore.js";

const chainPolicy = (id: number, farmer = "0xAbc"): PolicyData => ({
  id,
  farmer,
  windowId: 19,
  droughtThresholdMm: 8500,
  payoutAmount: "0.01",
  premiumPaid: "0.001",
  settled: false,
});

const sale = (policyId: number, farmerId: string, farmerName: string, soldAt = "2026-10-29T02:15:00Z"): AgentSale =>
  ({
    policyId,
    agentId: "agent-1",
    farmerId,
    farmerName,
    lga: "Wamakko",
    crop: "Millet",
    soldAt,
  }) as AgentSale;

test("a policy sold through an agent carries that farmer's identity", () => {
  const [p] = attributePolicies([chainPolicy(0)], [sale(0, "u-amina", "Amina Bello")]);
  assert.equal(p?.farmerId, "u-amina");
  assert.equal(p?.farmerName, "Amina Bello");
  assert.equal(p?.lga, "Wamakko");
  assert.equal(p?.crop, "Millet");
});

test("a policy with no sale receipt is passed through untouched", () => {
  const [p] = attributePolicies([chainPolicy(1)], [sale(0, "u-amina", "Amina Bello")]);
  assert.equal(p?.farmerId, undefined);
  assert.equal(p?.farmer, "0xAbc");
});

test("sales for unknown policy ids are ignored", () => {
  const [p] = attributePolicies([chainPolicy(2)], [sale(9, "u-amina", "Amina Bello")]);
  assert.equal(p?.farmerId, undefined);
});

test("the earliest receipt names the farmer when one exists twice", () => {
  const [p] = attributePolicies([chainPolicy(0)], [
    sale(0, "u-later", "Later Name", "2026-10-29T09:14:00Z"),
    sale(0, "u-amina", "Amina Bello", "2026-10-29T02:15:00Z"),
  ]);
  assert.equal(p?.farmerId, "u-amina");
});
