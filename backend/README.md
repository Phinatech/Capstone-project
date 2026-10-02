# Backend — API & Oracle Relayer

Express + TypeScript service with two jobs:

1. **API** — REST endpoints for policies, pool status, and aggregate readings
   (read-only for v1; writes go through the dapp).
2. **Oracle relayer** — on a schedule, fetch rainfall for the current reporting
   period and call `OracleAggregator.submitReading` on each registered source's
   behalf.

## Status

The relayer is **file-backed**: it reads historical GHCN precipitation data for
Birni N'Konni, Niger (station `NG000001075`, ~83 km from Sokoto) and submits
dekadal readings on-chain. This exercises the full transactional path — real
signer per source, real `submitReading`, real `finalizePeriod`, real gas numbers.

## Data Source

**GHCN (Global Historical Climatology Network) — Birni N'Konni, Niger**
- Station ID: `NG000001075`
- Location: 13.8°N, 5.25°E (~83 km from Sokoto)
- Coverage: 15,923 daily precipitation records from 1938 to 2024
- Aggregated to 1,342 dekadal values in `data/sokoto-dekadal-rainfall.json`
- Data is freely available on AWS S3 (`s3://noaa-ghcn-pds/`) under CC0

### Circular dependency caveat

CHIRPS and Meteostat both incorporate GHCN station data in their construction,
so GHCN is not a fully independent referee for those sources. It is independent
of NASA POWER (reanalysis-based) and TAMSAT (cold-cloud-duration-based). This
is a known limitation in the satellite-rainfall literature, not a flaw unique
to this project. Weights derived against GHCN should be cross-checked against
TAMSAT where available.

## Live API Integration (Deferred)

Live API integration (CHIRPS, NASA POWER, Meteostat) is **deferred, not dropped**.
The file-backed relayer was chosen because:

- The contribution being evaluated is the **weighting logic**, not data plumbing
- A file-backed relayer still exercises the entire real path (signer → submitReading → finalizePeriod → gas)
- Live APIs have different formats (CHIRPS ships as raster/NetCDF, NASA POWER is REST, Meteostat is a library), rate limits, and latency variability
- The historical dataset is the same one the Chapter Four backtest runs against

A live implementation would need to:
1. Replace `fetchRainfall` with API calls to each source
2. Map each source's grid cell to the Sokoto region (lat 13.05, lon 5.23)
3. Aggregate daily values to dekads
4. Apply the same plausibility check (`MAX_READING = 50_000`)

## Getting started

```bash
npm run dev          # from repo root: npm run dev:backend
```

Copy `.env.example` to `.env` and adjust. Never commit `.env`.

## Layout

```
src/
  index.ts     Express app entry; mounts routers, starts relayer loop
  relayer.ts   Periodic rainfall fetch -> submitReading (file-backed)
  relayer.test.ts  node:test tests (npm run test:backend)
  config.ts    Environment configuration
  utils/
    period.ts          Shared dekad period utilities (canonical implementation)
    aggregate-ghcn.ts  GHCN daily -> dekadal aggregation script
data/
  birni-n-konni-ghcn.csv       Raw GHCN daily data
  sokoto-dekadal-rainfall.json  Aggregated dekadal values
.env.example   Configuration template
```

Period ids are `YYYYMMD` (year, month 1-12, dekad 1-3 on days 1-10 / 11-20 /
21-end, UTC), e.g. `2026111` for 1-10 Nov 2026 — see `src/utils/period.ts`.

## Security notes

The relayer holds the oracle source keys — treat it as a high-value target.
Per `docs/security-audit.md`: H-1 (centralized admin) and M-1 (finalize race)
are the contract-side risks the relayer interacts with; add quorum + windows
before pointing this service at a shared chain.
