# Security Audit — Oracle Aggregation Weather-Index Insurance

**Date:** 2026-09-25
**Scope:** Full project scan — `contracts/`, `test/`, `ignition/`, `hardhat.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, docs.
**Solidity:** `^0.8.34` · **Framework:** Hardhat 3 · **Audit methodology:** manual review + `npm audit`

**Summary:** 0 critical, 3 high, 5 medium, 6 low findings. The contracts are
straightforward and free of the classic Ethereum exploit classes (no reentrancy
loss, no integer overflow on 0.8.x checked math, no unbounded loops over
user-grown arrays beyond registered oracles, no unprotected selfdestruct).
The real risk concentrates in **centralization/trust** — a single EOA controls
oracle registration, reputation weights, and policy creation — and in
**unbounded payout timing**, plus one **high-severity dependency CVE**.

| ID | Severity | Title | Location |
|------|----------|--------------------------------------------------------|------------------------------------------|
| H-1 | HIGH | Fully centralized admin: owner controls payouts, oracles, and weights | `WeatherIndexInsurance.sol`, `OracleAggregator.sol` |
| H-2 | HIGH | Payout can be settled late, after drought relief is already committed | `WeatherIndexInsurance.sol#checkAndSettle` |
| H-3 | HIGH | `serialize-javascript` ≤7.0.4 — RCE (GHSA-5c6j-r48x-rmvq) — **resolved 2026-09-28** | `package-lock.json` (dev, via mocha) |
| M-1 | MEDIUM | Manipulable finalization race: anyone can finalize a half-reported period — **resolved 2026-09-30** | `OracleAggregator.sol#finalizePeriod` |
| M-2 | MEDIUM | Owner can unilaterally rewrite reputation weights after readings are in — **resolved 2026-09-30** | `OracleAggregator.sol#updateReputation` |
| M-3 | MEDIUM | Last-second reentrancy griefing of the payout pool | `WeatherIndexInsurance.sol#fundPool` |
| M-4 | MEDIUM | Payouts silently skipped when the pool is underfunded (no fund accounting) — **resolved 2026-09-28** | `WeatherIndexInsurance.sol#checkAndSettle` |
| M-5 | MEDIUM | No bounds/sanity checks on submitted rainfall readings — **partly resolved 2026-09-30** | `OracleAggregator.sol#submitReading` |
| L-1 | LOW | `finalizePeriod` can permanently brick a period before any reading exists* | `OracleAggregator.sol#finalizePeriod` |
| L-2 | LOW | Truncation in weighted-average division | `OracleAggregator.sol#finalizePeriod` |
| L-3 | LOW | Owner key = single point of failure; no timelock/multisig — **partly resolved 2026-09-30** | `WeatherIndexInsurance.sol`, `OracleAggregator.sol` |
| L-4 | LOW | Sepolia key in `hardhat.config.ts` via `configVariable` (config hygiene) | `hardhat.config.ts` |
| L-5 | LOW | `oracleList` can only grow; no deregistration path — **resolved 2026-09-30** | `OracleAggregator.sol` |
| L-6 | LOW | 14 npm advisories (12 low, 1 moderate, 1 high) in dev toolchain — **partly resolved 2026-09-28** | `package-lock.json` |

\* L-1 was initially flagged as a griefing vector but re-classified low after
re-reading `finalizePeriod`: the `submitters.length > 0` guard means an empty
period cannot be finalized at all — see the finding text.

---

## High severity

### H-1 — Fully centralized admin: owner controls payouts, oracles, and weights

**Location:** `contracts/WeatherIndexInsurance.sol` (`createPolicy`, owner state),
`contracts/OracleAggregator.sol` (`registerOracle`, `updateReputation`).

`WeatherIndexInsurance.createPolicy` is `onlyOwner`, and the aggregator's
`registerOracle` / `updateReputation` are `onlyOwner`. One EOA can:

- mint policies for any address, with any threshold and any payout amount,
  and settle them against the shared pool;
- register a *new* oracle (a sybil source) mid-season with a huge weight;
- rewrite any oracle's reputation weight at any time (see M-2).

For the farmers this is intended to serve, the practical consequence is that
"insurance" is only as trustworthy as a single private key. The prototype
concedes this in its NatSpec ("capstone prototype"), but it is the dominant
trust assumption in the system and must be documented as the headline risk.

