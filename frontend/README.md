# Frontend — Farmer & Admin Dapp UI

React 18 + Vite 6 + TypeScript + Tailwind CSS. Two role-based areas:

- **Farmer** (`/farmer`): dashboard, buy cover, policies, payouts.
- **Admin** (`/admin`): overview, policies, farmers, oracle sources, analytics,
  backtest, data model.

## Data: on-chain or simulated

The app picks its data source when it starts:

- **On-chain** when `.env` has `VITE_RPC_URL` and both contract addresses
  (`npm run seed:local` writes them). Policies, coverage windows, oracle
  readings, settlements, wallet balances and the pool balance are read from
  the contracts and refresh on every new block. Buying cover sends
  `buyPolicy`, and the admin's **Settle on-chain** button sends
  `checkAndSettle`. On a local Hardhat chain each demo user signs with a
  fixed test account (admin #0; farmers #1, #5, #6, #7; #2-#4 are the
  oracles); see `src/chain/config.ts`. Other networks are read-only until
  browser-wallet signing (e.g. MetaMask) is added.
- **Simulated** otherwise, or when the node is unreachable or the contracts
  aren't deployed on it (a toast says which and what to run). Policies and
  balances are React state seeded from `src/data/`.

The sidebar shows which mode is active ("Local chain" or "Simulated data").
Either way, the oracle research views (Oracle sources, Backtest, and the
admin's simulation runs with corruption injection) use the illustrative
2023 rainfall in `src/data/rainfall.ts` and never move funds.

Other things that are still simulated in both modes:

- Sign-in is a client-side demo (see `docs/frontend-audit.md` F-1 to F-3),
  and the Cloudflare Turnstile check uses Cloudflare's always-pass test key.
- A policy's location and crop aren't stored on-chain; the buyer's browser
  keeps them, and other browsers fall back to the farmer's profile.

The contract ABIs the app uses are in `src/chain/abi.json`;
`blockchain/test/frontend-abi.ts` fails if they drift from the contracts.

## Running it

From the repo root (Node ≥ 22.13, one `npm install` at the root):

```bash
npm run dev:frontend   # http://localhost:5173
```

For on-chain mode, first start and seed a local chain in two other
terminals (`npm run chain`, then `npm run seed:local`); restart the dev
server after the first seed so it picks up `.env`.

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
  chain/        Contract config, ABIs, local test-account mapping
  contexts/     Auth, policies (ChainPolicyProvider / SimulatedPolicyProvider),
                notifications, theme, i18n, preferences
  data/         Seed data: policies, rainfall, users, translations (en/ha/fr)
  utils/        oracle.ts (aggregation + backtest) and its tests, formatting
  types/        Shared TypeScript types
```
