/**
 * Oracle relayer: reports each source's rainfall for every finished dekad
 * on-chain, signing with that source's oracle account.
 *
 * NASA_POWER, CHIRPS and Meteostat (with METEOSTAT_API_KEY set) all read live
 * data for the insured location (RAINFALL_LATITUDE / RAINFALL_LONGITUDE):
 * NASA POWER from its JSON API, CHIRPS from the Climate Hazards Center's daily
 * GeoTIFF archive, and Meteostat from its API. Meteostat without a key falls
 * back to the historical GHCN series for Birni N'Konni (station NG000001075),
 * which only covers past seasons.
 *
 * A dekad is only reported once it has ended and the source has data for all
 * of its days: the aggregator accepts one reading per source per dekad, so a
 * partial total could never be corrected.
 */
import { readFile } from "node:fs/promises";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import type { SourceConfig } from "./config.js";
import { config } from "./config.js";
import { readReadings } from "./utils/chain.js";
import { dailyFeed, type Feed } from "./utils/feeds.js";
import { fetchChirpsDaily } from "./utils/chirps.js";
import { fetchMeteostatDaily } from "./utils/meteostat.js";
import { fetchNasaPowerDaily } from "./utils/nasaPower.js";
import { completedPeriods, currentPeriod } from "./utils/period.js";
import { withRpcRetry } from "./utils/rpcRetry.js";
import { settleDue } from "./settlement.js";

// Re-export for backward compatibility with the test suite
export { currentPeriod };

export interface RainfallReading {
  source: string;
  period: number;
  rainfallMm: number; // scaled by 100 for 2dp precision, per OracleAggregator
}

// Source-specific bias factors to simulate each source's different error profile
// on the historical series. These are illustrative; replace with backtest-derived values.
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

function historical(label: string): Feed {
  return async (periods) => {
    const data = await loadDekadalData();
    const bias = SOURCE_BIAS[label] ?? 1.0;
    const totals = new Map<number, number>();
    for (const period of periods) {
      const mm = data.get(period);
      if (mm !== undefined) totals.set(period, mm * bias);
    }
    return totals;
  };
}

// Meteostat's free plan allows 500 requests a month and its data lags about a
// week, so hourly retries would use ~170 requests per dekad; six-hourly ~30.
const METEOSTAT_MIN_INTERVAL_MS = 6 * 60 * 60_000;

const location = { latitude: config.rainfallLatitude, longitude: config.rainfallLongitude };

const FEEDS: Record<string, Feed> = {
  NASA_POWER: dailyFeed((start, end) => fetchNasaPowerDaily({ apiUrl: config.nasaPowerApiUrl, ...location, start, end })),
  CHIRPS: dailyFeed((start, end) =>
    fetchChirpsDaily(
      {
        baseUrl: config.chirpsBaseUrl,
        latitude: config.rainfallLatitude,
        longitude: config.rainfallLongitude,
        cachePath: config.chirpsCachePath,
      },
      start,
      end,
      fetch,
      config.chirpsConcurrency,
    ),
  ),
  Meteostat: config.meteostatApiKey
    ? dailyFeed(
        (start, end) => fetchMeteostatDaily({ apiKey: config.meteostatApiKey, ...location, start, end }),
        METEOSTAT_MIN_INTERVAL_MS
      )
    : historical("Meteostat"),
};

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
    // A dropped connection must not cost a reporting window: the aggregator
    // accepts one reading per source per dekad, so a re-sent transaction that
    // actually landed comes back as "already submitted" below.
    const receipt = await withRpcRetry(async () => {
      const tx = await aggregator.getFunction("submitReading")(reading.period, reading.rainfallMm);
      return tx.wait();
    });
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

/** Reports every finished dekad in the lookback that a source hasn't reported yet. */
export async function relayFinishedDekads(sources: SourceConfig[], now = new Date()): Promise<void> {
  const periods = completedPeriods(now, config.relayerLookbackDekads);
  const reported = new Set((await readReadings()).map((r) => `${r.period}:${r.oracle.toLowerCase()}`));

  for (const source of sources) {
    const feed = FEEDS[source.label];
    if (!feed) {
      console.log(`[relayer] no feed for ${source.label}, skipping`);
      continue;
    }
    const oracle = new Wallet(source.privateKey).address.toLowerCase();
    const due = periods.filter((period) => !reported.has(`${period}:${oracle}`));
    if (due.length === 0) continue;

    let totals: Map<number, number>;
    try {
      totals = await feed(due);
    } catch (e) {
      console.log(`[relayer] ${source.label} feed failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const waiting = due.filter((period) => !totals.has(period));
    if (waiting.length > 0) console.log(`[relayer] ${source.label} has no complete data yet for ${waiting.join(", ")}`);

    for (const [period, mm] of totals) {
      const rainfallMm = Math.round(mm * 100);
      if (rainfallMm > MAX_READING) {
        console.log(`[relayer] reading ${rainfallMm} exceeds MAX_READING for ${source.label}, period ${period}`);
        continue;
      }
      await submitReading({ source: source.label, period, rainfallMm });
    }
  }
}

/**
 * Every `intervalMinutes` (and once at start-up): report finished dekads, then
 * finalize dekads and settle policies that are ready (see settlement.ts).
 */
export function startRelayer(sources: SourceConfig[], intervalMinutes: number): void {
  if (!config.relayerEnabled) {
    console.log("[relayer] off; set RELAYER_ENABLED=true to submit readings and settle policies on-chain");
    return;
  }
  const keeperKey = config.keeperPrivateKey;
  if (sources.length === 0) console.log("[relayer] ORACLE_SOURCES not configured; not reporting readings");
  if (!keeperKey) console.log("[settlement] KEEPER_PRIVATE_KEY not configured; not finalizing or settling");
  if (sources.length === 0 && !keeperKey) return;

  const run = async (job: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      console.log(`[${job}] run failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    if (sources.length > 0) await run("relayer", () => relayFinishedDekads(sources));
    if (keeperKey) await run("settlement", () => settleDue(keeperKey));
    running = false;
  };

  void tick();
  setInterval(tick, intervalMinutes * 60_000);
  console.log(`[relayer] started: ${sources.length} source(s)${keeperKey ? " and settlement" : ""}, every ${intervalMinutes} min`);
}
