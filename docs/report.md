# Weather-Index Insurance on Ethereum: The Sokoto Rainfall Cover Platform

**BSc Software Engineering Capstone Project**

Chinemerem Judith Ugbo · Supervisor: Dr Aaron Izang

African Leadership University

October 2026

---

## Abstract

Smallholder farmers in Sokoto State, Nigeria, lose their harvests to drought with no
reliable way to insure against them: traditional crop insurance needs loss assessors,
paper claims and weeks of waiting, which makes it uneconomic at smallholder scale.
*Weather-index insurance* replaces all of that with a rainfall measurement — if rainfall
during the coverage period falls below a threshold agreed at purchase, the farmer is paid
automatically. The problem moves from assessing losses to trusting the rainfall number.
This project builds **Sokoto Rainfall Cover**, a decentralised application that settles
weather-index insurance on the Ethereum test network (Sepolia) using smart contracts, and
answers the trust question with three independent rainfall sources — CHIRPS, NASA POWER
and Meteostat — aggregated by a reputation-weighted consensus so that no single source can
decide a claim. The system comprises two Solidity contracts (insurance and oracle
aggregation), an Express/TypeScript backend running an oracle relayer, settlement keeper
and notification service, and a React frontend with separate farmer, field-agent and
administrator portals. Farmers can buy cover themselves from a wallet, or through a field
agent who collects the premium in naira; payouts are pushed automatically to the policy
holder's wallet at settlement, so no claim is ever filed. The contracts are covered by 56
Solidity tests (including fuzz and audit-regression tests), the backend and frontend by 33
more, and a manual security audit found and fixed four issues. A backtest against the 2023
season shows the reputation-weighted design holding the payout decision within 9% of the
sources' own mean while a corrupted feed moves an equally weighted design by 59%. The
platform is deployed and demonstrable end to end: one live policy was bought and paid out
autonomously during evaluation.

**Keywords:** weather-index insurance, smart contracts, Ethereum, oracle problem,
reputation weighting, decentralised applications, agricultural finance

---

## Table of contents

*(Generate in your word processor from the headings below.)*

---

## 1. Introduction

### 1.1 Background and motivation

Drought is the dominant risk for rain-fed farming in northern Nigeria. Sokoto State's
growing season runs on a handful of wet months split into ten-day *dekads*, and a dry
spell in any one of them can halve a millet or sorghum harvest. For a farming household
earning a few hundred dollars a year, one bad season means selling assets, pulling children
out of school or taking loans at usurious rates.

Insurance exists to smooth exactly this risk, but conventional crop insurance barely
reaches smallholder farmers. It requires someone to visit the field, assess the loss,
process a claim and pay out — a cost structure that only works for large farms (Jensen &
Barrett, 2017). *Weather-index insurance* removes the assessment step entirely: the policy
pays out when a measured weather variable — rainfall, in this project — falls below an
agreed level, regardless of what actually happened to any individual farm (Hazell et al.,
2010). The trade-off is well documented: index insurance is cheap and fast, but it exposes
the farmer to *basis risk* — the index may say "no drought" while their particular field
suffered — and it demands trust in whoever produces the number (Greatrex et al., 2015).

This project takes that trust problem as its central engineering question. A rainfall
index is only fair if the number is honest. The design answers it in two moves. First,
three independent data sources — the CHIRPS satellite–station blend, NASA POWER
reanalysis, and Meteostat station interpolation — each report rainfall for the insured
location directly to a smart contract. Second, the contract aggregates those reports with
*reputation weights* derived from how well each source has historically agreed with the
others, so one feed drifting (or lying) cannot move a payout decision on its own.

The settlement side removes a second layer of trust. Smart contracts on Ethereum execute
exactly as written: premiums, reserves and payouts are held and moved by code that no
party — not the insurer, not the agent, not the developer — can quietly change after the
fact. A farmer's payout is a deterministic function of the recorded rainfall and the
threshold chosen at purchase, executed automatically at the end of the coverage window.

### 1.2 Problem statement

Smallholder farmers in Sokoto State lack access to affordable drought insurance because
(1) claim assessment makes traditional policies uneconomic at their scale, (2) existing
index products ask farmers to trust a single opaque data provider and a centrally operated
payout process, and (3) payout delays under the very stress the insurance is meant to
cushion. There is no deployed system that combines multi-source rainfall consensus with
trust-minimised, automatic settlement for this population.

### 1.3 Objectives