**Recommendation:** move to a 2-of-3 multisig (Safe) for owner functions, add
a timelock on `createPolicy` and `updateReputation`, and cap
`payoutAmount` to some fraction of `address(this).balance` at creation time.
Longer term, decentralize weight-setting (e.g. weight = f(reported error
history written on-chain by independent reporters)).

### H-2 — Payout can be settled arbitrarily late; farmer bears the timing risk

**Location:** `contracts/WeatherIndexInsurance.sol#checkAndSettle`.

Once a period is finalized, `checkAndSettle(policyId)` is permissionless and
has **no deadline**. The aggregate for a period is immutable once finalized,
so nothing forces settlement within a window the farmer can rely on. In a
real drought, the farmer's survival strategy depends on the payout arriving
inside the season; a policy that pays in six months has failed at its purpose
even though the contract's arithmetic is perfect.

A related asymmetry: because finalization is permissionless and can be
triggered the moment a single (possibly low-weight, possibly manipulated)
reading lands (see M-1), an adversarial settler can force an early finalize,
then the policy settles against that number forever.

**Recommendation:** add an expiry — e.g. `require(block.timestamp <= policy.windowClose, "window closed")`
with the window stored on the policy at creation, and/or auto-settlement via
a keepers network. Also consider an explicit `reportingWindow` on the
aggregator (`submitReading` only before close, `finalizePeriod` only after).

### H-3 — `serialize-javascript` ≤7.0.4: RCE via `RegExp.flags` / `Date.prototype.toISOString()` (dev dependency)

**Location:** transitive via `mocha` (through `@nomicfoundation/hardhat-toolbox-mocha-ethers`).

`npm audit`: **HIGH** — GHSA-5c6j-r48x-rmvq (RCE) and GHSA-qj8w-gfj5-8c6v
(CPU-exhaustion DoS), plus a **moderate** advisory on `mocha` itself via
`diff` / `serialize-javascript`. It is dev-only (test toolchain), so it does
not ship to users — but mocha *executes project test files*, and
`serialize-javascript` is used in mocha's parallel mode to serialize test
results across processes; a crafted test input is the documented RCE path.
Overall exposure is low-to-moderate, severity is tracked as HIGH because of
the advisory label.

**Recommendation:** `npm audit fix` first; if that does not clear it,
`npm audit fix --force` (npm proposes mocha@11.3.0 / older hardhat-ignition —
review the breaking change against the Hardhat toolbox before applying).
Re-run `npm audit` after.

**Status (2026-09-28): Resolved.** `npm audit fix --force` was not used (it
would have downgraded the Hardhat toolbox). Instead, root `package.json`
`overrides` pin `serialize-javascript` to `^7.0.5` (installed 7.1.2) and
`diff` to `^8.0.3` (installed 8.0.4) under mocha 11.8.0. All 14 contract tests
pass, and mocha's failure-diff output was checked by hand with a deliberately
failing test.

---

## Medium severity

### M-1 — Manipulable finalization: anyone can finalize on a single, possibly malicious, reading

**Location:** `contracts/OracleAggregator.sol#finalizePeriod`.

