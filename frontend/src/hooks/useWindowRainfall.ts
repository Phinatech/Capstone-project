import { useMemo } from 'react';
import { useRainfallSeries } from './useRainfallSeries';
import { useOracleTrust } from './useOracleTrust';
import { windowRainfallMm, type ReputationTable } from '../utils/oracle';

/**
 * Rainfall a coverage window insures, aggregated the way the deployed
 * aggregator will settle it: each dekad is reputation-weighted across the
 * sources that reported, and the window sums its dekads. Window 19 comes to
 * 78.35 mm, matching the contract.
 *
 * Returns null while any dekad in the window has no reading, so a caller can
 * show nothing rather than a partial total. Weights come from the contract, so
 * in simulated mode there are none and every window stays null.
 */
export function useWindowRainfall(): (periods: number[]) => number | null {
  const { dekads } = useRainfallSeries();
  const { sources } = useOracleTrust();

  const rep = useMemo(() => {
    const table = {} as ReputationTable;
    for (const s of sources) {
      table[s.sourceId] = { score: s.score, weight: s.weight, meanDeviation: s.meanDeviation ?? 0 };
    }
    return table;
  }, [sources]);

  return useMemo(() => (periods: number[]) => windowRainfallMm(periods, dekads, rep), [dekads, rep]);
}
