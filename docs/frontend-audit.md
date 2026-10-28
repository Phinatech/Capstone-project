# Frontend Security & Quality Audit

**Date:** 2026-09-25 · **Scope:** `frontend/` (~140 files: React 18 + Vite 5 + TS + Tailwind + react-router 6)
**Method:** manual review of auth/storage/config code, pattern sweeps (`dangerouslySetInnerHTML`, `eval`, storage, secrets, `_blank`), `npm audit`, typecheck + production build verification.

**Summary: 0 critical, 2 high, 4 medium, 4 low findings. 7 resolved, 2 partly
resolved, 1 reopened — each finding carries its own dated status below.**

The big picture when this was written: a **client-side demo app** — all
authentication, users, and "payouts" lived in the browser. The auth *looked*
real (Google button, Turnstile, password rules), which is itself a risk. Two
genuine high-severity issues: **demo auth pretending to be production auth**
and **the Turnstile CAPTCHA being Cloudflare's always-pass test key**.

The headline change since: **F-1 closed on 2026-10-21.** Sessions, passwords,
roles and Google ID-token verification all moved into `backend/`, the demo
credentials left the JS bundle, and the agent ledger took its identity from the
same session (F-10's second half). **F-2 closed on 2026-10-28**: the sign-in,
sign-up and reset forms gate the widget on `TURNSTILE_ENFORCED`, a real key
pair is now deployed on both sides, and the token is verified server-side
against Cloudflare rather than trusted by the client. What remains open is
narrower still — frontend tests for auth and `RequireRole` (F-8), append-only
agent records (F-10's third half), and the reopened dependency count (F-5).

**Second headline — the UI shows no simulated figures on any deployed path**
(2026-10-26/27). The buy forms, threshold tables, rainfall charts, oracle
trust figures, analytics and consensus simulator all read the contract and the
readings it has accepted. The 2023 season table is confined to simulated mode
and to the Backtest/EvaluationRunner pages, which label themselves
illustrative. Window rainfall is totalled the way the aggregator settles it —
reputation-weighted, renormalised over the sources that reported — so the
figure on screen matches the contract's.

**F-5 reopened 2026-10-27.** The advisory count grew from 4 to 29 (17 high).
By workspace: 23 (14 high) sit in the Hardhat toolchain and are dev-only; 5
(2 high) are in the frontend, where vite 6.4.3 has picked up a new advisory —
both have fixes available; and 1 high is `body-parser`, transitive via Express
in the **backend runtime**. That last one is what makes "dev-only" no longer
hold, and why the 2026-09-28 closure was premature.

**Still unproven end-to-end (2026-10-27):** 0 policies, 0 settlements, 0
evaluations on Sepolia. Every finding above is a code or configuration
question; none of them is evidence that a policy can be bought and settled.
That test has not been run.

| ID | Severity | Title | Status |
|------|----------|-------|--------|
| F-1 | HIGH | Client-side mock auth controls "production" role gating | **Resolved 2026-10-21** |
| F-2 | HIGH | CAPTCHA is Cloudflare's always-pass test key | **Resolved 2026-10-28** |
| F-3 | MEDIUM | Passwords "hashed" with FNV-1a (not a password hash) | **Resolved 2026-10-21** |
| F-4 | MEDIUM | Build passes with failing typechecks (`tsc` not in build) | Resolved 2026-09-28 |
| F-5 | MEDIUM | Dependency advisories (4 when written; **29 as of 2026-10-27 — 17 high, 5 in shipped runtime deps**) | **Reopened 2026-10-27** |
| F-10 | MEDIUM | Agent sales ledger is written through an unauthenticated endpoint | Partly resolved |
| F-6 | LOW | Swapping in a real Turnstile key will hard-lock every user out | Resolved 2026-10-10 |
| F-7 | LOW | Template leftovers: wrong favicon, stale names, dead nested package.json | Resolved 2026-09-28 |
| F-8 | LOW | Lint script has no ESLint config; no test script | Partly resolved |
| F-9 | LOW | Root docs describe a different frontend than the one on disk | Resolved 2026-09-28 |

---

## High severity

### F-1 — Client-side mock auth controls "production" role gating

**Location:** `src/utils/users.ts`, `src/contexts/AuthContext.tsx`, `src/utils/authTokens.ts`, `src/data/demoCredentials.ts`, `src/components/layout/RequireRole.tsx`.

Everything security-relevant runs in the browser:

- **Users are localStorage.** `users.ts` merges a hardcoded `data/users.ts`
  list with `localStorage['sokoto-cover-registered-users']` and per-user
  override maps. Anyone can open DevTools and run
  `localStorage.setItem('sokoto-cover-user-overrides', '{"admin-1":{"role":"admin"}}')`
  → full admin UI on next load. `RequireRole` guards routing only; with no
  server there is nothing to bypass *into* — but the moment a real API or
  contract write exists, every one of these "sessions" is attacker-controlled.
- **Hardcoded demo credentials in the bundle** (`demoCredentials.ts`,
  5 accounts incl. admin `Admin#2023`) ship in production JS. Deployed as-is,
  every visitor gets the admin password.
- **Password reset / email verification are a spoofable farce** — reset
  tokens and 6-digit codes are generated and checked in the same localStorage
  (`authTokens.ts`). The "emailed" code is readable via
  `AuthContext.currentVerificationCode()`. Anyone can reset anyone's demo
  password by writing their own token.
- **JWT decode without verification** (`utils/jwt.ts`) — acceptable *only*
  because the flow is mock; the NatSpec comment admits server-side
  verification is assumed. There is no server.

**Recommendation:** treat this as a demo and label it loudly (visible demo
banner), because it is the basis for the whole UX. Before any real user
touches it: move auth to the backend (`backend/` already exists for exactly
this), store httpOnly session cookies server-side, verify Google ID tokens
server-side, delete `demoCredentials.ts` from the production bundle, and keep
`RequireRole` purely as UX (real authorization must live server-side).

**Status (2026-10-21): Resolved.** Every part of that recommendation landed:

- **Users are a server-side store, not localStorage.**
  `backend/src/utils/userStore.ts` keeps accounts in `backend/data/users.json`
  (gitignored), written atomically through a serialised queue.
  `frontend/src/utils/users.ts` is now display only — a directory fetched from
  `GET /api/users/directory` plus pure helpers. It has no write path, cannot
  set a role, and holds no credential. `StoredUser` and its `passwordHash`
  field were deleted from `types/user.ts`.
- **Sessions are opaque 256-bit ids in httpOnly cookies**
  (`backend/src/utils/sessions.ts`, `backend/src/middleware/auth.ts`),
  `SameSite=Lax`, backed by a revocable store with 12-hour / 30-day lifetimes.
  Nothing in JavaScript can read one, write one, or lose one to XSS.
  `login`, `logout`, `register`, `verify-email`, `reset/*` and `password` all
  sit under `/auth/*`, and the identity on every request comes from that
  cookie — never from the request body.
- **`RequireRole` is now routing UX only**, as recommended. It decides which
  page a signed-in user sees; `requireAuth` and `requireRole` on the server
  decide what they may do. Writing `{"role":"admin"}` into DevTools now
  changes a redirect and nothing else.
- **Demo credentials left the bundle.** `data/demoCredentials.ts` is deleted;
  the sign-in panel fetches `GET /api/demo-credentials`, which answers only
  while `AUTH_DEMO_ACCOUNTS=true`. That endpoint also supplies `agent-1`'s
  password — an account the old hardcoded list omitted, which had made the
  agent flow impossible to sign into from a clean browser.
- **Reset tokens and verification codes are server-side**, single-use and
  TTL-bound (`backend/src/utils/authCodes.ts`). The localStorage twin
  `authTokens.ts` is deleted, and `AuthContext.currentVerificationCode()` —
  the function that handed any visitor the "emailed" code — is gone with it.
- **Google ID tokens are verified, not decoded.**
  `backend/src/utils/googleAuth.ts` checks RS256 against Google's JWKS with a
  `kid` lookup and `iss`/`aud`/`exp`/`email_verified` checks. The frontend's
  `utils/jwt.ts` is deleted, and the demo Google path that pushed a
  *fabricated* identity straight into the callback was removed too — the
  button now passes only the opaque token.

Two affordances make the demo usable without weakening a clone of the repo:
`AUTH_DEMO_ACCOUNTS` and `AUTH_DEMO_CODES` both **default to off**, so a fresh
checkout seeds no accounts and serves no credentials. With codes off,
`/auth/reset/request` answers `200 {}` for every address; with them on — as
this demo runs — the response *does* distinguish a registered address, since a
token can only be minted for an account that exists. That trade is exactly why
the flag is not a default.

**Verification.** 23 integration tests in `backend/src/authRoutes.test.ts` run
a real Express app against a real cookie jar over HTTP: a forged cookie
resolves to signed out, a wrong password and an unknown address are byte-identical
failures, a role-escalation PATCH leaves the role unchanged on disk, and
sign-out revokes a session that was copied to a second client. Checked live
against the running backend: `agent-1` signs in (200, `role: agent`), the
session cookie comes back `Path=/; HttpOnly; SameSite=Lax`, `POST
/api/agent/sales` answers 401 with no session and 403 for a farmer, and no
auth or directory response contains `passwordHash`.

**Closes alongside it:** `POST /api/agent/sales` now overwrites `agentId` with
the session's user id (F-10's second half), and `/auth/register` verifies its
Turnstile token server-side (F-2's half).

**Deployment note:** this demo runs on localhost over plain HTTP, so passwords
travel unencrypted to `/auth/*`. A real deployment needs HTTPS in front, which
is what `SECURE_COOKIES` exists to switch on.

### F-2 — CAPTCHA is Cloudflare's always-pass test key

**Location:** `src/data/authConfig.ts` → `TURNSTILE_SITE_KEY = '1x00000000000000000000AA'`,
consumed by `TurnstileWidget.tsx` in sign-in/sign-up.

That key is Cloudflare's documented public **test** key: every challenge
passes automatically, visibly marked as a test widget. So today the "security
check" on account creation and sign-in provides zero protection against bots
— by design of the key, not by accident.

**Recommendation:** for the demo, keep it but display the `auth.googleDemo`-
style "(demo)" hint next to the security check. For production, generate a
real site key (and verify the token server-side at the backend before any
sign-up/sign-in endpoint — a client-side Turnstile check alone is trivially
bypassed).

**Status (2026-10-10, updated 2026-10-21): Partly resolved.** The site key now
comes from `VITE_TURNSTILE_SITE_KEY`; left empty, the demo keeps the test key.
The backend exposes `POST /auth/turnstile/verify`, which checks a token with
Cloudflare's siteverify using `TURNSTILE_SECRET_KEY`, and `useCaptcha` sends it
before sign-in and password reset.
**Sign-up no longer trusts the browser for this.** Since F-1 closed, `SignUp`
sends the token in the request body and `/auth/register` verifies it with
Cloudflare itself before creating an account — so the client-side
`captcha.check()` call was dropped from that path. That was necessary as well
as correct: a Turnstile token is accepted only once, and spending it on a
pre-check would leave nothing for the request to verify.

Still open: **sign-in and password reset have no server-side check of their
own.** The CAPTCHA verdict on those is made in the browser and never re-checked
on submission, so with a real key a scripted login attempt would be gated only
by the password and the per-account rate limit.

**Status (2026-10-28): Resolved** — the test key is gone. A real pair is
deployed: `VITE_TURNSTILE_SITE_KEY` on Pages and `TURNSTILE_SECRET_KEY` on
Render. Verified live on 2026-10-28:

- the deployed `authConfig` bakes in `0x4AAAAAAFp2cX1_MDv0TIv_`, so
  `TURNSTILE_ENFORCED` evaluates **true**;
- `POST /auth/register` with no token answers `400 captcha_required`;
- `POST /auth/turnstile/verify` with a forged token answers
  `400 {"errorCodes":["invalid-input-response"]}` — Cloudflare's own verdict,
  not ours;
- `POST /auth/login` is untouched by the gate and still answers
  `401 invalid_credentials`.

`SignIn`, `SignUp` and `ForgotPassword` now render the widget only when
`TURNSTILE_ENFORCED` is true, and demand a token only then. With no key
configured the widget is not rendered, no token is required, and the browser
never fetches Cloudflare's challenge script — so the app no longer displays a
check it is not performing, which was the visible half of this finding.

The residual noted above (login and reset not re-verified server-side) sits
beyond what this finding originally described, and is recorded here rather
than folded into the closure.

## Medium severity

### F-3 — Passwords "hashed" with FNV-1a (not a password hash)

**Location:** `src/utils/users.ts#hashPassword`.

`hashPassword` is a 32-bit FNV-1a of the password, stored in
`localStorage['sokoto-cover-password-overrides']`. This is a checksum, not a
KDF: no salt, no work factor, 4.3 billion outputs, trivially rainbow-tabled.
Even for a demo it teaches the wrong pattern, and the hashes sit next to the
ciphertext-free plaintext demo passwords anyway.

**Recommendation:** demo only — fine if labeled. For anything real: bcrypt/
argon2id on the server, never in the browser. If you want a better demo
fidelity cheaply, use PBKDF2 via `crypto.subtle` with a per-user salt.

**Status (2026-10-21): Resolved.** `hashPassword`, `users.ts`'s per-user
override maps and `localStorage['sokoto-cover-password-overrides']` are all
deleted, along with the `passwordHash` field on the frontend's `User` type.

Passwords are now hashed in the backend with **scrypt** from `node:crypto`
(`backend/src/utils/passwords.ts`) — `scrypt$32768$8$1$salt$hash`, a per-user
salt and an honest work factor, which is the argon2id recommendation one KDF
further down the same road. Comparison uses `timingSafeEqual`, login is
timing-equalised against a dummy verify so a wrong password and an unknown
address cost the same, and a malformed or absurd-cost record fails *closed*
rather than opening the door. Only one path writes credentials — a private
`setPasswordHash` — and `userStore.update()` refuses to touch `id`, `role`,
`email` or `provider` at all.

Nothing password-shaped remains in the browser: the password appears only in
the body of a request to `/auth/*`.

### F-4 — Build passes with failing typechecks (`tsc` not in build)

**Location:** `frontend/package.json` (`"build": "npx vite build"`).

Verified: `npx tsc --noEmit` **fails** — e.g. `src/App.tsx(54,12): error TS2786:
'Routes' cannot be used as a JSX component`, repeated for `Route` and others
(a react-router 6 / `@types/react` JSX.Element typing mismatch). Because
`vite build` doesn't typecheck, `npm run build` succeeds and ships anyway.
There is also no `typecheck` script at all, so the root `npm run typecheck`
silently skips the frontend (`--if-present`).

**Recommendation:** fix the type errors (usually fixed by aligning
`@types/react` with the installed React, or a `react-router-dom` minor bump),
then set `"build": "tsc --noEmit && vite build"` and add `"typecheck":
"tsc --noEmit"` so the root script covers it.

**Status (2026-09-28): Resolved.** The errors came from two copies of
`@types/react` (18 and 19) plus three `BoxIcon`-as-type mistakes and 61 unused
`React` imports; root `overrides` now pin one React 18 (runtime and types).
`build` is `tsc --noEmit && vite build`, and `typecheck` exists.

### F-5 — Dependency advisories (4 when written; 29 as of 2026-10-27)

`npm audit` for this workspace:

| Severity | Package | Issue |
|----------|---------|-------|
| HIGH | `vite` ≤6.4.2 (installed ^5.2.0) | Path traversal in optimized deps `.map` handling; also `launch-editor` NTLMv2 hash disclosure via UNC path (Windows) — **dev server only, does not ship to users** |
| MODERATE | `react-router` 6.0.0–7.17.0 | Open redirect via backslash in `<Link>`/`useNavigate` (CVE-2025-68470 bypass); arbitrary constructor injection via `deserializeErrors()` (SSR — this app is SPA-only, so not applicable) |
| MODERATE | `esbuild` | Dev-server request reading — dev-only |
| MODERATE | `react-router-dom` | via `react-router` |

The vite/esbuild issues matter if a developer runs `npm run dev` on an
untrusted network; the react-router open redirect is the only one reachable
from the deployed app, and its impact here is contained (SPA navigation to
another site — phishing risk at most).

**Recommendation:** `npm audit fix` (non-breaking set), then evaluate react
-router 7 or the patched 6.x line for the open redirect. Vite 5.2.0 → latest
5.x clears the high advisory without the Vite 7 migration.

**Status (2026-09-28): Resolved.** vite 5 → 6.4.3 (clears vite and esbuild)
and react-router-dom 6 → 7.18.4 (no patched 6.x exists). All 17 routes were
re-checked in a headless browser after the upgrade.

**Status (2026-10-27): Reopened.** That closure held for the frontend's own
advisories at the time, but the count has since grown and is no longer
confined to dev tooling. `npm audit` across the workspaces:

| Workspace | Advisories | High | Where |
|---|---|---|---|
| `blockchain/` | 23 | 14 | Hardhat toolchain — dev-only, not shipped |
| `frontend/` | 5 | 2 | vite 6.4.3 (new advisory), `source-map-js` — both `fixAvailable` |
| `backend/` | 1 | 1 | `body-parser`, transitive via Express — **shipped runtime** |

The vite and `source-map-js` entries are build tooling and both have fixes
queued. The one that matters is `body-parser`: it runs inside the deployed
Express service, so the "dev-only" qualifier that justified closing this
finding no longer applies to the whole set.

**Recommendation:** `npm audit fix` per workspace, then pin `body-parser` to a
patched range explicitly — it arrives transitively and will silently re-widen
on the next Express update.

### F-10 — Agent sales ledger is written through an unauthenticated endpoint

**Location:** `src/contexts/AgentSalesContext.tsx` (the frontend's only caller) → `POST /api/agent/sales`, served by `backend/src/routes/api.ts` and `backend/src/utils/agentStore.ts`. The endpoint itself sits in `backend/`, outside this audit's nominal scope, but it is the frontend's data layer for the agent flow.

Agent receipts used to live in `localStorage`, readable only from the browser
that took them. They now go to the backend, so one agent's book reads the same
from any device. That fixed the record's availability; **who may write it is not
addressed anywhere**:

- **Any client can post under any `agentId`.** `POST /api/agent/sales` carries
  no session, token or signature — the only gate is CORS enforcement of
  `CORS_ORIGINS`, which constrains browsers and nothing else. `GET` likewise
  returns whichever agent's book is named in the query string, with nothing
  tying that name to the caller. This is the concrete arrival of F-1's warning:
  roles are still decided entirely in the browser, now with a write path behind
  them.
- **The naira figures are consistent only by courtesy.** `parseSale` validates
  each field independently — `premiumNgn`, `premiumEth` and `ethNgnRate` are
  each checked on their own, so `premiumNgn: 1` alongside `premiumEth: 0.01` at
  a rate of 3,261,222 is accepted. Nothing reconciles a receipt against the
  policy the chain actually recorded, which is the one source the agent cannot
  edit.
- **Receipts are overwritten, not appended.** The upsert keys on `policyId`, so
  re-posting an existing policy silently replaces its payment method, reference,
  amounts and timestamp. A correction leaves no trace of what it corrected.

**Bounded impact.** None of these figures can be spent anywhere, writes are
capped at 120/hour, and `commissionNgn` is recomputed server-side rather than
accepted from the client — but that only stops a client setting the field
directly. Inflating the `premiumNgn` it is derived from inflates the commission
with it: verified, `premiumNgn: 1000000` is accepted (201) and stored as
`commissionNgn: 100000`. So the record is exactly as trustworthy as the
`premiumNgn` posted beside it, and nothing checks that against the chain. These
are, however, precisely the figures a report would quote as evidence of agent
activity — which is the claim this endpoint exists to support.

**Recommendation:** (1) *the cheap half, do now* — have the server verify a
posted sale against data it already reads: `policyId` must exist in
`readPolicies`, `premiumEth`/`payoutEth` must match the values the contract
recorded, and `premiumNgn` must equal `premiumEth × ethNgnRate` within rounding;
(2) *the real half, tracked with F-1* — put these routes behind the server-side
session that finding already calls for, so `agentId` comes from an
authenticated principal instead of the request body; (3) make the ledger
append-only, or retain superseded records, so a corrected receipt does not erase
the original.

**Status (2026-10-21): Partly resolved.** Recommendation (1) now lands. The
route reads the policy a receipt claims and rejects it with **422** when the
contract disagrees: `policyForSale` in `backend/src/routes/api.ts` resolves the
id (re-reading the chain once if the shared cache predates the purchase, so an
honest receipt is never refused for being new), and `verifySaleAgainstPolicy` in
`backend/src/utils/saleVerification.ts` checks `premiumEth`, `payoutEth` and
`thresholdMm` against what the contract recorded, plus that both naira figures
follow from the ETH at the rate the sale quotes. 11 tests cover it in
`backend/src/saleVerification.test.ts`, including the case that motivates it: a
10× `premiumNgn` is caught, and since `commissionNgn` is derived server-side
from `premiumNgn`, that is what closes the inflation path.

Two behaviours are deliberate. A chain read that fails answers **503**, not
**422** — nothing was written, so the client queues the receipt for a later
retry (the `retryable` flag on `AgentSalesContext.record`), because reporting a
real on-chain purchase as failed would be a lie. A receipt that fails
verification is *not* queued: re-posting it unchanged can never succeed, so
`AgentPurchaseForm` shows "receipt rejected" and asks the agent to escalate
rather than leaving the sync banner stuck on a count it can never clear. Neither
outcome writes to the ledger.

**Status (2026-10-21, updated): recommendation (2) lands too.** `GET` and `POST
/api/agent/sales` now sit behind `requireAuth` + `requireRole("agent",
"admin")`, and the route overwrites `agentId` with the session's user id
*before* `parseSale` runs — so the value in the request body is never the one
that decides whose book gets written. `AgentSalesContext` sends no `agentId` at
all any more, and every call carries `credentials: 'include'`: the cookie is
the identity. Verified live — 401 with no session, 403 for a farmer, 200 for
`agent-1`, and requesting another agent's book by query parameter answers 403.

Remainder: (3), append-only records, is untouched — a corrected receipt still
replaces the original in place, leaving no trace of what it corrected — so the
finding stays MEDIUM.

## Low severity

### F-6 — Swapping in a real Turnstile key will hard-lock every user out

**Location:** `TurnstileWidget.tsx` + sign-in/sign-up gating.

The widget result gates form submission, and the `error-callback` is treated
exactly like expiry. With a real key, any Turnstile hiccup (network, region,
ad-blockers, key/domain mismatch) blocks sign-in with a dead end. The current
test key masks this — you'll discover it the day you deploy for real.

**Recommendation:** before switching keys, add a graceful path: retry button
on error (exists for script-load failure, not for challenge failure), and a
documented support fallback.

**Status (2026-10-10): Resolved.** A failed challenge now shows "The security
check hit a problem" with a Retry button that renders a fresh challenge. A
token the backend rejects, or a backend that can't be reached, shows its own
message under the widget instead of a silent dead end.

### F-7 — Template leftovers: wrong favicon, stale names, dead nested package.json

- `index.html` links `/vite.svg`, but `public/` contains only
  `pasted-image.png` → 404 favicon on every page.
- `frontend/package.json` is still named `magic-patterns-vite-template` (the
  workspace root references the folder, so installs work, but it's wrong).
- `frontend/src/package.json` is a second, conflicting manifest from the
  template ("magic-patterns-project") with *different* pinned versions
  (react-router-dom 6.30.2, sonner 1.7.4, recharts 2.15.0...). npm ignores
  it, but it will confuse humans and tooling. Delete it or reconcile.
- `frontend/.env.example` starts with a literal `[TEMPLATE]` line and still
  describes my original scaffold (backend health check) rather than this app.

**Recommendation:** one cleanup pass: real favicon, honest package names,
delete `src/package.json`, rewrite `.env.example`.

**Status (2026-09-28): Resolved.** `public/favicon.svg` (the app's rain-cloud
mark), package renamed `@weather/frontend`, `src/package.json` and the
`[TEMPLATE]` line were already gone, template README replaced.

### F-8 — Lint script has no ESLint config; no test script

`npm run lint` runs `eslint .` but there is no `.eslintrc*`/`eslint.config.*`
anywhere in `frontend/` — ESLint 8 exits with "couldn't find a config" so the
script is dead weight. There is also no `test` script, so the root
`npm run test` skips this workspace entirely. Given the auth logic complexity,
even a few Vitest + React Testing Library tests on `AuthContext`, `users.ts`,
and the route guards would catch real regressions.

**Recommendation:** add a flat eslint config (the deps are already
installed), wire `lint` into CI, add Vitest with tests for auth flows and
`RequireRole`.

**Status (2026-09-28, updated 2026-10-21): Partly resolved.** ESLint 9 +
typescript-eslint 8 flat config (0 errors; 9 `react-refresh` warnings), root
`npm run lint`. Vitest added with 20 tests across `utils/oracle.ts`
(aggregation, reputation, backtest) and `utils/agentSales.test.ts`.

The auth-flow half of this moved to the backend with F-1: that logic is no
longer in the frontend to test, and `backend/src/authRoutes.test.ts` runs 23
integration tests against a real Express app and a real cookie jar — session
issue and revocation, wrong-password/unknown-address equivalence, privilege
escalation, login rate limiting, and the `requireAuth`/`requireRole`
middleware itself.

Still to do: the frontend's own remainder — component tests for `AuthContext`
and `RequireRole`.

### F-9 — Root docs describe a different frontend than the one on disk

Root `README.md`/`CLAUDE.md` say "React 19 + Vite 7"; the actual app is
React 18 + Vite 5 (and uses Emotion, Tailwind, react-router, recharts — none
documented). Misleading docs cause wrong assumptions in reviews and upgrades.

**Recommendation:** update root docs to match reality (React 18, Vite 5,
Tailwind, react-router 6) and note the demo-auth nature of the app.

**Status (2026-09-28): Resolved.** Root README now says React 18 + Vite 6 +
Tailwind; `frontend/README.md` documents the stack and states that auth and
data are simulated.

---

## What was checked and found GOOD

- **No XSS sinks:** zero `dangerouslySetInnerHTML`, `eval`, or `new Function`
  in the codebase.
- **No secrets in the bundle:** the only "keys" are the public Turnstile test
  key and an intentionally empty `GOOGLE_CLIENT_ID`. No API keys, no private
  data committed; `.env` is gitignored at root.
- **`target="_blank"` links carry `rel`** (both instances checked) — no
  reverse-tabnabbing.
- **`RequireRole` redirect guard is sane:** `SignIn` only honors
  `location.state.from` when it `startsWith(homePath(user))` — no cross-role
  redirect trickery, and role checks re-run on every render of the guard.
- **Modal accessibility is genuinely good:** focus trap, Escape handling,
  focus restore, `aria-modal`, labelled title, body scroll lock.
- **90+ aria-label/alt usages**, `aria-live` regions for auth status and
  password strength, decorative icons consistently `aria-hidden`.
- **Code-splitting is real:** every page is `React.lazy` under a `Suspense`
  fallback; recharts (375 kB) is isolated in its own chunk.
- **TypeScript strict mode** is on, with `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`; **zero** `any`/
  `as any` in ~140 files.
- **Concurrent-safe auth callback:** `AuthCallback` guards double-execution
  with a ref and cleans up its timers.

## Priority remediation order

1. **F-4 + F-8** (30 min): make `tsc` part of the build, fix the type errors,
   add the eslint config — this restores basic engineering gates.
2. **F-1 labeling + F-2 hint** (1 hr): demo banner, "(demo)" CAPTCHA hint —
   honest UI before anything ships.
3. **F-5** (1 hr): `npm audit fix`, bump vite 5.x.
4. **F-6/F-7/F-9** (2 hr): cleanup pass before demo day.
5. ~~**F-10 cheap half** (1 hr): check posted sales against the chain
   (`policyId` exists, `premiumEth`/`payoutEth` match `readPolicies`,
   `premiumNgn = premiumEth × ethNgnRate`) — makes the agent ledger trustworthy
   before real auth exists.~~ **Done 2026-10-21**, so the ledger can be trusted
   against a malicious agent; the second half below is what remains.
6. ~~**F-1 for real** (when auth becomes real): server-side sessions, backend
   endpoints in `backend/`, delete demo credentials from the bundle — F-10's
   second half falls out of this.~~ **Done 2026-10-21**: `/auth/*` on the
   backend, scrypt passwords, httpOnly sessions, server-side Google ID-token
   verification, demo credentials out of the bundle, `agentId` taken from the
   session, and `AUTH_DEMO_ACCOUNTS` / `AUTH_DEMO_CODES` defaulting off.
7. **What is left, in order:** server-side Turnstile on sign-in (F-2's
   remainder), auth and `RequireRole` tests in the frontend (F-8), append-only
   agent records so a corrected receipt keeps its original (F-10's third
   half), then chain-read availability for the settlement pipeline.
