/**
 * Reads policy, oracle, and window data from the blockchain.
 * Used by the API endpoints to serve cached data to the frontend.
 */
import { JsonRpcProvider, Contract, formatEther, type EventLog, type JsonRpcPayload, type JsonRpcResult } from "ethers";
import { config } from "../config.js";
import { blockChunks } from "./logChunks.js";
import { mapLimit } from "./concurrency.js";
import { withRpcRetry } from "./rpcRetry.js";

/**
 * How many per-item contract reads to run at once; each one is a round trip.
 * This stays low on purpose: the public gateways rate-limit well before the
 * network saturates, and a burst is what got this backend a 429.
 */
const READ_CONCURRENCY = 3;

const range = (count: number) => Array.from({ length: count }, (_, i) => i);

/**
 * Every read below goes through this provider. Public Sepolia endpoints drop
 * connections now and then, and a single `request timeout` would turn a whole
 * API route into a 500 that the frontend shows as a blank screen. Every call
 * made here is a read, so re-running it is always safe.
 */
/**
 * Every read below goes through this provider. Public Sepolia endpoints drop
 * connections now and then, and a single `request timeout` would turn a whole
 * API route into a 500 that the frontend shows as a blank screen. Every call
 * made here is a read, so re-running it is always safe.
 *
 * `batchMaxCount: 1` matters as much as the retry. ethers groups concurrent
 * calls into one batched HTTP request; retrying that batch re-sends frames the
 * queue has already handed out, so the original callers wait forever on
 * promises nothing will ever resolve. It showed up as reads that hung with no
 * error and no timeout anywhere. One call per request keeps the retry honest.
 */
class RetryingProvider extends JsonRpcProvider {
  override async _send(payload: JsonRpcPayload | JsonRpcPayload[]): Promise<JsonRpcResult[]> {
    return withRpcRetry(() => super._send(payload));
  }
}

const provider = new RetryingProvider(config.rpcUrl, undefined, { batchMaxCount: 1 });
const logsProvider =
  config.logsRpcUrl === config.rpcUrl ? provider : new RetryingProvider(config.logsRpcUrl, undefined, { batchMaxCount: 1 });

/** Head block both RPCs have reached: reads and event scans reflect at least this block. */
export async function headBlock(): Promise<number> {
  if (logsProvider === provider) return provider.getBlockNumber();
  const [readsHead, logsHead] = await Promise.all([provider.getBlockNumber(), logsProvider.getBlockNumber()]);
  return Math.min(readsHead, logsHead);
}

// Chunks this far behind the head are past any realistic reorg, so their logs are kept.
const SETTLED_DEPTH = 64;
const settledChunks = new Map<string, Promise<EventLog[]>>();

/**
 * Every `eventName` log a contract emitted since DEPLOY_BLOCK, read in
 * LOGS_BLOCK_RANGE-sized chunks. Full chunks well behind the head are kept,
 * so after the first call only the newest blocks are fetched.
 */
/**
 * How many block chunks to fetch at once; they are independent of one another.
 * Kept deliberately small for the same rate-limit reason as READ_CONCURRENCY.
 */
const CHUNK_CONCURRENCY = 2;

async function queryEvents(address: string, abi: string[], eventName: string): Promise<EventLog[]> {
  const contract = new Contract(address, abi, logsProvider);
  const head = await logsProvider.getBlockNumber();
  if (config.deployBlock > head) {
    throw new Error(`DEPLOY_BLOCK ${config.deployBlock} is ahead of the chain head ${head}; is it set for another network?`);
  }

  const ranges = [...blockChunks(config.deployBlock, head, config.logsBlockRange)];
  const perChunk = new Array<EventLog[]>(ranges.length);

  // Chunks don't depend on each other, so they are fetched a few at a time
  // rather than strictly one after another. Fetched serially, a scan from
  // DEPLOY_BLOCK to the head is ~54 round trips, which alone pushed the
  // evaluations route past six minutes on its first, uncached call.
  let next = 0;
  const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, ranges.length) }, async () => {
    while (next < ranges.length) {
      const index = next++;
      const [from, to] = ranges[index]!;
      const key = `${address}:${eventName}:${from}`;
      let chunk = settledChunks.get(key);
      if (!chunk) {
        chunk = contract.queryFilter(eventName, from, to) as Promise<EventLog[]>;
        if (to - from + 1 === config.logsBlockRange && head - to >= SETTLED_DEPTH) {
          settledChunks.set(key, chunk);
          chunk.catch(() => settledChunks.delete(key));
        }
      }
      perChunk[index] = await chunk;
    }
  });
  await Promise.all(workers);

  return perChunk.flat();
}

