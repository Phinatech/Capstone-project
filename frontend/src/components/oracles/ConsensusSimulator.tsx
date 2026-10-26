import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangleIcon } from 'lucide-react';
import { FilterSelect } from '../ui/FilterSelect';
import { oracleSources } from '../../data/rainfall';
import { useRainfallSeries } from '../../hooks/useRainfallSeries';
import { useOracleTrust } from '../../hooks/useOracleTrust';
import { aggregate, applyCorruption, SOURCE_IDS, type ReputationTable } from '../../utils/oracle';
import { formatMm } from '../../utils/format';
import type { AggregationMode, CorruptionType, SourceId } from '../../types/insurance';

const ease = [0.23, 1, 0.32, 1] as const;
const modes: {mode: AggregationMode;label: string;}[] = [
{ mode: 'single', label: 'Single' },
{ mode: 'equal', label: 'Equal' },
{ mode: 'reputation', label: 'Reputation' }];


export function ConsensusSimulator() {
  const { dekads } = useRainfallSeries();
  const { sources } = useOracleTrust();
  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState<'none' | SourceId>('nasa');
  const [type, setType] = useState<CorruptionType>('inflated');

  // Only dekads where every source reported can be compared fairly: a source
  // that did not submit has no reading to corrupt or to disagree with.
  const comparable = useMemo(() => dekads.filter((d) => SOURCE_IDS.every((id) => d[id] !== null)), [dekads]);
  const dekad = comparable[Math.min(index, Math.max(0, comparable.length - 1))];

  const repTable = useMemo(() => {
    const table = {} as ReputationTable;
    for (const s of sources) {
      table[s.sourceId] = { score: s.score, weight: s.weight, meanDeviation: s.meanDeviation ?? 0 };
    }
    return table;
  }, [sources]);

  const values = useMemo(() => {
    const clean = {} as Record<SourceId, number>;
    SOURCE_IDS.forEach((id) => {
      const reported = dekad?.[id] ?? 0;
      clean[id] = target === 'none' ? reported : applyCorruption(reported, type);
    });
    return clean;
  }, [dekad, target, type]);

  // There is no gauge feed on-chain, so measure each design against what the
  // three sources actually agreed on before any corruption.
  const cleanMean = dekad ? SOURCE_IDS.reduce((s, id) => s + (dekad[id] ?? 0), 0) / SOURCE_IDS.length : 0;
  const results = modes.map((m) => ({ ...m, ...aggregate(m.mode, values, repTable) }));
  const rep = results.find((r) => r.mode === 'reputation')!;
  const max = Math.max(cleanMean, ...Object.values(values), ...results.map((r) => r.value)) * 1.08 || 1;

  if (comparable.length === 0) {
    return (
      <section aria-labelledby="sim-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-6">
        <h2 id="sim-heading" className="text-base font-semibold">Consensus simulator</h2>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          No dekad yet has readings from all three sources, so there is nothing to compare. Corruption can only be
          simulated where every feed reported on the same dekad.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sim-heading" className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="border-b border-line p-4 sm:p-6">
        <h2 id="sim-heading" className="text-base font-semibold">
          Consensus simulator
        </h2>
        <p className="text-xs text-muted sm:text-sm">Corrupt one real reading and watch how each design's aggregate moves away from what the sources agreed.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <FilterSelect
            label="Dekad"
            value={String(dekad?.period ?? '')}
            onChange={(v) => setIndex(comparable.findIndex((d) => String(d.period) === v))}
            options={comparable.map((d) => ({ value: String(d.period), label: d.label }))} />

          <FilterSelect<'none' | SourceId>
            label="Corrupt source"
            value={target}
            onChange={setTarget}
            options={[{ value: 'none', label: 'No corruption' }, ...oracleSources.map((s) => ({ value: s.id, label: `Corrupt ${s.name}` }))]} />

          <FilterSelect<CorruptionType>
            label="Corruption type"
            value={type}
            onChange={setType}
            options={[
            { value: 'inflated', label: 'Inflated ×2.5' },
            { value: 'understated', label: 'Understated ×0.3' },
            { value: 'outage', label: 'Outage (0 mm)' }]
            } />

        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted">Readings and contract weights</p>
          <ul className="space-y-2.5">
            {oracleSources.map((s) => {
              const corrupted = target === s.id;
              return (
                <li key={s.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="truncate">{s.name}</span>
                      {corrupted && <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Corrupted" />}
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      {formatMm(values[s.id])} · <span className="text-accent-strong">{(rep.weights[s.id] * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: corrupted ? 'var(--danger)' : s.color }}
                      animate={{ width: `${rep.weights[s.id] * 100}%` }}
                      transition={{ duration: 0.25, ease }} />

                  </div>
                </li>);

            })}
          </ul>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted">Aggregate vs the sources' own mean ({formatMm(cleanMean)})</p>
          <ul className="space-y-2.5">
            {results.map((r) => {
              const err = Math.abs(r.value - cleanMean) / Math.max(cleanMean, 1);
              return (
                <li key={r.mode} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className={`truncate ${r.mode === 'reputation' ? 'font-semibold' : ''}`}>{r.label}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {formatMm(r.value)}{' '}
                      <span className={err > 0.15 ? 'text-danger' : 'text-success'}>
                        {err < 0.0005 ? '±0%' : `${r.value >= cleanMean ? '+' : '−'}${(err * 100).toFixed(0)}%`}
                      </span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-canvas">
                    <motion.div
                      className={`h-full rounded-full ${r.mode === 'reputation' ? 'bg-accent' : 'bg-muted'}`}
                      animate={{ width: `${r.value / max * 100}%` }}
                      transition={{ duration: 0.25, ease }} />

                    <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink" style={{ left: `${cleanMean / max * 100}%` }} aria-hidden />
                  </div>
                </li>);

            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">The dark tick marks the uncorrupted mean of the three sources for this dekad.</p>
        </div>
      </div>
    </section>);

}
