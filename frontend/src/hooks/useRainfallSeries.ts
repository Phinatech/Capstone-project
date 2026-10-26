import { useEffect, useState } from 'react';
import { SOURCE_BY_LABEL } from '../chain/config';
import { usePolicies } from '../contexts/PolicyContext';
import { dekadalRainfall } from '../data/rainfall';
import type { RainfallSeriesRow } from '../utils/oracle';
import type { SourceId } from '../types/insurance';

const API_URL = import.meta.env.VITE_API_URL?.trim() || '';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A period id is YYYYMMD: 2026092 is 2026, September, second dekad. */
function dekadLabel(period: number): string {
  const month = Math.floor(period / 10) % 100;
  return `${MONTHS[month - 1] ?? month} D${period % 10}`;
}

interface ReadingRow {
  period: number;
  oracle: string;
  rainfallMm: number;
}

interface OracleRow {
  address: string;
  label: string;
}

/** One dekad of rainfall, plus which period it came from. */
export interface RainfallDekad extends RainfallSeriesRow {
  period: number;
  /** The gauge record. Simulated data only — the contracts have no gauge feed. */
  reference?: number;
}

async function fetchSubmitted(): Promise<RainfallDekad[]> {
  const [readingsRes, oraclesRes] = await Promise.all([
    fetch(`${API_URL}/api/readings`),
    fetch(`${API_URL}/api/oracles`)
  ]);
  if (!readingsRes.ok || !oraclesRes.ok) throw new Error('rainfall feeds unavailable');
  const { readings } = await readingsRes.json() as { readings: ReadingRow[] };
  const { oracles } = await oraclesRes.json() as { oracles: OracleRow[] };

  // ReadingSubmitted carries an address; map it back to the app's source id.
  const sourceByAddress = new Map<string, SourceId>();
  for (const o of oracles) {
    const id = SOURCE_BY_LABEL[o.label];
    if (id) sourceByAddress.set(o.address.toLowerCase(), id);
  }

  const byPeriod = new Map<number, Partial<Record<SourceId, number>>>();
  for (const r of readings) {
    const id = sourceByAddress.get(r.oracle.toLowerCase());
    if (!id) continue;
    // The contract stores mm * 100.
    byPeriod.set(r.period, { ...byPeriod.get(r.period), [id]: r.rainfallMm / 100 });
  }

  return [...byPeriod.entries()].
  sort(([a], [b]) => a - b).
  map(([period, submitted]) => ({
    period,
    label: dekadLabel(period),
    chirps: submitted.chirps ?? null,
    nasa: submitted.nasa ?? null,
    meteostat: submitted.meteostat ?? null
  }));
}

/**
 * Dekadal rainfall for the charts. Against the deployed contracts this is what
 * the oracles actually submitted, oldest dekad first; in simulated mode it is
 * the prototype's season table. A source is null for a dekad it never reported.
 */
export function useRainfallSeries(): {dekads: RainfallDekad[];live: boolean;} {
  const { source } = usePolicies();
  const live = source.kind === 'chain';
  const [dekads, setDekads] = useState<RainfallDekad[]>(() =>
    dekadalRainfall.map((row) => ({ ...row, period: 0 }))
  );

  useEffect(() => {
    if (!live) {
      setDekads(dekadalRainfall.map((row) => ({ ...row, period: 0 })));
      return;
    }
    let cancelled = false;
    fetchSubmitted().
    then((rows) => {
      if (!cancelled) setDekads(rows);
    }).
    catch(() => {
      // Keep whatever is on screen rather than blanking the chart.
    });
    return () => {
      cancelled = true;
    };
  }, [live]);

  return { dekads, live };
}
