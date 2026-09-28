# Backend — API & Oracle Relayer

Express + TypeScript service with two jobs:

1. **API** — REST endpoints for policies, pool status, and aggregate readings
   (read-only for v1; writes go through the dapp).
2. **Oracle relayer** — on a schedule, fetch rainfall for the current reporting
   period from CHIRPS / NASA POWER / Meteostat and call
   `OracleAggregator.submitReading` on each registered source's behalf.

## Status

Scaffold. Endpoints and the relayer loop are stubs — see `src/index.ts`.

## Getting started

```bash
npm run dev          # from repo root: npm run dev:backend
```

Copy `.env.example` to `.env` and adjust. Never commit `.env`.

## Layout

```
src/
  index.ts     Express app entry; mounts routers, starts relayer loop
  relayer.ts   Periodic rainfall fetch -> submitReading (stub), dekad period ids
  relayer.test.ts  node:test tests (npm run test:backend)
.env.example   Configuration template
```

Period ids are `YYYYMMD` (year, month 1-12, dekad 1-3 on days 1-10 / 11-20 /
21-end, UTC), e.g. `2026111` for 1-10 Nov 2026 — see `currentPeriod()`.

## Security notes

The relayer holds the oracle source keys — treat it as a high-value target.
Per `docs/security-audit.md`: H-1 (centralized admin) and M-1 (finalize race)
are the contract-side risks the relayer interacts with; add quorum + windows
before pointing this service at a shared chain.
