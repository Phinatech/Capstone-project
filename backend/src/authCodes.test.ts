import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuthCodeStore } from "./utils/authCodes.js";

/** A store whose clock the test drives. */
function withClock() {
  let time = Date.parse("2026-10-21T09:00:00.000Z");
  const store = createAuthCodeStore({ now: () => time });
  return { store, advance: (ms: number) => (time += ms) };
}

describe("email verification codes", () => {
  it("accepts the code it issued, once", async () => {
    const { store } = withClock();
    const code = await store.createVerificationCode("farmer-1");
    assert.equal(await store.checkVerificationCode("farmer-1", code), true);
    assert.equal(await store.checkVerificationCode("farmer-1", code), false, "a used code is spent");
  });

  it("rejects a wrong code", async () => {
    const { store } = withClock();
    await store.createVerificationCode("farmer-1");
    assert.equal(await store.checkVerificationCode("farmer-1", "000000"), false);
  });

  it("gives up after five attempts, so a 6-digit code cannot be brute-forced", async () => {
    const { store } = withClock();
    const code = await store.createVerificationCode("farmer-1");
    for (let i = 0; i < 5; i++) {
      assert.equal(await store.checkVerificationCode("farmer-1", "999999"), false);
    }
    assert.equal(await store.checkVerificationCode("farmer-1", code), false, "the real code is now refused too");
  });

  it("expires", async () => {
    const { store, advance } = withClock();
    const code = await store.createVerificationCode("farmer-1");
    advance(16 * 60_000);
    assert.equal(await store.checkVerificationCode("farmer-1", code), false);
  });

  it("does not confuse a dropped leading zero with a wrong code", async () => {
    const { store } = withClock();
    const code = await store.createVerificationCode("farmer-1");
    // A client that parsed the code as a number would send "42" for "000042".
    assert.equal(await store.checkVerificationCode("farmer-1", code.replace(/^0+/, "")), true);
  });

  it("keeps one user's code out of another's", async () => {
    const { store } = withClock();
    const code = await store.createVerificationCode("farmer-1");
    assert.equal(await store.checkVerificationCode("farmer-2", code), false);
  });
});

describe("password reset tokens", () => {
  it("resolves to the email it was made for", async () => {
    const { store } = withClock();
    const token = await store.createResetToken("Amina.Bello@mail.ng");
    assert.deepEqual(await store.readResetToken(token), { email: "amina.bello@mail.ng" });
  });

  it("is single-use", async () => {
    const { store } = withClock();
    const token = await store.createResetToken("amina.bello@mail.ng");
    assert.equal(await store.consumeResetToken(token), true);
    assert.equal(await store.consumeResetToken(token), false, "a spent token cannot be replayed");
    assert.equal(await store.readResetToken(token), undefined);
  });

  it("expires", async () => {
    const { store, advance } = withClock();
    const token = await store.createResetToken("amina.bello@mail.ng");
    advance(61 * 60_000);
    assert.equal(await store.readResetToken(token), undefined);
  });

  it("answers undefined for anything it did not issue", async () => {
    const { store } = withClock();
    assert.equal(await store.readResetToken("not-a-token"), undefined);
    assert.equal(await store.readResetToken(""), undefined);
    assert.equal(await store.readResetToken(undefined as unknown as string), undefined);
    assert.equal(await store.consumeResetToken("not-a-token"), false);
  });

  it("mints tokens that are not guessable from one another", async () => {
    const { store } = withClock();
    const tokens = await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.createResetToken(`farmer-${i}@mail.ng`))
    );
    assert.equal(new Set(tokens).size, tokens.length, "every token must be distinct");
    for (const token of tokens) assert.match(token, /^[0-9a-f]{48}$/);
  });
});

describe("persistence", () => {
  it("a code survives a restart of the store", async () => {
    let document: unknown = null;
    const persistence = {
      read: async () => {
        if (document === null) throw Object.assign(new Error("empty"), { code: "ENOENT" });
        return document;
      },
      write: async (data: unknown) => {
        document = data;
      }
    };
    const first = createAuthCodeStore({}, persistence);
    const code = await first.createVerificationCode("user-1");

    const second = createAuthCodeStore({}, persistence);
    assert.equal(await second.checkVerificationCode("user-1", code), true, "the code still verifies after the restart");
  });
});