1. **Design and implement** an Ethereum smart-contract system that sells rainfall-index
   policies, reserves their payouts, and settles them automatically against aggregated
   multi-source rainfall data.
2. **Design and implement** a reputation-weighted oracle aggregation mechanism in which
   three independent sources report each period and no single source can decide a payout.
3. **Implement** an automated data pipeline (oracle relayer and settlement keeper) that
   fetches real rainfall data for the insured location and reports it on-chain.
4. **Implement** a role-based web application (farmer, field agent, administrator) with
   wallet integration, covering purchase, monitoring, consensus research and backtesting.
5. **Evaluate** the system through automated testing, a security audit, and a backtest of
   the aggregation designs against historical (2023) rainfall.

### 1.4 Scope and limitations of the prototype

The prototype runs on the **Sepolia test network**; premiums and payouts are testnet ETH
and no real money is at stake. Payments between farmer and agent in naira are recorded
as receipts against the on-chain policy but are settled off-chain. The insured location is
a single point (Sokoto, 13.05°N 5.24°E) and the index is rainfall-only. Fiat on/off-ramps,
mobile-money integration and a production key-management setup are out of scope and
identified as future work in Chapter 9.

### 1.5 Report structure

Chapter 2 reviews weather-index insurance, blockchain settlement and the oracle problem.
Chapter 3 derives requirements. Chapters 4 and 5 describe design and implementation.
Chapter 6 evaluates the system against its objectives, Chapter 7 covers security, and
Chapter 8 describes deployment and operations. Chapter 9 discusses limitations and future
work, and Chapter 10 concludes.

---

## 2. Background and literature review

### 2.1 Weather-index insurance

Weather-index insurance (also called index-based crop insurance) pays out against a
measured weather variable rather than an assessed farm loss. Its advantages for
smallholder agriculture are well established: payouts are fast, assessment costs vanish,
and the product can be sold at scale (Hazell et al., 2010; Jensen & Barrett, 2017). Its
acknowledged weakness is *basis risk* — the gap between the index and the farmer's actual
experience — which is reduced by measuring rainfall close to where the farmer works and by
choosing thresholds and windows that match local practice (Greatrex et al., 2015). In
Sokoto State, farmers already reason in ten-day *dekads* within the June–September wet
season; this project's coverage windows follow that same dekad calendar, and its rainfall
index is the summed rainfall over the window's dekads.

### 2.2 Existing schemes and their trust problems

National and NGO index-insurance programmes (for example Africa Risk Capacity's
drought covers, and the long-running Indian and Ethiopian index schemes) show the model
can work at scale, but they share an architecture in which one institution measures the
index, decides the payout and holds the funds. The farmer's recourse is to trust that
institution's data and processes. Independent reviews consistently identify transparency
of the trigger and speed of payment as the two levers that determine farmer trust and
renewal (Greatrex et al., 2015). Both levers are addressed directly in this project's
design: the trigger is computed from three public data sources reported on-chain where
anyone can audit them, and payment is a contract-executed transfer, not a process.

### 2.3 Blockchain and smart contracts as settlement infrastructure

A smart contract is a program deployed to a blockchain whose execution is replicated and
verified by the network; its code is the agreement (Buterin, 2014). Ethereum adds a
general-purpose virtual machine (the EVM) and a mature tooling ecosystem (Solidity,
ethers.js, Hardhat, OpenZeppelin). For insurance, the relevant property is *credible
commitment*: once deployed, the payout rules cannot be altered unilaterally, and every
premium, reserve and payout is publicly traceable. Prior decentralised insurance
projects — notably Etherisc's flight-delay and crop products, and Arbol's parametric
weather covers for institutions — demonstrate the pattern commercially, but their
aggregation and payout logic is typically operated by a single oracle or a permissioned
operator. This project's contribution is to make the rainfall measurement itself a
multi-party, auditable input.

### 2.4 The oracle problem

Blockchains cannot see the outside world; feeding external data on-chain requires
*oracles*, and the reliability of that feed is the "oracle problem" (Halaburda et al.,
2020). Standard mitigations include multiple independent sources and aggregation
contracts. Chainlink's decentralized oracle networks aggregate many node operators for a
single data point, but each data point typically comes from one upstream vendor. For an
insurance index, upstream *source diversity* matters as much as node diversity: two
aggregators reading the same sensor share its failure modes. This project aggregates
three structurally different upstream sources — satellite blends (CHIRPS), numerical
reanalysis (NASA POWER) and station interpolation (Meteostat) — and weights them by
observed agreement rather than fixed shares.

