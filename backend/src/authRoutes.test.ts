import './authTestEnv.js';
import { TEST_TMP_DIR } from './authTestEnv.js';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import express from 'express';
import { authCodeStore, sessionStore, userStore } from './authServices.js';
import { attachSession, requireAuth, requireRole, type SessionPrincipal } from './middleware/auth.js';
import { createAuthRouter, resetAuthRateLimit } from './routes/auth.js';
import { demoAccounts } from './utils/demoAccounts.js';
import type { GoogleVerifier } from './utils/googleAuth.js';
import { config } from './config.js';

/**
 * End-to-end tests for the auth that replaced the localStorage one (F-1).
 *
 * These run a real Express app and a real cookie jar over HTTP, because the
 * properties under test are exactly the ones a unit test would stub away: what
 * the `Set-Cookie` header actually says, whether the session survives a
 * request, whether an identity taken from the body is believed, and whether a
 * role escalation attempt changes anything.
 *
 * Google is the one thing stubbed — `verify` is injected so no request ever
 * reaches Google — and the stub is *stricter* than the real verifier: it
 * accepts one literal token and rejects everything else.
 */
const ACCEPTED_GOOGLE_TOKEN = 'fixture-google-id-token';

const fakeGoogle: GoogleVerifier = {
  async verify(token, audience) {
    // Binds the audience the same way the real one does, so a mismatch between
    // the configured client id and what the handler passes would show up here.
    if (audience !== config.googleClientId) throw new Error(`unexpected audience: ${audience}`);
    if (token !== ACCEPTED_GOOGLE_TOKEN) throw new Error('signature does not verify');
    return {
      sub: '118273645543210987654',
      email: 'zainab.ibrahim@gmail.com',
      name: 'Zainab Ibrahim',
      emailVerified: true
    };
  }
};

const app = express();
app.use(express.json());
app.use(attachSession({ sessions: sessionStore, users: userStore, cookieName: config.sessionCookieName }));
app.use(
  '/auth',
  createAuthRouter({ users: userStore, sessions: sessionStore, authCodes: authCodeStore, google: fakeGoogle })
);

let baseUrl = '';
let server: import('node:http').Server;

before(async () => {
  await userStore.ensureSeeded(demoAccounts);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(TEST_TMP_DIR, { recursive: true, force: true });
});

/** The shared login rate limiter lives on the module, so tests clear it out. */
beforeEach(() => resetAuthRateLimit());

/** A browser, as far as the server is concerned: one cookie jar. */
class Client {
  private cookie: string | undefined;

  async call(path: string, opts: { method?: string; body?: unknown } = {}): Promise<Response> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.cookie ? { cookie: this.cookie } : {})
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });
    this.absorb(res);
    return res;
  }

  /** A subsequent request from the same browser. */
  private absorb(res: Response): void {
    for (const raw of res.headers.getSetCookie()) {
      // Only the first name=value pair matters; attributes follow it.
      const [pair = ''] = raw.split(';');
      const idx = pair.indexOf('=');
      if (idx < 0) continue;
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      // `Max-Age=0` is the clear; anything else is a fresh session id.
      this.cookie = value ? `${name}=${value}` : undefined;
    }
  }

  /** A copy that starts with this cookie but does not share the jar. */
  clone(): Client {
    const next = new Client();
    next.cookie = this.cookie;
    return next;
  }
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

function registerForm(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Test Farmer',
    email: `farmer-${Math.random().toString(36).slice(2, 10)}@mail.ng`,
    phone: '+234 800 000 0000',
    lga: 'Wamakko',
    password: 'Farmer#2023',
    ...overrides
  };
}

