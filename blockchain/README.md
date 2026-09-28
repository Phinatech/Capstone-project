# Blockchain — Contracts & Deployment (Hardhat 3)

Reputation-weighted oracle aggregation for a blockchain-based weather-indexed
micro-insurance system, prototyped for pearl millet farmers in Sokoto State,
Nigeria. Rather than trusting a single rainfall data source or weighting
several sources equally, `OracleAggregator` combines readings from multiple
independent sources (intended to represent CHIRPS, NASA POWER, and Meteostat)
using weights that reflect each source's historical reliability.

## Why reputation weighting

A single-source oracle is a single point of failure — if that one feed has
a gap or an error for the reporting period, the payout decision is wrong
with no way to catch it. Averaging several sources equally is more robust,
but it lets a source with a poor track record pull the estimate just as
hard as one with a strong one. Reputation weighting sits between the two:
it still uses every source that reports, but a source's influence on the
final estimate is proportional to how reliable it has historically been for
this region.

That reliability score itself is computed **off-chain** (by backtesting
each source's historical readings against verified rain-gauge records for
Sokoto) and set on-chain via `registerOracle` / `updateReputation`. The
contract's job is just to collect readings and compute the weighted
aggregate — it doesn't attempt reliability analysis on-chain, since the
ground-truth data that would require isn't available on-chain.

This also makes the capstone's baseline comparison easy to run: a
single-source baseline is just this same aggregator with only one oracle
registered, and an equally-weighted baseline is the same aggregator with
every oracle given the same weight. The three evaluation conditions
(single-source, equal-weight, reputation-weight) are different weight
configurations of one contract, not three different implementations.

## Project layout

```
contracts/
  OracleAggregator.sol        Core contribution: weighted rainfall aggregation
  OracleAggregator.t.sol      Solidity unit tests (forge-std) for the aggregation math
  WeatherIndexInsurance.sol   Consumes the aggregate to decide policy payouts
test/
  integration.ts              TypeScript integration tests for the full aggregator -> payout flow
ignition/modules/
  DeployOracleInsurance.ts    Deploys and wires both contracts together
hardhat.config.ts
```

## Running it

```shell
npx hardhat test              # Solidity unit tests + TypeScript integration tests
npx hardhat test solidity     # just the Solidity tests
npx hardhat test mocha        # just the TypeScript tests
```

The first `npx hardhat test` (or `npx hardhat build`) downloads the Solidity
compiler automatically — that just needs a normal internet connection, no
extra setup. (Install workspaces from the repo root: `npm install`.)

To typecheck without running anything (fast feedback on argument/type
mistakes before the test runner even starts):

```shell
npx hardhat build && npx tsc --noEmit
```

## Deploying

To a local, throwaway simulated chain:

```shell
npx hardhat ignition deploy ignition/modules/DeployOracleInsurance.ts
```

To Sepolia testnet, set a funded account's private key via the keystore
plugin first (never a plaintext env var):

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy --network sepolia ignition/modules/DeployOracleInsurance.ts
```

Deployment only creates the two contracts and wires the insurance contract
to the aggregator. Registering the real oracle addresses, setting their
reputation weights from the off-chain backtest, and creating farmer
policies are separate steps — left to a follow-up script once you've
decided how CHIRPS/NASA POWER/Meteostat data actually reaches the chain
(the `backend/` workspace is the home for that relayer).

## Next steps for the write-up / evaluation

- **Historical backtest for reputation weights.** Pull a season (or several)
  of CHIRPS, NASA POWER, and Meteostat data for Sokoto against verified
  rain-gauge ground truth, score each source's error, and turn that into
  the initial weights passed to `registerOracle`.
- **Baseline comparison script.** A Node script that replays the same
  historical readings through three configurations of `OracleAggregator`
  (one oracle only, equal weights, reputation weights) and records payout
  accuracy, finalization latency, and gas cost for `finalizePeriod` under
  each — this is the data Chapter 4's evaluation section needs.
- **Relayer.** See `../backend/src/relayer.ts` — fetch CHIRPS/NASA POWER/
  Meteostat data on a schedule and call `submitReading` on each source's
  behalf, since the real APIs aren't blockchain-native.

## Security

Read `../docs/security-audit.md` before deploying anywhere shared — 14
documented findings; the finalize-race (M-1) and retroactive weight edits
(M-2) are the ones that matter most for payout correctness.
