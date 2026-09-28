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

/**
 * Dekad period id as YYYYMMD: year * 1000 + month (1-12) * 10 + dekad (1-3),
 * e.g. 2026111 for 1-10 Nov 2026. Dekads follow the standard agro-met split:
 * days 1-10, 11-20, and 21 to month end (8-11 days). Computed in UTC.
 */
export function currentPeriod(now: Date = new Date()): number {
  const day = now.getUTCDate();
  const dekad = day <= 10 ? 1 : day <= 20 ? 2 : 3;
  return now.getUTCFullYear() * 1000 + (now.getUTCMonth() + 1) * 10 + dekad;
}