### 2.5 Related work and the gap

| System | Index | Aggregation | Settlement | Gap addressed here |
| --- | --- | --- | --- | --- |
| National index schemes (e.g. ARC, Indian WBCIS) | rainfall/drought | single agency | centralised, claims-institution payment | transparent trigger, automatic payment |
| Etherisc | flight delay, parametric | single oracle | smart contract | multi-source weather consensus for agriculture |
| Arbol | weather for institutions | vendor data | contract + off-chain agreements | smallholder, self-service and agent flows |
| Chainlink feeds | price/weather | node-network aggregation | any contract | upstream source diversity, on-chain audit trail |
| **Sokoto Rainfall Cover** | dekad rainfall | **3 sources, reputation-weighted, on-chain** | **push-payment contract** | — |

No reviewed system combines (a) farmer-facing self-service purchase, (b) an agent model
for farmers without wallets, (c) on-chain multi-source rainfall consensus with
reputation weighting, and (d) automatic push-payment settlement. That combination is this
project's scope.

---

## 3. Requirements analysis

### 3.1 Stakeholders and personas

| Stakeholder | Needs |
| --- | --- |
| **Farmer** (e.g. Amina, millet farmer, Wamakko LGA) | affordable cover, transparent trigger, fast automatic payment, no paperwork |
| **Field agent** (e.g. Fatima) | sell cover to farmers who have no wallet, collect naira premiums, keep a commission trail |
| **Administrator** (insurer operator) | manage windows and the pool, monitor oracle health, research consensus behaviour, audit policies |
| **Operator/developer** | deploy, configure relayer and settlement, monitor notifications |

### 3.2 Functional requirements

**Policy lifecycle**

- FR1 The system shall sell a policy for a chosen coverage window, crop, LGA, rainfall
  threshold (mm) and payout amount, with the premium computed as 10% of the payout.
- FR2 The premium must be paid on-chain in ETH and the payout must be reserved at
  purchase so the pool can always honour it.
- FR3 A farmer shall be able to buy cover directly from their own wallet.
- FR4 A field agent shall be able to buy cover for a farmer, record the naira payment
  method and reference, and earn a commission; the receipt must be verifiable server-side
  against the on-chain policy.
- FR5 The system shall settle every policy automatically after its window ends and all
  dekads are finalized: payout if aggregated rainfall < threshold, otherwise no payout.
- FR6 Payouts shall be transferred to the policy holder's wallet without any claim step.

**Oracle and consensus**

- FR7 Three independent rainfall sources (CHIRPS, NASA POWER, Meteostat) shall each
  report the dekad rainfall for the insured location to the oracle contract.
- FR8 Each source shall report a dekad at most once, and only after the dekad has ended
  with complete data.
- FR9 The oracle contract shall aggregate reports with reputation weights derived from
  inter-source agreement and expose per-source weights and finalized aggregates.
- FR10 No single source shall be able to finalize an extreme reading into a payout
  (regression-tested after the security audit).

**Application**

- FR11 The application shall provide farmer, agent and admin portals with the pages
  listed in Appendix B.
- FR12 The application shall show each policy's live evaluation: per-source rainfall,
  weights, and whether the payout triggers.
- FR13 Administrators shall be able to simulate consensus strategies (single-source,
  equal weighting, reputation weighting) and stress-test them by corrupting one source's
  reading.
- FR14 Administrators shall be able to backtest aggregation designs over historical
  rainfall.
- FR15 The application shall notify farmers of purchase, payout and settlement in-app,
  and optionally by SMS and Telegram.

### 3.3 Non-functional requirements

| ID | Requirement | Realisation |
| --- | --- | --- |
| NFR1 Trust | settlement rules cannot be changed after purchase | immutable contract logic; premium rate changes never apply retroactively |
| NFR2 Availability | purchase and monitoring work despite wallet/RPC faults | trusted read RPC, explicit gas limits, wallet-state preflights (Chapter 5.5) |
| NFR3 Security | sessions, roles and keys protected | httpOnly SameSite=Lax cookies, server-side role checks, Turnstile CAPTCHA, timing-safe API keys |
| NFR4 Data quality | one bad feed cannot decide a payout | reputation weighting + audit regression tests |
| NFR5 Operability | one backend instance runs relayer and settlement | env-gated relayer; documented deployment (Chapter 8) |
| NFR6 Usability | farmers and agents use it without crypto knowledge | naira quotes, agent model, plain-language errors |
| NFR7 Cost | free-tier infrastructure only | Sepolia testnet, Render free tier, Cloudflare Pages, free data APIs |

