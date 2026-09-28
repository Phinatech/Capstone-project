# Weather-Index Insurance (monorepo)

npm workspaces monorepo. Always run one `npm install` at the root — never
per-package installs.

## Project layout

```
frontend/   React + Vite + TypeScript dapp UI (farmer/admin)
backend/    Express + TypeScript API and oracle relayer service
blockchain/ Hardhat 3 project: contracts, Solidity + TS tests, Ignition deploy
docs/       Project documentation (security-audit.md is the full audit)
```

## Working in this project

- **Contracts / Hardhat config / Solidity or chain-interacting TS tests:**
  invoke the **`hardhat`** skill (per `blockchain/CLAUDE.md`).
- Node version: >= 22.13 (see `.nvmrc`). Package manager: npm (workspaces, no pnpm/yarn).
- Run workspace commands through the root scripts (`npm run test:blockchain`,
  `npm run dev:backend`, ...) or with `--workspace <name>`.
- Secrets live in per-workspace `.env` files (see each `.env.example`);
  `.env*` is gitignored at the root. The Sepolia deployer key uses Hardhat's
  keystore (`npx hardhat keystore set SEPOLIA_PRIVATE_KEY`), never plaintext.

## Docs

- Hardhat 3 — https://hardhat.org/llms.txt
- ethers.js — https://docs.ethers.org/v6/
- React — https://react.dev/learn
- Express — https://expressjs.com/
