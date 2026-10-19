/**
 * Statistics for the oracle backtest: how far each estimate is from the gauge,
 * reputation weights from those errors, the contract's weighted average, and
 * how often an estimate would make a different payout call than the gauge.
 */

export interface ErrorStats {
  n: number;
  /** Mean absolute error, mm. */
  mae: number;
  /** Root mean square error, mm. */
  rmse: number;
  /** Mean of estimate minus gauge, mm: positive overestimates. */
  bias: number;
  /** Pearson correlation with the gauge. */
  correlation: number;
}

export function errorStats(gauge: number[], estimate: number[]): ErrorStats {
  const n = gauge.length;
  if (n === 0 || estimate.length !== n) throw new RangeError("Need equally long, non-empty series");
  let abs = 0;
  let sq = 0;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const e = estimate[i]! - gauge[i]!;
    abs += Math.abs(e);
    sq += e * e;
    diff += e;
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / n;
  const mg = mean(gauge);
  const me = mean(estimate);
  let cov = 0;
  let vg = 0;
  let ve = 0;
  for (let i = 0; i < n; i++) {
    cov += (gauge[i]! - mg) * (estimate[i]! - me);
    vg += (gauge[i]! - mg) ** 2;
    ve += (estimate[i]! - me) ** 2;
  }
  return { n, mae: abs / n, rmse: Math.sqrt(sq / n), bias: diff / n, correlation: vg && ve ? cov / Math.sqrt(vg * ve) : 0 };
}

/**
 * Reputation weights proportional to 1/MSE, summing to 1. For independent,
 * unbiased errors this is the combination with the smallest expected error.
 */
export function inverseMseWeights(rmse: Record<string, number>): Record<string, number> {
  const inverse = Object.entries(rmse).map(([source, r]) => [source, 1 / Math.max(r, 1e-9) ** 2] as const);
  const total = inverse.reduce((sum, [, w]) => sum + w, 0);
  return Object.fromEntries(inverse.map(([source, w]) => [source, w / total]));
}

/**
 * The aggregator's estimate: the weighted average of the sources that
 * reported, as OracleAggregator.finalizePeriod computes it. Null if none did.
 */
export function weightedEstimate(readings: Record<string, number | undefined>, weights: Record<string, number>): number | null {
  let sum = 0;
  let total = 0;
  for (const [source, mm] of Object.entries(readings)) {
    const w = weights[source] ?? 0;
    if (mm === undefined || w <= 0) continue;
    sum += w * mm;
    total += w;
  }
  return total > 0 ? sum / total : null;
}

/** Whole-number weights summing to `total`, for OracleAggregator's reputationWeight. */
export function onChainWeights(weights: Record<string, number>, total = 1000): Record<string, number> {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const exact = Object.entries(weights).map(([source, w]) => [source, (w / sum) * total] as const);
  const rounded = Object.fromEntries(exact.map(([source, w]) => [source, Math.floor(w)]));
  // Hand the remainder to the largest fractional parts so the integers still add up to `total`.
  let left = total - Object.values(rounded).reduce((a, b) => a + b, 0);
  for (const [source] of [...exact].sort((a, b) => (b[1] % 1) - (a[1] % 1))) {
    if (left-- <= 0) break;
    rounded[source]! += 1;
  }
  return rounded;
}

/** The p-th percentile (0-100) by linear interpolation. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new RangeError("No values");
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (rank - lo);
}

/** Seeded pseudo-random numbers in [0, 1) (mulberry32), so bootstrap results are reproducible. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 95% bootstrap interval for MAE(a) minus MAE(b), resampling dekads with
 * replacement. An interval that includes 0 means the data can't tell a and b apart.
 */
export function maeDifferenceInterval(gauge: number[], a: number[], b: number[], iterations = 2000, seed = 1): [number, number] {
  const random = seededRandom(seed);
  const n = gauge.length;
  const differences: number[] = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const k = Math.floor(random() * n);
      sum += Math.abs(a[k]! - gauge[k]!) - Math.abs(b[k]! - gauge[k]!);
    }
    differences.push(sum / n);
  }
  return [percentile(differences, 2.5), percentile(differences, 97.5)];
}

export interface PayoutAgreement {
  /** Gauge dry and estimate dry: a payout that should happen does. */
  hits: number;
  /** Gauge dry but estimate not: a farmer in drought isn't paid. */
  misses: number;
  /** Estimate dry but gauge not: a payout without a drought. */
  falseAlarms: number;
  correctNegatives: number;
}

/** Compares payout calls (rainfall below `threshold`) made from the estimate with the gauge's. */
export function payoutAgreement(gauge: number[], estimate: number[], threshold: number): PayoutAgreement {
  const result = { hits: 0, misses: 0, falseAlarms: 0, correctNegatives: 0 };
  gauge.forEach((g, i) => {
    const gaugeDry = g < threshold;
    const estimateDry = estimate[i]! < threshold;
    if (gaugeDry && estimateDry) result.hits++;
    else if (gaugeDry) result.misses++;
    else if (estimateDry) result.falseAlarms++;
    else result.correctNegatives++;
  });
  return result;
}
