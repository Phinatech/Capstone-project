/**
 * Email-verification codes and password-reset tokens.
 *
 * These used to live in `frontend/src/utils/authTokens.ts`, generated and
 * checked in the same `localStorage` — so anyone could reset anyone's password
 * by writing their own token (F-1). They now live on the server, expire, are
 * single-use, and are attempt-capped.
 *
 * There is no mail service in this deployment, so the code has to reach the
 * user somehow. It is disclosed in the response **only** when
 * `AUTH_DEMO_CODES` is enabled, which is the explicit "this is a demo" switch
 * the audit asks for. With the flag off — the default, and what any real
 * deployment must use — the code is written to the server log for the
 * operator to relay, and never crosses the wire.
 */
import { randomInt, randomBytes } from "node:crypto";
import type { StorePersistence } from "./persistence.js";

const CODE_TTL_MS = 15 * 60_000;
const RESET_TTL_MS = 60 * 60_000;
/** Brute-forcing a 6-digit code is 10^6 guesses; this makes it impractical. */
const MAX_ATTEMPTS = 5;

interface CodeEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

interface ResetEntry {
  email: string;
  expiresAt: number;
}

export interface AuthCodeStore {
  createVerificationCode: (userId: string) => Promise<string>;
  /** Single-use on success; consumes an attempt on failure. */
  checkVerificationCode: (userId: string, code: string) => Promise<boolean>;
  createResetToken: (email: string) => Promise<string>;
  readResetToken: (token: string) => Promise<{ email: string } | undefined>;
  consumeResetToken: (token: string) => Promise<boolean>;
}

/**
 * Kept behind short-lived, single-use, attempt-capped entries. With a
 * persistence these survive restarts — the safety comes from the expiry and
 * the caps, not from losing codes when the process recycles.
 *
 * The clock is injectable so expiry can be tested without waiting out a real
 * fifteen minutes.
 */
export function createAuthCodeStore(
  { now = Date.now }: { now?: () => number } = {},
  persistence?: StorePersistence
): AuthCodeStore {
  // Without persistence the store is memory-only, which is what tests use.
  // With one, every change is written through so codes survive restarts — on
  // a host that cold-starts, that is the difference between a code that can
  // be used and one that dies before its email is opened. The safety
  // properties are unchanged: 15-minute expiry, single use, attempt cap.
  const codes = new Map<string, CodeEntry>();
  const resets = new Map<string, ResetEntry>();
  let loaded = false;
  let writeChain: Promise<unknown> = Promise.resolve();

  function live<T extends { expiresAt: number }>(entry: T | undefined): T | undefined {
    return entry && entry.expiresAt > now() ? entry : undefined;
  }

  async function loadOnce(): Promise<void> {
    if (loaded) return;
    loaded = true;
    if (!persistence) return;
    try {
      const parsed = (await persistence.read()) as { codes?: Record<string, CodeEntry>; resets?: Record<string, ResetEntry> } | null;
      for (const [key, entry] of Object.entries(parsed?.codes ?? {})) {
        if (live(entry)) codes.set(key, entry);
      }
      for (const [key, entry] of Object.entries(parsed?.resets ?? {})) {
        if (live(entry)) resets.set(key, entry);
      }
    } catch (err) {
      // An empty store is the normal first run; anything else is corruption.
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(`the auth-code store could not be read: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  function persist(): Promise<void> {
    if (!persistence) return Promise.resolve();
    const snapshot = { codes: Object.fromEntries(codes), resets: Object.fromEntries(resets) };
    const next = writeChain.then(() => persistence.write(snapshot), () => persistence.write(snapshot));
    writeChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  return {
    async createVerificationCode(userId) {
      await loadOnce();
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      codes.set(userId, { code, expiresAt: now() + CODE_TTL_MS, attempts: 0 });
      await persist();
      return code;
    },

    async checkVerificationCode(userId, code) {
      await loadOnce();
      const entry = live(codes.get(userId));
      if (!entry) {
        codes.delete(userId);
        await persist();
        return false;
      }
      // A mismatch is one attempt toward the cap; a match consumes the code.
      if (entry.attempts >= MAX_ATTEMPTS) {
        codes.delete(userId);
        await persist();
        return false;
      }
      entry.attempts += 1;
      // Normalise so "042" does not fail against "42" when a leading zero was
      // dropped by a client that parsed it as a number.
      const supplied = String(code).trim().padStart(6, "0");
      if (entry.code !== supplied) {
        if (entry.attempts >= MAX_ATTEMPTS) codes.delete(userId);
        await persist();
        return false;
      }
      codes.delete(userId);
      await persist();
      return true;
    },

    async createResetToken(email) {
      await loadOnce();
      const token = randomBytes(24).toString("hex");
      resets.set(token, { email: email.trim().toLowerCase(), expiresAt: now() + RESET_TTL_MS });
      await persist();
      return token;
    },

    async readResetToken(token) {
      await loadOnce();
      if (!token || typeof token !== "string") return undefined;
      const entry = live(resets.get(token));
      return entry ? { email: entry.email } : undefined;
    },

    async consumeResetToken(token) {
      await loadOnce();
      if (!resets.has(token)) return false;
      resets.delete(token);
      await persist();
      return true;
    }
  };
}