const aggregatorAbi = [
  "function getOracleCount() view returns (uint256)",
  "function oracleList(uint256) view returns (address)",
  "function oracles(address) view returns (bool registered, string label, uint256 reputationWeight)",
  "function isFinalized(uint256) view returns (bool)",
  "function finalizedAggregate(uint256) view returns (uint256)",
  "function weightForPeriod(uint256 period, address oracleAddress) view returns (uint256)",
  "event ReadingSubmitted(address indexed oracle, uint256 indexed period, uint256 rainfallMm)",
];

const insuranceAbi = [
  "function nextPolicyId() view returns (uint256)",
  "function nextWindowId() view returns (uint256)",
  "function policies(uint256) view returns (address farmer, uint256 windowId, uint256 droughtThresholdMm, uint256 payoutAmount, uint256 premiumPaid, bool settled)",
  "function getCoverageWindow(uint256) view returns (uint64 salesCloseAt, uint256[] periods)",
  "function premiumRateBps() view returns (uint256)",
  "function reservedPayouts() view returns (uint256)",
  "event PolicyCreated(uint256 indexed policyId, address indexed farmer, uint256 indexed windowId, uint256 droughtThresholdMm, uint256 payoutAmount, uint256 premiumPaid)",
  "event PayoutTriggered(uint256 indexed policyId, address indexed farmer, uint256 windowRainfallMm, uint256 payoutAmount)",
  "event PayoutSkipped(uint256 indexed policyId, uint256 windowRainfallMm, uint256 droughtThresholdMm)",
];

export interface PolicyData {
  id: number;
  farmer: string;
  windowId: number;
  droughtThresholdMm: number;
  payoutAmount: string;
  premiumPaid: string;
  settled: boolean;
}

export interface OracleData {
  address: string;
  label: string;
  registered: boolean;
  reputationWeight: number;
}

export interface WindowData {
  id: number;
  salesCloseAt: number;
  periods: number[];
}

export interface PoolData {
  balance: string;
  reservedPayouts: string;
  availableCapacity: string;
  premiumRateBps: number;
}

export interface SettlementData {
  policyId: number;
  triggered: boolean;
  rainfallMm: number;
  txHash: string;
  blockNumber: number;
}

export interface ReadingData {
  period: number;
  oracle: string;
  rainfallMm: number;
}

export interface PolicyEvaluation {
  policyId: number;
  farmer: string;
  windowId: number;
  droughtThresholdMm: number;
  payoutAmount: string;
  premiumPaid: string;
  settled: boolean;
  settlement: SettlementData | null;
  readings: ReadingData[];
  periodWeights: Record<string, number>;
  purchasedAtBlock: number;
  purchasedAtTimestamp: number;
  settlementTimestamp: number;
  /** Settlement gas as a decimal string: JSON has no bigint. */
  gasUsed: string;
}

export async function readPolicies(): Promise<PolicyData[]> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const count = Number(await insurance.nextPolicyId!());
  const rows = await mapLimit(range(count), READ_CONCURRENCY, (i) => insurance.policies!(i));
  return rows.map((p, i) => ({
    id: i,
    farmer: p.farmer,
    windowId: Number(p.windowId),
    droughtThresholdMm: Number(p.droughtThresholdMm),
    payoutAmount: formatEther(p.payoutAmount),
    premiumPaid: formatEther(p.premiumPaid),
    settled: p.settled,
  }));
}

export async function readOracles(): Promise<OracleData[]> {
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);
  const count = Number(await aggregator.getOracleCount!());
  // Two round trips per oracle; fetching them one at a time made this 8 s.
  return mapLimit(range(count), READ_CONCURRENCY, async (i) => {
    const addr = await aggregator.oracleList!(i);
    const o = await aggregator.oracles!(addr);
    return {
      address: addr,
      label: o.label,
      registered: o.registered,
      reputationWeight: Number(o.reputationWeight),
    };
  });
}

