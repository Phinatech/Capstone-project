import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firestorePayload } from "./utils/firebase.js";
import type { StorePersistence } from "./utils/persistence.js";
import { createUserStore } from "./utils/userStore.js";

/** Where Firestore would refuse the document: the path of the first `undefined`. */
function firstUndefined(value: unknown, path = "payload"): string | null {
  if (value === undefined) return path;
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      const found = firstUndefined(inner, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

/** An in-memory store that, like Firestore, refuses `undefined` anywhere. */
function firestoreLike(prepare: (data: unknown) => unknown): StorePersistence {
  let stored: unknown = [];
  return {
    async read() {
      return stored;
    },
    async write(data) {
      const payload = prepare(data);
      const at = firstUndefined(payload);
      if (at) throw new Error(`Cannot use "undefined" as a Firestore value (found in field "${at}")`);
      stored = payload;
    },
  };
}

const googleAccount = {
  id: "farmer-1234567890",
  role: "farmer" as const,
  name: "Amina Bello",
  email: "amina@example.com",
  wallet: "0x0000000000000000000000000000000000000001",
  provider: "google" as const,
  emailVerified: true,
  avatarUrl: undefined,
};

describe("writing stores to Firestore", () => {
  it("drops undefined fields at any depth and keeps everything else", () => {
    const data = [{ a: 1, b: undefined, c: null, d: { e: undefined, f: "x" }, g: [1, 2] }];
    assert.deepEqual(firestorePayload(data), [{ a: 1, c: null, d: { f: "x" }, g: [1, 2] }]);
  });

  it("refused every Google sign-up before: the account has no password hash", async () => {
    const users = createUserStore(firestoreLike((data) => data));
    await assert.rejects(users.create(googleAccount), /found in field "payload\.0\.\w+"/);
  });

  it("saves a Google account once the payload is cleaned the way the files store it", async () => {
    const users = createUserStore(firestoreLike(firestorePayload));
    const created = await users.create(googleAccount);
    assert.equal(created.email, "amina@example.com");
    assert.equal((await users.findByEmail("amina@example.com"))?.provider, "google");
    // An update carrying an empty optional field (a cleared farm size) saves too.
    assert.ok(await users.update(created.id, { farmSizeHa: undefined, lastSignInAt: new Date().toISOString() }));
  });
});
