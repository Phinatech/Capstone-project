/**
 * Downloads the daily rainfall series the backtest judges against the
 * Birni N'Konni gauge (GHCN NG000001075, 13.80°N 5.25°E), read at the gauge:
 *
 *  - NASA POWER PRECTOTCORR (MERRA-2 reanalysis), 1981-2024, in one request;
 *  - CHIRPS v2 daily (satellite + stations) through SERVIR's ClimateSERV API,
 *    in 5-year jobs (longer ranges fail).
 *
 * With METEOSTAT_API_KEY set it also fetches Meteostat's daily record for
 * station 61075 (Birni N'Konni), only to show it republishes the gauge: it
 * isn't an independent source here (Sokoto, 65010, has no daily data).
 *
 * Writes data/backtest/<source>.json as { "YYYYMMDD": mm }, skipping sources
 * already downloaded (delete a file to fetch it again).
 * Usage: npx tsx src/utils/fetch-backtest-data.ts
 */
import "dotenv/config";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fetchNasaPowerDaily } from "./nasaPower.js";

const GAUGE = { latitude: 13.8, longitude: 5.25 };
const FIRST_YEAR = 1981;
const LAST_YEAR = 2024;
const OUT_DIR = new URL("../../data/backtest/", import.meta.url);

const CLIMATESERV = "https://climateserv.servirglobal.net/api";
const CHIRPS_DATATYPE = "0";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET JSON, retrying dropped connections and server errors: ClimateSERV has both now and then. */
async function getJson<T>(url: string, tries = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (attempt >= tries) throw e;
      await sleep(15_000);
    }
  }
}

/** CHIRPS daily rainfall averaged over a ~5 km box around the gauge, one ClimateSERV job. */
async function fetchChirps(firstYear: number, lastYear: number): Promise<Map<string, number>> {
  const half = 0.025;
  const { latitude: lat, longitude: lon } = GAUGE;
  const box = [[lon - half, lat - half], [lon + half, lat - half], [lon + half, lat + half], [lon - half, lat + half], [lon - half, lat - half]];
  const params = new URLSearchParams({
    datatype: CHIRPS_DATATYPE,
    begintime: `01/01/${firstYear}`,
    endtime: `12/31/${lastYear}`,
    intervaltype: "0", // daily
    operationtype: "5", // average over the box
    dateType_Category: "default",
    isZip_CurrentDataType: "false",
    geometry: JSON.stringify({ type: "Polygon", coordinates: [box] }),
  });
  const [jobId] = await getJson<string[]>(`${CLIMATESERV}/submitDataRequest/?${params}`);
  for (let tries = 0; ; tries++) {
    const [progress] = await getJson<number[]>(`${CLIMATESERV}/getDataRequestProgress/?id=${jobId}`);
    if (progress === 100) break;
    if (progress === -1 || tries > 120) throw new Error(`ClimateSERV job for ${firstYear}-${lastYear} failed`);
    await sleep(5_000);
  }
  const body = await getJson<{ data?: Array<{ date: string; value?: { avg?: number } }> }>(
    `${CLIMATESERV}/getDataFromRequest/?id=${jobId}`
  );
  const daily = new Map<string, number>();
  for (const { date, value } of body.data ?? []) {
    const mm = value?.avg;
    if (typeof mm !== "number" || mm < 0) continue; // CHIRPS marks missing values as negative
    const [month, day, year] = date.split("/");
    daily.set(`${year}${month}${day}`, Math.round(mm * 100) / 100);
  }
  return daily;
}

/** Meteostat's measured daily rainfall for one station (no model fill), in 9-year requests (the API allows 3,650 days). */
async function fetchMeteostatStation(station: string, apiKey: string): Promise<Map<string, number>> {
  const daily = new Map<string, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 9) {
    const params = new URLSearchParams({ station, start: `${year}-01-01`, end: `${Math.min(year + 8, LAST_YEAR)}-12-31`, model: "false" });
    const res = await fetch(`https://meteostat.p.rapidapi.com/stations/daily?${params}`, {
      headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": "meteostat.p.rapidapi.com" },
    });
    if (!res.ok) throw new Error(`Meteostat answered ${res.status}`);
    for (const { date, prcp } of ((await res.json()) as { data?: Array<{ date: string; prcp: number | null }> }).data ?? []) {
      if (typeof prcp === "number") daily.set(date.slice(0, 10).replaceAll("-", ""), prcp);
    }
  }
  return daily;
}

async function save(name: string, daily: Map<string, number>): Promise<void> {
  const sorted = Object.fromEntries([...daily].sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(new URL(`${name}.json`, OUT_DIR), JSON.stringify(sorted));
  console.log(`${name}: ${daily.size} days`);
}

async function fetchAllChirps(): Promise<Map<string, number>> {
  const chirps = new Map<string, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 5) {
    const last = Math.min(year + 4, LAST_YEAR);
    for (const [day, mm] of await fetchChirps(year, last)) chirps.set(day, mm);
    console.log(`  CHIRPS ${year}-${last} done`);
  }
  return chirps;
}

const downloaded = (name: string) => access(new URL(`${name}.json`, OUT_DIR)).then(() => true, () => false);

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const meteostatKey = process.env.METEOSTAT_API_KEY?.trim();
  const downloads: Array<[string, () => Promise<Map<string, number>>]> = [
    [
      "nasa-power",
      () => fetchNasaPowerDaily({ apiUrl: "https://power.larc.nasa.gov/api/temporal/daily/point", ...GAUGE, start: `${FIRST_YEAR}0101`, end: `${LAST_YEAR}1231` }),
    ],
    ["chirps", fetchAllChirps],
  ];
  if (meteostatKey) downloads.push(["meteostat-61075", () => fetchMeteostatStation("61075", meteostatKey)]);
  else console.log("meteostat-61075: skipped (set METEOSTAT_API_KEY to fetch it)");

  for (const [name, download] of downloads) {
    if (await downloaded(name)) console.log(`${name}: already downloaded`);
    else await save(name, await download());
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
