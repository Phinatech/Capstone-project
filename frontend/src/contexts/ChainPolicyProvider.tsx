import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, Network, formatEther, isAddress, parseEther, type EventLog, type Log } from 'ethers';
import { toast } from 'sonner';
import abi from '../chain/abi.json';
import { LOCAL_CHAIN_ID, SOURCE_BY_LABEL, localAccountIndex, type ChainConfig } from '../chain/config';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorPage } from '../pages/ErrorPage';
import { findUser, getTeam, ensureFarmerName } from '../utils/users';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import type { TranslationKey } from '../data/translations';
import { formatDate } from '../utils/format';
import { windowDays } from '../utils/windows';
import { PolicyContext, type PolicyContextValue, type PurchaseInput, type WindowOption } from './policyContextCore';
import type { EvaluationResult, Policy, SourceReading } from '../types/insurance';
import type { User } from '../types/user';

type Connection =
  {phase: 'connecting';} |
  {phase: 'ready';provider: JsonRpcProvider | BrowserProvider;chainId: bigint;accounts: string[];isWallet: boolean;rpcUrl: string;} |
  {phase: 'failed';reason: string;};

/** Public Sepolia nodes tried when the configured one cannot answer. */
const RPC_FALLBACKS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://rpc.sepolia.org'
];

/**
 * The first Sepolia node that answers, preferring the configured one. Some
 * hosts rate-limit hard, and one busy tab must not be able to take the whole
 * app down with it.
 */
async function resolveRpcUrl(preferred: string): Promise<string | null> {
  for (const url of [preferred, ...RPC_FALLBACKS]) {
    try {
      BigInt(await rpc(url, 'eth_chainId'));
      return url;
    } catch {
      /* try the next node */
    }
  }
  return null;
}

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
  let rpcUrl: string;
  try {
    rpcUrl = (await resolveRpcUrl(config.rpcUrl))!;
    chainId = BigInt(await rpc(rpcUrl, 'eth_chainId'));
  } catch {
    return {
      phase: 'failed',
      reason: `No Sepolia node answered (tried ${config.rpcUrl} and the public fallbacks). The network or an RPC may be down or rate-limiting; try again in a moment.`
    };
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
          code = await rpc(rpcUrl, 'eth_getCode', 8000, [config.insuranceAddress, 'latest']);
        } catch {
          // Same endpoint answered eth_chainId moments ago, so an RPC blip
          // must not cost us the wallet. Only a definite "no code here"
          // should, and that is the '0x' below.
        }
        if (code !== '0x') {
          return { phase: 'ready', provider: browserProvider, chainId, accounts, isWallet: true, rpcUrl };
        }
      }
    } catch {
      // Fall through to read-only mode
    }
  }

  // Local chain or fallback: read-only with unlocked accounts
  const provider = new JsonRpcProvider(rpcUrl, Network.from(chainId), { staticNetwork: true, pollingInterval: 2000 });
  if ((await provider.getCode(config.insuranceAddress)) === '0x') {
    provider.destroy();
    return {
      phase: 'failed',
      reason: 'The insurance contract is not deployed on this chain. A local node forgets everything when it restarts, so run "npm run seed:local" again.'
    };
  }
  const accounts: string[] = chainId === LOCAL_CHAIN_ID ? await provider.send('eth_accounts', []) : [];
  return { phase: 'ready', provider, chainId, accounts, isWallet: false, rpcUrl };
}

