/**
 * The server-side user directory.
 *
 * This replaces `frontend/src/utils/users.ts`, which kept users in
 * `localStorage` and let any visitor rewrite their own role from DevTools
 * (F-1). Nothing here is reachable from the browser: the store lives in a
 * JSON file next to the agent ledger, and the only way to read or change it
 * is through the auth routes.
 *
 * The store itself never accepts a plaintext password — `create` and
 * `changePassword` hash inside, so a plaintext value cannot be logged,
 * serialised or compared anywhere else in the codebase.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { hashPassword, needsRehash, verifyPassword } from "./passwords.js";

export type Role = "farmer" | "agent" | "admin";

export interface UserRecord {
  id: string;
  role: Role;
  name: string;
  /** Always stored lowercase and trimmed; lookups depend on it. */
  email: string;
  wallet: string;
  joinedAt: string;
  provider: "password" | "google";
  emailVerified: boolean;
  lga?: string;
  phone?: string;
  title?: string;
  avatarUrl?: string;
  bio?: string;
  farmSizeHa?: number;
  primaryCrop?: string;
  village?: string;
  lastSignInAt?: string;
  twoFactor?: boolean;
  /** Absent for Google-only accounts, which have no local password. */
  passwordHash?: string;
}

/** What the browser is allowed to see. Never includes `passwordHash`. */
export type PublicUser = Omit<UserRecord, "passwordHash">;

export interface NewUser {
  id?: string;
  role: Role;
  name: string;
  email: string;
  wallet: string;
  joinedAt?: string;
  provider: "password" | "google";
  emailVerified?: boolean;
  lga?: string;
  phone?: string;
  title?: string;
  avatarUrl?: string;
  bio?: string;
  farmSizeHa?: number;
  primaryCrop?: string;
  village?: string;
}

