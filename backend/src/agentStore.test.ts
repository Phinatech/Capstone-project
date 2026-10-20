import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { COMMISSION_RATE, createAgentStore, parseSale } from "./utils/agentStore.js";

const tempDirs: string[] = [];

/** A ledger on a fresh temporary file, so tests never touch real records. */
async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), "agent-sales-"));
  tempDirs.push(dir);
  const path = join(dir, "agent-sales.json");
  return { path, store: createAgentStore(path) };
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

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

describe("agent sale validation", () => {
  it("accepts a complete sale and computes the commission itself", () => {
    const result = parseSale(validBody);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.policyId, 19);
    assert.equal(result.sale.paymentMethod, "cash");
    assert.equal(result.sale.commissionNgn, 32_612 * COMMISSION_RATE);
  });

  it("ignores a commission the client tried to set for itself", () => {
    const result = parseSale({ ...validBody, commissionNgn: 999_999 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sale.commissionNgn, 32_612 * COMMISSION_RATE);
  });

  it("normalises the timestamp to a canonical ISO string", () => {
    const result = parseSale({ ...validBody, soldAt: "2026-10-20 12:34:56" });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.sale.soldAt.endsWith("Z"));
    assert.ok(!Number.isNaN(Date.parse(result.sale.soldAt)));
  });

  it("rejects a payment method it does not know", () => {
    const result = parseSale({ ...validBody, paymentMethod: "cheque" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /paymentMethod/);
  });

  it("rejects a payment reference that could carry a link", () => {
    for (const bad of ["", "   ", "http://evil.example", "a b", "x".repeat(25)]) {
      const result = parseSale({ ...validBody, paymentReference: bad });
      assert.equal(result.ok, false, bad);
      if (result.ok) continue;
      assert.match(result.error, /paymentReference/);
    }
  });

  it("rejects a payout smaller than the premium", () => {
    const result = parseSale({ ...validBody, payoutEth: 0.005, premiumEth: 0.01 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /payoutEth/);
  });

  it("rejects missing, non-numeric and fractional-policy values", () => {
    for (const patch of [
      { policyId: "abc" },
      { policyId: 19.5 },
      { agentId: "" },
      { farmerName: undefined },
      { premiumNgn: "lots" },
      { premiumNgn: -1 },
      { ethNgnRate: 0 },
      { thresholdMm: 0 },
      { soldAt: "not a date" },
      { lga: "x".repeat(61) },
    ]) {
      const result = parseSale({ ...validBody, ...patch });
      assert.equal(result.ok, false, JSON.stringify(patch));
    }
  });
});

describe("agent sales store", () => {
  it("starts empty when no file exists yet", async () => {
    const { store } = await freshStore();
    assert.deepEqual(await store.list(), []);
    assert.equal(await store.findByPolicy(19), undefined);
  });

  it("writes to disk, so a different store on the same file sees the sale", async () => {
    const { path, store } = await freshStore();
    const result = parseSale(validBody);
    assert.ok(result.ok);
    await store.upsert(result.sale);

    const secondReader = createAgentStore(path);
    const sales = await secondReader.list();
    assert.equal(sales.length, 1);
    assert.equal(sales.at(0)?.farmerName, "Amina Bello");
    const found = await secondReader.findByPolicy(19);
    assert.equal(found?.policyId, 19);
  });

  it("replaces a sale when the same policy is submitted again", async () => {
    const { store } = await freshStore();
    const first = parseSale(validBody);
    const corrected = parseSale({ ...validBody, paymentReference: "SKT-9999" });
    assert.ok(first.ok && corrected.ok);
    await store.upsert(first.sale);
    await store.upsert(corrected.sale);

    const sales = await store.list();
    assert.equal(sales.length, 1);
    assert.equal(sales.at(0)?.paymentReference, "SKT-9999");
  });

  it("filters to one agent and never leaks another agent's sales", async () => {
    const { store } = await freshStore();
    const mine = parseSale(validBody);
    const theirs = parseSale({ ...validBody, policyId: 20, agentId: "agent-2" });
    assert.ok(mine.ok && theirs.ok);
    await store.upsert(mine.sale);
    await store.upsert(theirs.sale);

    assert.equal((await store.list("agent-1")).length, 1);
    assert.equal((await store.list("agent-2")).length, 1);
    assert.equal((await store.list("agent-3")).length, 0);
    assert.equal((await store.list()).length, 2);
  });

  it("lists the newest sale first", async () => {
    const { store } = await freshStore();
    const older = parseSale({ ...validBody, policyId: 1, soldAt: "2026-10-01T10:00:00.000Z" });
    const newer = parseSale({ ...validBody, policyId: 2, soldAt: "2026-10-20T10:00:00.000Z" });
    assert.ok(older.ok && newer.ok);
    await store.upsert(older.sale);
    await store.upsert(newer.sale);
    assert.deepEqual((await store.list()).map((s) => s.policyId), [2, 1]);
  });

  it("keeps every record when sales are submitted concurrently", async () => {
    const { store } = await freshStore();
    const sales = Array.from({ length: 25 }, (_, i) => parseSale({ ...validBody, policyId: i + 1 }));
    assert.ok(sales.every((s) => s.ok));

    // Without serialised, atomic writes these interleave and lose records.
    await Promise.all(sales.map((s) => (s.ok ? store.upsert(s.sale) : Promise.resolve())));

    const written = await store.list();
    assert.equal(written.length, 25);
    assert.deepEqual(new Set(written.map((s) => s.policyId)), new Set(Array.from({ length: 25 }, (_, i) => i + 1)));

    // A reader that never saw the cache proves all 25 reached the file.
    const reread = createAgentStore(join(tempDirs.at(-1)!, "agent-sales.json"));
    assert.equal((await reread.list()).length, 25);
  });

  it("reports a corrupt ledger instead of silently discarding records", async () => {
    const { store } = await freshStore();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(tempDirs.at(-1)!, "agent-sales.json"), "{ not json", "utf8");
    await assert.rejects(() => store.list(), /could not be read/);
  });
});