describe('sessions are issued as httpOnly cookies', () => {
  it('signs up, carries the cookie, and never exposes a password hash', async () => {
    const browser = new Client();
    // Built once: calling registerForm() again would mint a different address.
    const form = registerForm();
    const res = await browser.call('/auth/register', { method: 'POST', body: form });
    assert.equal(res.status, 201);

    const setCookie = res.headers.getSetCookie()[0] ?? '';
    assert.match(setCookie, /^test_session=[0-9a-f]{64}/, 'a random 256-bit id');
    assert.ok(setCookie.includes('HttpOnly'), 'page JavaScript must not be able to read the session');
    assert.ok(setCookie.includes('SameSite=Lax'), 'cross-site POSTs are the CSRF vector');
    assert.ok(setCookie.includes('Path=/'));
    assert.ok(!setCookie.includes('Secure'), 'plain-http development cannot carry Secure');

    const body = await json(res);
    assert.ok(!JSON.stringify(body).includes('passwordHash'), 'the hash must never reach the client');
    assert.equal(JSON.stringify(body).includes('Farmer#2023'), false, 'nor the password');

    const session = await json(await browser.call('/auth/session'));
    assert.equal((session.user as { email: string }).email, form.email);
  });

  it('answers anonymous when no cookie is presented', async () => {
    const res = await new Client().call('/auth/session');
    assert.equal(res.status, 200);
    assert.deepEqual(await json(res), { user: null });
  });

  it('ignores a forged cookie rather than trusting it', async () => {
    for (const forged of ['a'.repeat(64), 'not-a-session-id', '../../etc/passwd']) {
      const browser = new Client();
      const res = await fetch(`${baseUrl}/auth/session`, { headers: { cookie: `test_session=${forged}` } });
      assert.deepEqual(await json(res), { user: null }, `${JSON.stringify(forged)} must not resolve`);
    }
  });

  it('signs in with a seeded password and returns the right role', async () => {
    const browser = new Client();
    const res = await browser.call('/auth/login', {
      method: 'POST',
      body: { email: 'fatima.abdullahi@mail.ng', password: 'Agent#2023', remember: true }
    });
    assert.equal(res.status, 200);
    const body = await json(res);
    assert.equal((body.user as { role: string }).role, 'agent');
    assert.equal((body.user as { id: string }).id, 'agent-1');
    assert.equal(res.headers.getSetCookie()[0]?.includes('Max-Age'), true, 'remembered sessions get an expiry');
  });

  it('treats a wrong password and an unknown address as the same failure', async () => {
    const wrongPassword = await new Client().call('/auth/login', {
      method: 'POST',
      body: { email: 'fatima.abdullahi@mail.ng', password: 'not-the-password' }
    });
    const unknownAddress = await new Client().call('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@mail.ng', password: 'whatever-it-is' }
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownAddress.status, 401);
    // Each body read once — a Response can only be consumed a single time.
    const wrongBody = await json(wrongPassword);
    const unknownBody = await json(unknownAddress);
    assert.equal(wrongBody.code, 'invalid_credentials');
    assert.equal(
      wrongBody.error,
      unknownBody.error,
      'a distinguishable message would confirm which addresses are registered'
    );
  });

  it('rejects a sign-in with no fields', async () => {
    const res = await new Client().call('/auth/login', { method: 'POST', body: {} });
    assert.equal(res.status, 400);
    assert.equal((await json(res)).code, 'invalid_input');
  });

  it('signs out server-side, so the id stops working even if it is replayed', async () => {
    const browser = new Client();
    assert.equal(
      (await browser.call('/auth/login', {
        method: 'POST',
        body: { email: 'amina.bello@mail.ng', password: 'Farmer#2023' }
      })).status,
      200
    );
    // A second copy of the same browser, to prove revocation rather than the
    // cookie merely being cleared in one place.
    const thief = browser.clone();
    assert.equal(((await json(await thief.call('/auth/session'))).user as { id: string }).id, 'farmer-1');

    const out = await browser.call('/auth/logout', { method: 'POST' });
    assert.equal(out.status, 204);
    assert.match(out.headers.getSetCookie()[0] ?? '', /test_session=;/, 'the cookie is cleared');

    assert.deepEqual(await json(await thief.call('/auth/session')), { user: null });
  });

  it('rate-limits repeated failures on one account', async () => {
    const email = `rate-${Date.now()}@mail.ng`;
    await userStore.create(
      { role: 'farmer', name: 'Rate Limited', email, wallet: '0xabc', provider: 'password' },
      'Farmer#2023'
    );
    const browser = new Client();
    let sawLimit = false;
    for (let attempt = 0; attempt < 12 && !sawLimit; attempt++) {
      const res = await browser.call('/auth/login', {
        method: 'POST',
        body: { email, password: 'definitely-wrong' }
      });
      if (res.status === 429) {
        assert.equal((await json(res)).code, 'rate_limited');
        sawLimit = true;
      } else {
        assert.equal(res.status, 401);
      }
    }
    assert.ok(sawLimit, 'the gate must close before a 6-digit-scale search becomes viable');
  });
});

