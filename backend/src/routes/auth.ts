/**
 * Authentication endpoints.
 *
 * Everything the frontend used to do in `localStorage` now happens here:
 * password verification against scrypt hashes, Google ID-token verification,
 * session issuing, email verification and password reset (F-1, F-3).
 *
 * Deliberate properties:
 *
 * - **Identity is never taken from the body.** Handlers read `req.principal`,
 *   which came from the session cookie. There is no `agentId` field to forge.
 * - **A wrong email and a wrong password are indistinguishable** — same
 *   status, same message, and the same scrypt work is spent either way, so a
 *   response cannot be timed to enumerate accounts.
 * - **Errors carry a `code`.** The UI is trilingual and maps the code onto its
 *   own wording; the English `error` is for logs and for clients with no
 *   translation of their own.
 */
import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { verifyTurnstileToken } from "../turnstile.js";
import type { AuthCodeStore } from "../utils/authCodes.js";
import { sessionClearCookie, sessionSetCookie } from "../utils/cookies.js";
import { createGoogleVerifier, type GoogleVerifier } from "../utils/googleAuth.js";
import { hashPassword, verifyPassword } from "../utils/passwords.js";
import type { SessionStore } from "../utils/sessions.js";
import { DEFAULT_SESSION_SECONDS, REMEMBERED_SESSION_SECONDS } from "../utils/sessions.js";
import type { NewUser, Role, UserStore } from "../utils/userStore.js";
import { normaliseEmail, toPublicUser } from "../utils/userStore.js";

export interface AuthDeps {
  users: UserStore;
  sessions: SessionStore;
  authCodes: AuthCodeStore;
  google?: GoogleVerifier;
}

/** Spend real hashing work even when the account does not exist. */
const DUMMY_HASH_PROMISE = hashPassword("sokoto-cover-timing-equaliser");

