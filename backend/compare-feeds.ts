import { config } from "./src/config.js";
import { fetchChirpsDaily } from "./src/utils/chirps.js";
import { dailyFeed } from "./src/utils/feeds.js";
import { fetchMeteostatDaily } from "./src/utils/meteostat.js";
import { fetchNasaPowerDaily } from "./src/utils/nasaPower.js";

const location = { latitude: config.rainfallLatitude, longitude: config.rainfallLongitude };
const periods = [2026092, 2026093];

const sources: [string, ReturnType<typeof dailyFeed>][] = [
  [
    "CHIRPS (real raster)",
    dailyFeed((s, e) =>
      fetchChirpsDaily({ baseUrl: config.chirpsBaseUrl, ...location, cachePath: config.chirpsCachePath }, s, e, fetch, 3),
    ),
  ],
  ["NASA POWER", dailyFeed((s, e) => fetchNasaPowerDaily({ apiUrl: config.nasaPowerApiUrl, ...location, start: s, end: e }))],
  [
    "Meteostat",
    config.meteostatApiKey
      ? dailyFeed((s, e) => fetchMeteostatDaily({ apiKey: config.meteostatApiKey, ...location, start: s, end: e }))
      : (async () => new Map<number, number>()) as ReturnType<typeof dailyFeed>,
  ],
];

console.log(`insured point: lat ${location.latitude}, lon ${location.longitude}\n`);
for (const [name, feed] of sources) {
  try {
    const totals = await feed(periods);
    const parts = periods.map((p) => `${p}=${totals.get(p) ?? "no data"} mm`);
    console.log(`${name.padEnd(20)} ${parts.join("   ")}`);
  } catch (e) {
    console.log(`${name.padEnd(20)} unreachable: ${(e as Error).message}`);
  }
}
console.log(`\n(aggregator works in 0.01 mm; the relayer's MAX_READING = 50000 = 500 mm per dekad)`);
