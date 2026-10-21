import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { createSessionStore, DEFAULT_SESSION_SECONDS, REMEMBERED_SESSION_SECONDS } from "./utils/sessions.js";

const tempDirs: string[] = [];

function withClock() {
  let time = Date.parse("2026-10-21T09:00:00.000Z");
  return {
    now: () => time,
    advance: (ms: number) => (time += ms)
  };
}

async function freshStore() {
  const dir = await mkdtemp(join(tmpdir(), "cover-sessions-"));
  tempDirs.push(dir);
  const clock = withClock();
  const path = join(dir, "sessions.json");
  return { path, clock, store: createSessionStore(path, { now: clock.now }) };
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("sessions", () => {
  it("issues an unguessable id that resolves back to the user", async () => {
    const { store } = await freshStore();
    const session = await store.create("farmer-1", "farmer");
    assert.match(session.id, /^[0-9a-f]{64}$/, "256 bits of randomness, as hex");
    const read = await store.read(session.id);
    assert.equal(read?.userId, "farmer-1");
    assert.equal(read?.role, "farmer");
  });

  it("gives every session its own id", async () => {
    const { store } = await freshStore();
    const ids = await Promise.all(
      Array.from({ length: 25 }, () => store.create("farmer-1", "farmer").then((s) => s.id))
    );
    assert.equal(new Set(ids).size, ids.length);
  });

  it("answers undefined for an id it never issued", async () => {
    const { store } = await freshStore();
    assert.equal(await store.read("a".repeat(64)), undefined);
  });

  it("answers undefined, without touching the store, for a malformed id", async () => {
    const { store } = await freshStore();
    for (const bad of ["", "short", "z".repeat(64), "a".repeat(63), "a".repeat(65), "../../etc/passwd"]) {
      assert.equal(await store.read(bad), undefined, `expected ${JSON.stringify(bad)} to be refused`);
    }
  });

  it("expires, and an expired id is refused", async () => {
    const { store, clock } = await freshStore();
    const session = await store.create("farmer-1", "farmer", 60);
    clock.advance(59_000);
    assert.ok(await store.read(session.id), "still live just before expiry");
    clock.advance(2_000);
    assert.equal(await store.read(session.id), undefined, "gone just after");
  });

  it("treats a remembered session as lasting much longer than a plain one", async () => {
    assert.ok(REMEMBERED_SESSION_SECONDS > DEFAULT_SESSION_SECONDS * 20);
  });

  it("revokes one session", async () => {
    const { store } = await freshStore();
    const a = await store.create("farmer-1", "farmer");
    const b = await store.create("farmer-1", "farmer");
    assert.equal(await store.revoke(a.id), true);
    assert.equal(await store.read(a.id), undefined);
    assert.ok(await store.read(b.id), "the other device stays signed in");
    assert.equal(await store.revoke(a.id), false, "revoking twice is not an error");
  });

  it("revokes every session for one user, which is what a password change needs", async () => {
    const { store } = await freshStore();
    const a = await store.create("farmer-1", "farmer");
    const b = await store.create("farmer-1", "farmer");
    const other = await store.create("admin-1", "admin");
    assert.equal(await store.revokeAllForUser("farmer-1"), 2);
    assert.equal(await store.read(a.id), undefined);
    assert.equal(await store.read(b.id), undefined);
    assert.ok(await store.read(other.id), "another user is unaffected");
  });

  it("sweeps expired sessions out of the file", async () => {
    const { store, clock, path } = await freshStore();
    const stale = await store.create("farmer-1", "farmer", 60);
    const live = await store.create("farmer-1", "farmer");
    clock.advance(120_000);
    assert.equal(await store.sweep(), 1);

    // Reopening must find the sweep persisted, not just held in memory.
    const reopened = createSessionStore(path, { now: clock.now });
    assert.equal(await reopened.read(stale.id), undefined, "the short-lived one was dropped");
    assert.ok(await reopened.read(live.id), "the twelve-hour one is still live after two minutes");
  });

  it("keeps sessions across a reopen, so a restart does not sign everyone out", async () => {
    const { path, store } = await freshStore();
    const session = await store.create("farmer-1", "farmer");
    const reopened = createSessionStore(path);
    assert.equal((await reopened.read(session.id))?.userId, "farmer-1");
  });
});
