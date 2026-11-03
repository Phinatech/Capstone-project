import { Link } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';
import { DatabaseIcon, FlaskConicalIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { RainfallChart } from '../../components/RainfallChart';
import { useRainfallSeries } from '../../hooks/useRainfallSeries';
import { TrustOverview } from '../../components/oracles/TrustOverview';
import { SourceRegistry } from '../../components/oracles/SourceRegistry';
import { AgreementHeatmap } from '../../components/oracles/AgreementHeatmap';
import { ReputationTrendChart } from '../../components/oracles/ReputationTrendChart';
import { ConsensusSimulator } from '../../components/oracles/ConsensusSimulator';
import { btnSecondary } from '../../components/ui/buttons';

export function Oracles() {
  const { t } = useI18n();
  const { live } = useRainfallSeries();
  return (
    <div>
      <PageHeader
        title={t('nav.oracles')}
        description={t('oracles.description')}
        actions={
        <>
            <Link to="/admin/data-model" className={`${btnSecondary} h-9 px-3 sm:h-10 sm:px-4`}>
              <DatabaseIcon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('nav.dataModel')}</span>
            </Link>
            <Link to="/admin/backtest" className={`${btnSecondary} h-9 px-3 sm:h-10 sm:px-4`}>
              <FlaskConicalIcon className="h-4 w-4" aria-hidden />
              {t('nav.backtest')}
            </Link>
          </>
        } />
      

      <div className="space-y-4 sm:space-y-6">
        <TrustOverview />
        <SourceRegistry />
        <AgreementHeatmap />

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section aria-labelledby="rainfall-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="rainfall-heading" className="text-base font-semibold">
              {live ? t('oracles.rainfallLive') : t('oracles.rainfallSim')}
            </h2>
            <p className="text-xs text-muted sm:text-sm">
              {live ?
              t('oracles.rainfallLiveHint') :
              t('oracles.rainfallSimHint')}
            </p>
            <div className="mt-3 sm:mt-4">
              <RainfallChart />
            </div>
          </section>
          <section aria-labelledby="trend-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="trend-heading" className="text-base font-semibold">
              {t('oracles.trend')}
            </h2>
            <p className="text-xs text-muted sm:text-sm">{t('oracles.trendHint')}</p>
            <div className="mt-3 sm:mt-4">
              <ReputationTrendChart />
            </div>
          </section>
        </div>

        <ConsensusSimulator />
      </div>
    </div>);

}