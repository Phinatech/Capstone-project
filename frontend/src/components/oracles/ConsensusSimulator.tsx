import { useMemo, useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import type { TranslationKey } from '../../data/translations';
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
const modes: {mode: AggregationMode;label: TranslationKey;}[] = [
{ mode: 'single', label: 'mode.single.short' },
{ mode: 'equal', label: 'mode.equal.short' },
{ mode: 'reputation', label: 'mode.reputation.short' }];


export function ConsensusSimulator() {
  const { t } = useI18n();
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
      // Corrupt exactly the selected source — the point of the panel is how the
      // aggregates react to one bad reading, not three at once.
      clean[id] = id === target ? applyCorruption(reported, type) : reported;
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
        <h2 id="sim-heading" className="text-base font-semibold">{t('sim.title')}</h2>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          {t('sim.empty')}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sim-heading" className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="border-b border-line p-4 sm:p-6">
        <h2 id="sim-heading" className="text-base font-semibold">
          {t('sim.title')}
        </h2>
        <p className="text-xs text-muted sm:text-sm">{t('sim.hint')}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <FilterSelect
            label={t('sim.dekad')}
            value={String(dekad?.period ?? '')}
            onChange={(v) => setIndex(comparable.findIndex((d) => String(d.period) === v))}
            options={comparable.map((d) => ({ value: String(d.period), label: d.label }))} />

          <FilterSelect<'none' | SourceId>
            label={t('sim.corruptSource')}
            value={target}
            onChange={setTarget}
            options={[{ value: 'none', label: t('sim.noCorruption') }, ...oracleSources.map((s) => ({ value: s.id, label: t('sim.corrupt', { name: s.name }) }))]} />

          <FilterSelect<CorruptionType>
            label={t('sim.type')}
            value={type}
            onChange={setType}
            options={[
            { value: 'inflated', label: t('sim.inflated') },
            { value: 'understated', label: t('sim.understated') },
            { value: 'outage', label: t('sim.outage') }]
            } />

        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium text-muted">{t('sim.readings')}</p>
          <ul className="space-y-2.5">
            {oracleSources.map((s) => {
              const corrupted = target === s.id;
              return (
                <li key={s.id} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="truncate">{s.name}</span>
                      {corrupted && <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-danger" aria-label={t('result.corrupted')} />}
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
          <p className="mb-2 text-xs font-medium text-muted">{t('sim.aggregate', { mean: formatMm(cleanMean) })}</p>
          <ul className="space-y-2.5">
            {results.map((r) => {
              const err = Math.abs(r.value - cleanMean) / Math.max(cleanMean, 1);
              return (
                <li key={r.mode} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className={`truncate ${r.mode === 'reputation' ? 'font-semibold' : ''}`}>{t(r.label)}</span>
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
          <p className="mt-3 text-[11px] text-muted">{t('sim.tick')}</p>
        </div>
      </div>
    </section>);

}