### 3.4 Use cases

**UC1 Farmer buys cover.** Farmer signs in → Buy cover → chooses window, threshold,
payout → confirms the wallet transaction → policy appears in My policies with its live
evaluation.

**UC2 Agent sells cover.** Agent signs in → Buy cover for a farmer → selects farmer,
crop, window, threshold, payout → collects the naira premium (cash/transfer/mobile money)
and enters the payment reference → pays the premium from the agent wallet → receipt saved
and verified against the chain.

**UC3 Automatic settlement.** The relayer reports each ended dekad → the settlement
keeper calls `checkAndSettle` after the window finalizes → the contract pays or skips →
farmer and admin are notified in-app and (optionally) by SMS.

**UC4 Consensus research.** Admin opens Oracle sources → runs the consensus simulator
with one source corrupted → compares single, equal and reputation-weighted aggregates →
compares against the sources' uncorrupted mean.

*(Use-case diagrams and sequence diagrams are generated as Mermaid sources in
`docs/figures/` — see Appendix A.)*

---

## 4. System design and architecture

### 4.1 Architecture overview

The system has four layers: the **Ethereum contracts** (the source of truth for policies,
oracle reports and money), an **off-chain backend** that feeds and drives them, a
**React frontend** with three role-based portals, and **external data** (three rainfall
APIs, an FX rate API, SMS/Telegram providers).

```
  Rainfall sources                 Users
  CHIRPS · NASA POWER              Farmer · Agent · Admin
  Meteostat                               │
     │  (daily fetch)                     │ browser + MetaMask
     ▼                                    ▼
┌────────────────┐   txs/receipts   ┌────────────────────┐
│ Backend (Render)│───────────────▶ │ React SPA (Pages)   │
│ · REST API      │◀─────────────── │ · farmer portal     │
│ · oracle relayer│   JSON, same    │ · agent portal      │
│ · settlement    │   origin proxy  │ · admin console     │
│ · notifier      │                 └─────────┬──────────┘
└────────┬───────┘                            │ signed txs / reads
         │ signed reports                     ▼
         ▼                          ┌────────────────────┐
┌───────────────────────────────────┤  Ethereum Sepolia  │
│ WeatherIndexInsurance · OracleAggregator (Solidity)  │
└───────────────────────────────────┴────────────────────┘
```

Trust boundaries: the **contracts** are the only components that hold value and are
treated as adversarial-facing (audited, heavily tested); the **backend** is a convenience
and liveness layer — it can delay data but cannot forge a payout, because every number a
payout depends on is reported on-chain by distinct oracle accounts and is publicly
auditable; the **frontend** never holds keys or sessions (the wallet signs, the server
keeps httpOnly sessions).

### 4.2 Smart contract design

**`WeatherIndexInsurance`** holds the policy lifecycle.

