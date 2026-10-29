import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, Network, formatEther, parseEther, type EventLog, type Log } from 'ethers';
import { toast } from 'sonner';
import abi from '../chain/abi.json';
import { LOCAL_CHAIN_ID, SOURCE_BY_LABEL, localAccountIndex, type ChainConfig } from '../chain/config';
import { LoadingScreen } from '../components/LoadingScreen';
import { findUser, getFarmers } from '../utils/users';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { PolicyContext, type PolicyContextValue, type PurchaseInput, type WindowOption } from './policyContextCore';
import { notifyPurchase, notifySettlement } from './policyNotifications';
import { SimulatedPolicyProvider } from './SimulatedPolicyProvider';
import type { EvaluationResult, Policy, SourceReading } from '../types/insurance';
import type { User } from '../types/user';

type Connection =
  {phase: 'connecting';} |
  {phase: 'ready';provider: JsonRpcProvider | BrowserProvider;chainId: bigint;accounts: string[];isWallet: boolean;} |
  {phase: 'failed';reason: string;};

async function rpc(url: string, method: string, timeoutMs = 3000, params: unknown[] = []): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

async function connect(config: ChainConfig): Promise<Connection> {
  let chainId: bigint;
  try {
    chainId = BigInt(await rpc(config.rpcUrl, 'eth_chainId'));
  } catch {
    return { phase: 'failed', reason: `No chain node answered at ${config.rpcUrl}. Start one with "npm run chain", then "npm run seed:local".` };
  }

  // For non-local chains, try browser wallet first
  if (chainId !== LOCAL_CHAIN_ID && typeof window !== 'undefined' && window.ethereum) {
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send('eth_requestAccounts', []);
      if (accounts.length > 0) {
        // Ask the RPC this app already reads from, not the wallet's own
        // endpoint: that one rate-limits under load, and a failed answer here
        // used to drop the whole app into read-only mode — where addressOf
        // returns nothing, every balance reads 0, and the buy form reports
        // that as "not enough ETH in your agent wallet".
        let code: string | null = null;
        try {
          code = await rpc(config.rpcUrl, 'eth_getCode', 8000, [config.insuranceAddress, 'latest']);
        } catch {
          // Same endpoint answered eth_chainId moments ago, so an RPC blip
          // must not cost us the wallet. Only a definite "no code here"
          // should, and that is the '0x' below.
        }
        if (code !== '0x') {
          return { phase: 'ready', provider: browserProvider, chainId, accounts, isWallet: true };
        }
      }
    } catch {
      // Fall through to read-only mode
    }
  }

  // Local chain or fallback: read-only with unlocked accounts
  const provider = new JsonRpcProvider(config.rpcUrl, Network.from(chainId), { staticNetwork: true, pollingInterval: 2000 });
  if ((await provider.getCode(config.insuranceAddress)) === '0x') {
    provider.destroy();
    return {
      phase: 'failed',
      reason: 'The insurance contract is not deployed on this chain. A local node forgets everything when it restarts, so run "npm run seed:local" again.'
    };
  }
  const accounts: string[] = chainId === LOCAL_CHAIN_ID ? await provider.send('eth_accounts', []) : [];
  return { phase: 'ready', provider, chainId, accounts, isWallet: false };
}

