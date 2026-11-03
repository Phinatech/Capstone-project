import { motion } from 'framer-motion';
import { useI18n } from '../../contexts/I18nContext';
import { formatEth, formatPct } from '../../utils/format';
import type { PortfolioStats } from '../../utils/analytics';

const ease = [0.23, 1, 0.32, 1] as const;

export function KpiStrip({ stats, pool }: {stats: PortfolioStats;pool: number;}) {
  const { t } = useI18n();
  const secondary = [
  { label: t('kpi.premiums'), value: formatEth(stats.premiums) },
  { label: t('kpi.payouts'), value: formatEth(stats.payouts), tone: 'text-clay' },
  { label: t('kpi.exposure'), value: formatEth(stats.exposure) },
  { label: t('kpi.farmers'), value: String(stats.farmersCovered) }];

  return (
    <section aria-label={t('kpi.portfolio')} className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
      <div className="min-w-0 bg-surface p-4 sm:p-5">
        <p className="text-xs text-muted">{t('kpi.pool')}</p>
        <p className="mt-1 truncate font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{formatEth(pool)}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(stats.lossRatio, 1) * 100}%` }}
              transition={{ duration: 0.3, ease }} />
            
          </div>
          <span className="shrink-0 font-mono text-xs">{formatPct(stats.lossRatio)}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">{t('kpi.lossRatio')}</p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-line">
        {secondary.map((s) =>
        <div key={s.label} className="min-w-0 bg-surface px-4 py-3 sm:px-5 sm:py-4">
            <dt className="truncate text-[11px] text-muted sm:text-xs">{s.label}</dt>
            <dd className={`mt-0.5 truncate font-mono text-sm font-medium sm:text-base ${s.tone ?? ''}`}>{s.value}</dd>
          </div>
        )}
      </dl>
    </section>);

}