export interface UserStore {
  list: () => Promise<UserRecord[]>;
  /** Directory entries for the UI: everyone, ordered as seeded then joined. */
  directory: () => Promise<PublicUser[]>;
  findById: (id: string) => Promise<UserRecord | undefined>;
  findByEmail: (email: string) => Promise<UserRecord | undefined>;
  create: (input: NewUser, password?: string) => Promise<UserRecord>;
  update: (id: string, patch: Partial<UserRecord>) => Promise<UserRecord | undefined>;
  remove: (id: string) => Promise<boolean>;
  /** Verifies the current password, then replaces it. False if either fails. */
  changePassword: (id: string, current: string, next: string) => Promise<boolean>;
  /**
   * Replaces a password without requiring the current one — the reset flow,
   * where proving the current password is exactly what the caller cannot do.
   * Takes the plaintext and hashes internally, like every other entry point.
   */
  replacePassword: (id: string, password: string) => Promise<boolean>;
  /**
   * Re-derives the hash at the current cost. Called after a *successful*
   * login, because scrypt cannot upgrade a hash without the plaintext — a
   * hash on its own is a one-way trip.
   */
  upgradePasswordHash: (id: string, password: string) => Promise<void>;
  /** Seeds accounts that are missing, leaving existing ones untouched. */
  ensureSeeded: (seeds: Array<NewUser & { password: string }>) => Promise<void>;
  /** Deletes accounts by id; used to retire the shipped demo accounts. */
  removeByIds: (ids: string[]) => Promise<void>;
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The record minus the fields that must never reach a client. */
export function toPublicUser(record: UserRecord): PublicUser {
  // `password` as well as `passwordHash`: a seeded record once carried the
  // plaintext alongside the hash, and stripping only the hash let it ride into
  // every API response. Belt and braces — both must go.
  const { passwordHash: _passwordHash, password: _password, ...rest } = record as UserRecord & { password?: string };
  return rest;
}

/**
 * A directory backed by one JSON file, written the same way as the agent
 * ledger: temp file then rename, with writes serialised so two sign-ups at
 * once cannot interleave and lose one of the records.
 */
export function createUserStore(filePath: string): UserStore {
  let cached: UserRecord[] | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();

  async function load(): Promise<UserRecord[]> {
    if (cached) return cached;
    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
      if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
      cached = parsed as UserRecord[];
      return cached;
    } catch (err) {
      // A missing file is an empty directory; a corrupt one is every account
      // lost, so it surfaces loudly instead of quietly starting over.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        cached = [];
        return cached;
      }
      throw new Error(`${filePath} could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function write(records: UserRecord[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const temp = `${filePath}.tmp`;
    await writeFile(temp, `${JSON.stringify(records, null, 2)}\n`, "utf8");
    await rename(temp, filePath);
    cached = records;
  }

  /** Runs `task` after every write already queued, so writes never overlap. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async function persist(records: UserRecord[]): Promise<void> {
    return enqueue(() => write(records));
  }

  /**
   * The only route to a password hash.
   *
   * `update` deliberately refuses the field, so a profile edit cannot replace
   * a credential; hashing and re-hashing go through here instead.
   */
  async function setPasswordHash(id: string, passwordHash: string | undefined): Promise<UserRecord | undefined> {
    return enqueue(async () => {
      const records = await load();
      const index = records.findIndex((u) => u.id === id);
      if (index < 0) return undefined;
      const current = records[index];
      if (!current) return undefined;
      const updated: UserRecord = { ...current, passwordHash };
      records[index] = updated;
      await write(records);
      return updated;
    });
  }

  return {
    async list() {
      return [...(await load())];
    },

    async directory() {
      return (await load()).map(toPublicUser);
    },

    async findById(id) {
      return (await load()).find((u) => u.id === id);
    },

    async findByEmail(email) {
      const wanted = normaliseEmail(email);
      return (await load()).find((u) => u.email === wanted);
    },

    async create(input, password) {
      return enqueue(async () => {
        const records = await load();
        const email = normaliseEmail(input.email);
        if (records.some((u) => u.email === email)) {
          throw new Error(`email already registered: ${email}`);
        }
        if (input.provider === "password" && !password) {
          throw new Error("a password account needs a password");
        }
        // The caller may spread a seed carrying a plaintext `password` next to
        // the separate password argument; nothing but the hash may ever be
        // stored, or it rides along into every API response.
        const { password: _seedPassword, ...safeInput } = input as NewUser & { password?: string };
        const record: UserRecord = {
          ...safeInput,
          id: input.id ?? `${input.role}-${randomUUID().slice(0, 8)}`,
          email,
          joinedAt: input.joinedAt ?? new Date().toISOString().slice(0, 10),
          emailVerified: input.emailVerified ?? false,
          // Hashed here rather than by the caller, so plaintext never leaves
          // this module.
          passwordHash: password ? await hashPassword(password) : undefined
        };
        await write([...records, record]);
        return record;
      });
    },

    async update(id, patch) {
      return enqueue(async () => {
        const records = await load();
        const index = records.findIndex((u) => u.id === id);
        if (index < 0) return undefined;
        const current = records[index];
        if (!current) return undefined;
        // Identity and authority are fixed at creation. Refusing them here
        // means that even a caller passing an unfiltered patch cannot promote
        // an account to admin or re-point it at someone else's email — the
        // exact escalation F-1 was about.
        const {
          passwordHash: _hash,
          id: _id,
          role: _role,
          email: _email,
          provider: _provider,
          ...safe
        } = patch;
        if (_id !== undefined || _role !== undefined || _email !== undefined || _provider !== undefined) {
          throw new Error("update cannot change an account's identity or role");
        }
        // The cast is bounded: `safe` is a Partial<UserRecord> minus the keys
        // above, so every field it can carry is already on the record.
        const updated = { ...current, ...safe } as UserRecord;
        records[index] = updated;
        await write(records);
        return updated;
      });
    },

    async remove(id) {
      return enqueue(async () => {
        const records = await load();
        const next = records.filter((u) => u.id !== id);
        if (next.length === records.length) return false;
        await write(next);
        return true;
      });
    },

    async changePassword(id, current, next) {
      const record = (await load()).find((u) => u.id === id);
      if (!record) return false;
      if (!(await verifyPassword(current, record.passwordHash))) return false;
      // Not `update`: the profile path refuses this field on purpose.
      await setPasswordHash(id, await hashPassword(next));
      return true;
    },

    async replacePassword(id, password) {
      const record = (await load()).find((u) => u.id === id);
      if (!record) return false;
      await setPasswordHash(id, await hashPassword(password));
      return true;
    },

    async upgradePasswordHash(id, password) {
      const record = (await load()).find((u) => u.id === id);
      if (!record || !needsRehash(record.passwordHash)) return;
      await setPasswordHash(id, await hashPassword(password));
    },

    async ensureSeeded(seeds) {
      for (const seed of seeds) {
        const existing = await load().then((records) => records.find((u) => u.id === seed.id || u.email === normaliseEmail(seed.email)));
        if (existing) {
          // A password supplied at seed time still has to be honoured, but a
          // changed demo password is the operator's decision to make, so only
          // fill in an account that has none.
          if (!existing.passwordHash && seed.password) {
            await this.update(existing.id, { passwordHash: await hashPassword(seed.password) });
          }
          continue;
        }
        await this.create(seed, seed.password);
      }
    },

    async removeByIds(ids) {
      await enqueue(async () => {
        const records = await load();
        const remaining = records.filter((u) => !ids.includes(u.id));
        if (remaining.length !== records.length) await write(remaining);
      });
    }
  };
}