export async function readWindows(): Promise<WindowData[]> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const count = Number(await insurance.nextWindowId!());
  const windows = await mapLimit(range(count), READ_CONCURRENCY, (i) => insurance.getCoverageWindow!(i));
  return windows.map((w, i) => ({
    id: i,
    salesCloseAt: Number(w.salesCloseAt),
    periods: w.periods.map(Number),
  }));
}

export async function readPool(): Promise<PoolData> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const [balance, reserved, rateBps] = await Promise.all([
    provider.getBalance(config.insuranceAddress),
    insurance.reservedPayouts!(),
    insurance.premiumRateBps!(),
  ]);
  return {
    balance: formatEther(balance),
    reservedPayouts: formatEther(reserved),
    availableCapacity: formatEther(balance - reserved),
    premiumRateBps: Number(rateBps),
  };
}

export async function readSettlements(): Promise<SettlementData[]> {
  const [triggered, skipped] = await Promise.all([
    queryEvents(config.insuranceAddress, insuranceAbi, "PayoutTriggered"),
    queryEvents(config.insuranceAddress, insuranceAbi, "PayoutSkipped"),
  ]);
  const settlements: SettlementData[] = [];
  for (const e of triggered) {
    settlements.push({
      policyId: Number(e.args.policyId),
      triggered: true,
      rainfallMm: Number(e.args.windowRainfallMm),
      txHash: e.transactionHash,
      blockNumber: e.blockNumber,
    });
  }
  for (const e of skipped) {
    settlements.push({
      policyId: Number(e.args.policyId),
      triggered: false,
      rainfallMm: Number(e.args.windowRainfallMm),
      txHash: e.transactionHash,
      blockNumber: e.blockNumber,
    });
  }
  return settlements;
}

export async function readReadings(): Promise<ReadingData[]> {
  const events = await queryEvents(config.aggregatorAddress, aggregatorAbi, "ReadingSubmitted");
  const readings: ReadingData[] = [];
  for (const e of events) {
    readings.push({
      period: Number(e.args.period),
      oracle: e.args.oracle,
      rainfallMm: Number(e.args.rainfallMm),
    });
  }
  return readings;
}

/** A policy bought or settled, for notifications. Rainfall and thresholds in mm. */
export type InsuranceActivity =
  | { kind: "purchase"; policyId: number; windowPeriods: number[]; thresholdMm: number; payoutEth: string; premiumEth: string; txHash: string }
  | { kind: "payout"; policyId: number; rainfallMm: number; thresholdMm: number; payoutEth: string; txHash: string }
  | { kind: "no_payout"; policyId: number; rainfallMm: number; thresholdMm: number; txHash: string };

/** Policies bought and settled in blocks fromBlock to toBlock, oldest first. */
export async function readInsuranceActivity(fromBlock: number, toBlock: number): Promise<InsuranceActivity[]> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const logs = [];
  for (const [from, to] of blockChunks(fromBlock, toBlock, config.logsBlockRange)) {
    logs.push(...(await logsProvider.getLogs({ address: config.insuranceAddress, fromBlock: from, toBlock: to })));
  }
  const mm = (hundredths: bigint) => Number(hundredths) / 100; // the contract stores mm x 100
  const activity: InsuranceActivity[] = [];
  for (const log of logs) {
    const event = insurance.interface.parseLog(log);
    if (!event) continue; // windows added, pool funded, ownership changes
    const policyId = Number(event.args.policyId);
    const txHash = log.transactionHash;
    if (event.name === "PolicyCreated") {
      const window = await insurance.getFunction("getCoverageWindow")(event.args.windowId);
      activity.push({
        kind: "purchase",
        policyId,
        windowPeriods: (window.periods as bigint[]).map(Number),
        thresholdMm: mm(event.args.droughtThresholdMm),
        payoutEth: formatEther(event.args.payoutAmount),
        premiumEth: formatEther(event.args.premiumPaid),
        txHash,
      });
    } else if (event.name === "PayoutTriggered") {
      const policy = await insurance.getFunction("policies")(policyId);
      activity.push({
        kind: "payout",
        policyId,
        rainfallMm: mm(event.args.windowRainfallMm),
        thresholdMm: mm(policy.droughtThresholdMm),
        payoutEth: formatEther(event.args.payoutAmount),
        txHash,
      });
    } else if (event.name === "PayoutSkipped") {
      activity.push({ kind: "no_payout", policyId, rainfallMm: mm(event.args.windowRainfallMm), thresholdMm: mm(event.args.droughtThresholdMm), txHash });
    }
  }
  return activity;
}