`finalizePeriod` is callable by anyone as soon as ≥1 reading exists, and locks
the period permanently. There is no minimum-quorum and no reporting window.
Attack path: at period open, the attacker (or a compromised/low-weight source,
or a registered source's relayer key) submits an extreme reading for the
period, then immediately calls `finalizePeriod` before honest sources report.
The extreme value is now the permanent aggregate for the period. If the
attacker holds a policy on the insurance contract with a threshold above that
value, `checkAndSettle` pays out on manipulated data.

Concretely with the test weights (CHIRPS 50, NASA 30, Meteostat 20): Meteostat
reports 1 mm and finalizes before the others → aggregate = 1 → every policy
with threshold > 1 pays. The docstring's "once the reporting window has closed
off-chain" is a social assumption the contract cannot enforce.

**Recommendation:** add a minimum quorum (e.g. `require(submitters.length >= minSources)`)
and a reporting window (`finalizePeriod` reverts until `block.timestamp > periodClose`).
Optionally a dispute/challenge period between first finalize request and lock-in.

**Status (2026-09-30): Resolved.** `finalizePeriod` now requires (a) at least
`minQuorum` sources to have reported (default 2) and (b) either every
registered source to have reported or `reportingWindow` (default 1 day) to
have passed since the period's *first* reading, recorded in
`firstReadingAt`. The window is anchored to the first reading rather than a
fixed `periodClose` because the aggregator treats period ids as opaque
numbers; anchoring it this way still guarantees honest sources a full window
to answer whatever was submitted first. The owner can tune both
(`setMinQuorum`, bounded by the number of registered sources;
`setReportingWindow`, at most 30 days), and lowering the quorum is the
recovery path if sources go offline for good. The attack above now reverts
with "quorum not reached"; see `test_SingleEarlyReadingCannotBeFinalized`
and the integration test "won't let one source finalize an extreme early
reading into a payout".

*Residual:* the contract can't tell when a dekad has actually ended, so a
reading submitted mid-dekad is accepted. The relayer must only report a
dekad after it closes, and the owner-controlled quorum/window settings are
part of the H-1 centralization risk. No dispute period was added.

### M-2 — Owner can rewrite reputation weights after readings are in (retroactive manipulation)

**Location:** `contracts/OracleAggregator.sol#updateReputation`.

`updateReputation` mutates `oracles[addr].reputationWeight` at any time, and
`finalizePeriod` reads weights at finalize time. The owner (or anyone who
phishes/compromises the owner key) can front-run a finalization: see the
pending aggregate tipping toward a payout, bump the weight of the source whose
reading is on the profitable side of the threshold, then let finalization
proceed. `ReputationUpdated` emits an event, but there is no binding between
the weight version and the period being aggregated — the resulting aggregate
is indistinguishable from an honest one on-chain.

This breaks the system's core claim: that the estimate reflects *pre-committed*
historical reliability rather than an administrator's real-time preference.

**Recommendation:** snapshot weights per period (e.g. store
`periodStartWeight[period][oracle]` set at first reading submission, or keep a
`weightVersion` counter and record `weightVersionAtFirstReading[period]`), and
make `updateReputation` only effective for *future* periods.

**Status (2026-09-30): Resolved.** A period's first reading now snapshots
every registered source's weight (`periodWeight`, readable through
`weightForPeriod(period, oracle)`), and `finalizePeriod` aggregates with
those snapshots only. `updateReputation` therefore takes effect from the next
period to receive its first reading. The same applied to *registration*: a
source registered after a period opened could otherwise report into it with
any weight, so such submissions now revert ("registered after period
opened"), and the "every source has reported" early-finalization check (M-1)
counts the period's snapshot, not the live list. Covered by
`test_AggregateUsesWeightsLiveWhenThePeriodStarted`, a fuzz test that any
reweighting after the first reading leaves the aggregate unchanged,
`test_SourceRegisteredMidPeriodCannotReportForIt`, and the integration test
"ignores reputation changes made after a dekad's readings started". The
frontend's on-chain results show the snapshot weights.

*Residual:* the snapshot is per dekad, not per policy. For a coverage window
already on sale, the owner can still reweight before its *later* dekads
open; binding policies to the weights in force when they were sold would
need a per-window snapshot. The first reporter pays for the snapshot (one
storage write per registered source).

### M-3 — Reentrancy griefing of the payout pool via `fundPool`

**Location:** `contracts/WeatherIndexInsurance.sol#fundPool`, interacts with `checkAndSettle`.

`fundPool` accepts ETH from anyone and credits nothing per-depositor — the
pool is just `address(this).balance`. A contract can `fundPool` and then
reenter `checkAndSettle` on a policy whose drought condition is met: during
the payout `call{value}`, the attacker's fallback reenters `checkAndSettle`
on *other* settled-ready policies, draining the pool for those policies
before the outer call finishes.

This is **griefing / fund-drain, not theft of the attacker's own funds**:
`claimed` is set before the external call, and the solidity-0.8 checked-arithmetic
`balance >= payout` guard reverts on overdraw, so each individual policy still
pays out at most once and at most its payout amount. The impact is that the
pool's *other* policyholders can be drained by an attacker who seeds the pool
with one policy's worth of ETH, and honest late depositors' subsidy is consumed.
The order of operations (effects-before-interaction) is correct for safety of
the *claiming* policy; the exposure is pool-level accounting by balance, not
per-policy double-payment.

**Recommendation:** track reserves explicitly (`uint256 public poolReserves`
incremented in `fundPool`, decremented on payout) so reentrant balance reads
can't be used to skew solvency, and/or add a `nonReentrant` guard on
`checkAndSettle`. Consider capping payouts as a fraction of reserves.

### M-4 — Payouts silently skipped when pool is underfunded; no per-policy fund accounting

**Location:** `contracts/WeatherIndexInsurance.sol#checkAndSettle`, `createPolicy`.

`createPolicy` never checks `payoutAmount <= address(this).balance`, and
`checkAndSettle` reverts with "pool underfunded" when the condition fires.
Worse: if rainfall ends up *above* the threshold, the policy is marked
`claimed` and `PayoutSkipped` is emitted — the policyholder's position is
gone either way. There is no refund path and no per-policy escrow; whoever
funded the pool has no accounting of which policies their ETH backs, and
policyholders have no assurance their policy was ever actually funded.

The docstring acknowledges the shared-pool simplification, but the failure
mode (policy exists, drought happened, pool was pre-drained by earlier
payouts → farmer gets nothing and the policy burns) is worth stating
explicitly as a product-level vulnerability, not just a design shortcut.

**Recommendation:** either (a) escrow per-policy at creation
(`msg.value == payoutAmount`, refundable if no drought), or (b) keep the pool
but add a solvency check in `createPolicy` and emit a distinct event when a
settle attempt fails due to underfunding *without* burning the claim
(keep `claimed == false` if the transfer would fail, so settlement can be
retried once the pool is funded).

**Status (2026-09-28): Resolved (option b).** Each policy now reserves its
payout when it is sold (`reservedPayouts`), and `buyPolicy` / `createPolicy`
revert with "pool cannot cover payout" unless the unreserved balance
(`availableCapacity()`, premium included) covers it — so a triggered policy
can always be paid. Settlement releases the reserve either way. If the payout
transfer itself fails (e.g. a farmer contract that rejects ETH), the whole
`checkAndSettle` reverts and the policy stays unsettled, so it can be retried.
Covered by `WeatherIndexInsurance.t.sol`, including a fuzz test that reserves
never exceed the pool balance across random sales and settlements.

### M-5 — No sanity bounds on submitted rainfall readings

**Location:** `contracts/OracleAggregator.sol#submitReading`.

Any registered oracle can submit any `uint256` — including values far outside
physically plausible rainfall (e.g. `type(uint256).max` mm), typos in mm×100
scaling, or negatives-that-wrapped (not possible post-0.8, but garbage is). A
single high-weight source submitting a garbage value pulls the aggregate
proportionally to its weight, and a fat-fingered mm×100 off-by-100 is
indistinguishable from an honest report.

The bounded-input fuzz test (`testFuzz_WeightedAverageStaysWithinReadingBounds`)
correctly proves the *aggregate* stays within the submitted bounds, but it
can't say anything about whether the *inputs* are sane — that gap is exactly
where real-world oracle incidents live.

**Recommendation:** add a plausibility band, e.g. `require(rainfallMm <= 50_000)`
(500 mm for a dekad is generous) — matching the fuzz test's own bound — plus
optionally a per-period cap on deviation from the running median of other
sources' readings, or a stake-and-slash for sources whose reading ends up a
defined outlier at finalization.

**Status (2026-09-30): Partly resolved.** `submitReading` now rejects any
value above `MAX_READING = 50_000` (500.00 mm in one period, a constant
rather than an owner setting) with "reading out of range", matching the
fuzz tests' bound, which now reads the constant. A rejected reading doesn't
use up the source's one submission for the period. Covered by
`test_RejectsImplausibleReadings` (including a doubly scaled 120 mm →
1,200,000 and `type(uint256).max`) and a fuzz test that every value above
the bound reverts.

*Residual:* a wrong value inside 0-500 mm (for example an unscaled 120 mm
sent as `120` = 1.20 mm) is still accepted; the reputation weighting and the
M-1 quorum limit its effect, and the relayer should validate readings before
submitting. The median-deviation cap and stake-and-slash suggestions were
not implemented.

---

## Low severity

### L-1 — Finalization requires a reading; empty periods cannot be finalized (verified non-issue, documented for completeness)

**Location:** `contracts/OracleAggregator.sol#finalizePeriod`.

Initially flagged as "anyone can brick a period by finalizing before any
reading exists." On re-read, `require(submitters.length > 0, "...no readings
submitted")` makes that impossible: finalizing an empty period reverts, and
once a reading exists the period can only be finalized once (`isFinalized`
guard). The residual risk is that *if* no oracle ever reports for a period
(all relayers down), the period can never be finalized, and every policy
tied to that period can never settle (see also H-2). That's an availability
risk, not a griefing one — a policy that can never settle should ideally
expire and refund.

**Recommendation:** add an expiry to policies (refunds or settlement against
a default aggregate such as the long-run regional mean after a grace period).

### L-2 — Truncation in the weighted-average division

**Location:** `contracts/OracleAggregator.sol#finalizePeriod` (`weightedSum / weightTotal`).

Integer division floors, so the aggregate is biased 1 unit (0.01 mm) low
relative to the exact weighted mean whenever the division isn't exact. With
readings bounded at 50,000 mm×100 (see M-5) and weights at typical scale,
`weightedSum` cannot overflow uint256 (max ≈ 50k × weightTotal ≤ 2^256 as long
as weightTotal stays below ~2^236 — unreachable in practice). The systematic
0.01 mm floor bias is negligible for a drought threshold at 15 mm, but it is
technically a deviation from the documented formula and could matter at
boundaries (threshold exactly equal to the true mean).

**Recommendation:** if exactness ever matters (it does at thresholds),
document the floor convention in the NatSpec, or round-to-nearest via
`(weightedSum * 2 + weightTotal) / (weightTotal * 2)`.

### L-3 — Owner key is a single point of failure (no multisig, no timelock)

**Location:** both contracts' `constructor` set `owner = msg.sender`; no transfer mechanism exists.

Two distinct issues: (a) if the key is lost or the ownerEOA is deleted, every
owner function — registering a replacement oracle, updating weights, creating
policies — is bricked forever (there is no `transferOwnership`, so not even a
recovery is possible); (b) if the key is compromised, see H-1/M-2 for the
full damage surface. The absence of `transferOwnership` is a correctness bug
in its own right for any deployment longer than a demo.

**Recommendation:** add a two-step `transferOwnership` (propose/accept), then
transfer to a multisig at deploy time. Add a timelock for weight updates.

**Status (2026-09-30): Partly resolved.** Both contracts now have a two-step
transfer with the same semantics and event names as OpenZeppelin's
`Ownable2Step`: `transferOwnership(newOwner)` (owner only) records a
`pendingOwner` and emits `OwnershipTransferStarted`; nothing changes until
that address calls `acceptOwnership()`, which emits `OwnershipTransferred`.
Proposing `address(0)` cancels a pending transfer. A mistyped address can't
take control, and a lost key can now be migrated away from while it is still
available. There is deliberately no `renounceOwnership`, since an ownerless
contract could never publish windows or register oracles again. Covered by
`test_TwoStepOwnershipTransfer`, `test_OnlyThePendingOwnerCanAccept` and
`test_PendingTransferCanBeRedirectedOrCancelled` in both contracts' Solidity
tests, plus the integration test "hands both contracts to a new owner in two
steps".

*Still open:* the deploy flow doesn't transfer to a multisig yet (the owner
is still the deployer EOA until someone runs the transfer), and there is no
timelock on owner actions, so H-1's centralization remains. A key that is
already lost still can't be recovered.

