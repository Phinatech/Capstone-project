/**
 * Reads policy, oracle, and window data from the blockchain.
 * Used by the API endpoints to serve cached data to the frontend.
 */
import { JsonRpcProvider, Contract, formatEther, type EventLog } from "ethers";
import { config } from "../config.js";

const provider = new JsonRpcProvider(config.rpcUrl);

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
  gasUsed: bigint;
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
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const triggered = await insurance.queryFilter(insurance.filters.PayoutTriggered!());
  const skipped = await insurance.queryFilter(insurance.filters.PayoutSkipped!());
  const settlements: SettlementData[] = [];
  for (const e of triggered as EventLog[]) {
    settlements.push({
      policyId: Number(e.args.policyId),
      triggered: true,
      rainfallMm: Number(e.args.windowRainfallMm),
      txHash: e.transactionHash,
      blockNumber: e.blockNumber,
    });
  }
  for (const e of skipped as EventLog[]) {
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
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);
  const events = await aggregator.queryFilter(aggregator.filters.ReadingSubmitted!());
  const readings: ReadingData[] = [];
  for (const e of events as EventLog[]) {
    readings.push({
      period: Number(e.args.period),
      oracle: e.args.oracle,
      rainfallMm: Number(e.args.rainfallMm),
    });
  }
  return readings;
}

export async function readPolicyEvaluations(): Promise<PolicyEvaluation[]> {
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, provider);
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, provider);
  const policyCount = Number(await insurance.nextPolicyId!());
  const oracleCount = Number(await aggregator.getOracleCount!());
  const oracles: string[] = [];
  for (let i = 0; i < oracleCount; i++) oracles.push(await aggregator.oracleList!(i));

  const settlements = await readSettlements();
  const readings = await readReadings();

  const evaluations: PolicyEvaluation[] = [];
  for (let i = 0; i < policyCount; i++) {
    const p = await insurance.policies!(i);
    const s = settlements.find((x) => x.policyId === i) ?? null;
    const policyReadings = readings.filter((r) => r.period >= 0); // all readings for now
    const periodWeights: Record<string, number> = {};
    for (const period of new Set(policyReadings.map((r) => r.period))) {
      for (const o of oracles) {
        const w = await aggregator.weightForPeriod!(period, o);
        periodWeights[`${period}:${o.toLowerCase()}`] = Number(w);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let purchasedAtBlock = 0;
    let purchasedAtTimestamp = 0;
    let settlementTimestamp = 0;
    let gasUsed = 0n;
    if (s) {
      const receipt = await provider.getTransactionReceipt(s.txHash);
      gasUsed = receipt?.gasUsed ?? 0n;
      const block = await provider.getBlock(s.blockNumber);
      settlementTimestamp = block?.timestamp ?? 0;
    }
    evaluations.push({
      policyId: i,
      farmer: p.farmer,
      windowId: Number(p.windowId),
      droughtThresholdMm: Number(p.droughtThresholdMm),
      payoutAmount: formatEther(p.payoutAmount),
      premiumPaid: formatEther(p.premiumPaid),
      settled: p.settled,
      settlement: s,
      readings: policyReadings,
      periodWeights,
      purchasedAtBlock,
      purchasedAtTimestamp,
      settlementTimestamp,
      gasUsed,
    });
  }
  return evaluations;
}