describe('email verification and password reset live on the server', () => {
  it('verifies with the code the server issued, exactly once', async () => {
    const browser = new Client();
    const registered = await browser.call('/auth/register', { method: 'POST', body: registerForm() });
    const { demoCode } = await json(registered);
    assert.equal(typeof demoCode, 'string', 'AUTH_DEMO_CODES is on for this suite');

    const verified = await browser.call('/auth/verify-email', { method: 'POST', body: { code: demoCode } });
    assert.equal(verified.status, 200);
    const verifiedBody = await json(verified);
    assert.equal((verifiedBody.user as { emailVerified: boolean }).emailVerified, true);

    const replay = await browser.call('/auth/verify-email', { method: 'POST', body: { code: demoCode } });
    assert.equal(replay.status, 400, 'a code is single-use');
    assert.equal((await json(replay)).code, 'code_invalid');
  });

  it('resets a password, and signing out every other session on the way', async () => {
    const oldSession = new Client();
    assert.equal(
      (await oldSession.call('/auth/login', {
        method: 'POST',
        body: { email: 'musa.abubakar@mail.ng', password: 'Farmer#2023' }
      })).status,
      200
    );

    const requester = new Client();
    const requested = await requester.call('/auth/reset/request', {
      method: 'POST',
      body: { email: 'MUSA.abubakar@mail.ng' }
    });
    assert.equal(requested.status, 200);
    const { demoToken } = await json(requested);
    assert.equal(typeof demoToken, 'string');

    const confirmed = await requester.call('/auth/reset/confirm', {
      method: 'POST',
      body: { token: demoToken, password: 'BrandNew#2026' }
    });
    assert.equal(confirmed.status, 204);

    // The token is spent.
    const replay = await requester.call('/auth/reset/confirm', {
      method: 'POST',
      body: { token: demoToken, password: 'AnotherOne#2026' }
    });
    assert.equal(replay.status, 400);
    assert.equal((await json(replay)).code, 'token_invalid');

    // The session that was open under the old password no longer works.
    assert.deepEqual(await json(await oldSession.call('/auth/session')), { user: null });

    // And the new password is what signs in now.
    const resigned = await new Client().call('/auth/login', {
      method: 'POST',
      body: { email: 'musa.abubakar@mail.ng', password: 'BrandNew#2026' }
    });
    assert.equal(resigned.status, 200);
    const stillOld = await new Client().call('/auth/login', {
      method: 'POST',
      body: { email: 'musa.abubakar@mail.ng', password: 'Farmer#2023' }
    });
    assert.equal(stillOld.status, 401, 'the superseded password is gone');
  });

  it('answers a known address with a token and an unknown one with nothing', async () => {
    // This is the account-existence oracle F-1 warned about, made visible on
    // purpose: with AUTH_DEMO_CODES on — as it is for this suite and for the
    // demo — the two responses differ, because a token can only be minted for
    // an account that exists. With the flag off, which is what any real
    // deployment must use, both addresses answer `200 {}` and the distinction
    // disappears entirely. That difference is why the flag is not a default.
    const known = await new Client().call('/auth/reset/request', {
      method: 'POST',
      body: { email: 'amina.bello@mail.ng' }
    });
    const unknown = await new Client().call('/auth/reset/request', {
      method: 'POST',
      body: { email: 'never-registered@mail.ng' }
    });
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.equal(typeof (await json(known)).demoToken, 'string');
    assert.deepEqual(await json(unknown), {}, 'no token, because there is no such account');
  });

  it('requires a current password to change one while signed in', async () => {
    const browser = new Client();
    await browser.call('/auth/login', {
      method: 'POST',
      body: { email: 'hauwa.garba@mail.ng', password: 'Farmer#2023' }
    });

    const wrong = await browser.call('/auth/password', {
      method: 'POST',
      body: { current: 'not-it', next: 'Whatever#2026' }
    });
    assert.equal(wrong.status, 400);
    assert.equal((await json(wrong)).code, 'current_password');

    const right = await browser.call('/auth/password', {
      method: 'POST',
      body: { current: 'Farmer#2023', next: 'Whatever#2026' }
    });
    assert.equal(right.status, 204);
  });
});

