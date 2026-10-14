/**
 * Reads policy, oracle, and window data from the blockchain.
 * Used by the API endpoints to serve cached data to the frontend.
 */
import { JsonRpcProvider, Contract, formatEther, type EventLog } from "ethers";
import { config } from "../config.js";
import { blockChunks } from "./logChunks.js";

const provider = new JsonRpcProvider(config.rpcUrl);
const logsProvider = config.logsRpcUrl === config.rpcUrl ? provider : new JsonRpcProvider(config.logsRpcUrl);

// Chunks this far behind the head are past any realistic reorg, so their logs are kept.
const SETTLED_DEPTH = 64;
const settledChunks = new Map<string, Promise<EventLog[]>>();

/**
 * Every `eventName` log a contract emitted since DEPLOY_BLOCK, read in
 * LOGS_BLOCK_RANGE-sized chunks. Full chunks well behind the head are kept,
 * so after the first call only the newest blocks are fetched.
 */
async function queryEvents(address: string, abi: string[], eventName: string): Promise<EventLog[]> {
  const contract = new Contract(address, abi, logsProvider);
  const head = await logsProvider.getBlockNumber();
  if (config.deployBlock > head) {
    throw new Error(`DEPLOY_BLOCK ${config.deployBlock} is ahead of the chain head ${head}; is it set for another network?`);
  }
  const logs: EventLog[] = [];
  for (const [from, to] of blockChunks(config.deployBlock, head, config.logsBlockRange)) {
    const key = `${address}:${eventName}:${from}`;
    let chunk = settledChunks.get(key);
    if (!chunk) {
      chunk = contract.queryFilter(eventName, from, to) as Promise<EventLog[]>;
      if (to - from + 1 === config.logsBlockRange && head - to >= SETTLED_DEPTH) {
        settledChunks.set(key, chunk);
        chunk.catch(() => settledChunks.delete(key));
      }
    }
    logs.push(...(await chunk));
  }
  return logs;
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
  const policies: PolicyData[] = [];
  for (let i = 0; i < count; i++) {
    const p = await insurance.policies!(i);
    policies.push({
      id: i,
      farmer: p.farmer,
      windowId: Number(p.windowId),
      droughtThresholdMm: Number(p.droughtThresholdMm),
      payoutAmount: formatEther(p.payoutAmount),
      premiumPaid: formatEther(p.premiumPaid),
      settled: p.settled,
    });
  }
  return policies;
}

export async function readOracles(): Promise<OracleData[]> {
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);
  const count = Number(await aggregator.getOracleCount!());
  const oracles: OracleData[] = [];
  for (let i = 0; i < count; i++) {
    const addr = await aggregator.oracleList!(i);
    const o = await aggregator.oracles!(addr);
    oracles.push({
      address: addr,
      label: o.label,
      registered: o.registered,
      reputationWeight: Number(o.reputationWeight),
    });
  }
  return oracles;
}

export async function readWindows(): Promise<WindowData[]> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const count = Number(await insurance.nextWindowId!());
  const windows: WindowData[] = [];
  for (let i = 0; i < count; i++) {
    const w = await insurance.getCoverageWindow!(i);
    windows.push({
      id: i,
      salesCloseAt: Number(w.salesCloseAt),
      periods: w.periods.map(Number),
    });
  }
  return windows;
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

export async function readPolicyEvaluations(): Promise<PolicyEvaluation[]> {
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);
  const [policies, windows, oracles, settlements, readings, purchases] = await Promise.all([
    readPolicies(),
    readWindows(),
    readOracles(),
    readSettlements(),
    readReadings(),
    queryEvents(config.insuranceAddress, insuranceAbi, "PolicyCreated"),
  ]);
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
  const [weights, timestamps, gasUsed] = await Promise.all([
    Promise.all(
      [...weightLookups].map(async ([key, { period, oracle }]) => [key, Number(await aggregator.weightForPeriod!(period, oracle))] as const)
    ).then((entries) => new Map(entries)),
    Promise.all([...blockNumbers].map(async (n) => [n, (await provider.getBlock(n))?.timestamp ?? 0] as const)).then(
      (entries) => new Map(entries)
    ),
    Promise.all(
      settlements.map(async (s) => [s.txHash, ((await provider.getTransactionReceipt(s.txHash))?.gasUsed ?? 0n).toString()] as const)
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
