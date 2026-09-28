import { configurationProfiles } from '../data/configurations';
import { coverageWindows } from '../data/policies';
import { dekadalRainfall } from '../data/rainfall';
import { pseudoHash } from './format';
import type {
  AggregationMode,
  Corruption,
  CorruptionType,
  EvaluationResult,
  Policy,
  SourceId } from
'../types/insurance';

export const SOURCE_IDS: SourceId[] = ['chirps', 'nasa', 'meteostat'];
export const SINGLE_SOURCE: SourceId = 'chirps';
const AGREEMENT_TOLERANCE = 0.15;
const REPUTATION_SCALE = 0.1;

export type ReputationTable = Record<SourceId, {score: number;weight: number;meanDeviation: number;}>;

export function getWindow(windowId: string) {
  return coverageWindows.find((w) => w.id === windowId) ?? coverageWindows[0];
}

export function windowTotal(key: SourceId | 'reference', start: number, end: number): number {
  return dekadalRainfall.slice(start, end + 1).reduce((sum, row) => sum + row[key], 0);
}

/** Reputation = historical agreement of each source with the mean of its two peers. */
export function computeReputation(): ReputationTable {
  const raw = SOURCE_IDS.map((id) => {
    const peers = SOURCE_IDS.filter((p) => p !== id);
    const deviations = dekadalRainfall.
    map((row) => {
      const peerMean = (row[peers[0]] + row[peers[1]]) / 2;
      return peerMean >= 5 ? Math.abs(row[id] - peerMean) / peerMean : null;
    }).
    filter((d): d is number => d !== null);
    const meanDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    return { id, meanDeviation, score: 1 / (1 + meanDeviation / REPUTATION_SCALE) };
  });
  const total = raw.reduce((s, r) => s + r.score, 0);
  return raw.reduce((acc, r) => {
    acc[r.id] = { score: r.score, weight: r.score / total, meanDeviation: r.meanDeviation };
    return acc;
  }, {} as ReputationTable);
}

export const reputation = computeReputation();

/** Per-dekad relative deviation of each source from the mean of its two peers (null when peers report < 5 mm). */
export function dekadDeviations(): Record<SourceId, (number | null)[]> {
  const out = {} as Record<SourceId, (number | null)[]>;
  SOURCE_IDS.forEach((id) => {
    const peers = SOURCE_IDS.filter((p) => p !== id);
    out[id] = dekadalRainfall.map((row) => {
      const peerMean = (row[peers[0]] + row[peers[1]]) / 2;
      return peerMean >= 5 ? Math.abs(row[id] - peerMean) / peerMean : null;
    });
  });
  return out;
}

/** Reputation score as it would have stood after each dekad of the season (cumulative). */
export function reputationTrend(): {label: string;chirps: number;nasa: number;meteostat: number;}[] {
  const devs = dekadDeviations();
  return dekadalRainfall.map((row, i) => {
    const point = { label: row.label } as {label: string;chirps: number;nasa: number;meteostat: number;};
    SOURCE_IDS.forEach((id) => {
      const seen = devs[id].slice(0, i + 1).filter((d): d is number => d !== null);
      const mean = seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : 0;
      point[id] = Math.round(1 / (1 + mean / REPUTATION_SCALE) * 1000) / 10;
    });
    return point;
  });
}

/** Reads a coverage window from every source, optionally corrupting one reading. */
export function readSources(windowId: string, corruption: Corruption | null): Record<SourceId, number> {
  const w = getWindow(windowId);
  return readWindow(w.start, w.end, corruption);
}

function agreement(a: number, b: number): number {
  const scale = Math.max((a + b) / 2, 1);
  const d = Math.abs(a - b) / scale;
  return 1 / (1 + (d / AGREEMENT_TOLERANCE) ** 2);
}

export function applyCorruption(value: number, type: CorruptionType): number {
  if (type === 'outage') return 0;
  if (type === 'inflated') return value * 2.5;
  return value * 0.3;
}

