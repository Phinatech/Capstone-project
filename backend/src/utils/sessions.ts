/**
 * Server-side sessions.
 *
 * The old flow kept the session id in `localStorage` under
 * `sokoto-cover-user` and treated whoever held the id as that user (F-1).
 * Here the id is a random, unguessable handle into this file, delivered in an
 * httpOnly cookie, so it is invisible to page JavaScript and cannot be read
 * back out by an XSS bug — and the role it carries is the role the server
 * assigned, not one the client can rewrite.
 *
 * Sessions are stored rather than stateless (a signed JWT would work too)
 * because it makes revocation real: signing out, or changing a password,
 * immediately invalidates the id instead of waiting for it to expire.
 */
import { randomBytes } from "node:crypto";
import { filePersistence, type StorePersistence } from "./persistence.js";
import type { Role } from "./userStore.js";

export interface Session {
  /** 256 bits of randomness. Unguessable, and safe as a cookie value. */
  id: string;
  userId: string;
  role: Role;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

/** Signed in on this device only; cleared when the browser closes. */
export const DEFAULT_SESSION_SECONDS = 12 * 60 * 60;
/** "Remember me": survives a restart, still bounded server-side. */
export const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;

export interface SessionStore {
  create: (userId: string, role: Role, ttlSeconds?: number) => Promise<Session>;
  /** Returns undefined for an unknown, expired or swept id. */
  read: (id: string) => Promise<Session | undefined>;
  revoke: (id: string) => Promise<boolean>;
  /** Used on password change: every device signed in as this user is signed out. */
  revokeAllForUser: (userId: string) => Promise<number>;
  /** Drops expired sessions so the file cannot grow without bound. */
  sweep: () => Promise<number>;
}

/**
 * Sessions live in a JSON file, like the user directory and agent ledger, so
 * a restart does not sign everyone out mid-demo. Writes are serialised for
 * the same reason: two sign-ins arriving together must not overwrite each
 * other.
 *
 * The clock is injectable so expiry can be tested without waiting.
 */
export function createSessionStore(target: string | StorePersistence, { now = Date.now }: { now?: () => number } = {}): SessionStore {
  const storage = typeof target === "string" ? filePersistence(target) : target;
  const where = typeof target === "string" ? target : "the session store";
  let cached: Session[] | null = null;
  let writeChain: Promise<unknown> = Promise.resolve();

  function isLive(session: Session): boolean {
    return Date.parse(session.expiresAt) > now();
  }

  async function load(): Promise<Session[]> {
    if (cached) return cached;
    try {
      const parsed: unknown = await storage.read();
      if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
      cached = (parsed as Session[]).filter(isLive);
      return cached;
    } catch (err) {
      // Losing sessions signs everyone out, which is recoverable; a corrupt
      // file must not be treated as an empty one silently.
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        cached = [];
        return cached;
      }
      throw new Error(`${where} could not be read: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function write(sessions: Session[]): Promise<void> {
    await storage.write(sessions);
    cached = sessions;
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = writeChain.then(task, task);
    writeChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  async function persist(sessions: Session[]): Promise<void> {
    return enqueue(() => write(sessions));
  }

  return {
    async create(userId, role, ttlSeconds = DEFAULT_SESSION_SECONDS) {
      return enqueue(async () => {
        const time = now();
        const session: Session = {
          id: randomBytes(32).toString("hex"),
          userId,
          role,
          createdAt: new Date(time).toISOString(),
          expiresAt: new Date(time + ttlSeconds * 1000).toISOString(),
          lastSeenAt: new Date(time).toISOString()
        };
        const live = (await load()).filter(isLive);
        await write([...live, session]);
        return session;
      });
    },

    async read(id) {
      if (!id || !/^[0-9a-f]{64}$/.test(id)) return undefined;
      const session = (await load()).find((s) => s.id === id);
      if (!session || !isLive(session)) return undefined;
      return session;
    },

    async revoke(id) {
      return enqueue(async () => {
        const sessions = await load();
        const next = sessions.filter((s) => s.id !== id);
        if (next.length === sessions.length) return false;
        await write(next);
        return true;
      });
    },

    async revokeAllForUser(userId) {
      return enqueue(async () => {
        const sessions = await load();
        const next = sessions.filter((s) => s.userId !== userId);
        const revoked = sessions.length - next.length;
        if (revoked > 0) await write(next);
        return revoked;
      });
    },

    async sweep() {
      return enqueue(async () => {
        const sessions = await load();
        const live = sessions.filter(isLive);
        const dropped = sessions.length - live.length;
        if (dropped > 0) await write(live);
        return dropped;
      });
    }
  };
}