/** Policies read from, and transactions sent to, the deployed contracts. */
export function ChainPolicyProvider({ config, children }: {config: ChainConfig;children: React.ReactNode;}) {
  const { t } = useI18n();
  const [conn, setConn] = useState<Connection>({ phase: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setConn({ phase: 'connecting' });
    connect(config).then((c) => {
      if (cancelled) {
        if (c.phase === 'ready') c.provider.destroy();
        return;
      }
      setConn(c);
    }).catch((e: unknown) => {
      if (cancelled) return;
      setConn({ phase: 'failed', reason: e instanceof Error ? e.message : String(e) });
    });
    return () => {
      cancelled = true;
    };
  }, [config, attempt]);

  useEffect(() => () => {
    if (conn.phase === 'ready') conn.provider.destroy();
  }, [conn]);

  if (conn.phase === 'connecting') return <LoadingScreen label={t('chain.connecting')} />;
  // A configured chain that cannot be reached is an outage, not an invitation
  // to invent data: showing a simulated portfolio here once passed for real
  // state on the admin console. Say what failed and let the user retry.
  if (conn.phase === 'failed') {
    return <ErrorPage fullScreen error={new Error(conn.reason)} onRetry={() => setAttempt((a) => a + 1)} />;
  }
  return (
    <ChainData config={config} provider={conn.provider} chainId={conn.chainId} accounts={conn.accounts} isWallet={conn.isWallet} rpcUrl={conn.rpcUrl}>
      {children}
    </ChainData>);

}

// ---------- Reading the contracts ----------

interface Snapshot {
  policies: Policy[];
  balances: Record<string, number>;
  poolEth: number;
  /** Premium as a share of the payout, as the contract charges it. */
  premiumRate: number;
  windowCount: number;
  /** As the contract reports them; labels are built at render, in the reader's language. */
  windows: RawWindow[];
}

interface RawWindow {
  id: number;
  salesCloseAt: number;
  periods: number[];
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
type PolicyMeta = Record<number, {lga: string;crop: string;farmer: string;farmerId?: string;}>;
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



/** A balance read slower than this is left for the next block's refresh. */
const BALANCE_TIMEOUT_MS = 6_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}

function knownUsers(current: User | null): User[] {
  // Agents too, so the admin console can show an agent's wallet balance.
  const list = [...getTeam(), findUser('admin-1'), current].filter((u): u is User => !!u);
  return [...new Map(list.map((u) => [u.id, u])).values()];
}

type Translate = ReturnType<typeof useI18n>['t'];

const FRIENDLY_REVERTS: Record<string, TranslationKey> = {
  'window not finalized yet': 'chainErr.notFinalized',
  'sales closed for window': 'chainErr.salesClosed',
  'pool cannot cover payout': 'chainErr.poolShort',
  'already settled': 'chainErr.alreadySettled',
  'wrong premium': 'chainErr.wrongPremium'
};

function chainLabel(chainId: bigint, t: Translate): string {
  if (chainId === 1n) return t('chain.mainnet');
  if (chainId === 11155111n) return t('chain.sepolia');
  return t('chain.other', { id: String(chainId) });
}

