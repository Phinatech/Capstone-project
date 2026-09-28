# Frontend Security & Quality Audit

**Date:** 2026-09-25 · **Scope:** `frontend/` (~140 files: React 18 + Vite 5 + TS + Tailwind + react-router 6)
**Method:** manual review of auth/storage/config code, pattern sweeps (`dangerouslySetInnerHTML`, `eval`, storage, secrets, `_blank`), `npm audit`, typecheck + production build verification.

**Summary: 0 critical, 2 high, 3 medium, 4 low findings.**
The big picture: this is a **client-side demo app** — all authentication,
users, and "payouts" live in the browser. That's fine for a capstone demo,
but the auth *looks* real (Google button, Turnstile, password rules), which
is itself a risk. Two genuine high-severity issues: **demo auth pretending to
be production auth** and **the Turnstile CAPTCHA is Cloudflare's always-pass
test key**. Separately, the build ships with **failing typechecks** and the
toolchain has drifted from the template it came from.

| ID | Severity | Title |
|------|----------|-------|
| F-1 | HIGH | Client-side mock auth controls "production" role gating |
| F-2 | HIGH | CAPTCHA is Cloudflare's always-pass test key |
| F-3 | MEDIUM | Passwords "hashed" with FNV-1a (not a password hash) |
| F-4 | MEDIUM | Build passes with failing typechecks (`tsc` not in build) |
| F-5 | MEDIUM | 4 dependency advisories (1 high: Vite path traversal, dev-only) |
| F-6 | LOW | Swapping in a real Turnstile key will hard-lock every user out |
| F-7 | LOW | Template leftovers: wrong favicon, stale names, dead nested package.json |
| F-8 | LOW | Lint script has no ESLint config; no test script |
| F-9 | LOW | Root docs describe a different frontend than the one on disk |

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

### F-5 — 4 dependency advisories (1 high, dev-only)

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

### F-9 — Root docs describe a different frontend than the one on disk

Root `README.md`/`CLAUDE.md` say "React 19 + Vite 7"; the actual app is
React 18 + Vite 5 (and uses Emotion, Tailwind, react-router, recharts — none
documented). Misleading docs cause wrong assumptions in reviews and upgrades.

**Recommendation:** update root docs to match reality (React 18, Vite 5,
Tailwind, react-router 6) and note the demo-auth nature of the app.

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
5. **F-1 for real** (when auth becomes real): server-side sessions, backend
   endpoints in `backend/`, delete demo credentials from the bundle.
