import { useEffect, useState } from 'react';
import { SOURCE_BY_LABEL } from '../chain/config';
import { oracleSources } from '../data/rainfall';
import { usePolicies } from '../contexts/PolicyContext';
import { useRainfallSeries } from './useRainfallSeries';
import { deviationsFrom } from '../utils/oracle';
import type { SourceId } from '../types/insurance';

const API_URL = '';

/** Reputation scale used by the app's score: a 10% mean deviation scores 50. */
const REPUTATION_SCALE = 0.1;

interface OracleRow {
  address: string;
  label: string;
  registered: boolean;
  reputationWeight: number;
}

/** Trust for one rainfall source, measured rather than assumed. */
export interface SourceTrust {
  sourceId: SourceId;
  name: string;
  /** Reputation weight the contract holds for this source, as a share of the total. */
  weight: number;
  /** Score derived from how far this source sat from its peers, 0–1. */
  score: number;
  /** Mean relative deviation from the peer mean. Null when it never reported alongside both peers. */
  meanDeviation: number | null;
  /** Dekads this source submitted, out of those any source submitted. */
  dekadsReported: number;
  dekadsTotal: number;
  /** False once the contract has deactivated every address for this source. */
  registered: boolean;
}

function scoreFrom(meanDeviation: number | null): number {
  if (meanDeviation === null) return 0;
  return Math.round(1 / (1 + meanDeviation / REPUTATION_SCALE) * 1000) / 1000;
}

/**
 * Per-source trust from the contract and the readings it has accepted: the
 * reputation weights actually registered on-chain, how far each source sat
 * from its peers, and how many dekads it has submitted. The prototype used
 * to assume these from a hardcoded 2023 season.
 */
export function useOracleTrust(): {sources: SourceTrust[];loading: boolean;} {
  const { source } = usePolicies();
  const { dekads } = useRainfallSeries();
  const [oracles, setOracles] = useState<OracleRow[]>([]);

  useEffect(() => {
    if (source.kind !== 'chain') return;
    let cancelled = false;
    fetch(`${API_URL}/api/oracles`).
    then((r) => r.ok ? r.json() : Promise.reject(new Error('no oracles'))).
    then(({ oracles: rows }: { oracles: OracleRow[] }) => {
      if (!cancelled) setOracles(rows);
    }).
    catch(() => {
      /* leave the weights at zero rather than inventing any */
    });
    return () => {
      cancelled = true;
    };
  }, [source.kind]);

  // A source has several addresses over its life; the registered one holds the
  // live weight. A source with no registered address has been deactivated.
  const live = new Map<SourceId, OracleRow>();
  for (const o of oracles) {
    const id = SOURCE_BY_LABEL[o.label];
    if (id && o.registered) live.set(id, o);
  }
  const totalWeight = [...live.values()].reduce((sum, o) => sum + o.reputationWeight, 0);

  const devs = deviationsFrom(dekads);
  const dekadsTotal = dekads.length;

  const rows: SourceTrust[] = oracleSources.map((s) => {
    const dekadsReported = dekads.filter((d) => d[s.id] !== null).length;
    const deviations = devs[s.id].filter((d): d is number => d !== null);
    const meanDeviation = deviations.length ? deviations.reduce((a, b) => a + b, 0) / deviations.length : null;
    return {
      sourceId: s.id,
      name: s.name,
      weight: 0,
      score: scoreFrom(meanDeviation),
      meanDeviation,
      dekadsReported,
      dekadsTotal,
      registered: true
    };
  });

  if (source.kind === 'chain') {
    // On-chain the registration decides: weight and liveness both come from
    // the contract, and a deactivated source keeps its history but no weight.
    for (const r of rows) {
      r.registered = live.has(r.sourceId);
      r.weight = r.registered && totalWeight > 0 ? live.get(r.sourceId)!.reputationWeight / totalWeight : 0;
    }
  } else {
    // Simulated mode has no registration to read. Weight each source by its
    // measured score — the same split `reputation` derives from the season
    // table — instead of showing every weight as zero.
    const totalScore = rows.reduce((sum, r) => sum + r.score, 0);
    for (const r of rows) {
      r.weight = totalScore > 0 ? r.score / totalScore : 0;
    }
  }

  return { sources: rows, loading: oracles.length === 0 && source.kind === 'chain' };
}