/** Policies read from, and transactions sent to, the deployed contracts. */
export function ChainPolicyProvider({ config, children }: {config: ChainConfig;children: React.ReactNode;}) {
  const [conn, setConn] = useState<Connection>({ phase: 'connecting' });

  useEffect(() => {
    let cancelled = false;
    connect(config).then((c) => {
      if (cancelled) {
        if (c.phase === 'ready') c.provider.destroy();
        return;
      }
      // Deferred so the Toaster, which renders inside the app, is mounted.
      if (c.phase === 'failed') setTimeout(() => toast.warning('Showing simulated data', { description: c.reason, duration: 12000 }), 500);
      setConn(c);
    });
    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => () => {
    if (conn.phase === 'ready') conn.provider.destroy();
  }, [conn]);

  if (conn.phase === 'connecting') return <LoadingScreen label="Connecting to the chain" />;
  if (conn.phase === 'failed') return <SimulatedPolicyProvider reason={conn.reason}>{children}</SimulatedPolicyProvider>;
  return (
    <ChainData config={config} provider={conn.provider} chainId={conn.chainId} accounts={conn.accounts} isWallet={conn.isWallet}>
      {children}
    </ChainData>);

}

// ---------- Reading the contracts ----------

interface Snapshot {
  policies: Policy[];
  balances: Record<string, number>;
  poolEth: number;
  windowCount: number;
  windows: WindowOption[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A period id is YYYYMMD: 2026092 is 2026, September, second dekad. */
function dekadLabel(period: number): string {
  const month = Math.floor(period / 10) % 100;
  return `${MONTHS[month - 1] ?? month} D${period % 10}`;
}

function windowCloses(salesCloseAt: number): string {
  return new Date(salesCloseAt * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Which dekads a window insures, e.g. "Sep D2 – Oct D1". */
function windowCovers(periods: number[]): string {
  if (periods.length === 0) return '—';
  if (periods.length === 1) return dekadLabel(periods[0]);
  return `${dekadLabel(periods[0])} – ${dekadLabel(periods[periods.length - 1])}`;
}

interface OracleInfo {
  address: string;
  label: string;
  /** False once the owner deactivates it (e.g. after a key rotation). */
  registered: boolean;
}

interface Settlement {
  triggered: boolean;
  rainfall: bigint;
  log: EventLog;
}

// Location and crop aren't stored on-chain; the buyer's browser keeps them.
type PolicyMeta = Record<number, {lga: string;crop: string;farmer: string;}>;
const metaKey = (insurance: string) => `sokoto-cover-policy-meta:${insurance.toLowerCase()}`;

function readMeta(insurance: string): PolicyMeta {
  try {
    return JSON.parse(localStorage.getItem(metaKey(insurance)) ?? '{}');
  } catch {
    return {};
  }
}

function writeMeta(insurance: string, id: number, entry: PolicyMeta[number]) {
  try {
    localStorage.setItem(metaKey(insurance), JSON.stringify({ ...readMeta(insurance), [id]: entry }));
  } catch {

    /* storage unavailable: the policy falls back to the farmer's profile */
  }
}



function knownUsers(current: User | null): User[] {
  const list = [...getFarmers(), findUser('admin-1'), current].filter((u): u is User => !!u);
  return [...new Map(list.map((u) => [u.id, u])).values()];
}

const FRIENDLY_REVERTS: Record<string, string> = {
  'window not finalized yet': "The oracles haven't finalized every dekad in this window yet, so it can't be settled.",
  'sales closed for window': 'Sales for this coverage window have closed.',
  'pool cannot cover payout': "The payout pool can't cover this payout right now.",
  'already settled': 'This policy has already been settled.',
  'wrong premium': "The premium sent didn't match the contract's quote."
};

function chainLabel(chainId: bigint): string {
  if (chainId === 1n) return 'Ethereum mainnet';
  if (chainId === 11155111n) return 'the Sepolia testnet';
  return `chain ${chainId}`;
}

function chainErrorMessage(e: unknown): string {
  const err = e as {reason?: string;shortMessage?: string;message?: string;code?: string;};
  const reason = err.reason?.replace(/^\w+: /, '');
  if (reason) return FRIENDLY_REVERTS[reason] ?? `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
  const raw = err.shortMessage ?? err.message ?? '';
  // "missing revert data" is ethers' way of saying the node reported a failure
  // with no reason at all: no require() fired, so this is infrastructure — the
  // wallet's RPC failing or rate-limiting mid-estimate — or an account that
  // cannot cover the premium plus gas. Say so instead of echoing jargon.
  if (err.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(raw)) {
    return "The wallet says this account can't cover the premium plus gas. If MetaMask is showing a different account with funds, switch back to it or reload the page so the app picks up the account you're using now.";
  }
  if (/missing revert data/i.test(raw)) {
    return "The node couldn't say why the transaction failed — usually the wallet's RPC is busy, or this account doesn't cover the premium plus gas. Check the balance in MetaMask, wait a moment, then try again.";
  }
  if (/network changed|chain.?changed/i.test(raw)) {
    return 'MetaMask changed networks while the page was open. Reload the page on the right network and try again.';
  }
  return raw || 'The transaction failed.';
}

function chainEvaluation(
policy: Policy,
periods: bigint[],
oracles: OracleInfo[],
readings: Map<string, bigint>,
periodWeights: Map<string, bigint>,
settlement: Settlement,
gasUsed: bigint,
timestamp: number)
: EvaluationResult {
  // A source's weight in each dekad is its snapshot weight (fixed at the
  // dekad's first reading) over the total of the sources that reported, as in
  // OracleAggregator.finalizePeriod; the window's figure averages the dekads.
  const shareIn = (p: bigint, o: OracleInfo) => {
    if (!readings.has(`${p}:${o.address}`)) return 0;
    const total = oracles.reduce(
      (t, x) => readings.has(`${p}:${x.address}`) ? t + Number(periodWeights.get(`${p}:${x.address}`) ?? 0n) : t,
      0
    );
    return total ? Number(periodWeights.get(`${p}:${o.address}`) ?? 0n) / total : 0;
  };
  // A deactivated oracle only appears where it reported, so a rotated source isn't listed twice.
  const sources = oracles.filter((o) => o.registered || periods.some((p) => readings.has(`${p}:${o.address}`)));
  const sourceReadings: SourceReading[] = sources.flatMap((o) => {
    const sourceId = SOURCE_BY_LABEL[o.label];
    if (!sourceId) return [];
    const mm = periods.reduce((sum, p) => sum + Number(readings.get(`${p}:${o.address}`) ?? 0n), 0) / 100;
    const weight = periods.length ? periods.reduce((sum, p) => sum + shareIn(p, o), 0) / periods.length : 0;
    return [{ sourceId, value: mm, weight, corrupted: false }];
  });
  return {
    mode: 'reputation',
    readings: sourceReadings,
    aggregateMm: Number(settlement.rainfall) / 100,
    thresholdMm: policy.thresholdMm,
    triggered: settlement.triggered,
    referenceMm: NaN, // no rain-gauge record on-chain
    referenceTriggered: settlement.triggered,
    gasUsed: Number(gasUsed),
    latencySec: NaN,
    txHash: settlement.log.transactionHash,
    evaluatedAt: new Date(timestamp * 1000).toISOString(),
    corruption: null,
    simulated: false
  };
}

function ChainData({
  config,
  provider,
  chainId,
  accounts,
  isWallet,
  children


}: {config: ChainConfig;provider: JsonRpcProvider | BrowserProvider;chainId: bigint;accounts: string[];isWallet: boolean;children: React.ReactNode;}) {
  const { user } = useAuth();
  const { notify } = useNotifications();
  // The wallet's account list is captured when the page loads. Once the user
  // switches accounts in MetaMask, paying from the stale entry makes the node
  // answer "insufficient funds" while the panel shows a funded account — so
  // follow the wallet's changes instead of trusting the page-load snapshot.
  const [liveAccounts, setLiveAccounts] = useState(accounts);
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!isWallet || !eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const next = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      setLiveAccounts(next);
    };
    eth.on('accountsChanged', onAccounts);
    return () => eth.removeListener('accountsChanged', onAccounts);
  }, [isWallet]);
  // The wallet can also hop to another chain at any moment. A send then goes
  // out wherever it now is — on Ethereum mainnet that means real funds to an
  // address that only holds this contract on Sepolia — so say so loudly.
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!isWallet || !eth?.on) return;
    const onChain = (...args: unknown[]) => {
      const next = typeof args[0] === 'string' ? BigInt(args[0]) : null;
      if (next !== null && next !== chainId) {
        toast.warning('MetaMask switched networks', {
          description: `This app trades on ${chainLabel(chainId)}. Switch MetaMask back before buying cover — a purchase sent now would go out on ${chainLabel(next)}.`,
          duration: 12000
        });
      }
    };
    eth.on('chainChanged', onChain);
    return () => eth.removeListener('chainChanged', onChain);
  }, [isWallet, chainId]);
  const local = chainId === LOCAL_CHAIN_ID && liveAccounts.length > 0;
  const insurance = useMemo(() => new Contract(config.insuranceAddress, abi.WeatherIndexInsurance, provider), [config, provider]);
  const aggregator = useMemo(() => new Contract(config.aggregatorAddress, abi.OracleAggregator, provider), [config, provider]);
  // In wallet mode `provider` is MetaMask's own endpoint, which rate-limits
  // under load. Balances read through it came back failed or zero and the buy
  // form reported that as an empty wallet. This is the RPC that just answered
  // eth_chainId and eth_getCode, so it is the one worth asking.
  const readProvider = useMemo(
    () => new JsonRpcProvider(config.rpcUrl, Network.from(chainId), { staticNetwork: true, pollingInterval: 2000 }),
    [config.rpcUrl, chainId]
  );
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  // Policies bought in this browser that the API's (cached) reads don't include yet.
  const unindexed = useRef(new Map<number, Policy>());

  // A read-only copy of the policy contract. Reads belong on the RPC that
  // answers; only the transaction itself needs the wallet. quotePremium is an
  // eth_call, and routing it through MetaMask's node returned
  // "could not decode result data" whenever that endpoint was having trouble.
  const insuranceRead = useMemo(
    () => new Contract(config.insuranceAddress, abi.WeatherIndexInsurance, readProvider),
    [config, readProvider]
  );

  const addressOf = useCallback(
    (userId: string): string | undefined => {
      if (local) return liveAccounts[localAccountIndex(userId)];
      if (isWallet && liveAccounts.length > 0) return liveAccounts[0];
      return undefined;
    },
    [local, isWallet, liveAccounts]
  );

  /** `minBlock`: ask the API for data read at or after this block, i.e. our own transaction's. */
  const load = useCallback(async (minBlock?: number): Promise<Snapshot> => {
    const users = knownUsers(user);
    const idByAddress = new Map<string, string>();
    users.forEach((u) => {
      const a = addressOf(u.id);
      if (a) idByAddress.set(a.toLowerCase(), u.id);
    });

    // Fetch all data from the cached API instead of making dozens of RPC calls
    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    const fresh = minBlock === undefined ? '' : `?minBlock=${minBlock}`;
    const [policiesRes, oraclesRes, windowsRes, evaluationsRes] = await Promise.all([
      fetch(`${apiUrl}/api/policies${fresh}`),
      fetch(`${apiUrl}/api/oracles${fresh}`),
      fetch(`${apiUrl}/api/windows${fresh}`),
      fetch(`${apiUrl}/api/evaluations${fresh}`),
    ]);

    if (!policiesRes.ok || !oraclesRes.ok || !windowsRes.ok || !evaluationsRes.ok) {
      throw new Error('Failed to fetch data from the API');
    }

    const { policies: rawPolicies } = await policiesRes.json() as { policies: Array<{ id: number; farmer: string; windowId: number; droughtThresholdMm: number; payoutAmount: string; premiumPaid: string; settled: boolean }> };
    const { oracles: rawOracles } = await oraclesRes.json() as { oracles: Array<{ address: string; label: string; registered: boolean; reputationWeight: number }> };
    const { windows: rawWindows } = await windowsRes.json() as { windows: Array<{ id: number; salesCloseAt: number; periods: number[] }> };
    const { evaluations: rawEvaluations } = await evaluationsRes.json() as { evaluations: Array<{ policyId: number; settlement: { policyId: number; triggered: boolean; rainfallMm: number; txHash: string; blockNumber: number } | null; readings: Array<{ period: number; oracle: string; rainfallMm: number }>; periodWeights: Record<string, number>; gasUsed: string; purchasedAtTimestamp: number; settlementTimestamp: number }> };

    const oracles: OracleInfo[] = rawOracles.map((o) => ({ address: o.address.toLowerCase(), label: o.label, registered: o.registered }));
    const windows = rawWindows.map((w) => w.periods.map(BigInt));
    const windowOptions: WindowOption[] = rawWindows.map((w) => {
      const closes = windowCloses(w.salesCloseAt);
      return {
        id: String(w.id),
        label: `Window #${w.id} · closes ${closes}`,
        open: w.salesCloseAt * 1000 > Date.now(),
        covers: windowCovers(w.periods),
        closes,
        periods: w.periods
      };
    });
    const readings = new Map<string, bigint>();
    for (const r of rawEvaluations.flatMap((e) => e.readings)) {
      readings.set(`${r.period}:${r.oracle.toLowerCase()}`, BigInt(r.rainfallMm));
    }
    const periodWeights = new Map<string, bigint>();
    for (const e of rawEvaluations) {
      for (const [key, weight] of Object.entries(e.periodWeights)) {
        periodWeights.set(key, BigInt(weight));
      }
    }
    const gasUsed = new Map<string, bigint>();
    for (const e of rawEvaluations) {
      if (e.settlement) gasUsed.set(e.settlement.txHash, BigInt(e.gasUsed));
    }
    const timestamps = new Map<number, number>();
    for (const e of rawEvaluations) {
      if (e.settlement) timestamps.set(e.settlement.blockNumber, e.settlementTimestamp);
    }

    const meta = readMeta(config.insuranceAddress);
    const policies = rawPolicies.map((p): Policy => {
      const farmerAddress = p.farmer.toLowerCase();
      const farmerId = idByAddress.get(farmerAddress) ?? p.farmer;
      const farmer = findUser(farmerId);
      const saved = meta[p.id]?.farmer === farmerAddress ? meta[p.id] : undefined;
      const windowIndex = p.windowId;
      const evalData = rawEvaluations.find((e) => e.policyId === p.id);
      const policy: Policy = {
        id: p.id,
        farmerId,
        lga: saved?.lga ?? farmer?.lga ?? '—',
        crop: saved?.crop ?? farmer?.primaryCrop ?? 'Millet',
        windowId: String(windowIndex),
        thresholdMm: p.droughtThresholdMm / 100,
        premiumEth: Number(p.premiumPaid),
        payoutEth: Number(p.payoutAmount),
        purchasedAt: new Date((evalData?.purchasedAtTimestamp ?? 0) * 1000).toISOString().slice(0, 10),
        status: 'active'
      };
      const s = evalData?.settlement ?? null;
      if (!s) return policy;
      const settlement: Settlement = {
        triggered: s.triggered,
        rainfall: BigInt(s.rainfallMm),
        log: { transactionHash: s.txHash, blockNumber: s.blockNumber } as EventLog,
      };
      return {
        ...policy,
        status: s.triggered ? 'paid' : 'no_payout',
        evaluation: chainEvaluation(
          policy,
          windows[windowIndex] ?? [],
          oracles,
          readings,
          periodWeights,
          settlement,
          gasUsed.get(s.txHash) ?? 0n,
          timestamps.get(s.blockNumber) ?? 0
        )
      };
    }).reverse();
    for (const [id, bought] of unindexed.current) {
      if (policies.some((p) => p.id === id)) unindexed.current.delete(id);else
      policies.unshift(bought);
    }

    const balances: Record<string, number> = {};
    await Promise.all(
      users.map(async (u) => {
        const a = addressOf(u.id);
        if (!a) return;
        // Neither read may take the snapshot down with it. A failed balance
        // leaves the entry unset, and walletConnected is what lets the form
        // call that "not connected" rather than "broke".
        try {
          balances[u.id] = Number(formatEther(await readProvider.getBalance(a)));
        } catch {
          try {
            balances[u.id] = Number(formatEther(await provider.getBalance(a)));
          } catch {
            /* leave unset rather than guess at 0 */
          }
        }
      })
    );
    const poolEth = Number(await (await fetch(`${apiUrl}/api/pool${fresh}`)).json().then((r: { balance: string }) => r.balance));
    return { policies, balances, poolEth, windowCount: windows.length, windows: windowOptions };
  }, [user, addressOf, insurance, aggregator, provider, readProvider, config.insuranceAddress]);

  // Reload on every new block; overlapping reloads collapse into one follow-up.
  const busy = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      setSnapshot(await load());
      setLoadError(null);
    } catch (e) {
      setLoadError(chainErrorMessage(e));
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void refresh();
      }
    }
  }, [load]);

  useEffect(() => {
    void refresh();
    const onBlock = () => void refresh();
    void provider.on('block', onBlock);
    return () => {
      void provider.off('block', onBlock);
    };
  }, [provider, refresh]);

  const purchasePolicy = useCallback(
    async (farmerId: string, input: PurchaseInput) => {
      const from = addressOf(farmerId);
      if (!from) throw new Error('Buying cover on this network needs a browser wallet. Connect MetaMask and try again.');
      // The wallet may sit on a different chain than this app trades on —
      // MetaMask switched to Ethereum mainnet, say. It would then sign a
      // mainnet transfer to an address that only holds this contract on
      // Sepolia: real funds sent into thin air. Ask the wallet which chain it
      // is on right now, before anything is prepared for signing. A wallet
      // whose UI has moved on but whose link to this page is stale answers
      // for the old chain too, and asking it to switch resyncs both cases.
      const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
      if (isWallet && eth?.request) {
        const walletChain = async () => BigInt((await eth.request({ method: 'eth_chainId' })) as string);
        let current = await walletChain();
        if (current !== chainId) {
          try {
            await eth.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${chainId.toString(16)}` }]
            });
          } catch {
            // The check below names the mismatch either way.
          }
          current = await walletChain();
        }
        if (current !== chainId) {
          throw new Error(
            `MetaMask is on ${chainLabel(current)}, but this purchase belongs on ${chainLabel(chainId)}. ` +
            `Switch MetaMask to ${chainLabel(chainId)} and try again — confirming now would send funds on the wrong chain. ` +
            `If MetaMask already shows ${chainLabel(chainId)}, its link to this page is stale: restart the browser, then reload.`
          );
        }
      }
      // The form passes the contract's own window id, so there is no lookup
      // table to translate through — that was how the wrong window got bought.
      const windowId = Number(input.windowId);
      const option = (snapshotRef.current?.windows ?? []).find((w) => w.id === input.windowId);
      if (!Number.isInteger(windowId) || !option || !option.open) {
        throw new Error('This coverage window is not on sale on the contract.');
      }
      let id: number;
      let premium: bigint;
      let block: number;
      try {
        const signer = await provider.getSigner(from);
        const payout = parseEther(input.payoutEth.toString());
        premium = await insuranceRead.quotePremium(payout);
        // The wallet's node can disagree with the chain about this account's
        // balance — a stale or wrongly-configured RPC behind MetaMask reports
        // 0 while the network shows funds, and its own UI may still show the
        // correct figure. Only the chain's view decides whether this purchase
        // can be paid for: everything here is priced from the trusted RPC, the
        // gas limit is already fixed above, and the wallet merely signs and
        // broadcasts. So block only when the chain itself says no, and let a
        // disagreeing wallet attempt the send rather than dead-ending a
        // purchase the network would accept.
        const [onChain, inWallet] = await Promise.all([
          readProvider.getBalance(from),
          provider.getBalance(from).catch(() => null)
        ]);
        if (inWallet !== null && inWallet < premium && onChain >= premium) {
          console.warn(
            `[chain] the wallet's node reports ${formatEther(inWallet)} ETH for ${from} while Sepolia shows ` +
            `${formatEther(onChain)} ETH — the wallet's RPC is stale or wrong. If this purchase fails at ` +
            'MetaMask, set its Sepolia RPC to https://ethereum-sepolia-rpc.publicnode.com and reload the page.'
          );
        }
        if (onChain < premium) {
          throw new Error(
            `${from} holds ${formatEther(onChain)} ETH on Sepolia, which does not cover the ` +
            `${formatEther(premium)} ETH premium plus gas. Send Sepolia ETH to that account and try again.`
          );
        }
        // Estimate gas here, on the RPC this app trusts, and hand the wallet an
        // explicit limit. Without one, ethers asks the wallet's own endpoint to
        // estimate — and that endpoint rate-limits under load, failing with
        // "missing revert data" (a node error carrying no revert reason) for a
        // transaction the chain happily accepts. A real revert still surfaces
        // its reason here and is translated below.
        const gasLimit = (await insuranceRead.buyPolicy.estimateGas(windowId, Math.round(input.thresholdMm * 100), payout, {
          from,
          value: premium
        })) * 125n / 100n;
        const tx = await (insurance.connect(signer) as Contract).buyPolicy(windowId, Math.round(input.thresholdMm * 100), payout, {
          value: premium,
          gasLimit
        });
        const receipt = await tx.wait();
        const event = (receipt.logs as Log[]).map((l) => insurance.interface.parseLog(l)).find((e) => e?.name === 'PolicyCreated');
        id = Number(event!.args.policyId);
        block = receipt.blockNumber;
      } catch (e) {
        throw new Error(chainErrorMessage(e));
      }
      // The premium is paid, so from here on the purchase must never be reported as failed.
      writeMeta(config.insuranceAddress, id, { lga: input.lga, crop: input.crop, farmer: from.toLowerCase() });
      const bought: Policy = {
        ...input,
        id,
        farmerId,
        premiumEth: Number(formatEther(premium)),
        purchasedAt: new Date().toISOString().slice(0, 10),
        status: 'active'
      };
      unindexed.current.set(id, bought);
      const next = await load(block).catch(() => null);
      if (next) setSnapshot(next);else
      setSnapshot((s) => s && { ...s, policies: [bought, ...s.policies.filter((p) => p.id !== id)] });
      const policy = next?.policies.find((p) => p.id === id) ?? bought;
      notifyPurchase(notify, policy);
      return policy;
    },
    [addressOf, isWallet, chainId, provider, readProvider, insurance, insuranceRead, config.insuranceAddress, load, notify]
  );

  const settleOnChain = useCallback(
    async (policyId: number) => {
      const from = addressOf(user?.id ?? 'admin-1');
      if (!from) throw new Error('Settling on this network needs a browser wallet. Connect MetaMask and try again.');
      let block: number;
      try {
        const signer = await provider.getSigner(from);
        const tx = await (insurance.connect(signer) as Contract).checkAndSettle(policyId);
        block = (await tx.wait()).blockNumber;
      } catch (e) {
        throw new Error(chainErrorMessage(e));
      }
      // Settled on-chain; a failed reload shouldn't turn that into an error.
      const next = await load(block).catch(() => null);
      if (!next) return;
      setSnapshot(next);
      const policy = next.policies.find((p) => p.id === policyId);
      if (policy?.evaluation) notifySettlement(notify, policy, policy.evaluation.aggregateMm, policy.evaluation.triggered);
    },
    [addressOf, user, provider, insurance, load, notify]
  );

  const value = useMemo<PolicyContextValue | null>(
    () =>
    snapshot && {
      source: { kind: 'chain', chainId, local },
      policies: snapshot.policies,
      windows: snapshot.windows,
      poolEth: snapshot.poolEth,
      // Without a wallet there is no account to read, so balanceOf answers 0
      // for everyone. Forms check this rather than blaming a funded wallet.
      walletConnected: isWallet,
      balanceOf: (userId: string) => snapshot.balances[userId] ?? 0,
      walletOf: (u: User) => addressOf(u.id) ?? u.wallet,
      purchasePolicy,
      recordEvaluation: () => {},
      settleOnChain
    },
    [snapshot, chainId, local, isWallet, addressOf, purchasePolicy, settleOnChain]
  );

  if (!value) {
    if (loadError) return <SimulatedPolicyProvider reason={loadError}>{children}</SimulatedPolicyProvider>;
    return <LoadingScreen label="Reading the contracts" />;
  }
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}