function dummyHash(): Promise<string> {
  return DUMMY_HASH_PROMISE;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Brute-force guard, keyed by client address and attempted account together:
 * keying only by address would let one attacker lock out everyone behind a
 * shared NAT, and keying only by account enables denial of service against a
 * known email.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/** Exported for tests, which share this module-level table. */
export function resetAuthRateLimit(): void {
  attempts.clear();
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Fails with a machine-readable `code` alongside a human `error`. */
function fail(res: Response, status: number, code: string, error: string): void {
  res.status(status).json({ error, code });
}

export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router();
  const { users, sessions, authCodes } = deps;
  const google = deps.google ?? createGoogleVerifier();

  function sessionCookieFor(res: Response, sessionId: string, remember: boolean): boolean {
    const cookie = sessionSetCookie(config.sessionCookieName, sessionId, {
      maxAgeSeconds: remember ? REMEMBERED_SESSION_SECONDS : undefined,
      secure: config.secureCookies
    });
    if (!cookie) return false;
    res.setHeader("Set-Cookie", cookie);
    return true;
  }

  /** Issues the session cookie, or fails loudly rather than silently. */
  async function signIn(res: Response, userId: string, role: Role, remember: boolean): Promise<boolean> {
    const session = await sessions.create(
      userId,
      role,
      remember ? REMEMBERED_SESSION_SECONDS : DEFAULT_SESSION_SECONDS
    );
    if (!sessionCookieFor(res, session.id, remember)) {
      fail(res, 500, "server_error", "Could not issue a session");
      return false;
    }
    return true;
  }

  /** Never let a browser or proxy keep an auth response around. */
  function noStore(res: Response): void {
    res.setHeader("Cache-Control", "no-store");
  }

  router.get("/session", (req, res) => {
    noStore(res);
    // Already a PublicUser — the middleware stripped the hash.
    res.json({ user: req.principal ? req.principal.user : null });
  });

  router.post("/login", async (req, res) => {
    noStore(res);
    const email = normaliseEmail(text(req.body?.email));
    const password = text(req.body?.password);
    const remember = req.body?.remember === true;
    if (!email || !password) {
      fail(res, 400, "invalid_input", "Email and password are required");
      return;
    }
    if (rateLimited(`${req.ip}|${email}`)) {
      fail(res, 429, "rate_limited", "Too many sign-in attempts. Try again in a few minutes.");
      return;
    }

    const record = await users.findByEmail(email);
    // Always hash: otherwise a fast rejection on an unknown email is a timing
    // signal that the account does not exist.
    const stored = record?.passwordHash ?? (await dummyHash());
    const ok = await verifyPassword(password, stored);
    if (!record || !ok || !record.passwordHash) {
      // One message for both failures, so this cannot be used to test whether
      // an address is registered.
      fail(res, 401, "invalid_credentials", "That email and password do not match an account");
      return;
    }
    // Cost parameters may have been raised since this hash was made; the
    // plaintext is in hand for exactly this moment.
    await users.upgradePasswordHash(record.id, password);

    const updated = await users.update(record.id, { lastSignInAt: new Date().toISOString() });
    if (!(await signIn(res, record.id, (updated ?? record).role, remember))) return;
    res.json({ user: toPublicUser(updated ?? record) });
  });

  router.post("/register", async (req, res) => {
    noStore(res);
    const name = text(req.body?.name);
    const email = normaliseEmail(text(req.body?.email));
    const phone = text(req.body?.phone);
    const lga = text(req.body?.lga);
    const password = text(req.body?.password);
    const remember = req.body?.remember !== false;

    if (!name || !email || !password) {
      fail(res, 400, "invalid_input", "Name, email and password are required");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      fail(res, 400, "invalid_email", "That does not look like an email address");
      return;
    }
    if (password.length < config.minPasswordLength) {
      fail(res, 400, "weak_password", `Password must be at least ${config.minPasswordLength} characters`);
      return;
    }
    if (rateLimited(`${req.ip}|register`)) {
      fail(res, 429, "rate_limited", "Too many attempts. Try again later.");
      return;
    }

    // Verified here rather than by a separate frontend call: checking in the
    // browser and then trusting the client's "I passed" is not a check at all.
    if (config.turnstileSecretKey) {
      const token = text(req.body?.turnstileToken);
      if (!token) {
        fail(res, 400, "captcha_required", "Security check is required");
        return;
      }
      try {
        const result = await verifyTurnstileToken(token, config.turnstileSecretKey, req.ip);
        if (!result.success) {
          fail(res, 400, "captcha_failed", "Security check failed. Try again.");
          return;
        }
      } catch {
        fail(res, 502, "captcha_unavailable", "Could not complete the security check");
        return;
      }
    }

    if (await users.findByEmail(email)) {
      // Revealing that an email is taken is unavoidable if the form is to be
      // useful, and sign-up is not a secret operation the way sign-in is.
      fail(res, 409, "email_taken", "An account with that email already exists");
      return;
    }

    let created;
    try {
      created = await users.create(
        {
          role: "farmer",
          name,
          email,
          phone,
          lga,
          wallet: randomWallet(),
          provider: "password",
          emailVerified: false
        } satisfies NewUser,
        password
      );
    } catch (err) {
      fail(res, 409, "email_taken", err instanceof Error ? err.message : "Could not create the account");
      return;
    }

    const code = await authCodes.createVerificationCode(created.id);
    if (!(await signIn(res, created.id, created.role, remember))) return;
    res.status(201).json({
      user: toPublicUser(created),
      // Only when explicitly enabled: without a mail service this is how the
      // demo shows the code, and it must be off for anything real.
      ...(config.demoAuthCodes ? { demoCode: code } : {})
    });
  });

  router.post("/google", async (req, res) => {
    noStore(res);
    if (!config.googleClientId) {
      fail(res, 503, "not_configured", "Google sign-in is not configured on the server");
      return;
    }
    const credential = text(req.body?.credential);
    if (!credential) {
      fail(res, 400, "invalid_input", "Missing Google credential");
      return;
    }
    if (rateLimited(`${req.ip}|google`)) {
      fail(res, 429, "rate_limited", "Too many attempts. Try again later.");
      return;
    }

    let identity;
    try {
      identity = await google.verify(credential, config.googleClientId);
    } catch (err) {
      // The reason is useful in the log and useless — and slightly helpful to
      // an attacker — in the response.
      console.warn("[auth] rejected a Google ID token:", err instanceof Error ? err.message : err);
      fail(res, 401, "token_rejected", "That Google sign-in could not be verified");
      return;
    }

    const existing = await users.findByEmail(identity.email);
    let record = existing;
    if (!record) {
      try {
        record = await users.create(
          {
            // Derived from Google's subject id, so a second sign-in finds the
            // same account instead of creating a duplicate.
            id: `farmer-${identity.sub.slice(-10)}`,
            role: "farmer",
            name: identity.name,
            email: identity.email,
            wallet: randomWallet(),
            provider: "google",
            emailVerified: identity.emailVerified,
            avatarUrl: identity.picture
          } satisfies NewUser
        );
      } catch (err) {
        fail(res, 500, "server_error", err instanceof Error ? err.message : "Could not create the account");
        return;
      }
    }

    const updated = await users.update(record.id, { lastSignInAt: new Date().toISOString() });
    if (!(await signIn(res, record.id, (updated ?? record).role, true))) return;
    res.json({ user: toPublicUser(updated ?? record) });
  });

  router.post("/verify-email", requireAuth, async (req, res) => {
    noStore(res);
    const principal = req.principal!;
    const code = text(req.body?.code);
    if (!code) {
      fail(res, 400, "invalid_input", "Enter the code from your email");
      return;
    }
    if (!(await authCodes.checkVerificationCode(principal.user.id, code))) {
      fail(res, 400, "code_invalid", "That code is not valid or has expired");
      return;
    }
    const updated = await users.update(principal.user.id, { emailVerified: true });
    res.json({ user: toPublicUser(updated ?? principal.user) });
  });

  router.post("/resend-verification", requireAuth, async (req, res) => {
    noStore(res);
    if (req.principal!.user.emailVerified) {
      fail(res, 400, "already_verified", "That email is already verified");
      return;
    }
    const code = await authCodes.createVerificationCode(req.principal!.user.id);
    // With no mail service the code goes to the server log for the operator.
    console.log(`[auth] verification code for ${req.principal!.user.email}: ${code}`);
    res.json(config.demoAuthCodes ? { demoCode: code } : {});
  });

  router.post("/reset/request", async (req, res) => {
    noStore(res);
    const email = normaliseEmail(text(req.body?.email));
    if (!email) {
      fail(res, 400, "invalid_input", "Enter your email address");
      return;
    }
    if (rateLimited(`${req.ip}|reset`)) {
      fail(res, 429, "rate_limited", "Too many requests. Try again later.");
      return;
    }
    const record = await users.findByEmail(email);
    // Both addresses answer 200, so with disclosure off this is not an
    // account-existence oracle. Enabling AUTH_DEMO_CODES *does* make the two
    // responses differ — a token can only be minted for an account that
    // exists — which is the whole reason that flag must stay off for anything
    // a real user touches.
    if (!record) {
      res.json({});
      return;
    }
    const token = await authCodes.createResetToken(email);
    console.log(`[auth] password reset token for ${email}: ${token}`);
    res.json(config.demoAuthCodes ? { demoToken: token } : {});
  });

  router.post("/reset/confirm", async (req, res) => {
    noStore(res);
    const token = text(req.body?.token);
    const password = text(req.body?.password);
    if (!token || !password) {
      fail(res, 400, "invalid_input", "Token and new password are required");
      return;
    }
    if (password.length < config.minPasswordLength) {
      fail(res, 400, "weak_password", `Password must be at least ${config.minPasswordLength} characters`);
      return;
    }
    const entry = await authCodes.readResetToken(token);
    const record = entry ? await users.findByEmail(entry.email) : undefined;
    if (!entry || !record) {
      fail(res, 400, "token_invalid", "That reset link is not valid or has expired");
      return;
    }
    // Consumed before the write, so the same token cannot be replayed even if
    // the update below fails.
    await authCodes.consumeResetToken(token);
    await users.replacePassword(record.id, password);
    // Every other device was signed in with the old password.
    await sessions.revokeAllForUser(record.id);
    res.status(204).end();
  });

  router.post("/password", requireAuth, async (req, res) => {
    noStore(res);
    const principal = req.principal!;
    const current = text(req.body?.current);
    const next = text(req.body?.next);
    if (!next || next.length < config.minPasswordLength) {
      fail(res, 400, "weak_password", `Password must be at least ${config.minPasswordLength} characters`);
      return;
    }
    if (!(await users.changePassword(principal.user.id, current, next))) {
      fail(res, 400, "current_password", "That is not your current password");
      return;
    }
    // Changing a password is the standard moment to end every other session —
    // it is what someone does when they think an account is compromised.
    await sessions.revokeAllForUser(principal.user.id);
    // ...but keep this one alive, since the user is clearly still here.
    const session = await sessions.create(principal.user.id, principal.user.role, REMEMBERED_SESSION_SECONDS);
    const cookie = sessionSetCookie(config.sessionCookieName, session.id, {
      maxAgeSeconds: REMEMBERED_SESSION_SECONDS,
      secure: config.secureCookies
    });
    if (cookie) res.setHeader("Set-Cookie", cookie);
    res.status(204).end();
  });

  router.patch("/profile", requireAuth, async (req, res) => {
    noStore(res);
    const principal = req.principal!;
    const patch = (req.body ?? {}) as Record<string, unknown>;
    // Whitelist: a profile edit must not be able to set `role`, `id` or
    // `passwordHash` — those are exactly the fields F-1 was about. The store
    // refuses them too, so this is belt as well as braces.
    const allowed = [
      "name",
      "phone",
      "lga",
      "bio",
      "farmSizeHa",
      "primaryCrop",
      "village",
      "title",
      "twoFactor"
    ] as const;
    const safe: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in patch) safe[key] = patch[key];
    }
    const updated = await users.update(principal.user.id, safe);
    res.json({ user: toPublicUser(updated ?? principal.user) });
  });

  router.delete("/account", requireAuth, async (req, res) => {
    noStore(res);
    const principal = req.principal!;
    await sessions.revokeAllForUser(principal.user.id);
    await users.remove(principal.user.id);
    res.setHeader("Set-Cookie", sessionClearCookie(config.sessionCookieName, config.secureCookies));
    res.status(204).end();
  });

  router.post("/logout", async (req, res) => {
    noStore(res);
    // Revoke server-side too. Clearing the cookie alone leaves a stolen id
    // working until it expires.
    if (req.principal) await sessions.revoke(req.principal.session.id);
    res.setHeader("Set-Cookie", sessionClearCookie(config.sessionCookieName, config.secureCookies));
    res.status(204).end();
  });

  return router;
}

/** A fresh 40-char hex address, matching the shape the UI expects. */
function randomWallet(): string {
  let out = "0x";
  for (let i = 0; i < 40; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}
