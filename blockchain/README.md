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
  WeatherIndexInsurance.sol   Coverage windows, farmer-bought policies, payouts
  WeatherIndexInsurance.t.sol Solidity unit tests for buying, reserves and settlement
test/
  integration.ts              TypeScript integration tests for the full aggregator -> payout flow
ignition/modules/
  DeployOracleInsurance.ts    Deploys and wires both contracts together
scripts/
  seed-local.ts               Deploys + seeds a local node, writes the .env files
hardhat.config.ts
```

## How a policy works

1. The owner publishes a **coverage window** with `addCoverageWindow(periods,
   salesCloseAt)`: a list of dekad periods (`YYYYMMD`, e.g. `2026071` for
   1-10 Jul 2026) and a deadline after which no more cover is sold.
2. A farmer calls `buyPolicy(windowId, droughtThresholdMm, payoutAmount)`,
   sending `quotePremium(payoutAmount)` (10% of the payout by default). The
   sale reserves the payout and is refused if the pool can't cover it.
3. Oracles report each dekad once to `OracleAggregator` (at most 500.00 mm,
   `MAX_READING`; larger values are rejected as implausible). Anyone can then
   finalize it, once at least `minQuorum` sources (default 2) have reported
   and either all registered sources have, or `reportingWindow` (default
   1 day) has passed since the dekad's first reading. One early, extreme
   reading therefore can't be locked in before honest sources report
   (audit M-1).
   Each dekad's first reading also snapshots every source's weight, and the
   aggregate uses only those, so reweighting a source affects later dekads,
   never one that is already reporting (audit M-2).
4. Once every dekad in the window is finalized, anyone can call
   `checkAndSettle(policyId)`: the window's dekad aggregates are summed and
   compared with the threshold (both in mm × 100), and the farmer is paid
   automatically if rainfall fell short.

Overlapping windows ("July", "June-July") share the same dekad reports, so a
source can't report the same rainfall differently for different policies.

### Ownership

Each contract's owner (the deployer at first) publishes windows, registers,
reweights and deactivates oracles, and tunes the quorum, reporting window and
premium rate. `deactivateOracle(address)` permanently stops a compromised or
retired source from reporting while keeping its label and weight as history;
readings it already sent for dekads still reporting keep counting. Ownership moves in two steps, so a mistyped address can't take control:

```solidity
contract.transferOwnership(newOwner); // current owner proposes (address(0) cancels)
contract.acceptOwnership();           // called by newOwner to complete it
```

For anything beyond a demo, hand both contracts to a multisig this way right
after deployment (audit L-3 / H-1).

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

### Local development chain (deployed and seeded)

From the repo root, in two terminals:

```shell
npm run chain        # local Hardhat node on http://localhost:8545
npm run seed:local   # deploy + seed, then write frontend/.env and backend/.env
```

`scripts/seed-local.ts` deploys both contracts, registers three oracle
sources (Hardhat test accounts #2-#4) with the reputation weights shown on the
admin Oracles page, funds the pool with 10 ETH, and publishes the next
season's five coverage windows (the same windows as the frontend), each on
sale until its first day. It writes the contract addresses into both `.env`
files and the oracle keys into `backend/.env` for the relayer. It refuses to
run on any network but `localhost`, because those keys are public. The node
keeps no state between restarts, so rerun the seed after restarting it.

### Sepolia testnet

Set a funded account's private key via the keystore plugin first (never a
plaintext env var):

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat ignition deploy --network sepolia ignition/modules/DeployOracleInsurance.ts
```

The Ignition module only creates the two contracts and wires the insurance
contract to the aggregator. Registering the real oracle addresses, setting
their weights from the off-chain backtest, and publishing coverage windows
are separate owner transactions (see `seed-local.ts` for the sequence).

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
