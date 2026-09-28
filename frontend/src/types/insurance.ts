export type SourceId = 'chirps' | 'nasa' | 'meteostat';

export type AggregationMode = 'single' | 'equal' | 'reputation';

export type CorruptionType = 'outage' | 'inflated' | 'understated';

export type PolicyStatus = 'active' | 'paid' | 'no_payout';

export interface OracleSource {
  id: SourceId;
  name: string;
  kind: string;
  color: string;
}

export interface DekadRainfall {
  label: string;
  reference: number;
  chirps: number;
  nasa: number;
  meteostat: number;
}

export interface CoverageWindow {
  id: string;
  label: string;
  start: number;
  end: number;
}

export interface Corruption {
  sourceId: SourceId;
  type: CorruptionType;
}

export interface SourceReading {
  sourceId: SourceId;
  value: number;
  weight: number;
  corrupted: boolean;
}

export interface EvaluationResult {
  mode: AggregationMode;
  readings: SourceReading[];
  aggregateMm: number;
  thresholdMm: number;
  triggered: boolean;
  referenceMm: number;
  referenceTriggered: boolean;
  gasUsed: number;
  latencySec: number;
  txHash: string;
  evaluatedAt: string;
  corruption: Corruption | null;
  simulated: boolean;
}

export interface Policy {
  id: number;
  farmerId: string;
  lga: string;
  crop: string;
  windowId: string;
  thresholdMm: number;
  premiumEth: number;
  payoutEth: number;
  purchasedAt: string;
  status: PolicyStatus;
  evaluation?: EvaluationResult;
}

export interface ConfigurationProfile {
  mode: AggregationMode;
  name: string;
  shortName: string;
  description: string;
  requestGas: number;
  fulfillGas: number;
  latencySec: number;
}