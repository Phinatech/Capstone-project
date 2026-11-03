import { PageHeader } from '../../components/PageHeader';
import { PurchaseForm } from '../../components/PurchaseForm';
import { WindowCoverageTable } from '../../components/WindowCoverageTable';
import { useI18n } from '../../contexts/I18nContext';

export function BuyCover() {
  const { t } = useI18n();
  return (
    <div>
      <PageHeader
        back={{ to: '/farmer/policies', label: t('nav.myPolicies') }}
        title={t('buy.title')}
        description={t('buy.description')} />
      
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PurchaseForm />
        </div>
        <aside className="lg:col-span-2">
          <section aria-labelledby="guide-heading" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="guide-heading" className="text-sm font-semibold">
              {t('buy.guideTitle')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t('buy.guideBody')}</p>
            <WindowCoverageTable />
          </section>
        </aside>
      </div>
    </div>);

}