import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangleIcon } from 'lucide-react';
import { FilterSelect } from '../ui/FilterSelect';
import { coverageWindows } from '../../data/policies';
import { oracleSources } from '../../data/rainfall';
import { aggregate, getWindow, readSources, windowTotal } from '../../utils/oracle';
import { formatMm } from '../../utils/format';
import type { AggregationMode, CorruptionType, SourceId } from '../../types/insurance';

const ease = [0.23, 1, 0.32, 1] as const;
const modes: {mode: AggregationMode;label: string;}[] = [
{ mode: 'single', label: 'Single' },
{ mode: 'equal', label: 'Equal' },
{ mode: 'reputation', label: 'Reputation' }];


export function ConsensusSimulator() {
  const [windowId, setWindowId] = useState('julaug');
  const [target, setTarget] = useState<'none' | SourceId>('nasa');
  const [type, setType] = useState<CorruptionType>('inflated');

  const w = getWindow(windowId);
  const gauge = windowTotal('reference', w.start, w.end);
  const values = useMemo(() => readSources(windowId, target === 'none' ? null : { sourceId: target, type }), [windowId, target, type]);
  const results = modes.map((m) => ({ ...m, ...aggregate(m.mode, values) }));
  const rep = results.find((r) => r.mode === 'reputation')!;
  const max = Math.max(gauge, ...Object.values(values), ...results.map((r) => r.value)) * 1.08 || 1;

  return (
    <section aria-labelledby="sim-heading" className="min-w-0 rounded-lg border border-line bg-surface">
      <div className="border-b border-line p-4 sm:p-6">
        <h2 id="sim-heading" className="text-base font-semibold">
          Consensus simulator
        </h2>
        <p className="text-xs text-muted sm:text-sm">Corrupt one feed and see how each design's aggregate moves away from the gauge.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <FilterSelect
            label="Coverage window"
            value={windowId}
            onChange={setWindowId}
            options={coverageWindows.map((c) => ({ value: c.id, label: c.label }))} />
          
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
          <p className="mb-2 text-xs font-medium text-muted">Readings and reputation weights</p>
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
          <p className="mb-2 text-xs font-medium text-muted">Aggregate vs gauge ({formatMm(gauge)})</p>
          <ul className="space-y-2.5">
            {results.map((r) => {
              const err = Math.abs(r.value - gauge) / Math.max(gauge, 1);
              return (
                <li key={r.mode} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className={`truncate ${r.mode === 'reputation' ? 'font-semibold' : ''}`}>{r.label}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {formatMm(r.value)}{' '}
                      <span className={err > 0.15 ? 'text-danger' : 'text-success'}>
                        {err < 0.0005 ? '±0%' : `${r.value >= gauge ? '+' : '−'}${(err * 100).toFixed(0)}%`}
                      </span>
                    </span>
                  </div>
                  <div className="relative mt-1 h-1.5 rounded-full bg-canvas">
                    <motion.div
                      className={`h-full rounded-full ${r.mode === 'reputation' ? 'bg-accent' : 'bg-muted'}`}
                      animate={{ width: `${r.value / max * 100}%` }}
                      transition={{ duration: 0.25, ease }} />
                    
                    <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink" style={{ left: `${gauge / max * 100}%` }} aria-hidden />
                  </div>
                </li>);

            })}
          </ul>
          <p className="mt-3 text-[11px] text-muted">The dark tick marks the gauge total used to check decisions.</p>
        </div>
      </div>
    </section>);

}