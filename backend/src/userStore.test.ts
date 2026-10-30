import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createUserStore, normaliseEmail, toPublicUser, type NewUser, type UserRecord } from "./utils/userStore.js";

const tempDirs: string[] = [];

/** A directory on a fresh temporary file, so tests never touch real accounts. */
async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), "cover-users-"));
  tempDirs.push(dir);
  return { path: join(dir, "users.json"), store: createUserStore(join(dir, "users.json")) };
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

const seedUser = {
  role: "farmer" as const,
  name: "Amina Bello",
  email: "amina.bello@mail.ng",
  wallet: "0x7a3F92c1B04dE5a8816cF0e4D2b9A61c33e0B4d7",
  provider: "password" as const
};

describe("user store", () => {
  it("creates an account and finds it by email, ignoring case", async () => {
    const { store } = await freshStore();
    await store.create(seedUser, "Farmer#2023");
    assert.ok(await store.findByEmail("amina.bello@mail.ng"));
    assert.ok(await store.findByEmail("  AMINA.BELLO@mail.ng  "), "lookups normalise the address");
  });

  it("stores the email normalised, so two spellings cannot both register", async () => {
    const { store } = await freshStore();
    const created = await store.create({ ...seedUser, email: "  Amina.Bello@Mail.ng " }, "Farmer#2023");
    assert.equal(created.email, "amina.bello@mail.ng");
    await assert.rejects(() => store.create(seedUser, "Farmer#2023"), /already registered/);
  });

  it("keeps the password hash out of the directory the UI reads", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    const directory = await store.directory();
    assert.equal(directory.length, 1);
    const entry = directory[0];
    assert.ok(entry, "the directory should hold the account just created");
    assert.ok(!("passwordHash" in entry), "the directory must not carry hashes");
    assert.ok(!JSON.stringify(directory).includes("Farmer#2023"));
    assert.ok(!JSON.stringify(directory).includes(created.passwordHash ?? "absent"));
  });

  it("drops the hash through toPublicUser as well", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    const publicUser = toPublicUser(created);
    assert.ok(!("passwordHash" in publicUser));
    assert.equal(publicUser.email, created.email);
  });

  it("refuses a password account with no password", async () => {
    const { store } = await freshStore();
    await assert.rejects(() => store.create(seedUser), /needs a password/);
  });

  it("accepts a Google account with no password", async () => {
    const { store } = await freshStore();
    const created = await store.create({ ...seedUser, provider: "google" });
    assert.equal(created.passwordHash, undefined);
    assert.ok(await store.findByEmail(seedUser.email));
  });

  it("verifies the current password before changing it", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    assert.equal(await store.changePassword(created.id, "Wrong#2023", "New#2024"), false);
    assert.equal(await store.changePassword(created.id, "Farmer#2023", "New#2024"), true);
    // The change is real, not just reported.
    const { verifyPassword } = await import("./utils/passwords.js");
    const reloaded = await store.findByEmail(seedUser.email);
    assert.equal(await verifyPassword("New#2024", reloaded?.passwordHash), true);
    assert.equal(await verifyPassword("Farmer#2023", reloaded?.passwordHash), false);
  });

  it("ignores an attempt to set the hash through a profile update", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    const before = (await store.findById(created.id))?.passwordHash;
    await store.update(created.id, { name: "Amina B.", passwordHash: "scrypt$1$1$1$00$00" } as Partial<UserRecord>);
    const after = await store.findById(created.id);
    assert.equal(after?.name, "Amina B.", "an ordinary profile edit goes through");
    assert.equal(after?.passwordHash, before, "the credential is untouched");
  });

  it("refuses a profile update that tries to change identity or role", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    // The escalation F-1 named: an unfiltered patch must not be able to make
    // an account an admin.
    await assert.rejects(
      () => store.update(created.id, { role: "admin" } as Partial<UserRecord>),
      /identity or role/
    );
    await assert.rejects(
      () => store.update(created.id, { email: "admin@sokotocover.ng" } as Partial<UserRecord>),
      /identity or role/
    );
    const unchanged = await store.findById(created.id);
    assert.equal(unchanged?.role, "farmer");
    assert.equal(unchanged?.email, "amina.bello@mail.ng");
  });

  it("removes an account and answers false for one that is not there", async () => {
    const { store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    assert.equal(await store.remove(created.id), true);
    assert.equal(await store.findByEmail(seedUser.email), undefined);
    assert.equal(await store.remove(created.id), false);
  });

  it("survives being reopened, so accounts are not per-process", async () => {
    const { path, store } = await freshStore();
    const created = await store.create(seedUser, "Farmer#2023");
    const reopened = createUserStore(path);
    assert.equal((await reopened.findById(created.id))?.name, "Amina Bello");
  });

  it("seeds missing accounts without overwriting an existing one", async () => {
    const { path, store } = await freshStore();
    await store.create(seedUser, "A-Changed-Password");
    await store.ensureSeeded([{ ...seedUser, password: "Farmer#2023" }]);

    const { verifyPassword } = await import("./utils/passwords.js");
    const reloaded = await store.findByEmail(seedUser.email);
    assert.equal(await verifyPassword("A-Changed-Password", reloaded?.passwordHash), true, "an operator's change is kept");

    // The second seed account was absent, so it gets created.
    await store.ensureSeeded([
      { ...seedUser, password: "Farmer#2023" },
      { ...seedUser, id: "farmer-2", email: "musa@mail.ng", password: "Farmer#2023" }
    ]);
    assert.ok(await store.findByEmail("musa@mail.ng"));

    // And reopening the file must not re-run the seed over the top.
    const reopened = createUserStore(path);
    await reopened.ensureSeeded([{ ...seedUser, email: "amina.bello@mail.ng", password: "Farmer#2023" }]);
    assert.equal((await reopened.findByEmail("amina.bello@mail.ng"))?.passwordHash, reloaded?.passwordHash);
  });

  it("normalises email for callers too", () => {
    assert.equal(normaliseEmail(" Amina.Bello@Mail.ng "), "amina.bello@mail.ng");
  });
});

describe("plaintext never escapes", () => {
  it("a seeded password field reaches neither the store nor a client", async () => {
    const { store } = await freshStore();
    await store.ensureSeeded([
      {
        id: "admin-1",
        role: "admin",
        name: "Operator",
        email: "operator@example.com",
        phone: "",
        wallet: "0x0000000000000000000000000000000000000000",
        emailVerified: true,
        provider: "password",
        password: "SuperSecret#1"
      }
    ] as Array<NewUser & { password: string }>);
    const [record] = await store.list();
    assert.ok(record, "the seeded account exists");
    assert.equal((record as UserRecord & { password?: string }).password, undefined, "no plaintext in the store");
    assert.equal("password" in toPublicUser(record), false, "no plaintext in API responses");
  });
});

describe("pluggable persistence", () => {
  it("keeps accounts across store restarts over any persistence", async () => {
    // The shape the database implementation provides: one shared document.
    let document: unknown = null;
    const persistence = {
      read: async () => {
        if (document === null) {
          throw Object.assign(new Error("empty"), { code: "ENOENT" });
        }
        return document;
      },
      write: async (data: unknown) => {
        document = data;
      }
    };
    const first = createUserStore(persistence);
    await first.create({ role: "agent", name: "Agent", email: "agent@example.com", wallet: "0x0", provider: "password" }, "Password#1");

    const second = createUserStore(persistence);
    const found = await second.findByEmail("agent@example.com");
    assert.ok(found, "the account survived the restart");
    assert.equal(found.name, "Agent");
  });
});
