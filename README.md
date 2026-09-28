# Weather-Index Insurance — Oracle Aggregation Capstone

Reputation-weighted oracle aggregation for a blockchain-based weather-indexed
micro-insurance system, prototyped for pearl millet farmers in Sokoto State,
Nigeria. Multiple independent rainfall sources (CHIRPS, NASA POWER, Meteostat)
are combined with weights that reflect each source's historical reliability —
the aggregate drives automatic drought payouts, no claims process required.

## Repository layout

```
├── frontend/        Farmer / admin dapp UI (React 18 + Vite 6 + TypeScript + Tailwind)
├── backend/         API + oracle relayer service (Express + TypeScript)
├── blockchain/      Smart contracts, tests, deployment (Hardhat 3)
├── docs/            Project documentation
│   └── security-audit.md   Full security audit with 14 documented findings
└── package.json     npm workspaces root — one `npm install` for everything
```

Each folder is self-contained with its own `package.json`, `README.md`, and
`.env.example`. See the README inside each for details.

## Quick start

Requires **Node.js ≥ 22.13** (Hardhat 3 needs it). With nvm, run `nvm use` —
the repo's `.nvmrc` selects Node 22.

```bash
npm install              # installs all three workspaces

# Blockchain (contracts + tests)
npm run test:blockchain  # Solidity unit tests + TS integration tests

# Local chain with deployed, seeded contracts (two terminals)
npm run chain            # Hardhat node on http://localhost:8545
npm run seed:local       # deploy + seed, writes frontend/.env and backend/.env

# Backend (API + relayer)
npm run dev:backend      # http://localhost:3001

# Frontend (dapp UI)
npm run dev:frontend     # http://localhost:5173
```

## Common commands (run from the root)

| Command                | What it does                                  |
|------------------------|-----------------------------------------------|
| `npm run build`        | Build every workspace that has a build script (the frontend build typechecks first) |
| `npm run test`         | Run all tests: Solidity + mocha (blockchain), node:test (backend), Vitest (frontend) |
| `npm run typecheck`    | TypeScript checks across workspaces           |
| `npm run lint`         | ESLint (frontend)                             |
| `npm run audit`        | `npm audit` for every workspace               |

## Documentation

- [`docs/security-audit.md`](docs/security-audit.md) — full audit: 0 critical,
  3 high, 5 medium, 6 low findings, plus remediation priorities
- [`docs/frontend-audit.md`](docs/frontend-audit.md) — frontend security and
  quality audit
- [`frontend/README.md`](frontend/README.md) — the dapp UI, demo accounts,
  and what is simulated vs. on-chain
- [`blockchain/README.md`](blockchain/README.md) — contracts, why reputation
  weighting, deploying to Sepolia
