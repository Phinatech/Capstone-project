import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSeedUsers } from "./utils/envAccounts.js";

const agent = {
  role: "agent",
  name: "Fatima Abdullahi",
  email: "Fatima@Example.com",
  password: "Agent#2023",
  phone: "+234 800 000 0000",
  lga: "Wamakko"
};

describe("SEED_USERS", () => {
  it("provisions a valid account with a stable default id", () => {
    const { accounts, errors } = parseSeedUsers(JSON.stringify([agent]));
    assert.deepEqual(errors, []);
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0]?.id, "agent-1");
    assert.equal(accounts[0]?.role, "agent");
    assert.equal(accounts[0]?.email, "fatima@example.com", "emails are normalised");
    assert.equal(accounts[0]?.emailVerified, true, "operator-provisioned accounts are verified");
  });

  it("keeps explicit ids so receipts keep naming the same farmer", () => {
    const { accounts } = parseSeedUsers(JSON.stringify([{ ...agent, id: "farmer-2", role: "farmer" }]));
    assert.equal(accounts[0]?.id, "farmer-2");
  });

  it("refuses administrators — those come from ADMIN_*", () => {
    const { accounts, errors } = parseSeedUsers(JSON.stringify([{ ...agent, role: "admin" }]));
    assert.equal(accounts.length, 0);
    assert.match(errors[0] ?? "", /role must be/);
  });

  it("skips invalid entries but keeps the rest", () => {
    const { accounts, errors } = parseSeedUsers(
      JSON.stringify([{ ...agent, password: "short" }, { ...agent, email: "not-an-email" }, agent])
    );
    assert.equal(accounts.length, 1);
    assert.equal(errors.length, 2);
  });

  it("reports malformed JSON and non-arrays without throwing", () => {
    assert.match(parseSeedUsers("{nope").errors[0] ?? "", /not valid JSON/);
    assert.match(parseSeedUsers("{}").errors[0] ?? "", /must be a JSON array/);
    assert.deepEqual(parseSeedUsers(""), { accounts: [], errors: [] });
  });
});
