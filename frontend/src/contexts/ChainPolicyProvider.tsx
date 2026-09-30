import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Contract, JsonRpcProvider, Network, formatEther, parseEther, type EventLog, type Log } from 'ethers';
import { toast } from 'sonner';
import abi from '../chain/abi.json';
import { LOCAL_CHAIN_ID, SOURCE_BY_LABEL, localAccountIndex, type ChainConfig } from '../chain/config';
import { LoadingScreen } from '../components/LoadingScreen';
import { coverageWindows } from '../data/policies';
import { findUser, getFarmers } from '../utils/users';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import { PolicyContext, type PolicyContextValue, type PurchaseInput } from './policyContextCore';
import { notifyPurchase, notifySettlement } from './policyNotifications';
import { SimulatedPolicyProvider } from './SimulatedPolicyProvider';
import type { EvaluationResult, Policy, SourceReading } from '../types/insurance';
import type { User } from '../types/user';

type Connection =
{phase: 'connecting';} |
{phase: 'ready';provider: JsonRpcProvider;chainId: bigint;accounts: string[];} |
{phase: 'failed';reason: string;};

async function rpc(url: string, method: string, timeoutMs = 3000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
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
  // Probe first, then pin the network, so ethers doesn't retry detection forever.
  const provider = new JsonRpcProvider(config.rpcUrl, Network.from(chainId), { staticNetwork: true, pollingInterval: 2000 });
  if ((await provider.getCode(config.insuranceAddress)) === '0x') {
    provider.destroy();
    return {
      phase: 'failed',
      reason: 'The insurance contract is not deployed on this chain. A local node forgets everything when it restarts, so run "npm run seed:local" again.'
    };
  }
  const accounts: string[] = chainId === LOCAL_CHAIN_ID ? await provider.send('eth_accounts', []) : [];
  return { phase: 'ready', provider, chainId, accounts };
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
    <ChainData config={config} provider={conn.provider} chainId={conn.chainId} accounts={conn.accounts}>
      {children}
    </ChainData>);

}

// ---------- Reading the contracts ----------

interface Snapshot {
  policies: Policy[];
  balances: Record<string, number>;
  poolEth: number;
  windowCount: number;
}

interface OracleInfo {
  address: string;
  label: string;
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

    /* storage unavailable: the policy falls back to the farmer's profile */}
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

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

