import { useState } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import { motion } from 'framer-motion';
import { ChevronRightIcon, ExternalLinkIcon } from 'lucide-react';
import { ScoreRing } from './ScoreRing';
import { Modal } from '../ui/Modal';
import { oracleSources } from '../../data/rainfall';
import { oracleMeta } from '../../data/oracleMeta';
import { useOracleTrust } from '../../hooks/useOracleTrust';
import { useRainfallSeries } from '../../hooks/useRainfallSeries';
import { deviationsFrom } from '../../utils/oracle';
import { formatPct } from '../../utils/format';
import type { OracleSource } from '../../types/insurance';

const ease = [0.23, 1, 0.32, 1] as const;

function Sparkline({ values, color, label }: {values: (number | null)[];color: string;label: string;}) {
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is {i: number;v: number;} => p.v !== null);
  const max = Math.max(0.25, ...pts.map((p) => p.v));
  const w = 120;
  const h = 28;
  const x = (i: number) => i / (values.length - 1) * w;
  const y = (v: number) => h - v / max * (h - 4) - 2;
  const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>);

}

export function SourceRegistry() {
  const { t } = useI18n();
  const [selected, setSelected] = useState<OracleSource | null>(null);
  const { sources } = useOracleTrust();
  const { dekads } = useRainfallSeries();
  const devs = deviationsFrom(dekads);
  const byId = new Map(sources.map((s) => [s.sourceId, s]));
  const ranked = [...oracleSources].sort((a, b) => (byId.get(b.id)?.score ?? 0) - (byId.get(a.id)?.score ?? 0));
  const selectedTrust = selected ? byId.get(selected.id) : undefined;

  return (
    <section aria-labelledby="registry-heading" className="min-w-0">
      <div className="mb-2.5 flex items-end justify-between gap-3 sm:mb-3">
        <div className="min-w-0">
          <h2 id="registry-heading" className="text-base font-semibold">
            {t('registry.title')}
          </h2>
          <p className="truncate text-xs text-muted sm:text-sm">{t('registry.hint')}</p>
        </div>
      </div>

      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
        <li className="hidden grid-cols-[minmax(0,2.2fr)_4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_1rem] items-center gap-4 border-b border-line px-5 py-2.5 text-xs text-muted lg:grid">
          <span>{t('registry.source')}</span>
          <span>{t('registry.score')}</span>
          <span className="text-right">{t('registry.baseWeight')}</span>
          <span className="text-right">{t('registry.meanDeviation')}</span>
          <span className="text-right">{t('registry.reported')}</span>
          <span>{t('registry.deviationTrend')}</span>
          <span />
        </li>
        {ranked.map((s, i) => {
          const rep = byId.get(s.id);
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
                    <ScoreRing value={(rep?.score ?? 0) * 100} color={s.color} size={44} />
                  </span>
                  <span className="hidden h-8 w-1 shrink-0 rounded-full lg:block" style={{ background: s.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{s.name}</span>
                      {i === 0 && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-px text-[10px] font-medium text-accent-strong">{t('registry.top')}</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{t(`source.${s.id}.kind`)}</span>
                  </span>
                </span>

                {/* Mobile / tablet summary */}
                <span className="grid w-[9.5rem] grid-cols-3 gap-2 text-right sm:w-56 lg:hidden">
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">{t('registry.weight')}</span>
                    <span className="block truncate font-mono text-xs">{formatPct(rep?.weight ?? 0)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">{t('registry.dev')}</span>
                    <span className="block truncate font-mono text-xs">{rep?.meanDeviation == null ? '—' : formatPct(rep.meanDeviation)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] text-muted">{t('registry.reported')}</span>
                    <span className="block truncate font-mono text-xs">{rep?.dekadsReported ?? 0}/{rep?.dekadsTotal ?? 0}</span>
                  </span>
                </span>

                <span className="hidden lg:block">
                  <ScoreRing value={(rep?.score ?? 0) * 100} color={s.color} size={40} />
                </span>
                <span className="hidden text-right font-mono text-sm lg:block">{formatPct(rep?.weight ?? 0)}</span>
                <span className="hidden text-right font-mono text-sm lg:block">{rep?.meanDeviation == null ? '—' : formatPct(rep.meanDeviation)}</span>
                <span className="hidden text-right font-mono text-sm lg:block">{rep?.dekadsReported ?? 0} / {rep?.dekadsTotal ?? 0}</span>
                <span className="hidden min-w-0 lg:block">
                  <Sparkline values={devs[s.id]} color={s.color} label={t('registry.deviationSeason')} />
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
        icon={selected ? <ScoreRing value={(selectedTrust?.score ?? 0) * 100} color={selected.color} size={44} /> : undefined}
        title={selected?.name}
        description={selected ? oracleMeta[selected.id].provider : undefined}>
        
        {selected &&
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
            { label: t('registry.reputation'), value: `${((selectedTrust?.score ?? 0) * 100).toFixed(1)}` },
            { label: t('registry.contractWeight'), value: formatPct(selectedTrust?.weight ?? 0) },
            { label: t('registry.dekadsReported'), value: `${selectedTrust?.dekadsReported ?? 0} / ${selectedTrust?.dekadsTotal ?? 0}` }].
            map((m) =>
            <div key={m.label} className="min-w-0 bg-surface px-3 py-2.5">
                  <p className="truncate text-[11px] text-muted">{m.label}</p>
                  <p className="mt-0.5 truncate font-mono text-sm font-semibold">{m.value}</p>
                </div>
            )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">{t('registry.deviationSeason')}</p>
              <div className="rounded-md border border-line px-3 py-2">
                <Sparkline values={devs[selected.id]} color={selected.color} label={t('registry.deviationSeason')} />
              </div>
            </div>
            <dl className="divide-y divide-line rounded-lg border border-line text-sm">
              {[
            [t('registry.product'), oracleMeta[selected.id].product],
            [t('registry.method'), t(`source.${selected.id}.method`)],
            [t('registry.resolution'), t(`source.${selected.id}.resolution`)],
            [t('registry.cadence'), t(`source.${selected.id}.cadence`)],
            [t('registry.meanDeviation'), selectedTrust?.meanDeviation == null ? '—' : formatPct(selectedTrust.meanDeviation)],
            [t('registry.registered'), selectedTrust?.registered ? t('registry.yes') : t('registry.noDeactivated')],
            [t('registry.licence'), t(`source.${selected.id}.licence`)]].
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