# Sokoto Rainfall Cover

**Weather-index insurance on Ethereum: automatic drought cover for smallholder farmers in Sokoto State, Nigeria.**

If rainfall during the coverage window falls below the threshold a farmer chooses at purchase, the smart contract pays them **automatically**, with no claim form and no assessor. Rainfall comes from three independent sources (CHIRPS, NASA POWER, Meteostat) aggregated on-chain with **reputation weighting**, so no single source can decide a claim.

**Live:** [sokoto-cover.pages.dev](https://sokoto-cover.pages.dev) · **Chain:** Ethereum Sepolia (`0x8520A0697D018a380a91CB65096AB50F5B65D6D5`)

---

## 1. Overview

| | |
|---|---|
| **What it is** | A full-stack dApp: Solidity contracts, an Express/TypeScript oracle relayer + API, and a React/TypeScript frontend with farmer, field-agent and admin portals |
| **Why it exists** | Conventional crop insurance cannot reach smallholder farmers, because assessing a loss costs more than a claim is worth. Index insurance removes assessment entirely; this project removes the need to *trust the index* by measuring it from three sources on a public chain |
| **What's real** | Live contracts on Sepolia, a live relayer feeding real rainfall data, a real policy bought and **paid out autonomously** during evaluation |

**Key properties**

- **Claims-free settlement**: `checkAndSettle` pushes the payout to the policyholder's wallet when the window's rainfall falls short
- **Multi-source oracle**: three measurement families, reputation-weighted aggregation, and a corrupted source moves the aggregate by **9%** against **59%** under equal weights
- **Three portals**: farmer (buy cover, monitor, payouts), field agent (sell cover, naira receipts verified against the chain), admin (policies, farmers and agents, oracle research)
- **Oracle research tools**: a consensus simulator (corrupt a source and compare strategies) and a backtest over 121 historical dekads
- **292 automated tests** and a documented security audit with regression-pinned fixes

## 2. Walkthrough video

**[Watch the technical walkthrough](REPLACE_WITH_VIDEO_LINK)** *(≈10 min)*: core functionality, backend/frontend interaction, error handling with varied inputs, the two testing strategies, and performance and compatibility notes.

## 3. Technical report

**[Technical report (PDF, 5 pages)](docs/technical-report.pdf)**: scope alignment, technical functionality, testing approaches and results, code quality and algorithmic design.

## 4. Technical requirements

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22.13 (`npm` workspaces) |
| Contracts | Solidity · Hardhat 3 · OpenZeppelin patterns | Solidity 0.8.x |
| Chain | Ethereum **Sepolia** testnet · ethers.js | ethers v6 |
| Backend | Express · TypeScript · `node:test` | Node 22 |
| Database | **Firebase Firestore** (free Spark plan) | firebase-admin SDK |
| Frontend | React · Vite · TypeScript · Vitest · Tailwind-style CSS | React 18 · Vite 6 |
| External APIs | CHIRPS (Climate Hazards Center), NASA POWER, Meteostat (RapidAPI) | n/a |
| Mail / SMS | Gmail SMTP (App Password) · optional Africa's Talking SMS | n/a |
| Browser | Chrome, Edge, Firefox and Safari (with **MetaMask**) | n/a |
| Hardware | Runs on low-end laptops and phones; mobile layout at 390 px | n/a |

## 5. Installation and running locally

```bash
git clone https://github.com/Phinatech/Capstone-project.git
cd Capstone-project
npm install                        # one install for all workspaces

# Configure (copy each .env.example to .env and fill in):
#   backend/.env    : RPC_URL, contract addresses, ADMIN_*, FIREBASE_SERVICE_ACCOUNT,
#                     MAIL_USER/MAIL_PASSWORD (optional), AUTH_DEMO_ACCOUNTS=false
#   frontend/.env   : VITE_RPC_URL, VITE_WEATHER_INDEX_INSURANCE_ADDRESS,
#                     VITE_ORACLE_AGGREGATOR_ADDRESS (leave VITE_API_URL empty)

npm run dev:backend                # API + relayer on :3001
npm run dev:frontend               # app on :5173 (proxies /api and /auth)
```

**Tests**: `npm run test` (all workspaces, 292 tests) · `npm run test:blockchain` · `npm run test:backend` · `npm run test:frontend`

**Deployed setup**: frontend on Cloudflare Pages, API/relayer on Render, contracts on Sepolia (see `docs/deployment.md`). The administrator account and any permanent agent/farmer accounts are provisioned from environment variables (`ADMIN_*`, `SEED_USERS`), so they survive restarts.

## 6. Repository structure

```
blockchain/          Solidity contracts, Hardhat 3 tests, Ignition deployment
  contracts/           WeatherIndexInsurance.sol, OracleAggregator.sol
  test/                56 Solidity + 13 integration (Mocha/ethers) tests
backend/             Express + TypeScript API, oracle relayer, settlement keeper
  src/routes/          auth, agent sales, chain reads, notifications
  src/utils/           stores (users/sessions/codes/sales), Firebase persistence,
                       rainfall feeds (CHIRPS/NASA/Meteostat), backtest, mail
frontend/            React + Vite dApp
  src/pages/           farmer · agent · admin portals
  src/contexts/        auth, policy (chain + wallet), notifications, FX
  src/components/      shared UI, oracle research tools, evaluation panels
functions/           Cloudflare Pages middleware (same-origin API proxy)
docs/                technical-report.pdf · screenshots (10) · security-audit.md
                     deployment.md · backtest-results.md · debugging-journal.md
                     licenses.md · figures (architecture + sequence diagrams)
```

## 7. Testing and evidence

| Suite | Count | Covers |
|---|---|---|
| Solidity (Hardhat) | 56 | premium maths, reserves invariant (fuzz), settlement, audit regressions |
| Integration (Mocha + ethers) | 13 | full purchase-to-settlement lifecycle against real contracts |
| Backend (`node:test`) | 193 | auth flows, stores, feeds, verification codes, sale verification |
| Frontend (Vitest) | 20 | policy evaluation, aggregation, formatting |

Two testing strategies are demonstrated in the video: **unit/functional** (contract invariants and store logic) and **integration/end-to-end** (real HTTP with cookie jars, real chain reads, live deployment). Performance and compatibility measurements are in §3.4 of the technical report.

## 8. Documentation

| Document | What's in it |
|---|---|
| [Technical report (PDF)](docs/technical-report.pdf) | Scope alignment, functionality, testing, code quality |
| [Deployment guide](docs/deployment.md) | Step-by-step production deployment |
| [Security audit](docs/security-audit.md) | Findings, fixes, regression tests |
| [Backtest results](docs/backtest-results.md) | Oracle accuracy study (121 dekads) |
| [Debugging journal](docs/debugging-journal.md) | Five production bugs, diagnosed and fixed |
| [Licences](docs/licenses.md) | Third-party components and data attributions |

## 9. License

MIT. See [LICENSE](LICENSE). Data sources: CHIRPS, NASA POWER, Meteostat (attribution required).
