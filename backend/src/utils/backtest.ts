/**
 * Backtest: compute reputation weights against GHCN ground truth.
 *
 * Reads the dekadal rainfall data and computes each source's error against
 * the GHCN reference. Sources with lower error get higher weights.
 *
 * Usage: npx tsx src/utils/backtest.ts
 */
import { readFile } from "node:fs/promises";

const DATA_FILE = new URL("../../data/sokoto-dekadal-rainfall.json", import.meta.url);

interface BacktestResult {
  source: string;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  correlation: number;
  weight: number;
}

function computeStats(observed: number[], predicted: number[]): {
  mae: number;
  rmse: number;
  correlation: number;
} {
  const n = observed.length;
  if (n === 0) return { mae: 0, rmse: 0, correlation: 0 };

  let sumAbs = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const err = predicted[i] - observed[i];
    sumAbs += Math.abs(err);
    sumSq += err * err;
  }
  const mae = sumAbs / n;
  const rmse = Math.sqrt(sumSq / n);

  // Pearson correlation
  const meanObs = observed.reduce((a, b) => a + b, 0) / n;
  const meanPred = predicted.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denObs = 0;
  let denPred = 0;
  for (let i = 0; i < n; i++) {
    const dObs = observed[i] - meanObs;
    const dPred = predicted[i] - meanPred;
    num += dObs * dPred;
    denObs += dObs * dObs;
    denPred += dPred * dPred;
  }
  const correlation = denObs > 0 && denPred > 0 ? num / Math.sqrt(denObs * denPred) : 0;

  return { mae, rmse, correlation };
}

async function main() {
  const data = JSON.parse(await readFile(DATA_FILE, "utf8")) as Record<number, number>;
  const periods = Object.keys(data).map(Number).sort((a, b) => a - b);

  // For this backtest, we use the GHCN data as the reference and simulate
  // each source's readings with different error profiles.
  // In a real implementation, you would have actual CHIRPS/NASA POWER/Meteostat
  // readings for the same periods.

  const sourceProfiles: Record<string, { bias: number; noise: number }> = {
    CHIRPS: { bias: 1.02, noise: 0.08 },
    NASA_POWER: { bias: 0.98, noise: 0.12 },
    Meteostat: { bias: 1.0, noise: 0.05 },
  };

  const results: BacktestResult[] = [];
  const weights: Record<string, number> = {};

  for (const [source, profile] of Object.entries(sourceProfiles)) {
    const observed: number[] = [];
    const predicted: number[] = [];

    for (const period of periods) {
      const reference = data[period];
      // Simulate source reading with bias and noise
      const reading = reference * profile.bias + (Math.random() - 0.5) * 2 * profile.noise * reference;
      observed.push(reference);
      predicted.push(reading);
    }

    const stats = computeStats(observed, predicted);
    // Weight inversely proportional to RMSE
    const rawWeight = 1 / (1 + stats.rmse / 10);
    weights[source] = rawWeight;

    results.push({
      source,
      meanAbsoluteError: Math.round(stats.mae * 100) / 100,
      rootMeanSquareError: Math.round(stats.rmse * 100) / 100,
      correlation: Math.round(stats.correlation * 1000) / 1000,
      weight: 0, // normalized below
    });
  }

  // Normalize weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const r of results) {
    r.weight = Math.round((weights[r.source] / totalWeight) * 1000) / 1000;
  }

  console.log("Backtest Results (vs GHCN Birni N'Konni)");
  console.log("==========================================");
  console.log("Source      | MAE (mm) | RMSE (mm) | Correlation | Weight");
  console.log("------------|----------|-----------|-------------|--------");
  for (const r of results) {
    console.log(
      `${r.source.padEnd(11)} | ${r.meanAbsoluteError.toFixed(2).padStart(8)} | ${r.rootMeanSquareError.toFixed(2).padStart(9)} | ${r.correlation.toFixed(3).padStart(11)} | ${r.weight.toFixed(3).padStart(6)}`
    );
  }
  console.log("");
  console.log("Note: Weights are illustrative. Replace with actual source readings");
  console.log("for a real backtest. The GHCN data is the ground truth reference.");
}

main().catch(console.error);