function chainErrorMessage(e: unknown): string {
  const err = e as {reason?: string;shortMessage?: string;message?: string;};
  const reason = err.reason?.replace(/^\w+: /, '');
  if (reason) return FRIENDLY_REVERTS[reason] ?? `${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`;
  return err.shortMessage ?? err.message ?? 'The transaction failed.';
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
  const sourceReadings: SourceReading[] = oracles.flatMap((o) => {
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
  children




}: {config: ChainConfig;provider: JsonRpcProvider;chainId: bigint;accounts: string[];children: React.ReactNode;}) {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const local = chainId === LOCAL_CHAIN_ID && accounts.length > 0;
  const insurance = useMemo(() => new Contract(config.insuranceAddress, abi.WeatherIndexInsurance, provider), [config, provider]);
  const aggregator = useMemo(() => new Contract(config.aggregatorAddress, abi.OracleAggregator, provider), [config, provider]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const addressOf = useCallback(
    (userId: string): string | undefined => local ? accounts[localAccountIndex(userId)] : undefined,
    [local, accounts]
  );

  const load = useCallback(async (): Promise<Snapshot> => {
    const users = knownUsers(user);
    const idByAddress = new Map<string, string>();
    users.forEach((u) => {
      const a = addressOf(u.id);
      if (a) idByAddress.set(a.toLowerCase(), u.id);
    });

    const [policyCount, windowCount, oracleCount] = (
    await Promise.all([insurance.nextPolicyId(), insurance.nextWindowId(), aggregator.getOracleCount()])).
    map(Number);
    const [windows, raw, oracleAddresses, created, triggered, skipped, submitted] = await Promise.all([
    Promise.all(range(windowCount).map(async (i) => Array.from((await insurance.getCoverageWindow(i)).periods as bigint[]))),
    Promise.all(range(policyCount).map((i) => insurance.policies(i))),
    Promise.all(range(oracleCount).map((i) => aggregator.oracleList(i) as Promise<string>)),
    insurance.queryFilter(insurance.filters.PolicyCreated()),
    insurance.queryFilter(insurance.filters.PayoutTriggered()),
    insurance.queryFilter(insurance.filters.PayoutSkipped()),
    aggregator.queryFilter(aggregator.filters.ReadingSubmitted())]
    );

    const oracles: OracleInfo[] = await Promise.all(
      oracleAddresses.map(async (address) => {
        const o = await aggregator.oracles(address);
        return { address: address.toLowerCase(), label: o.label as string };
      })
    );
    const readings = new Map<string, bigint>();
    for (const e of submitted as EventLog[]) readings.set(`${e.args.period}:${(e.args.oracle as string).toLowerCase()}`, e.args.rainfallMm);

    const settlements = new Map<number, Settlement>();
    for (const e of triggered as EventLog[]) settlements.set(Number(e.args.policyId), { triggered: true, rainfall: e.args.windowRainfallMm, log: e });
    for (const e of skipped as EventLog[]) settlements.set(Number(e.args.policyId), { triggered: false, rainfall: e.args.windowRainfallMm, log: e });
    const createdAtBlock = new Map<number, number>();
    for (const e of created as EventLog[]) createdAtBlock.set(Number(e.args.policyId), e.blockNumber);

    const blockNumbers = new Set([...createdAtBlock.values(), ...[...settlements.values()].map((s) => s.log.blockNumber)]);
    const timestamps = new Map<number, number>();
    const gasUsed = new Map<string, bigint>();
    // Snapshot weights for the dekads of settled policies' windows.
    const settledPeriods = new Set<bigint>();
    raw.forEach((p, id) => {
      if (settlements.has(id)) (windows[Number(p.windowId)] ?? []).forEach((period) => settledPeriods.add(period));
    });
    const periodWeights = new Map<string, bigint>();
    await Promise.all([
    ...[...settledPeriods].flatMap((period) =>
    oracles.map(async (o) => periodWeights.set(`${period}:${o.address}`, await aggregator.weightForPeriod(period, o.address)))
    ),
    ...[...blockNumbers].map(async (n) => timestamps.set(n, (await provider.getBlock(n))?.timestamp ?? 0)),
    ...[...settlements.values()].map(async (s) =>
    gasUsed.set(s.log.transactionHash, (await provider.getTransactionReceipt(s.log.transactionHash))?.gasUsed ?? 0n)
    )]
    );

    const meta = readMeta(config.insuranceAddress);
    const policies = raw.map((p, id): Policy => {
      const farmerAddress = (p.farmer as string).toLowerCase();
      const farmerId = idByAddress.get(farmerAddress) ?? p.farmer;
      const farmer = findUser(farmerId);
      const saved = meta[id]?.farmer === farmerAddress ? meta[id] : undefined;
      const windowIndex = Number(p.windowId);
      const policy: Policy = {
        id,
        farmerId,
        lga: saved?.lga ?? farmer?.lga ?? '—',
        crop: saved?.crop ?? farmer?.primaryCrop ?? 'Millet',
        windowId: coverageWindows[windowIndex]?.id ?? coverageWindows[0].id,
        thresholdMm: Number(p.droughtThresholdMm) / 100,
        premiumEth: Number(formatEther(p.premiumPaid)),
        payoutEth: Number(formatEther(p.payoutAmount)),
        purchasedAt: new Date((timestamps.get(createdAtBlock.get(id) ?? -1) ?? 0) * 1000).toISOString().slice(0, 10),
        status: 'active'
      };
      const s = settlements.get(id);
      if (!s) return policy;
      return {
        ...policy,
        status: s.triggered ? 'paid' : 'no_payout',
        evaluation: chainEvaluation(
          policy,
          windows[windowIndex] ?? [],
          oracles,
          readings,
          periodWeights,
          s,
          gasUsed.get(s.log.transactionHash) ?? 0n,
          timestamps.get(s.log.blockNumber) ?? 0
        )
      };
    }).reverse();

    const balances: Record<string, number> = {};
    await Promise.all(
      users.map(async (u) => {
        const a = addressOf(u.id);
        if (a) balances[u.id] = Number(formatEther(await provider.getBalance(a)));
      })
    );
    const poolEth = Number(formatEther(await provider.getBalance(config.insuranceAddress)));
    return { policies, balances, poolEth, windowCount };
  }, [user, addressOf, insurance, aggregator, provider, config.insuranceAddress]);

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
      if (!from) throw new Error('Buying cover on this network needs a browser wallet, which the app does not support yet.');
      const windowIndex = coverageWindows.findIndex((w) => w.id === input.windowId);
      if (windowIndex < 0 || windowIndex >= (snapshotRef.current?.windowCount ?? 0)) {
        throw new Error('This coverage window is not on sale on the contract.');
      }
      let id: number;
      try {
        const signer = await provider.getSigner(from);
        const payout = parseEther(input.payoutEth.toString());
        const premium: bigint = await insurance.quotePremium(payout);
        const tx = await (insurance.connect(signer) as Contract).buyPolicy(windowIndex, Math.round(input.thresholdMm * 100), payout, {
          value: premium
        });
        const receipt = await tx.wait();
        const event = (receipt.logs as Log[]).map((l) => insurance.interface.parseLog(l)).find((e) => e?.name === 'PolicyCreated');
        id = Number(event!.args.policyId);
      } catch (e) {
        throw new Error(chainErrorMessage(e));
      }
      writeMeta(config.insuranceAddress, id, { lga: input.lga, crop: input.crop, farmer: from.toLowerCase() });
      const next = await load();
      setSnapshot(next);
      const policy = next.policies.find((p) => p.id === id)!;
      notifyPurchase(notify, policy);
      return policy;
    },
    [addressOf, provider, insurance, config.insuranceAddress, load, notify]
  );

  const settleOnChain = useCallback(
    async (policyId: number) => {
      const from = addressOf(user?.id ?? 'admin-1');
      if (!from) throw new Error('Settling on this network needs a browser wallet, which the app does not support yet.');
      try {
        const signer = await provider.getSigner(from);
        const tx = await (insurance.connect(signer) as Contract).checkAndSettle(policyId);
        await tx.wait();
      } catch (e) {
        throw new Error(chainErrorMessage(e));
      }
      const next = await load();
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
      poolEth: snapshot.poolEth,
      balanceOf: (userId: string) => snapshot.balances[userId] ?? 0,
      walletOf: (u: User) => addressOf(u.id) ?? u.wallet,
      purchasePolicy,
      recordEvaluation: () => {},
      settleOnChain
    },
    [snapshot, chainId, local, addressOf, purchasePolicy, settleOnChain]
  );

  if (!value) {
    if (loadError) return <SimulatedPolicyProvider reason={loadError}>{children}</SimulatedPolicyProvider>;
    return <LoadingScreen label="Reading the contracts" />;
  }
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}
