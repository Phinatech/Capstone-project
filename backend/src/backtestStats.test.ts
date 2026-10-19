import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  errorStats,
  inverseMseWeights,
  maeDifferenceInterval,
  onChainWeights,
  payoutAgreement,
  percentile,
  weightedEstimate,
} from "./utils/backtestStats.js";

const close = (actual: number, expected: number, digits = 6) => assert.equal(actual.toFixed(digits), expected.toFixed(digits));

describe("backtest statistics", () => {
  it("measures error, bias and correlation against the gauge", () => {
    const s = errorStats([10, 20, 30, 40], [12, 18, 33, 41]);
    close(s.mae, 2); // |2|+|-2|+|3|+|1| = 8 over 4
    close(s.rmse, Math.sqrt((4 + 4 + 9 + 1) / 4));
    close(s.bias, 1); // (2-2+3+1)/4
    assert.ok(s.correlation > 0.98 && s.correlation <= 1);
  });

  it("weights a source with half the error four times as much", () => {
    const w = inverseMseWeights({ a: 10, b: 20 });
    close(w.a!, 0.8);
    close(w.b!, 0.2);
  });

  it("averages only the sources that reported, as the contract does", () => {
    close(weightedEstimate({ a: 10, b: 30 }, { a: 3, b: 1 })!, 15);
    close(weightedEstimate({ a: 10, b: undefined }, { a: 3, b: 1 })!, 10);
    assert.equal(weightedEstimate({ a: undefined }, { a: 1 }), null);
  });

  it("turns weights into whole numbers that add up to 1000", () => {
    const w = onChainWeights({ a: 1, b: 1, c: 1 });
    assert.equal(Object.values(w).reduce((x, y) => x + y, 0), 1000);
    assert.deepEqual(Object.values(w).sort(), [333, 333, 334]);
  });

  it("interpolates percentiles", () => {
    close(percentile([0, 10, 20, 30, 40], 25), 10);
    close(percentile([0, 10], 50), 5);
  });

  it("bootstraps the difference in error between two estimates", () => {
    const gauge = [0, 0, 0, 0, 0, 0];
    assert.deepEqual(maeDifferenceInterval(gauge, [1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2]), [-1, -1]);
    const [lo, hi] = maeDifferenceInterval(gauge, [1, 3, 1, 3, 1, 3], [2, 2, 2, 2, 2, 2]);
    assert.ok(lo < 0 && hi > 0, "an estimate no better on average straddles zero");
    assert.deepEqual(maeDifferenceInterval(gauge, [1, 3, 1, 3, 1, 3], [2, 2, 2, 2, 2, 2]), [lo, hi], "seeded, so reproducible");
  });

  it("counts payout calls that match or miss the gauge's", () => {
    // threshold 20: gauge dry at 10 and 15
    assert.deepEqual(payoutAgreement([10, 15, 30, 40], [12, 25, 18, 45], 20), {
      hits: 1, // 10 vs 12
      misses: 1, // 15 vs 25
      falseAlarms: 1, // 30 vs 18
      correctNegatives: 1, // 40 vs 45
    });
  });
});
