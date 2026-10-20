/**
 * Prints what each oracle source would report for the same dekads, so a
 * disagreement between feeds is visible before it reaches the aggregator.
 *
 * This is how the CHIRPS feed earned its place: with CHIRPS replaying a stale
 * GHCN series, NASA POWER was the only source with live data, and it reported
 * 689.52 mm for dekad 2026092 where the real CHIRPS raster says 49.98 mm.
 * Against two independent feeds that outlier is now visible instead of final.
 *
 * Usage:
 *   npx tsx src/utils/compare-feeds.ts              # the dekads the relayer sees
 *   npx tsx src/utils/compare-feeds.ts 2026092      # just one
 */
import { config } from "../config.js";
import { dailyFeed, type Feed } from "./feeds.js";
import { fetchChirpsDaily } from "./chirps.js";
import { fetchMeteostatDaily } from "./meteostat.js";
import { fetchNasaPowerDaily } from "./nasaPower.js";
import { completedPeriods } from "./period.js";

const location = { latitude: config.rainfallLatitude, longitude: config.rainfallLongitude };

function chirps(): Feed {
  return dailyFeed((start, end) =>
    fetchChirpsDaily(
      { baseUrl: config.chirpsBaseUrl, ...location, cachePath: config.chirpsCachePath },
      start,
      end,
      fetch,
      config.chirpsConcurrency,
    ),
  );
}

function nasaPower(): Feed {
  return dailyFeed((start, end) =>
    fetchNasaPowerDaily({ apiUrl: config.nasaPowerApiUrl, ...location, start, end }),
  );
}

function meteostat(): Feed {
  if (!config.meteostatApiKey) return async () => new Map<number, number>();
  return dailyFeed((start, end) =>
    fetchMeteostatDaily({ apiKey: config.meteostatApiKey, ...location, start, end }),
  );
}

const given = process.argv.slice(2).map(Number).filter(Number.isInteger);
const periods = given.length > 0 ? given.sort((a, b) => a - b) : completedPeriods(new Date(), 3);

const sources: [string, Feed][] = [
  ["CHIRPS", chirps()],
  ["NASA_POWER", nasaPower()],
  ["Meteostat", meteostat()],
];

console.log(`insured point: lat ${location.latitude}, lon ${location.longitude}`);
console.log(`dekads: ${periods.join(", ")}`);
console.log(`units: mm per dekad (the aggregator stores hundredths, so 49.98 mm becomes 4998)\n`);

// One fetch per source, reused for both the table and the spread below.
const results = await Promise.all(
  sources.map(async ([name, feed]) => {
    try {
      return { name, totals: await feed(periods) };
    } catch (e) {
      return { name, error: (e as Error).message.split("\n")[0]! };
    }
  }),
);

for (const { name, totals, error } of results) {
  const parts = totals
    ? periods.map((p) => `${p}: ${totals.get(p) ?? "no data"}`)
    : [`unreachable (${error})`];
  console.log(`${name.padEnd(11)} ${parts.join("   ")}`);
}

const widest = periods
  .map((period) => {
    const seen = results.flatMap(({ totals }) => {
      const mm = totals?.get(period);
      return mm === undefined ? [] : [mm];
    });
    return seen.length >= 2 ? { period, spread: Math.max(...seen) - Math.min(...seen) } : null;
  })
  .filter((x): x is { period: number; spread: number } => x !== null && x.spread > 0);

if (widest.length > 0) {
  console.log(
    `\nsources disagree on: ${widest
      .map((w) => `${w.period} by ${Math.round(w.spread * 100) / 100} mm`)
      .join(", ")}`,
  );
}
