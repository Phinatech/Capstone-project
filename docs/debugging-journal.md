# Debugging journal: on-chain purchases on the deployed site

How a purchase failure on `sokoto-cover.pages.dev` was diagnosed and fixed on
28–29 October 2026. The chain of errors is worth keeping: every layer of the
stack blamed the layer above it, and the contract turned out to be innocent
throughout.

## Symptoms, in order

| When | What the user saw | What the node said |
| --- | --- | --- |
| 28 Oct | Purchase spinner, then failure | `missing revert data` |
| 29 Oct 02:26 | Purchase blocked at confirmation | `insufficient funds for gas * price + value: address 0xcCb3… have 0 want 1000000000000000` |
| 29 Oct 02:34 | Purchase blocked by the app | "Your wallet's node reports 0.0 ETH … while Sepolia shows 0.1519 ETH" |
| 29 Oct ~03:20 | MetaMask confirmation, **Network: Ethereum** | — (about to spend real ETH) |
| 29 Oct 09:14 | Purchase confirmed | policy #0 on Sepolia |

The wallet held 0.152 SepoliaETH throughout. The premium was 0.001 ETH. The
arithmetic alone proved the error messages were lying about *something*.

## Diagnosis

1. **The contract was checked first and cleared.** A direct probe against
   `ethereum-sepolia-rpc.publicnode.com` ran the exact call the app makes —
   `buyPolicy(19, 8500, 0.01 ETH, value 0.001)` as a `eth_call` — and it
   succeeded. Every selector answered. If the chain accepts the call, the
   failure is in the plumbing between the page and the chain.
2. **The balance claim was checked second.** `eth_getBalance(0xcCb3…)` on two
   independent RPCs (PublicNode, Tenderly) returned **0.1519 ETH** while the
   node behind MetaMask answered **0**. The wallet's RPC (`sepolia.infura.io`)
   was reading stale state. The same endpoint had earlier failed gas
   estimation as `missing revert data` — ethers' wording for "the node failed
   the estimate but gave no revert reason", which no `require()` produces.
3. **The sender was checked third.** `addressOf()` returned `accounts[0]`,
   captured once at page load from `eth_requestAccounts`. Switching accounts
   in MetaMask left the app paying from a stale entry.
4. **The network was checked last — and it was the dangerous one.** A MetaMask
   confirmation dialog showed **Network: Ethereum** and dollar prices for a
   Sepolia purchase. `eth_getCode` at the contract address on mainnet returned
   0 bytes: confirming would have sent real ETH to a dead address.

## Root causes and fixes

All fixes are in `frontend/src/contexts/ChainPolicyProvider.tsx`.

| # | Root cause | Symptom | Fix | Commit |
| --- | --- | --- | --- | --- |
| 1 | Gas estimation delegated to the wallet's RPC (ethers estimates via `eth_sendTransaction` when no `gasLimit` is passed) | `missing revert data` | Estimate on the app's trusted RPC, pass an explicit `gasLimit` with 25% headroom | `26b3004` |
| 2 | Wallet RPC reports stale balances | `insufficient funds` for a funded account | Price everything from the trusted RPC; warn (don't block) when the wallet disagrees | `94f4c83`, `06f96b7` |
| 3 | Account list frozen at page load | Sends from the wrong account | Subscribe to `accountsChanged` and follow it | `1ad79c7` |
| 4 | No check of the wallet's chain before sending | Mainnet dialog for a Sepolia purchase | Ask `eth_chainId` before sending, attempt `wallet_switchEthereumChain` on mismatch, refuse with plain language otherwise; warn on `chainChanged` | `8f9c6bf`, `f57aa3c` |
| 5 | Raw ethers jargon in the UI | Confusing error text | `chainErrorMessage` maps the whole family (`INSUFFICIENT_FUNDS`, `missing revert data`, `network changed`) to sentences | `1ad79c7` |

## What made the difference

- **Trust the chain, not the wallet's node.** Every wrong number (balance 0,
  gas estimate failure) came from the wallet's RPC; every right number came
  from a node the app chose. Reads and pricing now go through the app's RPC;
  the wallet only signs.
- **Check the arithmetic before the code.** 0.152 ETH cannot fail to cover
  0.001 ETH at ~0 gas prices. The impossible error message pointed straight at
  the layer that was lying.
- **Inspect the deployed bundle, not just the repo.** The live site was running
  an older bundle for most of the session; several "it still fails" reports
  were the old code.
- **A wallet is a network citizen.** The account *and* the chain can change at
  any moment; anything cached from page load is stale by definition.

## Configuration findings (deployment)

| Finding | Evidence | Action |
| --- | --- | --- |
| Pages project lacked `API_URL` | `GET /api/demo-credentials` on `sokoto-cover.pages.dev` answered **500 "API_URL is not set on this Pages project"**; the demo-credentials panel on `/sign-in` rendered nothing | **Fixed 29 Oct**: `API_URL=https://sokoto-cover-api.onrender.com` set on the project via `wrangler pages secret put` and rebuilt; endpoint now answers. Per `docs/deployment.md`, `VITE_API_URL` should still be cleared from the build env so all calls go through the same-origin proxy |
| `METEOSTAT_API_KEY` (RapidAPI) is dead | Live call returns **403 "You are not subscribed to this API."** | Re-subscribe to Meteostat on RapidAPI and update the Render env var, or remove the key — the relayer then uses its historical GHCN fallback cleanly |
| `TERMINII_API_KEY` is inert | `SMS_PROVIDER` is unset and defaults to `africastalking` | Nothing to do; remove the key if you want less surface |

## Kept for the report

The failure is a good argument for a design rule the audit already states:
**an error message must name the layer that failed.** "insufficient funds" was
emitted by a node that could not see the account's funds; "missing revert data"
was emitted by an endpoint that failed without a reason; the actual chain never
refused anything until the wallet was about to sign on the wrong network.
