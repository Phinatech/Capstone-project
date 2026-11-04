/**
 * Builds the rainfall history cover is sold against, for the app's buy forms:
 * frontend/src/data/rainfallHistory.json.
 *
 * Input is the daily CHIRPS and NASA POWER record for the point the relayer
 * reads (data/cover-history/, from `HISTORY_POINT=sokoto npx tsx
 * src/utils/fetch-backtest-data.ts`). Each dekad of each year is summed per
 * source and combined with the sources' on-chain reputation weights, the way
 * the aggregator combines live readings. Meteostat has no daily record at
 * Sokoto, so the history is the weighted mean of the two that do.
 *
 * Output: for every dekad of the year, keyed like the last three digits of a
 * contract period id (June D1 of any year is "61", October D3 is "103"), the
 * total for each year, oldest first. The app sums the dekads of a window per
 * year and sets the window's rainfall level from those totals.
 *
 * Usage: npx tsx src/utils/build-cover-history.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { config } from "../config.js";
import { dekadDays } from "./period.js";

const IN_DIR = new URL("../../data/cover-history/", import.meta.url);
const OUT = new URL("../../../frontend/src/data/rainfallHistory.json", import.meta.url);
const FIRST_YEAR = 1981;
const LAST_YEAR = 2024;
/** The deployed sources' weights (OracleAggregator); Meteostat's 311 has no history here. */
const WEIGHTS = { chirps: 421, nasaPower: 268 };

type Daily = Record<string, number>;

/** One source's total over a dekad, or null if any day is missing. */
function dekadTotal(daily: Daily, days: string[]): number | null {
  let total = 0;
  for (const day of days) {
    const mm = daily[day];
    if (typeof mm !== "number" || mm < 0) return null;
    total += mm;
  }
  return total;
}

async function main() {
  const read = async (name: string) => JSON.parse(await readFile(new URL(`${name}.json`, IN_DIR), "utf8")) as Daily;
  const [chirps, nasaPower] = await Promise.all([read("chirps"), read("nasa-power")]);

  const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const dekads: Record<string, number[]> = {};
  for (let month = 1; month <= 12; month++) {
    for (let dekad = 1; dekad <= 3; dekad++) {
      const key = String(month * 10 + dekad);
      dekads[key] = years.map((year) => {
        const days = dekadDays(year * 1000 + month * 10 + dekad);
        const c = dekadTotal(chirps, days);
        const n = dekadTotal(nasaPower, days);
        if (c === null && n === null) throw new Error(`no rainfall for ${year} dekad ${key}`);
        // A source missing a day sits that dekad out, as a silent oracle would.
        const total = c === null ? n! : n === null ? c : (c * WEIGHTS.chirps + n * WEIGHTS.nasaPower) / (WEIGHTS.chirps + WEIGHTS.nasaPower);
        return Math.round(total * 10) / 10;
      });
    }
  }

  const history = {
    generatedAt: new Date().toISOString().slice(0, 10),
    point: { latitude: config.rainfallLatitude, longitude: config.rainfallLongitude },
    sources: { CHIRPS: WEIGHTS.chirps, "NASA POWER": WEIGHTS.nasaPower },
    years,
    dekads,
  };
  await writeFile(OUT, `${JSON.stringify(history)}\n`);
  console.log(`wrote ${years.length} years x ${Object.keys(dekads).length} dekads to ${OUT.pathname}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
