# Walkthrough video: shot list and script

**Target length:** 10 to 12 minutes · **Rubric sections covered:** 2A (core functionality), 2B (technical requirements), 2C (testing with inputs), 2D (testing strategies), 2E (performance and compatibility)

Recording tips: capture at 1440p, speak slowly, show the URL bar at the start of each scene, and keep the MetaMask window visible whenever a wallet prompt appears.

---

## Scene 0: the problem (0:00-0:40)

*"A millet farmer in Sokoto loses a season to drought. Traditional insurance needs someone to visit the field and assess the loss, and that costs more than the claim. Weather-index insurance replaces the assessment with a rainfall measurement: if rainfall falls below a threshold, the farmer is paid automatically. The question this project answers is who you trust for that number."*

Show: the sign-in page hero (`sokoto-cover.pages.dev`), then a 15-second slide: **3 sources → on-chain consensus → automatic payout**.

## Scene 1 (2A): agent sells cover (0:40-2:30)

1. Sign in as the **real field agent** (created through Sign up).
2. **Buy cover** → select the farmer, LGA, crop, coverage window, rainfall threshold (explain: the level below which the crop is damaged), payout amount (explain: premium = 10% of payout).
3. **Explain the naira leg**: the agent collects the premium from the farmer in cash and records the payment reference; the receipt is verified server-side against the chain (show the POST and its verification).
4. Click **Collect & buy policy** → MetaMask prompt appears (say: *"note the app checks which network the wallet is on and refuses to sign on the wrong chain"*).
5. Confirm → the policy appears with a toast and a receipt.

## Scene 2 (2A): the farmer's view (2:30-3:40)

1. Sign in as the **real farmer**.
2. **My policies** → the policy the agent just sold appears (attribution comes from the verified receipt).
3. **Policy detail** → show the *oracle evaluation*: per-source rainfall, weights, the threshold gauge.
4. **Payouts** page → explain push-payment settlement: *"There is no withdraw button. The contract sends the money to this wallet automatically when the window closes dry."*
5. Point at the live evidence: **Policy #0: bought 29 Oct, settled, 0.01 ETH paid out** (screenshot `04` in the report).

## Scene 3 (2A/B): admin console and the data path (3:40-5:30)

1. Sign in as the **admin** → Overview: real pool, premiums, payouts.
2. **Farmers & agents** → the real accounts with role badges.
3. **Policy #0 detail** → the settlement transaction hash (open Sepolia Etherscan in a tab and show the real payout transfer).
4. **Architecture beat (2B)**: 30-second diagram narration: *frontend (React/TS) → REST API (Express/TS) → Firebase (accounts, sessions, receipts) + ethers.js → Solidity on Sepolia; the relayer reads CHIRPS, NASA POWER and Meteostat and reports each dekad on-chain*. Show the relayer's log lines (`[relayer] …`).

## Scene 4 (2A): oracle research tools (5:30-7:00)

1. **Oracle sources** → three live sources + reputation weights.
2. **Consensus simulator** → corrupt **NASA POWER (inflated ×2.5)** → run: single +7%, equal **+59%**, reputation **+9%**. *"This is the core design claim: one corrupted source cannot decide a payout."*
3. **Backtest** → 121 historical dekads; CHIRPS MAE 24.4 mm vs NASA 30.3 mm; reputation weighting lands within 1.9 mm of the best source while guarding against the weaker one.

## Scene 5 (2C): testing with different inputs (7:00-8:30)

Show each failing gracefully (record the error text):

| Input | Expected and shown |
|---|---|
| Verify code wrong/expired | "That code is not valid or has expired" (single use, 5-attempt cap) |
| Sign in with wrong password | "That email and password do not match an account" (no account enumeration) |
| Buy with the wallet on the wrong network | The app asks for a network switch and refuses with plain-language guidance |
| Premium mismatch (direct contract call) | `wrong premium` revert |
| Role escalation in a profile edit | Ignored on the server (show the test name) |

## Scene 6 (2D): two testing strategies (8:30-10:00)

1. **Unit/functional**: run `npm run test` in the terminal and show **292 tests green** (56 Solidity including the reserves fuzz test, 13 integration, 193 backend, 20 frontend). *Chosen because the contract invariants are the product's fairness guarantees.* Name two bugs the suite caught (the resend route 404 and the seed-time password leak) and their regression tests.
2. **Integration/end to end**: show the Mocha lifecycle suite and the live deployment evidence (Policy #0's autonomous payout). *Chosen because the guarantees span HTTP, storage, wallet and chain.* Mention the wallet-infrastructure failures found this way (stale RPC state) and the hardening they forced.

## Scene 7 (2E): performance and compatibility (10:00-11:00)

- Numbers slide: API latency 0.44 to 0.82 s (Render free tier); build 8.3 s, 1.4 MB JS code split; test suite ~6.5 s; mobile layout at 390 px.
- Show the **mobile viewport** (DevTools device toolbar or a phone) with the farmer dashboard.
- **Cross-browser spot check (30 s):** open the same page in **Firefox** and **Safari** (or Edge) on camera. The sign-in page and farmer dashboard should render identically; rendering identically in three browser engines is the compatibility evidence.
- Wallet flows use only the EIP-1193 `window.ethereum` interface (MetaMask on Sepolia) and no browser-specific APIs, which is why portability holds.

## Scene 8: close (11:00-11:30)

*"Nothing on the screen is a mock. Real contracts on Sepolia, real rainfall data and a payout that ran with no human intervention. Thank you."*

Show: the live site + the repo URL.
