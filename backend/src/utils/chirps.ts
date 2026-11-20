/**
 * CHIRPS v3.0 daily rainfall for a point, read straight from the Climate
 * Hazards Center's public GeoTIFF archive.
 *
 * The relayer used to satisfy this source from `sokoto-dekadal-rainfall.json`,
 * which is actually GHCN station observations for Birni N'Konni and stops at
 * December 2024 (the station reports no PRCP for 2025 or 2026). That feed
 * could never report a current period, and calling it CHIRPS was wrong twice
 * over. This module fetches genuine CHIRPS data instead.
 *
 * The v2.0 archive (`products/CHIRPS-2.0/global_daily/tifs/p05`) was taken
 * offline in 2026 and every request to it now returns 404, which this module
 * used to read as "not published yet", so the CHIRPS oracle silently stopped
 * reporting. v3.0 publishes each day twice: a preliminary file a few days
 * after the date, and a final file weeks later that replaces it. A day is
 * read from the final file when it exists and from the preliminary one
 * otherwise, as the archive's readme advises.
 *
 * Each day is one GeoTIFF of roughly 13 MB, so the extracted value for a day
 * is remembered in a JSON cache file; without it every relayer tick would
 * re-download the same month of rasters. Days CHIRPS has not published yet are
 * left out of the result, which `dekadTotal` reads as "dekad not complete yet".
 *
 * Usage:
 *   npx tsx src/utils/chirps.ts 20261101 20261110   # print one dekad
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fromArrayBuffer } from "geotiff";
import { dekadDays } from "./period.js";

/** CHIRPS marks "no data" (water, outside the domain) with this value. */
const NODATA = -9999;

/**
 * Cache-key prefixes. They keep v3.0 values apart from the v2.0 values older
 * cache files hold under bare dates (the two versions differ day by day), and
 * keep a preliminary value from being mistaken for a final one.
 */
const FINAL_KEY = "v3:";
const PRELIM_KEY = "v3p:";

/** The default archive: CHIRPS v3.0 daily, holding `final/` and `prelim/`. */
export const CHIRPS_V3_DAILY = "https://data.chc.ucsb.edu/products/CHIRPS/v3.0/daily";

export interface ChirpsQuery {
  /** The v3.0 daily directory, holding `final/sat/<year>/` and `prelim/sat/<year>/`. */
  baseUrl: string;
  latitude: number;
  longitude: number;
  /** Optional JSON file that remembers daily values across restarts. */
  cachePath?: string;
}

