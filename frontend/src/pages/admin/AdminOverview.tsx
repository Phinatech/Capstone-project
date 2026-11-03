import { Link } from 'react-router-dom';
import { ArrowRightIcon, BarChart3Icon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { ActivityList } from '../../components/ActivityList';
import { KpiStrip } from '../../components/analytics/KpiStrip';
import { btnSecondary } from '../../components/ui/buttons';
import { usePolicies } from '../../contexts/PolicyContext';
import { oracleSources } from '../../data/rainfall';
import { buildActivity } from '../../utils/activity';
import { portfolioStats } from '../../utils/analytics';
import { useI18n } from '../../contexts/I18nContext';
import { useWindowName } from '../../contexts/PolicyContext';
import { cropName } from '../../contexts/policyActivity';
import { useOracleTrust } from '../../hooks/useOracleTrust';
import { findUser, getFarmers } from '../../utils/users';
import { formatEth } from '../../utils/format';

export function AdminOverview() {
  const { policies, poolEth: pool } = usePolicies();
  const { sources: oracleTrust } = useOracleTrust();
  const { t } = useI18n();
  const windowName = useWindowName();
  const byId = new Map(oracleTrust.map((s) => [s.sourceId, s]));
  const stats = portfolioStats(policies);
  const active = policies.filter((p) => p.status === 'active');

  return (
    <div>
      <PageHeader
        title={t('nav.overview')}
        description={t('adminOverview.description', { farmers: getFarmers().length, policies: policies.length })}
        actions={
        <Link to="/admin/analytics" className={`${btnSecondary} h-9 px-3 sm:h-10 sm:px-4`}>
            <BarChart3Icon className="h-4 w-4" aria-hidden />
            {t('nav.analytics')}
          </Link>
        } />
      

      <div className="space-y-3 sm:space-y-6">
        <KpiStrip stats={stats} pool={pool} />

        <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
          <section aria-labelledby="queue-heading" className="min-w-0 rounded-lg border border-line bg-surface lg:col-span-2">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 id="queue-heading" className="text-sm font-semibold sm:text-base">
                  {t('adminOverview.awaiting')}
                </h2>
                <p className="truncate text-xs text-muted">{t('adminOverview.awaitingHint')}</p>
              </div>
              <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-xs font-medium text-accent-strong">{active.length}</span>
            </div>
            {active.length === 0 ?
            <p className="px-5 py-10 text-center text-sm text-muted">{t('adminOverview.allSettled')}</p> :

            <ul className="scroll-area max-h-[340px] divide-y divide-line overflow-y-auto">
                {active.map((p) => {
                const farmer = findUser(p.farmerId);
                return (
                  <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5 sm:py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          <span className="mr-2 font-mono text-xs font-normal text-muted">#{p.id}</span>
                          {farmer?.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {p.lga} {cropName(p.crop, t)} · {windowName(p.windowId)} · &lt; {p.thresholdMm} mm
                        </p>
                      </div>
                      <span className="hidden font-mono text-sm sm:block">{formatEth(p.payoutEth)}</span>
                      <Link
                      to={`/admin/policies/${p.id}`}
                      className="whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out hover:border-accent hover:text-accent-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      
                        {t('adminOverview.evaluate')}
                      </Link>
                    </li>);

              })}
              </ul>
            }
          </section>

          <section aria-labelledby="oracle-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 id="oracle-heading" className="text-sm font-semibold sm:text-base">
                {t('adminOverview.reputation')}
              </h2>
              <Link to="/admin/oracles" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline">
                {t('adminOverview.sources')}
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <p className="text-xs text-muted">{t('adminOverview.reputationHint')}</p>
            <ul className="mt-4 space-y-3">
              {oracleSources.map((s) =>
              <li key={s.id}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="font-mono">{((byId.get(s.id)?.score ?? 0) * 100).toFixed(0)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full" style={{ width: `${(byId.get(s.id)?.score ?? 0) * 100}%`, background: s.color }} />
                  </div>
                </li>
              )}
            </ul>
          </section>

          <section aria-labelledby="activity-heading" className="min-w-0 rounded-lg border border-line bg-surface px-4 pt-3 sm:px-5 sm:pt-5 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="activity-heading" className="text-sm font-semibold sm:text-base">
                {t('farmerDash.recentActivity')}
              </h2>
              <Link to="/admin/policies" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline sm:text-sm">
                {t('farmerDash.allPolicies')}
                <ArrowRightIcon className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="pb-1">
              <ActivityList items={buildActivity(policies, 6)} basePath="/admin/policies" showFarmer />
            </div>
          </section>
        </div>
      </div>
    </div>);

}