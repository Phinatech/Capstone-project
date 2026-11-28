import assert from "node:assert/strict";
import { test } from "node:test";
import { attributePolicies, attributePoliciesFor, type Viewer } from "./utils/policyAttribution.js";
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
  assert.equal(p?.agentId, "agent-1", "the selling agent's portal follows it too");
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

// Policy 0 was sold by agent-1 for Amina; policy 1 was bought from a wallet with no receipt.
const book = (viewer: Viewer | undefined) =>
  attributePoliciesFor([chainPolicy(0), chainPolicy(1)], [sale(0, "u-amina", "Amina Bello")], viewer);

test("a visitor who is not signed in sees the chain record, never the farmer behind it", () => {
  const [sold, own] = book(undefined);
  assert.deepEqual(sold, chainPolicy(0));
  assert.deepEqual(own, chainPolicy(1));
});

test("the administrator sees every receipt's farmer, LGA, crop and agent", () => {
  const [sold] = book({ id: "admin-1", role: "admin" });
  assert.equal(sold?.farmerName, "Amina Bello");
  assert.equal(sold?.agentId, "agent-1");
});

test("the agent who sold a policy and the farmer it covers see it in full", () => {
  assert.equal(book({ id: "agent-1", role: "agent" })[0]?.farmerName, "Amina Bello");
  assert.equal(book({ id: "u-amina", role: "farmer" })[0]?.lga, "Wamakko");
});

test("another farmer sees none of a receipt", () => {
  assert.deepEqual(book({ id: "u-musa", role: "farmer" })[0], chainPolicy(0));
});

test("another agent sees only which farmer is covered, so a second policy is refused before they pay", () => {
  const [sold] = book({ id: "agent-2", role: "agent" });
  assert.equal(sold?.farmerId, "u-amina");
  assert.equal(sold?.farmerName, undefined);
  assert.equal(sold?.lga, undefined);
  assert.equal(sold?.crop, undefined);
  assert.equal(sold?.agentId, undefined);
});
