/**
 * Oracle relayer stub.
 *
 * Eventually: fetch rainfall for the current period from CHIRPS /
 * NASA POWER / Meteostat and call OracleAggregator.submitReading on each
 * registered source's behalf. For now this just proves the wiring and
 * logs what it *would* do.
 */
import type { SourceConfig } from "./config.js";

export interface RainfallReading {
  source: string;
  period: number;
  rainfallMm: number; // scaled by 100 for 2dp precision, per OracleAggregator
}

export async function fetchRainfall(
  source: SourceConfig,
  period: number,
): Promise<RainfallReading | null> {
  // TODO: real provider calls (CHIRPS / NASA POWER / Meteostat).
  console.log(`[relayer] would fetch rainfall for ${source.label}, period ${period}`);
  return null;
}

export async function submitReading(reading: RainfallReading): Promise<void> {
  // TODO: connect a signer for `reading.source` and call
  // OracleAggregator.submitReading(period, rainfallMm). See
  // docs/security-audit.md M-5: plausibility-check the value client-side
  // before submitting.
  console.log(
    `[relayer] would submit reading: source=${reading.source} period=${reading.period} rainfallMm=${reading.rainfallMm}`,
  );
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

/** Dekad-style period id: (year, month 1-12, dekad 1-3). */
export function currentPeriod(): number {
  const now = new Date();
  const dekad = Math.min(3, Math.floor(now.getUTCDate() / 10) + 1);
  return now.getUTCFullYear() * 1000 + now.getUTCMonth() * 100 + dekad * 10;
}
