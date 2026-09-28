import { describe, expect, it } from 'vitest';
import { seedPolicies } from '../data/policies';
import type { SourceId } from '../types/insurance';
import {
  aggregate,
  applyCorruption,
  computeReputation,
  evaluatePolicy,
  reputation,
  runBacktest,
  SINGLE_SOURCE,
  SOURCE_IDS } from
'./oracle';

// These check properties of the aggregation, not specific numbers, so they
// keep holding when the illustrative rainfall data is replaced with real data.

const sum = (w: Record<SourceId, number>) => SOURCE_IDS.reduce((s, id) => s + w[id], 0);
const readings = (chirps: number, nasa: number, meteostat: number) => ({ chirps, nasa, meteostat });

describe('computeReputation', () => {
  const rep = computeReputation();

  it('gives every source a positive weight, and the weights sum to 1', () => {
    SOURCE_IDS.forEach((id) => expect(rep[id].weight).toBeGreaterThan(0));
    expect(sum({ chirps: rep.chirps.weight, nasa: rep.nasa.weight, meteostat: rep.meteostat.weight })).toBeCloseTo(1, 10);
  });

  it('ranks sources by how closely they track their peers', () => {
    const byDeviation = [...SOURCE_IDS].sort((a, b) => rep[a].meanDeviation - rep[b].meanDeviation);
    const byWeight = [...SOURCE_IDS].sort((a, b) => rep[b].weight - rep[a].weight);
    expect(byWeight).toEqual(byDeviation);
  });
});

describe('aggregate', () => {
  it('single-source mode uses only the single source', () => {
    const { value, weights } = aggregate('single', readings(40, 55, 70));
    expect(value).toBe(readings(40, 55, 70)[SINGLE_SOURCE]);
    expect(weights[SINGLE_SOURCE]).toBe(1);
    expect(sum(weights)).toBe(1);
  });

  it('equal-weight mode is the plain mean', () => {
    const { value, weights } = aggregate('equal', readings(40, 55, 70));
    expect(value).toBeCloseTo(55, 10);
    SOURCE_IDS.forEach((id) => expect(weights[id]).toBeCloseTo(1 / 3, 10));
  });

  it('reputation mode returns normalised weights and stays within the readings', () => {
    const values = readings(40, 55, 70);
    const { value, weights } = aggregate('reputation', values);
    expect(sum(weights)).toBeCloseTo(1, 10);
    expect(value).toBeGreaterThanOrEqual(40);
    expect(value).toBeLessThanOrEqual(70);
  });

  it('reputation mode returns the common value when all sources agree', () => {
    expect(aggregate('reputation', readings(62, 62, 62)).value).toBeCloseTo(62, 10);
  });

  it('reputation mode discounts a source that disagrees with the others', () => {
    SOURCE_IDS.forEach((outlier) => {
      const values = readings(100, 100, 100);
      values[outlier] = 300;
      const rep = aggregate('reputation', values);
      const equal = aggregate('equal', values);
      expect(rep.weights[outlier]).toBeLessThan(reputation[outlier].weight);
      expect(Math.abs(rep.value - 100)).toBeLessThan(Math.abs(equal.value - 100));
    });
  });
});

describe('applyCorruption', () => {
  it('models an outage, an inflated reading and an understated reading', () => {
    expect(applyCorruption(80, 'outage')).toBe(0);
    expect(applyCorruption(80, 'inflated')).toBe(200);
    expect(applyCorruption(80, 'understated')).toBeCloseTo(24, 10);
  });
});

describe('evaluatePolicy', () => {
  const policy = seedPolicies[0];

  it('triggers a payout exactly when the aggregate is below the threshold', () => {
    for (const mode of ['single', 'equal', 'reputation'] as const) {
      const r = evaluatePolicy(policy, mode, null, true);
      expect(r.triggered).toBe(r.aggregateMm < r.thresholdMm);
      expect(r.referenceTriggered).toBe(r.referenceMm < r.thresholdMm);
      expect(r.readings).toHaveLength(SOURCE_IDS.length);
    }
  });

  it('flags only the corrupted source', () => {
    const r = evaluatePolicy(policy, 'reputation', { sourceId: 'nasa', type: 'outage' }, true);
    expect(r.readings.filter((x) => x.corrupted).map((x) => x.sourceId)).toEqual(['nasa']);
    expect(r.readings.find((x) => x.sourceId === 'nasa')?.value).toBe(0);
  });
});

describe('runBacktest', () => {
  it('scores every configuration over the same cases', () => {
    const results = runBacktest();
    expect(results.map((r) => r.mode)).toEqual(['single', 'equal', 'reputation']);
    const [first] = results;
    results.forEach((r) => {
      expect(r.cleanCases).toBe(first.cleanCases);
      expect(r.corruptedCases).toBe(first.corruptedCases);
      expect(r.corruptedCases).toBe(r.cleanCases * SOURCE_IDS.length * 3);
      for (const acc of [r.cleanAccuracy, r.corruptedAccuracy]) {
        expect(acc).toBeGreaterThanOrEqual(0);
        expect(acc).toBeLessThanOrEqual(1);
      }
    });
  });
});