/** YYYYMMDD for every day from `start` to `end`, inclusive. */
export function eachDate(start: string, end: string): string[] {
  const days: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(4, 6));
  let d = Number(start.slice(6, 8));
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(4, 6));
  const endD = Number(end.slice(6, 8));
  while (y < endY || (y === endY && (m < endM || (m === endM && d <= endD)))) {
    days.push(`${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d < lastDay) d += 1;
    else {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return days;
}

/**
 * The two archive URLs for one day: the final file
 * (`final/sat/2026/chirps-v3.0.sat.2026.10.15.tif`) and the preliminary one
 * (`prelim/sat/2026/chirps-v3.0.prelim.2026.10.15.tif`). Both use the
 * IMERG-based ("sat") daily split, the only one the preliminary run produces.
 */
export function dailyUrls(baseUrl: string, date: string): { final: string; prelim: string } {
  const year = date.slice(0, 4);
  const stamp = `${year}.${date.slice(4, 6)}.${date.slice(6, 8)}`;
  const base = baseUrl.replace(/\/$/, "");
  return {
    final: `${base}/final/sat/${year}/chirps-v3.0.sat.${stamp}.tif`,
    prelim: `${base}/prelim/sat/${year}/chirps-v3.0.prelim.${stamp}.tif`,
  };
}

/**
 * The grid cell containing (`latitude`, `longitude`), in row/column order.
 * CHIRPS is a regular 0.05 degree grid, so the geotransform is enough.
 */
export function pixelAt(
  bbox: [number, number, number, number],
  width: number,
  height: number,
  latitude: number,
  longitude: number,
): { row: number; col: number } {
  const [minX, minY, maxX, maxY] = bbox;
  const col = Math.floor(((longitude - minX) / (maxX - minX)) * width);
  const row = Math.floor(((maxY - latitude) / (maxY - minY)) * height);
  return { row, col };
}

/** Rainfall in mm for the one cell covering the query point. */
export async function extractRainfall(
  tiffBytes: Buffer,
  latitude: number,
  longitude: number,
): Promise<number | null> {
  const buffer = tiffBytes.buffer.slice(
    tiffBytes.byteOffset,
    tiffBytes.byteOffset + tiffBytes.byteLength,
  ) as ArrayBuffer;
  const tiff = await fromArrayBuffer(buffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const { row, col } = pixelAt(
    image.getBoundingBox() as [number, number, number, number],
    width,
    height,
    latitude,
    longitude,
  );
  if (row < 0 || row >= height || col < 0 || col >= width) return null;
  const rasters = await image.readRasters({ window: [col, row, col + 1, row + 1] });
  const value = Number(rasters[0]?.[0]);
  if (!Number.isFinite(value) || value <= NODATA) return null;
  return Math.round(value * 100) / 100;
}

async function loadCache(path: string | undefined): Promise<Map<string, number>> {
  if (!path) return new Map();
  try {
    const raw = await readFile(path, "utf8");
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

async function saveCache(path: string | undefined, cache: Map<string, number>): Promise<void> {
  if (!path || cache.size === 0) return;
  try {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(Object.fromEntries(cache), null, 0), "utf8");
    await rename(tmp, path);
  } catch {
    // A full disk should not stop rainfall reporting; the next run simply
    // re-downloads the days it could not remember.
  }
}

/** Run `work` over `items`, keeping at most `limit` in flight. */
async function mapLimit<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index]!);
    }
  });
  await Promise.all(workers);
}

/** Rainfall at the query point from one day's raster, or null if it is not published there. */
async function readDay(fetchImpl: typeof fetch, url: string, query: ChirpsQuery): Promise<number | null> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    await res.body?.cancel(); // not published yet: free the connection
    return null;
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  return extractRainfall(bytes, query.latitude, query.longitude);
}

/**
 * Daily rainfall in mm by YYYYMMDD for the requested range, from the final
 * file where CHIRPS has released one and the preliminary file otherwise. Days
 * with neither, or that come back as nodata, are simply absent from the map.
 */
export async function fetchChirpsDaily(
  query: ChirpsQuery,
  start: string,
  end: string,
  fetchImpl: typeof fetch = fetch,
  concurrency = 3,
): Promise<Map<string, number>> {
  const wanted = eachDate(start, end);
  if (wanted.length === 0) return new Map();

  const cache = await loadCache(query.cachePath);
  // A day only stops being fetched once its final value is known; until then
  // each run checks for the final file (a quick 404 while it is not out yet).
  const missing = wanted.filter((day) => !cache.has(FINAL_KEY + day));

  let dirty = false;
  await mapLimit(missing, concurrency, async (day) => {
    const urls = dailyUrls(query.baseUrl, day);
    try {
      const final = await readDay(fetchImpl, urls.final, query);
      if (final !== null) {
        cache.set(FINAL_KEY + day, final);
        dirty = true;
        return;
      }
      if (cache.has(PRELIM_KEY + day)) return;
      const prelim = await readDay(fetchImpl, urls.prelim, query);
      if (prelim !== null) {
        cache.set(PRELIM_KEY + day, prelim);
        dirty = true;
      }
    } catch {
      // One unreadable raster must not take the whole feed down.
    }
  });

  if (dirty) await saveCache(query.cachePath, cache);

  const daily = new Map<string, number>();
  for (const day of wanted) {
    const mm = cache.get(FINAL_KEY + day) ?? cache.get(PRELIM_KEY + day);
    if (mm !== undefined) daily.set(day, mm);
  }
  return daily;
}

/** Prints dekadal totals for the periods covering the given days. */
if (process.argv[1]?.endsWith("chirps.ts")) {
  const [start, end] = process.argv.slice(2);
  if (!start || !end) {
    console.log("usage: npx tsx src/utils/chirps.ts <start YYYYMMDD> <end YYYYMMDD>");
    process.exit(1);
  }
  const baseUrl = CHIRPS_V3_DAILY;
  const cachePath = fileURLToPath(
    new URL("../../data/chirps-daily-cache.json", import.meta.url),
  );
  const daily = await fetchChirpsDaily({ baseUrl, latitude: 13.05, longitude: 5.23, cachePath }, start, end);
  console.log(`fetched ${daily.size} day(s)`);
  for (const day of [...daily.keys()].sort()) console.log(`  ${day}: ${daily.get(day)} mm`);

  const periods = [...new Set(daily ? eachDate(start, end).map(dayToPeriod) : [])].sort(
    (a, b) => a - b,
  );
  for (const period of periods) {
    let total = 0;
    let complete = true;
    for (const day of dekadDays(period)) {
      const mm = daily.get(day);
      if (mm === undefined) {
        complete = false;
        break;
      }
      total += mm;
    }
    console.log(
      `  period ${period}: ${complete ? `${Math.round(total * 100) / 100} mm` : "incomplete"}`,
    );
  }
}

function dayToPeriod(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(4, 6));
  const d = Number(day.slice(6, 8));
  const dekad = d <= 10 ? 1 : d <= 20 ? 2 : 3;
  return year * 1000 + month * 10 + dekad;
}