- *Coverage windows.* The owner opens windows (`addWindow`) defined as a list of dekad
  period ids and a sales-close timestamp. This project's windows follow the Sokoto
  calendar (e.g. window #19 = Sep D2–Oct D1).
- *Purchase.* `buyPolicy(windowId, droughtThresholdMm, payoutAmount)` requires
  `msg.value == quotePremium(payoutAmount)`, where the premium is 10% of the payout
  (`premiumRateBps = 1000`), rounded up so it is never zero. The contract records
  `farmer = msg.sender`, and reserves the payout immediately: `reservedPayouts` grows by
  the payout amount and `availableCapacity()` (= balance − reserved) enforces that the
  pool can always honour every sold policy. A sale that would over-commit the pool
  reverts.
- *Settlement.* `checkAndSettle(policyId)` is callable by anyone exactly once per policy.
  It reverts until every dekad of the window is finalized in the oracle contract, then
  reads `windowRainfall(windowId)` — the reputation-weighted sum — and either transfers
  the payout to the policy holder (`PayoutTriggered`) or records no payout
  (`PayoutSkipped`). The transfer is a push payment: there is no withdrawal step and no
  claim to file.
- *Administration.* The premium rate can be changed but only affects future quotes;
  ownership moves via a deliberate two-step transfer (`transferOwnership` → `accept`),
  which the audit regression tests pin down.

**`OracleAggregator`** holds the measurement side.

- *Registry.* The owner registers the oracle accounts behind each source label
  (CHIRPS, NASA_POWER, Meteostat) and can retire a compromised account without losing
  its history.
- *Reporting.* Each oracle reports a dekad's rainfall once, after the dekad ends. A
  report is `rainfallMm × 100` (fixed-point, two decimals).
- *Finalization and weights.* When sufficient coverage exists, the dekad finalizes at a
  reputation-weighted aggregate. `weightForPeriod(period, oracle)` exposes the weight
  used per period; `isFinalized` / `finalizedAggregate` expose the outcome. Reputations
  are updated so that sources which agree with their peers gain weight and outliers lose
  it, and changes mid-dekad are ignored (audit finding M-2).

### 4.3 Oracle consensus: reputation weighting

For each finalized dekad, each reporting source receives a weight proportional to its
reputation score, which is updated from its agreement with the other sources' reports.
The design intent is the property the simulator demonstrates (Chapter 6): a single
corrupted feed shifts the **single-source** aggregate by the full corruption, the
**equal-weight** aggregate by one third of it, and the **reputation-weighted** aggregate
by much less — both because the corrupt source is down-weighted immediately and because
its historical weight was already lower if it had drifted before. A source that never
reports simply gets zero weight; the aggregate remains usable (regression-tested).

### 4.4 Backend services

An Express/TypeScript service (deployed on Render) exposes the REST API (Appendix B) and
runs three background roles, all gated so that exactly one instance runs them:

1. **Oracle relayer** — for each ended dekad, fetches daily rainfall for the insured
   point from each source and submits one signed report per source with that source's
   dedicated oracle key. CHIRPS comes from the Climate Hazards Center's daily GeoTIFF
   archive (cached, concurrency-limited), NASA POWER from its JSON API, and Meteostat
   from its RapidAPI point/daily endpoint (with a historical GHCN-series fallback when no
   key is configured). A dekad is only reported once every day of it is covered, because
   the aggregator accepts one report per source per dekad and a partial total could never
   be corrected. Meteostat is deliberately polled at most once per 6 hours to fit its free
   plan's request budget.
2. **Settlement keeper** — when every dekad of a sold policy's window is finalized, it
   calls `checkAndSettle`, retrying through RPC hiccups.
3. **Notifier** — watches new blocks for `PolicyCreated`, `PayoutTriggered` and
   `PayoutSkipped`, and dispatches in-app notifications plus optional SMS (Africa's
   Talking) and Telegram messages to the policy holder (matched by wallet) and operator
   numbers.

Security-relevant API design: sessions are httpOnly, `SameSite=Lax` cookies; the
Cloudflare Pages function proxies `/api` and `/auth` same-origin so that cookie flows on
one origin (Chapter 8); role checks (`requireRole`) run server-side; the agent-receipt
endpoint re-reads the chain and rejects receipts whose premium, payout or window do not
match the on-chain policy; the manual SMS endpoint requires a bearer key compared in
constant time and is rate-limited per hour.

### 4.5 Frontend design

A React + Vite + TypeScript single-page application with three role-based portals
(Farmer, Agent, Admin) sharing an authentication context, an FX context (naira quotes),
a notifications context and a policy context. The policy context has two providers: a
chain provider that reads the deployed contracts through a trusted RPC and submits
wallet-signed transactions, and a simulated provider used when no chain is reachable,
which powers the consensus simulator and the demo mode. Wallet integration is described
in 5.5. The admin console embeds the *oracle research* tools: the consensus simulator
(which re-runs a real dekad under a chosen strategy with one source optionally corrupted)
and the backtest runner over historical seasons.

### 4.6 Data model

On-chain: `CoverageWindow { periods[], salesCloseAt }`, `Policy { farmer, windowId,
droughtThresholdMm, payoutAmount, premiumPaid, settled }`, oracle registry +
per-period reports and weights. Off-chain: users (name, role, LGA, wallet, phone), agent
sales receipts (policy id, farmer, premium/payout in ETH and naira, commission, payment
method and reference, FX rate used, timestamp), sessions, and cached chain reads with
short TTLs. The data-model page in the admin console renders this schema for inspection.

### 4.7 Key sequence flows

**Purchase (agent).** Agent fills the form → the app quotes the premium via
`quotePremium` on the trusted RPC → pre-estimates gas and asks the wallet (with an
explicit gas limit and a chain check) to send `buyPolicy` → the contract reserves the
payout and emits `PolicyCreated` → the app saves the agent receipt (verified by the
server against the chain) → farmer and admin are notified.

**Report.** Relayer waits for the dekad to end with full source coverage → fetches
daily rainfall from each source → submits one report per source → the aggregator
finalizes the dekad with reputation weights.

**Settlement.** All dekads finalized → settlement keeper calls `checkAndSettle` →
contract compares weighted rainfall to the threshold → pushes the payout to the policy
holder or records no payout → notifier informs farmer and admin → the farmer's Payouts
page shows the amount, outcome and settlement transaction.

---

## 5. Implementation

### 5.1 Technology stack and rationale

| Layer | Choice | Why |
| --- | --- | --- |
| Contracts | Solidity + Hardhat 3, ethers v6 | industry standard; Hardhat 3's Solidity and TS test layers gave both fuzz tests and integration tests |
| Chain | Ethereum Sepolia | real network behaviour (gas, wallets) with no real-money risk |
| Backend | Node 22, Express, TypeScript | one language across the stack; the relayer needed mature HTTP/RPC tooling |
| Frontend | React + Vite + TypeScript | component ecosystem; strict typing end-to-end (`tsc --noEmit` in CI habits) |
| Hosting | Cloudflare Pages + Render free tier | zero cost, git-push deploys, fits NFR7 |
| Data | CHIRPS, NASA POWER, Meteostat | three structurally different measurement families |

### 5.2 Smart contracts

Both contracts are written to make failure modes explicit: purchases revert on wrong
premium, unknown or closed windows, and on sales the pool cannot cover; reporting reverts
on duplicates and early reports; settlement reverts on unknown, unsettled-again, or
not-yet-finalized policies. Fixed-point rainfall (`mm × 100`) keeps precision in integers.
The premium rounds *up* so it is never zero (regression-tested). Reserves are tracked
explicitly so the invariant *reserves ≤ pool balance* holds — and is fuzz-tested.

### 5.3 Oracle relayer and data sources

The relayer treats each source's quirks as first-class: CHIRPS daily GeoTIFFs are read
for the exact insured pixel with a persistent cache and bounded concurrency; NASA POWER
answers JSON directly; Meteostat lags up to a week and is polled conservatively, falling
back to a bundled historical GHCN series (Birni N'Konni station) when unkeyed. Because
the aggregator accepts exactly one report per source per dekad, the relayer only reports
when every day of the dekad is covered — a partial total could never be corrected, so
late-but-complete beats early-but-partial. RPC submissions go through a retry wrapper so
a transient node failure does not skip a dekad.

### 5.4 Backend API and session security

The API layering is deliberately boring: cached chain reads for anonymous data, cookie
sessions for personal data, role gates for agent/admin actions, and one bearer-keyed
operational endpoint. Receipts written by agents are *verified* server-side against the
chain before storage, so a tampered client cannot inflate commission or fake a sale.

### 5.5 Frontend and wallet hardening

Wallet integration proved the most failure-prone surface of the project, and the fixes
generalise into four rules (full detail in Appendix C):

1. **Trust the chain's RPC for reading and pricing.** Wallet-side RPC endpoints returned
   stale balances ("insufficient funds" for a funded account) and failed gas estimation
   with reasonless errors ("missing revert data"). Reads and quotes now go through the
   app's own RPC, and gas is pre-estimated there and passed to the wallet explicitly.
2. **Never cache wallet state.** The account list captured at page load went stale on
   account switches; the app now follows `accountsChanged`, and a wallet/chain
   disagreement is a warning while the chain's own view decides affordability.
3. **Check the wallet's chain before signing.** A confirmation prepared while MetaMask
   sat on Ethereum mainnet would have sent real ETH to an address holding no code there.
   The app now asks the wallet for its chain, requests a switch (`wallet_switchEthereumChain`)
   on mismatch, and refuses with plain language otherwise.
4. **Errors must name the layer that failed.** Raw ethers jargon is translated into
   actionable sentences (which account, which network, what to do).

### 5.6 Cross-cutting concerns

- **Naira quoting.** An FX context fetches ETH→NGN rates with per-provider fallback and
  degrades to approximate figures with a visible notice — the contract always settles in
  ETH; naira figures are for the farmer conversation.
- **Notifications.** One activity pipeline feeds in-app notifications, SMS templates that
  fit a single 160-character SMS, and an operator Telegram channel.
- **Internationalisation and preferences.** English/Hausa/French strings and a language
  hint to the Google sign-in flow; theme and accessibility preferences persist per user.
