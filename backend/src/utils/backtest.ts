/**
 * Backtest: compare NASA POWER and GHCN rainfall data for Sokoto.
 *
 * GHCN (Birni N'Konni, NG000001075) is the ground truth reference.
 * NASA POWER (MERRA-2 reanalysis) is the source being evaluated.
 *
 * Usage: npx tsx src/utils/backtest.ts
 */
import { readFile } from "node:fs/promises";

const GHCN_FILE = new URL("../../data/sokoto-dekadal-rainfall.json", import.meta.url);
const NASA_FILE = new URL("../../data/nasa-power-2024.json", import.meta.url);

interface BacktestResult {
  source: string;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  correlation: number;
  bias: number;
  weight: number;
}

function computeStats(observed: number[], predicted: number[]): {
  mae: number;
  rmse: number;
  correlation: number;
  bias: number;
} {
  const n = observed.length;
  if (n === 0) return { mae: 0, rmse: 0, correlation: 0, bias: 0 };

  let sumAbs = 0;
  let sumSq = 0;
  let sumBias = 0;
  for (let i = 0; i < n; i++) {
    const err = predicted[i]! - observed[i]!;
    sumAbs += Math.abs(err);
    sumSq += err * err;
    sumBias += err;
  }
  const mae = sumAbs / n;
  const rmse = Math.sqrt(sumSq / n);
  const bias = sumBias / n;

  // Pearson correlation
  const meanObs = observed.reduce((a, b) => a + b, 0) / n;
  const meanPred = predicted.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denObs = 0;
  let denPred = 0;
  for (let i = 0; i < n; i++) {
    const dObs = observed[i]! - meanObs;
    const dPred = predicted[i]! - meanPred;
    num += dObs * dPred;
    denObs += dObs * dObs;
    denPred += dPred * dPred;
  }
  const correlation = denObs > 0 && denPred > 0 ? num / Math.sqrt(denObs * denPred) : 0;

  return { mae, rmse, correlation, bias };
}

function parseNasaPower(data: any): Map<string, number> {
  const result = new Map<string, number>();
  const params = data?.properties?.parameter?.PRECTOTCORR;
  if (!params) return result;
  for (const [date, value] of Object.entries(params)) {
    result.set(date, value as number);
  }
  return result;
}

function aggregateNasaToDekads(daily: Map<string, number>): Map<number, number> {
  const dekadal = new Map<number, number>();
  const dekadalDays = new Map<number, number>();

  for (const [date, value] of daily) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(4, 6));
    const day = Number(date.slice(6, 8));
    const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
    const periodId = year * 1000 + month * 10 + dekad;

    dekadal.set(periodId, (dekadal.get(periodId) ?? 0) + value);
    dekadalDays.set(periodId, (dekadalDays.get(periodId) ?? 0) + 1);
  }

  // Only keep dekads with at least 8 days of data
  const result = new Map<number, number>();
  for (const [periodId, total] of dekadal) {
    const days = dekadalDays.get(periodId) ?? 0;
    if (days >= 8) {
      result.set(periodId, Math.round(total * 100) / 100);
    }
  }
  return result;
}

async function main() {
  // Load GHCN ground truth
  const ghcnData = JSON.parse(await readFile(GHCN_FILE, "utf8")) as Record<number, number>;
  const ghcnPeriods = Object.keys(ghcnData).map(Number).sort((a, b) => a - b);

  // Load NASA POWER daily data and aggregate to dekads
  const nasaRaw = JSON.parse(await readFile(NASA_FILE, "utf8"));
  const nasaDaily = parseNasaPower(nasaRaw);
  const nasaDekads = aggregateNasaToDekads(nasaDaily);

  // Find overlapping periods
  const ghcnSet = new Set(ghcnPeriods);
  const nasaSet = new Set(nasaDekads.keys());
  const common = ghcnPeriods.filter((p) => nasaSet.has(p));

  if (common.length === 0) {
    console.log("No overlapping periods between GHCN and NASA POWER data.");
    console.log(`GHCN periods: ${ghcnPeriods[0]} to ${ghcnPeriods[ghcnPeriods.length - 1]}`);
    console.log(`NASA POWER periods: ${[...nasaSet][0]} to ${[...nasaSet][nasaSet.size - 1]}`);
    return;
  }

  const observed: number[] = [];
  const predicted: number[] = [];

  for (const period of common) {
    observed.push(ghcnData[period]!);
    predicted.push(nasaDekads.get(period)!);
  }

  const stats = computeStats(observed, predicted);

  // Weight inversely proportional to RMSE (normalized later)
  const rawWeight = 1 / (1 + stats.rmse / 10);

  const result: BacktestResult = {
    source: "NASA_POWER",
    meanAbsoluteError: Math.round(stats.mae * 100) / 100,
    rootMeanSquareError: Math.round(stats.rmse * 100) / 100,
    correlation: Math.round(stats.correlation * 1000) / 1000,
    bias: Math.round(stats.bias * 100) / 100,
    weight: Math.round(rawWeight * 1000) / 1000,
  };

  console.log("Backtest Results: NASA POWER vs GHCN (Birni N'Konni)");
  console.log("=====================================================");
  console.log(`Common periods: ${common.length}`);
  console.log(`Period range: ${common[0]} to ${common[common.length - 1]}`);
  console.log("");
  console.log("Source      | MAE (mm) | RMSE (mm) | Correlation | Bias (mm) | Weight");
  console.log("------------|----------|-----------|-------------|-----------|--------");
  console.log(
    `${result.source.padEnd(11)} | ${result.meanAbsoluteError.toFixed(2).padStart(8)} | ${result.rootMeanSquareError.toFixed(2).padStart(9)} | ${result.correlation.toFixed(3).padStart(11)} | ${result.bias.toFixed(2).padStart(9)} | ${result.weight.toFixed(3).padStart(6)}`
  );
  console.log("");
  console.log("Note: GHCN is the ground truth reference. NASA POWER is the source being evaluated.");
  console.log("CHIRPS and Meteostat data could not be downloaded (URL format issues / invalid API key).");
  console.log("Add them to the comparison once their data is available.");
}

main().catch(console.error);
