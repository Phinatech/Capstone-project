# Backend — API & Oracle Relayer

Express + TypeScript service with two jobs:

1. **API** — REST endpoints for policies, pool status, and aggregate readings
   (read-only for v1; writes go through the dapp).
2. **Oracle relayer** — on a schedule, fetch each source's rainfall for every
   finished dekad and call `OracleAggregator.submitReading` on its behalf.

## Status

| Source | Feed |
|--------|------|
| NASA_POWER | **Live**: NASA POWER daily `PRECTOTCORR` for `RAINFALL_LATITUDE` / `RAINFALL_LONGITUDE` (default Sokoto), totalled per dekad. Lags about three days |
| Meteostat | **Live** when `METEOSTAT_API_KEY` is set: Meteostat point daily `prcp` through RapidAPI, interpolated from stations 65010 (Sokoto) and 61075 (Birni N'Konni). Lags about a week; asked again about the same days at most every six hours to stay within the free plan's 500 requests a month. Without a key it replays historical data |
| CHIRPS | Historical: the GHCN series below with an illustrative bias, so it only covers past seasons |

The relayer is off unless `RELAYER_ENABLED=true`, because it spends the oracle
accounts' gas. When on, it runs at start-up and then every
`RELAYER_INTERVAL_MINUTES`: for each of the last `RELAYER_LOOKBACK_DEKADS`
finished dekads that a source hasn't reported on-chain, it submits the
source's total once every day of the dekad has data. The aggregator accepts
one reading per source per dekad, so it never reports a dekad still in
progress. NASA POWER runs about three days behind, so a dekad is usually
reported three to four days after it ends, and Meteostat about a week after.

The aggregator needs readings from at least two sources (`minQuorum`) before a
dekad can finalize, so with NASA POWER and Meteostat both live, a dekad can
finalize once both have reported and the reporting window has passed. If
either feed has a gap, that dekad can't finalize until a third source reports.

### Notifications (SMS and Telegram)

The backend that runs the relayer (`RELAYER_ENABLED=true`) also checks the
insurance contract every 15 seconds and sends a notification for every policy
bought and every policy settled, with or without a payout (`src/notifier.ts`):

- **SMS** through Africa's Talking (`SMS_PROVIDER=africastalking`, the default)
  or Termii (`SMS_PROVIDER=termii`), to the farmer whose profile wallet owns
  the policy (if they have a phone number) and to every `NOTIFY_SMS_TO`
  number. With `AFRICASTALKING_USERNAME=sandbox` the messages are free and
  appear in Africa's Talking's online simulator instead of on real phones; a
  live app sends real SMS, which in Nigeria needs an approved sender ID.
- **Telegram**, with `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set, with a
  link to the transaction on Etherscan. It reacts to the transaction itself, so it
doesn't matter whether the keeper, the admin's Settle button or a farmer sent
it. It starts from the newest block when the backend starts, so a restart
never resends old messages, and events while the backend is down aren't sent.

### Settlement

After reporting, each run also settles what is ready (`src/settlement.ts`),
paying the gas from `KEEPER_PRIVATE_KEY`:

1. `finalizePeriod` for every reported dekad the aggregator will accept.
2. `checkAndSettle` for every unsettled policy whose window's dekads are all
   finalized, which pays the farmer if the window's rainfall is below their
   threshold.

Each call is dry-run first, so a dekad or policy that isn't ready costs no gas
and the contracts remain the only place the rules live. In practice a dekad
finalizes about a week after it ends, once Meteostat has reported, and its
policies settle in the same run.

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

## Live API Integration

NASA POWER and Meteostat are live (see Status). CHIRPS is still **deferred, not
dropped**: it ships as raster/NetCDF, so it needs its own adapter. Adding a
source means writing a daily fetch for the insured location (see
`src/utils/nasaPower.ts`), wrapping it in `dailyFeed` and registering it in
`FEEDS` in `src/relayer.ts`; the relayer handles the rest (finished dekads
only, one reading per dekad, the `MAX_READING = 50_000` plausibility check).

Meteostat's point data for Sokoto draws on station 61075, which is the
Birni N'Konni GHCN station the backtest uses as ground truth, so Meteostat
will look better against GHCN than it would against an independent gauge
(see the caveat above).

## Getting started

```bash
npm run dev          # from repo root: npm run dev:backend
```

Copy `.env.example` to `.env` and adjust. Never commit `.env`.

Event history (settlements, readings, purchases) is read with `eth_getLogs`
from `DEPLOY_BLOCK` onward, in chunks of `LOGS_BLOCK_RANGE` blocks. The RPC must
keep logs back to the deploy block and accept that range: Alchemy's free tier
allows only 10 blocks and PublicNode prunes logs older than a few days, so on
Sepolia set `LOGS_RPC_URL` to `https://sepolia.gateway.tenderly.co` (tested
with 100,000-block requests). Older chunks are kept in memory, so after the
first request only new blocks are read.

