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
 * Held in memory rather than on disk: these are short-lived secrets, and a
 * restart invalidating them is the *safe* direction — it can only sign
 * someone out of a recovery flow, never let an old token through.
 *
 * The clock is injectable so expiry can be tested without waiting out a real
 * fifteen minutes.
 */
export function createAuthCodeStore({ now = Date.now }: { now?: () => number } = {}): AuthCodeStore {
  const codes = new Map<string, CodeEntry>();
  const resets = new Map<string, ResetEntry>();

  function live<T extends { expiresAt: number }>(entry: T | undefined): T | undefined {
    return entry && entry.expiresAt > now() ? entry : undefined;
  }

  return {
    async createVerificationCode(userId) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
      codes.set(userId, { code, expiresAt: now() + CODE_TTL_MS, attempts: 0 });
      return code;
    },

    async checkVerificationCode(userId, code) {
      const entry = live(codes.get(userId));
      if (!entry) {
        codes.delete(userId);
        return false;
      }
      // A mismatch is one attempt toward the cap; a match consumes the code.
      if (entry.attempts >= MAX_ATTEMPTS) {
        codes.delete(userId);
        return false;
      }
      entry.attempts += 1;
      // Normalise so "042" does not fail against "42" when a leading zero was
      // dropped by a client that parsed it as a number.
      const supplied = String(code).trim().padStart(6, "0");
      if (entry.code !== supplied) {
        if (entry.attempts >= MAX_ATTEMPTS) codes.delete(userId);
        return false;
      }
      codes.delete(userId);
      return true;
    },

    async createResetToken(email) {
      const token = randomBytes(24).toString("hex");
      resets.set(token, { email: email.trim().toLowerCase(), expiresAt: now() + RESET_TTL_MS });
      return token;
    },

    async readResetToken(token) {
      if (!token || typeof token !== "string") return undefined;
      const entry = live(resets.get(token));
      return entry ? { email: entry.email } : undefined;
    },

    async consumeResetToken(token) {
      if (!resets.has(token)) return false;
      resets.delete(token);
      return true;
    }
  };
}
