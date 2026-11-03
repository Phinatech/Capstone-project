import { PageHeader } from '../../components/PageHeader';
import { AgentPurchaseForm } from '../../components/AgentPurchaseForm';
import { FxRateNote } from '../../components/FxRateNote';
import { WindowCoverageTable } from '../../components/WindowCoverageTable';
import { useI18n } from '../../contexts/I18nContext';

export function AgentBuyCover() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        back={{ to: '/agent/policies', label: t('agentPolicies.title') }}
        title={t('agentBuy.title')}
        description={t('agentBuy.description')} />

      <div className="mb-3 sm:mb-6">
        <FxRateNote />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AgentPurchaseForm />
        </div>
        <aside className="lg:col-span-2">
          <section aria-labelledby="guide-heading" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="guide-heading" className="text-sm font-semibold">
              {t('buy.guideTitle')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t('agentBuy.guideBody')}</p>
            <WindowCoverageTable />
          </section>

          <section aria-labelledby="agent-guide-heading" className="mt-4 rounded-lg border border-line bg-surface p-5">
            <h2 id="agent-guide-heading" className="text-sm font-semibold">
              {t('agentBuy.howTitle')}
            </h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted">
              <li>{t('agentBuy.how1')}</li>
              <li>{t('agentBuy.how2')}</li>
              <li>{t('agentBuy.how3')}</li>
              <li>{t('agentBuy.how4')}</li>
              <li>{t('agentBuy.how5')}</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>);

}