## Endpoints

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `200 {"ok":true,"service":"weather-insurance-backend"}` |
| `POST` | `/auth/turnstile/verify` | Body `{"token":"..."}`. `200` when Cloudflare confirms the token, `400` when it refuses it (with Cloudflare's `errorCodes`) or the token is missing, `503` without `TURNSTILE_SECRET_KEY`, `502` when Cloudflare can't be reached |
| `GET` | `/api/policies`, `/api/oracles`, `/api/windows`, `/api/pool`, `/api/settlements`, `/api/readings`, `/api/evaluations` | Cached chain data. `?minBlock=N` asks for data read at or after block N (e.g. right after your own transaction) |
| `POST` | `/api/notify/sms` | Sends one SMS through the configured provider (`SMS_PROVIDER`). Off (`503`) unless `NOTIFY_API_KEY` is set, and needs `Authorization: Bearer <NOTIFY_API_KEY>` (`401`). Body `{"phone", "type": "payout" \| "purchased" \| "settlement", "policyId", "payoutEth"?, "rainfallMm"?, "farmerName"?}`; `400` for a non-Nigerian number or a malformed field, `429` after 30 SMS in an hour, `502` when the provider refuses it (e.g. an unapproved sender ID) |

Browser calls are allowed from the origins in `CORS_ORIGINS`
(default `http://localhost:5173`).

## Layout

```
src/
  index.ts     Express app entry; mounts routers, starts relayer loop
  relayer.ts   Per-source feeds -> submitReading for each finished dekad
  settlement.ts  Keeper: finalizePeriod + checkAndSettle once ready
  *.test.ts    node:test tests (npm run test:backend)
  turnstile.ts Server-side Cloudflare Turnstile token check
  config.ts    Environment configuration
  routes/
    api.ts             Cached chain-data endpoints and SMS notifications
  utils/
    period.ts          Shared dekad period utilities (canonical implementation)
    feeds.ts           Daily rainfall -> dekad totals, with request throttling
    nasaPower.ts       NASA POWER daily rainfall
    meteostat.ts       Meteostat daily rainfall (RapidAPI)
    chain.ts           Contract reads and chunked event history
    cache.ts           In-memory cache with block-aware refresh
    logChunks.ts       Splits block ranges for eth_getLogs limits
    aggregate-ghcn.ts  GHCN daily -> dekadal aggregation script
    fetch-backtest-data.ts  Downloads NASA POWER, CHIRPS (and Meteostat) at the gauge
    backtest.ts        Sources vs the gauge -> docs/backtest-results.md
    backtestStats.ts   Error, weight and payout-agreement statistics
data/
  birni-n-konni-ghcn.csv       Raw GHCN daily data
  sokoto-dekadal-rainfall.json  Aggregated dekadal values
  backtest/                    Daily series at the gauge, from fetch-backtest-data.ts
.env.example   Configuration template
```

### Backtest

```bash
npx tsx src/utils/fetch-backtest-data.ts   # once; skips files already in data/backtest/
npx tsx src/utils/backtest.ts              # writes docs/backtest-results.md
```

It scores NASA POWER and CHIRPS against the Birni N'Konni gauge, 1981-2024,
compares single sources, equal weights, the deployed weights and
out-of-sample reputation weights, counts payout calls that disagree with the
gauge, and suggests `reputationWeight` values. Results and their limits are in
[`docs/backtest-results.md`](../docs/backtest-results.md).

Period ids are `YYYYMMD` (year, month 1-12, dekad 1-3 on days 1-10 / 11-20 /
21-end, UTC), e.g. `2026111` for 1-10 Nov 2026 — see `src/utils/period.ts`.

## Security notes

The relayer holds the oracle source keys — treat it as a high-value target.
Per `docs/security-audit.md`: H-1 (centralized admin) and M-1 (finalize race)
are the contract-side risks the relayer interacts with; add quorum + windows
before pointing this service at a shared chain.
