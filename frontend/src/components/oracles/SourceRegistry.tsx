import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { ScoreRing } from './ScoreRing';
import { Modal } from '../ui/Modal';
import { oracleSources } from '../../data/rainfall';
import { oracleMeta } from '../../data/oracleMeta';
import { dekadDeviations, reputation } from '../../utils/oracle';
import { formatPct } from '../../utils/format';
import type { OracleSource } from '../../types/insurance';

const ease = [0.23, 1, 0.32, 1] as const;

function Sparkline({ values, color }: {values: (number | null)[];color: string;}) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is {i: number;v: number;} => p.v !== null);
  const max = Math.max(0.25, ...pts.map((p) => p.v));
  const w = 120;
  const h = 28;
  const x = (i: number) => i / (values.length - 1) * w;
  const y = (v: number) => h - v / max * (h - 4) - 2;
  const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none" role="img" aria-label="Deviation from peers across the season">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>);

}

export function SourceRegistry() {
  const [selected, setSelected] = useState<OracleSource | null>(null);
  const devs = dekadDeviations();
  const ranked = [...oracleSources].sort((a, b) => reputation[b.id].score - reputation[a.id].score);

  return (
    <section aria-labelledby="registry-heading" className="min-w-0">
      <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
        <div className="min-w-0">
          <h2 id="registry-heading" className="text-base font-semibold">
            Source registry
          </h2>
          <p className="truncate text-xs text-muted sm:text-sm">Ranked by reputation · select a source for its full profile</p>
        </div>
      </div>

      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        <li className="hidden grid-cols-[minmax(0,2.2fr)_4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_1rem] items-center gap-4 border-b border-line px-5 py-2.5 text-xs text-muted lg:grid">
          <span>Source</span>
          <span>Score</span>
          <span className="text-right">Base weight</span>
          <span className="text-right">Mean deviation</span>
          <span className="text-right">Response</span>
          <span>Deviation, Jun → Oct</span>
          <span />
        </li>
        {ranked.map((s, i) => {
          const rep = reputation[s.id];
          const meta = oracleMeta[s.id];
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04, ease }}
              className="border-b border-line last:border-0">
              
              <button
                type="button"
                onClick={() => setSelected(s)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:bg-canvas sm:px-5 lg:grid-cols-[minmax(0,2.2fr)_4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_1rem] lg:gap-4 lg:py-3.5">
                
                <span className="flex min-w-0 items-center gap-3 lg:col-auto">
                  <span className="lg:hidden">
                    <ScoreRing value={rep.score * 100} color={s.color} size={44} />
                  </span>
                  <span className="hidden h-8 w-1 shrink-0 rounded-full lg:block" style={{ background: s.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{s.name}</span>
                      {i === 0 && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent-strong">Top</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{s.kind}</span>
                  </span>
                </span>

                {/* Mobile / tablet summary */}
                <span className="grid w-[9.5rem] grid-cols-3 gap-2 text-right sm:w-56 lg:hidden">
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">Weight</span>
                    <span className="block truncate font-mono text-xs">{formatPct(rep.weight)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">Dev.</span>
                    <span className="block truncate font-mono text-xs">{formatPct(rep.meanDeviation)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">Resp.</span>
                    <span className="block truncate font-mono text-xs">{meta.responseSec.toFixed(1)}s</span>
                  </span>
                </span>

                <span className="hidden lg:block">
                  <ScoreRing value={rep.score * 100} color={s.color} size={40} />
                </span>
                <span className="hidden text-right font-mono text-sm lg:block">{formatPct(rep.weight)}</span>
                <span className="hidden text-right font-mono text-sm lg:block">{formatPct(rep.meanDeviation)}</span>
                <span className="hidden text-right font-mono text-sm lg:block">{meta.responseSec.toFixed(1)} s</span>
                <span className="hidden min-w-0 lg:block">
                  <Sparkline values={devs[s.id]} color={s.color} />
                </span>
                <ChevronRightIcon className="h-4 w-4 text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden />
              </button>
            </motion.li>);

        })}
      </ul>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="md"
        icon={selected ? <ScoreRing value={reputation[selected.id].score * 100} color={selected.color} size={44} /> : undefined}
        title={selected?.name}
        description={selected ? oracleMeta[selected.id].provider : undefined}>
        
        {selected &&
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
            { label: 'Reputation', value: `${(reputation[selected.id].score * 100).toFixed(1)}` },
            { label: 'Base weight', value: formatPct(reputation[selected.id].weight) },
            { label: 'Uptime', value: formatPct(oracleMeta[selected.id].uptime) }].
            map((m) =>
            <div key={m.label} className="min-w-0 bg-surface px-3 py-2.5">
                  <p className="truncate text-[11px] text-muted">{m.label}</p>
                  <p className="mt-0.5 truncate font-mono text-sm font-semibold">{m.value}</p>
                </div>
            )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Deviation from peers across the season</p>
              <div className="rounded-md border border-line px-3 py-2">
                <Sparkline values={devs[selected.id]} color={selected.color} />
              </div>
            </div>
            <dl className="divide-y divide-line rounded-lg border border-line text-sm">
              {[
            ['Product', oracleMeta[selected.id].product],
            ['Method', oracleMeta[selected.id].method],
            ['Resolution', oracleMeta[selected.id].resolution],
            ['Update cadence', oracleMeta[selected.id].cadence],
            ['Mean deviation', formatPct(reputation[selected.id].meanDeviation)],
            ['Response time', `${oracleMeta[selected.id].responseSec.toFixed(1)} s (modelled)`],
            ['Licence', oracleMeta[selected.id].licence]].
            map(([k, v]) =>
            <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 px-3 py-2.5">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="min-w-0 break-words text-[13px]">{v}</dd>
                </div>
            )}
            </dl>
            <a
            href={`https://${oracleMeta[selected.id].endpoint}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 rounded-md bg-canvas px-3 py-2 font-mono text-xs text-accent hover:underline">
            
              <span className="truncate">{oracleMeta[selected.id].endpoint}</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        }
      </Modal>
    </section>);

}