describe('a profile edit cannot change who an account is', () => {
  it('ignores a role escalation attempt', async () => {
    const browser = new Client();
    const registered = await browser.call('/auth/register', { method: 'POST', body: registerForm() });
    const before = (await json(registered)).user as { id: string; role: string };
    assert.equal(before.role, 'farmer');

    const escalated = await browser.call('/auth/profile', {
      method: 'PATCH',
      body: { role: 'admin', id: 'admin-1', title: 'Programme administrator' }
    });
    assert.equal(escalated.status, 200);
    const after = (await json(escalated)).user as { id: string; role: string; title: string };
    assert.equal(after.role, 'farmer', 'the role must be unchanged');
    assert.equal(after.id, before.id, 'so must the id');
    assert.equal(after.title, 'Programme administrator', 'ordinary profile fields still go through');

    // And it is really unchanged on disk, not merely in the response.
    const reloaded = await userStore.findById(before.id);
    assert.equal(reloaded?.role, 'farmer');
  });

  it('ignores an attempt to swap the email for someone else’s', async () => {
    const browser = new Client();
    const registered = await browser.call('/auth/register', { method: 'POST', body: registerForm() });
    const me = (await json(registered)).user as { id: string; email: string };

    const res = await browser.call('/auth/profile', { method: 'PATCH', body: { email: 'admin@sokotocover.ng' } });
    assert.equal(res.status, 200);
    assert.equal(((await json(res)).user as { email: string }).email, me.email);
    assert.equal((await userStore.findById(me.id))?.email, me.email);
  });

  it('requires a session at all', async () => {
    const res = await new Client().call('/auth/profile', { method: 'PATCH', body: { name: 'No One' } });
    assert.equal(res.status, 401);
  });
});

describe('Google sign-in is verified rather than decoded', () => {
  it('accepts a token the verifier vouches for', async () => {
    const browser = new Client();
    const res = await browser.call('/auth/google', {
      method: 'POST',
      body: { credential: ACCEPTED_GOOGLE_TOKEN }
    });
    assert.equal(res.status, 200);
    const first = (await json(res)).user as { id: string; email: string; provider: string; emailVerified: boolean };
    assert.equal(first.email, 'zainab.ibrahim@gmail.com');
    assert.equal(first.provider, 'google');
    assert.equal(first.emailVerified, true);

    // A second sign-in finds the same account rather than minting a duplicate,
    // because the id is derived from Google's subject rather than generated.
    const again = await new Client().call('/auth/google', {
      method: 'POST',
      body: { credential: ACCEPTED_GOOGLE_TOKEN }
    });
    assert.equal(again.status, 200);
    assert.equal(((await json(again)).user as { id: string }).id, first.id);
  });

  it('rejects anything the verifier will not vouch for', async () => {
    for (const credential of ['', 'made-up', 'a.b.c']) {
      const res = await new Client().call('/auth/google', { method: 'POST', body: { credential } });
      if (credential === '') {
        assert.equal(res.status, 400);
        assert.equal((await json(res)).code, 'invalid_input');
      } else {
        assert.equal(res.status, 401, `${credential} must not be accepted`);
        assert.equal((await json(res)).code, 'token_rejected');
      }
    }
  });

  it('does not create an account for a rejected token', async () => {
    const before = (await userStore.list()).length;
    await new Client().call('/auth/google', { method: 'POST', body: { credential: 'forged' } });
    assert.equal((await userStore.list()).length, before);
  });
});

describe('authorization middleware', () => {
  function fake() {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      }
    };
    let passed = false;
    return {
      res,
      next: () => (passed = true),
      get passed() {
        return passed;
      }
    };
  }

  const principal = (role: 'farmer' | 'agent' | 'admin'): SessionPrincipal => ({
    user: { id: `${role}-1`, role, name: 'Test', email: 't@mail.ng', wallet: '0x1', joinedAt: '2026-01-01', provider: 'password', emailVerified: true },
    session: { id: 'f'.repeat(64), userId: `${role}-1`, role, createdAt: '', expiresAt: '', lastSeenAt: '' }
  });

  it('401s when there is no session', () => {
    const bare = fake();
    requireAuth({} as never, bare.res as never, bare.next as never);
    assert.equal(bare.passed, false);
    assert.equal(bare.res.statusCode, 401);
  });

  it('401s under requireRole too, rather than falling through to 403', () => {
    const bare = fake();
    requireRole('agent')({} as never, bare.res as never, bare.next as never);
    assert.equal(bare.res.statusCode, 401);
  });

  it('403s an agent for an admin-only route', () => {
    const run = fake();
    requireRole('admin')({ principal: principal('agent') } as never, run.res as never, run.next as never);
    assert.equal(run.passed, false);
    assert.equal(run.res.statusCode, 403);
  });

  it('lets a matching role through', () => {
    const run = fake();
    requireRole('agent', 'admin')({ principal: principal('agent') } as never, run.res as never, run.next as never);
    assert.equal(run.passed, true);
    assert.equal(run.res.statusCode, 0, 'nothing was written to the response');
  });

  it('takes the role from the session, not the request', () => {
    // The session says farmer; anything in the body is irrelevant because the
    // middleware never looks at it.
    const run = fake();
    requireRole('admin')(
      { principal: principal('farmer'), body: { role: 'admin' } } as never,
      run.res as never,
      run.next as never
    );
    assert.equal(run.res.statusCode, 403);
  });
});