### L-4 — Sepolia deployer key referenced in `hardhat.config.ts` (config hygiene)

**Location:** `hardhat.config.ts` (`accounts: [configVariable("SEPOLIA_PRIVATE_KEY")]`).

Good news first: this uses Hardhat 3's `configVariable`, which resolves from
the keystore/environment and is deliberately left unset for local tasks —
this is the correct pattern, **no secret is committed**. Residual hygiene
risks only: (a) the key that does end up in the keystore should be
testnet-only and funded minimally; (b) if anyone switches to a `.env`-based
flow later, `.gitignore` already covers `.env*` (with `!.env.example`) — keep
it that way; (c) a 64-hex-key regex scan over the repo found no leaked keys,
and the README instructs `npx hardhat keystore set`, not a plaintext env var.

**Recommendation:** keep the keystore flow; document that the Sepolia key
must never be reused from a mainnet-funded account.

### L-5 — `oracleList` only grows; no deregistration or deactivation path

**Location:** `OracleAggregator.sol` (`registerOracle`, `oracleList`).

There is no way to remove or deactivate a compromised or decommissioned
oracle. `submitReading` is gated on `registered`, but `registered` is never
set back to false, so a leaked oracle key can submit garbage readings for
every future period indefinitely (bounded only by the weights from M-2/M-5).
The array also grows unboundedly, though only over owner-added oracles, so
gas-wise this is not exploitable by third parties.