export async function readPolicyEvaluations(): Promise<PolicyEvaluation[]> {
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);

  // Two of these at a time, not all six at once: together they ask for 18
  // concurrent calls, which the public gateway answers with a 429 that ethers
  // then escalates for a couple of minutes. Bounded, the whole set is ~7 s.
  const readers: Array<() => Promise<unknown>> = [
    () => readPolicies(),
    () => readWindows(),
    () => readOracles(),
    () => readSettlements(),
    () => readReadings(),
    () => queryEvents(config.insuranceAddress, insuranceAbi, "PolicyCreated"),
  ];
  const [policies, windows, oracles, settlements, readings, purchases] = (await mapLimit(
    readers,
    2,
    (read) => read(),
  )) as [PolicyData[], WindowData[], OracleData[], SettlementData[], ReadingData[], EventLog[]];
  const settlementOf = new Map(settlements.map((s) => [s.policyId, s]));
  const purchaseBlockOf = new Map(purchases.map((e) => [Number(e.args.policyId), e.blockNumber]));
  const periodsOf = (p: PolicyData) => windows[p.windowId]?.periods ?? [];

  // Weights snapshotted for the dekads of settled policies' windows, each fetched once.
  const weightLookups = new Map<string, { period: number; oracle: string }>();
  for (const p of policies) {
    if (!settlementOf.has(p.id)) continue;
    for (const period of periodsOf(p)) {
      for (const o of oracles) {
        const oracle = o.address.toLowerCase();
        weightLookups.set(`${period}:${oracle}`, { period, oracle });
      }
    }
  }
  const blockNumbers = new Set([...purchaseBlockOf.values(), ...settlements.map((s) => s.blockNumber)]);
  // Bounded like the reads above. Fired at once these three lists are a burst
  // of requests, and an unbounded burst is what earned this endpoint a 429 and
  // a multi-minute retry spiral.
  const [weights, timestamps, gasUsed] = await Promise.all([
    mapLimit([...weightLookups], READ_CONCURRENCY, async ([key, { period, oracle }]) =>
      [key, Number(await aggregator.weightForPeriod!(period, oracle))] as const
    ).then((entries) => new Map(entries)),
    mapLimit([...blockNumbers], READ_CONCURRENCY, async (n) =>
      [n, (await provider.getBlock(n))?.timestamp ?? 0] as const
    ).then((entries) => new Map(entries)),
    mapLimit(settlements, READ_CONCURRENCY, async (s) =>
      [s.txHash, ((await provider.getTransactionReceipt(s.txHash))?.gasUsed ?? 0n).toString()] as const
    ).then((entries) => new Map(entries)),
  ]);

  return policies.map((p): PolicyEvaluation => {
    const periods = new Set(periodsOf(p));
    const settlement = settlementOf.get(p.id) ?? null;
    const periodWeights: Record<string, number> = {};
    if (settlement) {
      for (const period of periods) {
        for (const o of oracles) {
          const key = `${period}:${o.address.toLowerCase()}`;
          periodWeights[key] = weights.get(key) ?? 0;
        }
      }
    }
    const purchasedAtBlock = purchaseBlockOf.get(p.id) ?? 0;
    return {
      policyId: p.id,
      farmer: p.farmer,
      windowId: p.windowId,
      droughtThresholdMm: p.droughtThresholdMm,
      payoutAmount: p.payoutAmount,
      premiumPaid: p.premiumPaid,
      settled: p.settled,
      settlement,
      readings: readings.filter((r) => periods.has(r.period)),
      periodWeights,
      purchasedAtBlock,
      purchasedAtTimestamp: timestamps.get(purchasedAtBlock) ?? 0,
      settlementTimestamp: settlement ? timestamps.get(settlement.blockNumber) ?? 0 : 0,
      gasUsed: settlement ? gasUsed.get(settlement.txHash) ?? "0" : "0",
    };
  });
}
