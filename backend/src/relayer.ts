/**
 * Oracle relayer: fetches rainfall readings and submits them on-chain.
 *
 * Data source: historical GHCN precipitation data for Birni N'Konni, Niger
 * (station NG000001075), aggregated to dekads. This is the same dataset used
 * for the Chapter Four backtest, so the relayer exercises the full transactional
 * path with real historical data.
 *
 * Live API integration (CHIRPS, NASA POWER, Meteostat) is deferred, not dropped.
 * See README.md for details on what a live implementation would require.
 */
import { readFile } from "node:fs/promises";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import type { SourceConfig } from "./config.js";
import { config } from "./config.js";
import { currentPeriod } from "./utils/period.js";

// Re-export for backward compatibility with the test suite
export { currentPeriod };

export interface RainfallReading {
  source: string;
  period: number;
  rainfallMm: number; // scaled by 100 for 2dp precision, per OracleAggregator
}

// Source-specific bias factors to simulate each source's different error profile.
// These are illustrative; replace with backtest-derived values.
const SOURCE_BIAS: Record<string, number> = {
  CHIRPS: 1.02, // slight overestimate
  NASA_POWER: 0.98, // slight underestimate
  Meteostat: 1.0, // neutral
};

// Plausibility bound (matches OracleAggregator.MAX_READING)
const MAX_READING = 50_000;

let dekadalData: Map<number, number> | null = null;

async function loadDekadalData(): Promise<Map<number, number>> {
  if (dekadalData) return dekadalData;
  const data = JSON.parse(
    await readFile(new URL("../data/sokoto-dekadal-rainfall.json", import.meta.url), "utf8")
  ) as Record<number, number>;
  dekadalData = new Map(Object.entries(data).map(([k, v]) => [Number(k), v]));
  return dekadalData;
}

export async function fetchRainfall(
  source: SourceConfig,
  period: number
): Promise<RainfallReading | null> {
  const data = await loadDekadalData();
  const rainfallMm = data.get(period);
  if (rainfallMm === undefined) {
    console.log(`[relayer] no data for period ${period}, skipping ${source.label}`);
    return null;
  }

  const bias = SOURCE_BIAS[source.label] ?? 1.0;
  const adjusted = Math.round(rainfallMm * bias * 100);

  if (adjusted > MAX_READING) {
    console.log(`[relayer] reading ${adjusted} exceeds MAX_READING for ${source.label}, period ${period}`);
    return null;
  }

  return { source: source.label, period, rainfallMm: adjusted };
}

export async function submitReading(reading: RainfallReading): Promise<void> {
  const provider = new JsonRpcProvider(config.rpcUrl);
  const source = config.oracleSources.find((s) => s.label === reading.source);
  if (!source) {
    console.log(`[relayer] no private key for ${reading.source}, skipping`);
    return;
  }

  const wallet = new Wallet(source.privateKey, provider);
  const aggregator = new Contract(
    config.aggregatorAddress,
    [
      "function submitReading(uint256 period, uint256 rainfallMm)",
      "function isFinalized(uint256 period) view returns (bool)",
    ],
    wallet
  );

  try {
    const tx = await aggregator.getFunction("submitReading")(reading.period, reading.rainfallMm);
    const receipt = await tx.wait();
    const timestamp = new Date().toISOString();
    console.log(
      `[relayer] submitted: source=${reading.source} period=${reading.period} rainfallMm=${reading.rainfallMm} ` +
      `tx=${receipt.hash} gasUsed=${receipt.gasUsed} timestamp=${timestamp}`
    );
  } catch (e: unknown) {
    const err = e as { reason?: string; message?: string };
    const reason = err.reason ?? err.message ?? "";
    if (reason.includes("already submitted for period")) {
      console.log(`[relayer] ${reading.source} already submitted for period ${reading.period}, treating as success`);
    } else if (reason.includes("period already finalized")) {
      console.log(`[relayer] period ${reading.period} already finalized, skipping ${reading.source}`);
    } else if (reason.includes("not a registered oracle")) {
      console.log(`[relayer] ${reading.source} is not a registered oracle, skipping`);
    } else {
      console.log(`[relayer] failed to submit ${reading.source} for period ${reading.period}: ${reason}`);
    }
  }
}

export function startRelayer(sources: SourceConfig[], intervalMinutes: number): void {
  if (sources.length === 0) {
    console.log("[relayer] ORACLE_SOURCES not configured; relayer idle");
    return;
  }

  const tick = async () => {
    const period = currentPeriod();
    for (const source of sources) {
      const reading = await fetchRainfall(source, period);
      if (reading) await submitReading(reading);
    }
  };

  setInterval(tick, intervalMinutes * 60_000);
  console.log(`[relayer] started: ${sources.length} source(s), every ${intervalMinutes} min`);
}