**Recommendation:** add `deactivateOracle(address)` (sets `registered=false`,
keeps the label/weight history) and `setReputationWeight(addr, 0)` semantics
distinct from removal, so a bad source can be zeroed out without losing the
audit trail.

**Status (2026-09-30): Resolved.** `deactivateOracle(address)` (owner only)
sets `registered = false`, records `deactivatedAt[address]`, emits
`OracleDeactivated(oracle, label, lastWeight)` and leaves the label and
weight readable through `oracles(address)`; the address stays in
`oracleList` as history. A deactivated source can't submit, can't be
reweighted, and can't be re-registered (which would overwrite its history);
a replacement feed registers under a new address. New periods' weight
snapshots skip it, and `minQuorum`'s upper bound is now
`activeOracleCount`. Readings it already submitted for periods still
reporting keep counting: like reweighting under M-2, deactivation can't
change the outcome of a period already under way, so an owner can't use it
to drop an honest but inconvenient reading. Weights still can't be set to 0;
deactivation is the way to zero a source out. Covered by seven Solidity
tests (history kept, left out of new periods, pending readings still count,
mid-period deactivation, no re-registration, owner only, quorum bound) and
the integration test "switches off a compromised source without losing its
history".

*Residual:* a garbage reading a leaked key submitted *before* deactivation
still counts for that period (bounded by M-5's cap, its weight share and the
M-1 quorum). If deactivation leaves fewer active sources than `minQuorum`,
the owner must lower the quorum for new periods to finalize.