export function aggregate(
mode: AggregationMode,
values: Record<SourceId, number>,
rep: ReputationTable = reputation)
: {value: number;weights: Record<SourceId, number>;} {
  const raw = {} as Record<SourceId, number>;
  SOURCE_IDS.forEach((id) => {
    if (mode === 'single') raw[id] = id === SINGLE_SOURCE ? 1 : 0;else
    if (mode === 'equal') raw[id] = 1;else
    {
      const support = SOURCE_IDS.filter((o) => o !== id).reduce(
        (s, o) => s + rep[o].weight * agreement(values[id], values[o]),
        0
      );
      raw[id] = rep[id].weight * support;
    }
  });
  let total = SOURCE_IDS.reduce((s, id) => s + raw[id], 0);
  if (total < 1e-9) {
    SOURCE_IDS.forEach((id) => raw[id] = rep[id].weight);
    total = 1;
  }
  const weights = {} as Record<SourceId, number>;
  let value = 0;
  SOURCE_IDS.forEach((id) => {
    weights[id] = raw[id] / total;
    value += weights[id] * values[id];
  });
  return { value, weights };
}

function readWindow(start: number, end: number, corruption: Corruption | null): Record<SourceId, number> {
  const values = {} as Record<SourceId, number>;
  SOURCE_IDS.forEach((id) => {
    const clean = windowTotal(id, start, end);
    values[id] = corruption && corruption.sourceId === id ? applyCorruption(clean, corruption.type) : clean;
  });
  return values;
}

export function evaluatePolicy(
policy: Policy,
mode: AggregationMode,
corruption: Corruption | null,
simulated: boolean)
: EvaluationResult {
  const window = getWindow(policy.windowId);
  const values = readWindow(window.start, window.end, corruption);
  const { value, weights } = aggregate(mode, values);
  const triggered = value < policy.thresholdMm;
  const profile = configurationProfiles.find((p) => p.mode === mode) ?? configurationProfiles[0];
  const referenceMm = windowTotal('reference', window.start, window.end);
  const evaluatedAt = new Date().toISOString();
  return {
    mode,
    readings: SOURCE_IDS.map((id) => ({
      sourceId: id,
      value: values[id],
      weight: weights[id],
      corrupted: !!corruption && corruption.sourceId === id
    })),
    aggregateMm: value,
    thresholdMm: policy.thresholdMm,
    triggered,
    referenceMm,
    referenceTriggered: referenceMm < policy.thresholdMm,
    gasUsed: profile.requestGas + profile.fulfillGas + (triggered && !simulated ? 9_700 : 0),
    latencySec: profile.latencySec,
    txHash: pseudoHash(`${policy.id}-${mode}-${evaluatedAt}`),
    evaluatedAt,
    corruption,
    simulated
  };
}

// ---------- Backtest ----------

const thresholdFactors = [0.85, 0.92, 0.97, 1.03, 1.08, 1.15];
const corruptionTypes: CorruptionType[] = ['outage', 'inflated', 'understated'];

export interface BacktestSummary {
  mode: AggregationMode;
  cleanAccuracy: number;
  corruptedAccuracy: number;
  corruptedMeanError: number;
  cleanCases: number;
  corruptedCases: number;
}

export function runBacktest(): BacktestSummary[] {
  return (['single', 'equal', 'reputation'] as AggregationMode[]).map((mode) => {
    let cleanCorrect = 0;
    let cleanCases = 0;
    let corruptCorrect = 0;
    let corruptCases = 0;
    let errorSum = 0;
    coverageWindows.forEach((w) => {
      const reference = windowTotal('reference', w.start, w.end);
      thresholdFactors.forEach((f) => {
        const threshold = reference * f;
        const truth = reference < threshold;
        const clean = aggregate(mode, readWindow(w.start, w.end, null)).value;
        cleanCases++;
        if (clean < threshold === truth) cleanCorrect++;
        SOURCE_IDS.forEach((sourceId) =>
        corruptionTypes.forEach((type) => {
          const v = aggregate(mode, readWindow(w.start, w.end, { sourceId, type })).value;
          corruptCases++;
          if (v < threshold === truth) corruptCorrect++;
          errorSum += Math.abs(v - reference) / Math.max(reference, 1);
        })
        );
      });
    });
    return {
      mode,
      cleanAccuracy: cleanCorrect / cleanCases,
      corruptedAccuracy: corruptCorrect / corruptCases,
      corruptedMeanError: errorSum / corruptCases,
      cleanCases,
      corruptedCases: corruptCases
    };
  });
}