function chainErrorMessage(e: unknown, t: Translate): string {
  const err = e as {reason?: string;shortMessage?: string;message?: string;code?: string;};
  const reason = err.reason?.replace(/^\w+: /, '');
  if (reason) return FRIENDLY_REVERTS[reason] ? t(FRIENDLY_REVERTS[reason]) : `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
  const raw = err.shortMessage ?? err.message ?? '';
  // "missing revert data" is ethers' way of saying the node reported a failure
  // with no reason at all: no require() fired, so this is infrastructure — the
  // wallet's RPC failing or rate-limiting mid-estimate — or an account that
  // cannot cover the premium plus gas. Say so instead of echoing jargon.
  if (err.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(raw)) {
    return t('chainErr.insufficient');
  }
  if (/missing revert data/i.test(raw)) {
    return t('chainErr.noReason');
  }
  if (/network changed|chain.?changed/i.test(raw)) {
    return t('chainErr.networkChanged');
  }
  return raw || t('chainErr.failed');
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
  rpcUrl,
  children


}: {config: ChainConfig;provider: JsonRpcProvider | BrowserProvider;chainId: bigint;accounts: string[];isWallet: boolean;rpcUrl: string;children: React.ReactNode;}) {
  const { user } = useAuth();
  const { t } = useI18n();
  // Read through a ref by load/refresh, so changing language never refetches the chain.
  const tRef = useRef(t);
  tRef.current = t;
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
        toast.warning(t('chainErr.switchedTitle'), {
          description: t('chainErr.switchedBody', { expected: chainLabel(chainId, t), actual: chainLabel(next, t) }),
          duration: 12000
        });
      }
    };
    eth.on('chainChanged', onChain);
    return () => eth.removeListener('chainChanged', onChain);
  }, [isWallet, chainId, t]);
  const local = chainId === LOCAL_CHAIN_ID && liveAccounts.length > 0;
  const insurance = useMemo(() => new Contract(config.insuranceAddress, abi.WeatherIndexInsurance, provider), [config, provider]);
  const aggregator = useMemo(() => new Contract(config.aggregatorAddress, abi.OracleAggregator, provider), [config, provider]);
  // In wallet mode `provider` is MetaMask's own endpoint, which rate-limits
  // under load. Balances read through it came back failed or zero and the buy
  // form reported that as an empty wallet. This is the RPC that just answered
  // eth_chainId and eth_getCode, so it is the one worth asking.
  const readProvider = useMemo(
    () => new JsonRpcProvider(rpcUrl, Network.from(chainId), { staticNetwork: true, pollingInterval: 2000 }),
    [rpcUrl, chainId]
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

  /**
   * Whose wallet to read for a user: the account signing in this browser for
   * the person using it, everyone else's own profile wallet. Reading the
   * connected account for every user showed the admin's own balance and
   * address against each farmer.
   */
  const walletFor = useCallback(
    (u: User): string | undefined => {
      if (local) return liveAccounts[localAccountIndex(u.id)];
      if (u.id === user?.id) return addressOf(u.id) ?? (isAddress(u.wallet) ? u.wallet : undefined);
      return isAddress(u.wallet) ? u.wallet : undefined;
    },
    [local, liveAccounts, user, addressOf]
  );

  /** `minBlock`: ask the API for data read at or after this block, i.e. our own transaction's. */
  const load = useCallback(async (minBlock?: number): Promise<Snapshot> => {
    const users = knownUsers(user);
    // Who owns a self-bought policy: each person's own wallet, with the account
    // signing here (listed last) standing for the signed-in user. Mapping only
    // the connected account left everyone else's purchases nameless.
    const idByAddress = new Map<string, string>();
    users.forEach((u) => {
      const a = walletFor(u);
      if (a) idByAddress.set(a.toLowerCase(), u.id);
    });

    // Fetch all data from the cached API instead of making dozens of RPC calls
    const apiUrl = '';
    const fresh = minBlock === undefined ? '' : `?minBlock=${minBlock}`;
    const [policiesRes, oraclesRes, windowsRes, evaluationsRes, poolRes] = await Promise.all([
      fetch(`${apiUrl}/api/policies${fresh}`),
      fetch(`${apiUrl}/api/oracles${fresh}`),
      fetch(`${apiUrl}/api/windows${fresh}`),
      fetch(`${apiUrl}/api/evaluations${fresh}`),
      fetch(`${apiUrl}/api/pool${fresh}`),
    ]);

    if (!policiesRes.ok || !oraclesRes.ok || !windowsRes.ok || !evaluationsRes.ok) {
      throw new Error(tRef.current('chainErr.apiFailed'));
    }

    const { policies: rawPolicies } = await policiesRes.json() as { policies: Array<{ id: number; farmer: string; windowId: number; droughtThresholdMm: number; payoutAmount: string; premiumPaid: string; settled: boolean; agentId?: string; farmerId?: string; farmerName?: string; lga?: string; crop?: string }> };
    const { oracles: rawOracles } = await oraclesRes.json() as { oracles: Array<{ address: string; label: string; registered: boolean; reputationWeight: number }> };
    const { windows: rawWindows } = await windowsRes.json() as { windows: Array<{ id: number; salesCloseAt: number; periods: number[] }> };
    const { evaluations: rawEvaluations } = await evaluationsRes.json() as { evaluations: Array<{ policyId: number; settlement: { policyId: number; triggered: boolean; rainfallMm: number; txHash: string; blockNumber: number } | null; readings: Array<{ period: number; oracle: string; rainfallMm: number }>; periodWeights: Record<string, number>; gasUsed: string; purchasedAtTimestamp: number; settlementTimestamp: number }> };

    const oracles: OracleInfo[] = rawOracles.map((o) => ({ address: o.address.toLowerCase(), label: o.label, registered: o.registered }));
    const windows = rawWindows.map((w) => w.periods.map(BigInt));
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
    // Receipts can name a farmer the directory no longer knows (the account
    // lives elsewhere, or the user store was reset). Give them a display
    // record so admin, agent and farmer portals all show the same name.
    for (const p of rawPolicies) {
      if (p.farmerId && p.farmerName) ensureFarmerName(p.farmerId, p.farmerName);
    }
    const policies = rawPolicies.map((p): Policy => {
      const farmerAddress = p.farmer.toLowerCase();
      const saved = meta[p.id]?.farmer === farmerAddress ? meta[p.id] : undefined;
      // Whose policy is this? The chain records only the buying wallet, which
      // says nothing when an agent buys for a farmer. The agent sale receipt
      // (joined server-side into /api/policies) names the farmer and is what
      // syncs the admin, agent and farmer portals; the purchase-time meta is
      // the fallback for self-bought policies; the address map is last.
      const farmerId = p.farmerId ?? saved?.farmerId ?? idByAddress.get(farmerAddress) ?? p.farmer;
      const farmer = findUser(farmerId);
      const windowIndex = p.windowId;
      const evalData = rawEvaluations.find((e) => e.policyId === p.id);
      const policy: Policy = {
        id: p.id,
        farmerId,
        agentId: p.agentId,
        holder: farmerAddress,
        lga: p.lga ?? saved?.lga ?? farmer?.lga ?? '—',
        crop: p.crop ?? saved?.crop ?? farmer?.primaryCrop ?? 'Millet',
        windowId: String(windowIndex),
        thresholdMm: p.droughtThresholdMm / 100,
        premiumEth: Number(p.premiumPaid),
        payoutEth: Number(p.payoutAmount),
        purchasedAt: new Date((evalData?.purchasedAtTimestamp ?? 0) * 1000).toISOString().slice(0, 10),
        purchasedAtTime: evalData?.purchasedAtTimestamp ? new Date(evalData.purchasedAtTimestamp * 1000).toISOString() : undefined,
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

    // The admin console shows everyone's balance; anyone else needs only their
    // own, so a farmer's page no longer waits on a read per registered user.
    const balanceUsers = user?.role === 'admin' ? users : users.filter((u) => u.id === user?.id);
    const balances: Record<string, number> = {};
    await Promise.all(
      balanceUsers.map(async (u) => {
        const a = walletFor(u);
        if (!a) return;
        // Neither read may take the snapshot down with it, nor hold the page
        // on a slow node. A failed balance leaves the entry unset, and
        // walletConnected is what lets the form call that "not connected"
        // rather than "broke"; the next block's refresh fills it in.
        try {
          balances[u.id] = Number(formatEther(await withTimeout(readProvider.getBalance(a), BALANCE_TIMEOUT_MS)));
        } catch {
          try {
            balances[u.id] = Number(formatEther(await withTimeout(provider.getBalance(a), BALANCE_TIMEOUT_MS)));
          } catch {
            /* leave unset rather than guess at 0 */
          }
        }
      })
    );
    const pool = poolRes.ok ? (await poolRes.json()) as { balance: string; premiumRateBps?: number } : null;
    const poolEth = pool ? Number(pool.balance) : 0;
    // The rate the contract charges, so the quote on screen is what the wallet
    // is asked for. Without the API's figure, price one ETH of cover directly.
    const premiumRate = typeof pool?.premiumRateBps === 'number' ?
    pool.premiumRateBps / 10_000 :
    Number(formatEther(await insuranceRead.quotePremium(parseEther('1'))));
    return { policies, balances, poolEth, premiumRate, windowCount: windows.length, windows: rawWindows };
  }, [user, walletFor, insurance, insuranceRead, aggregator, provider, readProvider, config.insuranceAddress]);

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
      setLoadError(chainErrorMessage(e, tRef.current));
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
      if (!from) throw new Error(t('chainErr.buyNeedsWallet'));
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
          throw new Error(t('chainErr.wrongChain', { actual: chainLabel(current, t), expected: chainLabel(chainId, t) }));
        }
      }
      // The form passes the contract's own window id, so there is no lookup
      // table to translate through — that was how the wrong window got bought.
      const windowId = Number(input.windowId);
      const option = (snapshotRef.current?.windows ?? []).find((w) => w.id === windowId);
      if (!Number.isInteger(windowId) || !option || option.salesCloseAt * 1000 <= Date.now()) {
        throw new Error(t('chainErr.notOnSale'));
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
          throw new Error(t('chainErr.lowBalance', { account: from, balance: formatEther(onChain), premium: formatEther(premium) }));
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
        throw new Error(chainErrorMessage(e, t));
      }
      // The premium is paid, so from here on the purchase must never be reported as failed.
      writeMeta(config.insuranceAddress, id, { lga: input.lga, crop: input.crop, farmer: from.toLowerCase(), farmerId });
      const bought: Policy = {
        ...input,
        id,
        farmerId,
        premiumEth: Number(formatEther(premium)),
        purchasedAt: new Date().toISOString().slice(0, 10),
        purchasedAtTime: new Date().toISOString(),
        status: 'active'
      };
      unindexed.current.set(id, bought);
      const next = await load(block).catch(() => null);
      if (next) setSnapshot(next);else
      setSnapshot((s) => s && { ...s, policies: [bought, ...s.policies.filter((p) => p.id !== id)] });
      return next?.policies.find((p) => p.id === id) ?? bought;
    },
    [addressOf, isWallet, chainId, provider, readProvider, insurance, insuranceRead, config.insuranceAddress, load, t]
  );

  const settleOnChain = useCallback(
    async (policyId: number) => {
      const from = addressOf(user?.id ?? 'admin-1');
      if (!from) throw new Error(t('chainErr.settleNeedsWallet'));
      let block: number;
      try {
        const signer = await provider.getSigner(from);
        const tx = await (insurance.connect(signer) as Contract).checkAndSettle(policyId);
        block = (await tx.wait()).blockNumber;
      } catch (e) {
        throw new Error(chainErrorMessage(e, t));
      }
      // Settled on-chain; a failed reload shouldn't turn that into an error.
      const next = await load(block).catch(() => null);
      if (next) setSnapshot(next);
    },
    [addressOf, user, provider, insurance, load, t]
  );

  const value = useMemo<PolicyContextValue | null>(
    () =>
    snapshot && {
      source: { kind: 'chain', chainId, local },
      policies: snapshot.policies,
      windows: snapshot.windows.map((w): WindowOption => {
        const closes = formatDate(new Date(w.salesCloseAt * 1000).toISOString());
        return {
          id: String(w.id),
          label: t('window.label', { id: w.id, closes }),
          open: w.salesCloseAt * 1000 > Date.now(),
          covers: windowDays(w.periods),
          closes,
          periods: w.periods
        };
      }),
      poolEth: snapshot.poolEth,
      premiumRate: snapshot.premiumRate,
      // Without a wallet there is no account to read, so balanceOf answers 0
      // for everyone. Forms check this rather than blaming a funded wallet.
      walletConnected: isWallet,
      balanceOf: (userId: string) => snapshot.balances[userId] ?? 0,
      walletOf: (u: User) => walletFor(u) ?? u.wallet,
      purchasePolicy,
      recordEvaluation: () => {},
      settleOnChain
    },
    [snapshot, chainId, local, isWallet, walletFor, purchasePolicy, settleOnChain, t]
  );

  if (!value) {
    // Same rule as the connect failure: a chain read that failed is an outage,
    // never a reason to render invented data over the real state.
    if (loadError) return <ErrorPage error={new Error(loadError)} onRetry={() => void refresh()} />;
    return <LoadingScreen label={t('chain.reading')} />;
  }
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}
