/**
 * Aggregates GHCN daily precipitation data to dekadal values.
 *
 * Reads the GHCN CSV file for Birni N'Konni (NG000001075) and outputs a
 * JSON file mapping period IDs (YYYYMMD) to dekadal rainfall in mm.
 *
 * Usage: npx tsx src/utils/aggregate-ghcn.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { currentPeriod, dekadStart, dekadEnd } from "./period.js";

const DATA_FILE = new URL("../../data/birni-n-konni-ghcn.csv", import.meta.url);
const OUTPUT_FILE = new URL("../../data/sokoto-dekadal-rainfall.json", import.meta.url);

interface DailyReading {
  date: string;
  prcp: number;
}

function parseGhcnCsv(content: string): DailyReading[] {
  const lines = content.trim().split("\n");
  const readings: DailyReading[] = [];
  for (const line of lines.slice(1)) {
    const [id, date, element, value] = line.split(",");
    if (element !== "PRCP") continue;
    readings.push({ date, prcp: Number(value) });
  }
  return readings;
}

function aggregateToDekads(readings: DailyReading[]): Map<number, number> {
  const dekadal = new Map<number, number>();
  const dekadalDays = new Map<number, number>();

  for (const { date, prcp } of readings) {
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(4, 6));
    const day = Number(date.slice(6, 8));
    const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
    const periodId = year * 1000 + month * 10 + dekad;

    dekadal.set(periodId, (dekadal.get(periodId) ?? 0) + prcp);
    dekadalDays.set(periodId, (dekadalDays.get(periodId) ?? 0) + 1);
  }

  // Only keep dekads with at least 8 days of data (out of 10-11)
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
  const content = await readFile(DATA_FILE, "utf8");
  const readings = parseGhcnCsv(content);
  const dekadal = aggregateToDekads(readings);

  const sorted = [...dekadal.entries()].sort((a, b) => a[0] - b[0]);
  const output: Record<number, number> = {};
  for (const [periodId, rainfallMm] of sorted) {
    output[periodId] = rainfallMm;
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Wrote ${sorted.length} dekadal values to ${OUTPUT_FILE.pathname}`);
  console.log(`Period range: ${sorted[0][0]} to ${sorted.at(-1)![0]}`);
}

main().catch(console.error);