### L-6 — 14 npm advisories in the dev toolchain (12 low, 1 moderate, 1 high)

**Location:** `package-lock.json` (regenerated during this audit; the
lockfile was missing from the working tree — see note below).

`npm audit` totals: **12 low, 1 moderate (`mocha` via `diff`/`serialize-javascript`),
1 high (`serialize-javascript`, see H-3)**. All are in dev dependencies —
the `dependencies` field of `package.json` is empty and nothing here ships to
end users. Notable chains: `elliptic` (via `@ethersproject/signing-key` →
hardhat-verify → ignition, advisory GHSA-848j-6mx2-7j84 "risky cryptographic
primitive"), and the `serialize-javascript` RCE chain via mocha.

> **Repo hygiene note:** `package-lock.json` appears in the changed-files set
> for this session, but was **absent from the working tree** when the audit
> ran (glob for `**/package-lock.json` returned nothing). It was regenerated
> with `npm install --package-lock-only --ignore-scripts` to run `npm audit`.
> Commit the lockfile to keep dependency resolution reproducible and auditable.

**Recommendation:** `npm audit fix` for the non-breaking set; review the
`--force` proposal before applying (it downgrades `hardhat-ignition`).
Add `npm audit --audit-level=low` to CI so regressions are caught.

**Status (2026-09-28): Partly resolved.** After adding the frontend and
backend workspaces the audit had grown to 18 advisories; 11 remain, all low.
Fixed: `serialize-javascript` and `diff` (see H-3); `esbuild` (moderate, via
vite 5 — upgraded to vite 6.4.3); `react-router` (moderate, open redirect —
upgraded to react-router-dom 7.18.4). `package-lock.json` is now committed.
**Remaining, accepted:** `elliptic` (GHSA-848j-6mx2-7j84) and the 10
`@ethersproject/*` v5 packages that depend on it. The advisory covers every
`elliptic` version, so there is no patched release to move to; it is reached
only through `@nomicfoundation/hardhat-verify` (Etherscan verification), a
dev tool that never ships to users. The only way to clear it is to drop the
verify plugin from the toolbox.

---

## Test-suite coverage gaps (security-relevant)

The existing tests are good for the happy paths they cover — the weighted
math, missing-source robustness, duplicate/finalize guards, and the
fuzz invariant are all genuinely valuable. Missing adversarial cases:

1. **No test that finalization requires more than one source** (M-1) — and no
   quorum exists to test. Add `testFuzz`/unit coverage once a quorum is added.
2. **No test for reentrancy** on `checkAndSettle` (M-3) — add a malicious
   funder contract that reenters and assert the pool's per-policy solvency.
3. **No test for weight updates between submission and finalization** (M-2) —
   a test asserting the aggregate *at finalize time* uses the weights that
   were live *at submission time* would have caught the missing snapshot.
4. **No test for garbage/extreme readings** (M-5) — submit `type(uint256).max`
   or 10^12 mm and assert the system's behavior is defined.
5. **No test for pool exhaustion mid-season** (M-4) — two policies, one payout
   drains the pool, second policy's drought fires: assert defined behavior.
6. **No ownership-transfer test** (L-3) — there's no function to test, which
   is itself the finding.
7. **No integration test that a policy for a never-finalized period is
   permanently unsettled** (L-1/H-2) — asserts the expiry gap.

## Informational

- `WeatherIndexInsurance.fundPool` emits `PoolFunded` but does not track the
  depositor's balance anywhere — combined with M-4, deposits are pure
  donations with no accounting. Fine for a prototype; document it.
- The insurance contract trusts `aggregator` unconditionally and has no way
  to change it post-deploy (`aggregator` is `public` but there is no setter).
  If the aggregator is ever found to be misbehaving, the only remedy is
  social (stop creating policies). Document the trust boundary or add a
  guarded `setAggregator` behind the same future multisig/timelock as H-1.
- `submitReading` does not validate `period` against any calendar/registry —
  any registered oracle can submit readings for arbitrary future periods
  indefinitely (storage growth paid by the protocol, not the oracle). Bounding
  the acceptable period range would bound this.
- `OracleAggregator.t.sol` lives in `contracts/` rather than `test/` —
  cosmetic only; the Hardhat 3 layout in `CLAUDE.md` documents both.
- The NatSpec on `finalizePeriod` says "Callable by anyone once at least one
  reading exists, so an insurance contract (or anyone) can trigger
  finalization once the reporting window has closed off-chain" — the
  "reporting window" it references does not exist on-chain (M-1). Aligning
  the doc with reality, or adding the window, would prevent a false sense of
  safety in future audits.

## What was checked and found NOT vulnerable

- **Reentrancy on the payout path** (per-policy): `claimed = true` is set
  before the external `call`, following checks-effects-interactions; a policy
  cannot double-pay. The remaining pool-level griefing is M-3.
- **Integer overflow/underflow:** Solidity 0.8.34 checked arithmetic; the
  `weight * rainfall` products and sums are bounded (see L-2). No `unchecked`
  blocks anywhere.
- **Denial-of-service via unbounded loops:** `finalizePeriod` loops over
  `submittersByPeriod[period]`, which grows only via owner-registered
  oracles, one entry per oracle per period (duplicate guard present) — bounded
  and not third-party inflatable.
- **Storage collision / delegatecall / selfdestruct / tx.origin auth:**
  none present. No assembly, no `delegatecall`, no `selfdestruct`, no
  `tx.origin`.
- **Front-running of `checkAndSettle` itself** is intentional and harmless:
  settlement is permissionless by design and pays the farmer regardless of
  caller, so a sandwich attacker can only *help* the farmer, not steal the
  payout.
- **Secrets leakage:** no private keys, mnemonics, or API keys committed
  (regex scan for 64-hex keys, "private key", "mnemonic" across the repo
  came back clean; `.env*` is gitignored with `!.env.example` preserved).
- **Compiler:** `^0.8.34` via the `production` profile with optimizer
  (200 runs) is current and has no known relevant CVEs at audit time.

## Priority remediation order

1. **Now (before any testnet deployment with real users):** M-1 (quorum +
   reporting window) and M-2 (weight snapshots) — these are what actually
   protect the payout decision. H-2 (settlement window) follows directly.
2. **Before mainnet / real funds:** H-1 + L-3 (multisig owner, timelock,
   transferable two-step ownership), M-3 (explicit reserves + reentrancy
   guard), M-4 (escrow or retryable underfunded claims).
3. **Hygiene, any time:** ~~H-3/L-6 (`npm audit fix`), commit `package-lock.json`~~ (done 2026-09-28; `elliptic` accepted),
   M-5 (input bounds), L-5 (oracle deactivation), the NatSpec/doc fixes.
