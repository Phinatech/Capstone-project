import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, needsRehash, verifyPassword } from "./utils/passwords.js";

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const stored = await hashPassword("Farmer#2023");
    assert.equal(await verifyPassword("Farmer#2023", stored), true);
  });

  it("rejects a different password", async () => {
    const stored = await hashPassword("Farmer#2023");
    assert.equal(await verifyPassword("Farmer#2024", stored), false);
  });

  it("never stores the password", async () => {
    const stored = await hashPassword("correct horse battery staple");
    assert.ok(!stored.includes("correct horse battery staple"));
    assert.ok(!stored.includes("battery"));
  });

  it("salts, so the same password hashes differently every time", async () => {
    const [a, b] = await Promise.all([hashPassword("Farmer#2023"), hashPassword("Farmer#2023")]);
    assert.notEqual(a, b, "two hashes of one password must differ");
    // ...and both still verify, which is the point of a salted hash.
    assert.equal(await verifyPassword("Farmer#2023", a), true);
    assert.equal(await verifyPassword("Farmer#2023", b), true);
  });

  it("records its own parameters so they can be raised later", async () => {
    const stored = await hashPassword("Farmer#2023");
    const [prefix, cost, blockSize, parallelism] = stored.split("$");
    assert.equal(prefix, "scrypt");
    assert.ok(Number(cost) >= 2 ** 14, `cost ${cost} is too low to be memory-hard`);
    assert.equal(blockSize, "8");
    assert.equal(parallelism, "1");
    assert.equal(needsRehash(stored), false);
  });

  it("flags a hash made at a lower cost for upgrade", () => {
    assert.equal(needsRehash("scrypt$16384$8$1$00$00"), true);
    assert.equal(needsRehash(undefined), true);
    assert.equal(needsRehash("md5$whatever"), true);
  });

  it("treats a missing or malformed hash as a failure, not a match", async () => {
    assert.equal(await verifyPassword("anything", undefined), false);
    assert.equal(await verifyPassword("", undefined), false);
    for (const bad of ["", "not-a-hash", "scrypt$32768$8$1$deadbeef", "scrypt$32768$8$1$$", "bcrypt$10$abc"]) {
      assert.equal(await verifyPassword("Farmer#2023", bad), false, `expected ${JSON.stringify(bad)} to fail`);
    }
  });

  it("refuses an impossible work factor rather than exhausting memory", async () => {
    // A record demanding 2^30 rounds would try to allocate gigabytes.
    assert.equal(await verifyPassword("Farmer#2023", "scrypt$1073741824$8$1$00$00"), false);
  });

  it("does not treat an empty hash as a match for an empty password", async () => {
    const stored = await hashPassword("");
    assert.equal(await verifyPassword("", stored), true, "an empty password is still a password");
    assert.equal(await verifyPassword(" ", stored), false);
  });
});
