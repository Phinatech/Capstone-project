# Frontend — Farmer & Admin Dapp UI

React 18 + Vite 6 + TypeScript + Tailwind CSS. Two role-based areas:

- **Farmer** (`/farmer`): dashboard, buy cover, policies, payouts.
- **Admin** (`/admin`): overview, policies, farmers, oracle sources, analytics,
  backtest, data model.

## Status: simulated, not yet connected to the chain

The UI is complete, but it does not yet talk to the contracts or the backend.
Everything runs in the browser:

- Policies, balances and payouts are React state seeded from `src/data/`.
- The oracle logic in `src/utils/oracle.ts` (reputation scoring, the three
  aggregation modes, corruption injection and the backtest) runs on the
  illustrative rainfall in `src/data/rainfall.ts`, which stands in for pulled
  CHIRPS / NASA POWER / Meteostat data.
- Sign-in is a client-side demo (see `docs/frontend-audit.md` F-1 to F-3),
  and the Cloudflare Turnstile check uses Cloudflare's always-pass test key.
- The `VITE_*` variables in `.env.example` are placeholders for when the app
  reads the deployed contracts; nothing reads them yet.

## Running it

From the repo root (Node ≥ 22.13, one `npm install` at the root):

```bash
npm run dev:frontend   # http://localhost:5173
```

Sign in with a demo account: open **Demo credentials** on the sign-in page, or
see `src/data/demoCredentials.ts` (four farmers and one admin).

## Scripts

Run with `npm run <script> --workspace frontend`, or from the root where noted.

| Script      | What it does                                             |
|-------------|----------------------------------------------------------|
| `dev`       | Vite dev server (root: `npm run dev:frontend`)           |
| `build`     | Typecheck, then production build to `dist/`              |
| `preview`   | Serve the production build                               |
| `typecheck` | `tsc --noEmit`                                           |
| `lint`      | ESLint 9 flat config (`eslint.config.js`)                |
| `test`      | Vitest (root: `npm run test:frontend`)                   |

## Layout

```
src/
  pages/        Route components: farmer/, admin/, auth/, shared pages
  components/   UI building blocks (layout/, oracles/, ui/, auth/, ...)
  contexts/     Auth, policies, notifications, theme, i18n, preferences
  data/         Seed data: policies, rainfall, users, translations (en/ha/fr)
  utils/        oracle.ts (aggregation + backtest) and its tests, formatting
  types/        Shared TypeScript types
```
