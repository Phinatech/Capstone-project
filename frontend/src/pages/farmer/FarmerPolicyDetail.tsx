import { useParams } from 'react-router-dom';
import { ClockIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { PolicyTerms } from '../../components/PolicyTerms';
import { EvaluationResultPanel } from '../../components/EvaluationResultPanel';
import { NotFound } from '../NotFound';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { useI18n } from '../../contexts/I18nContext';
import { useWindowName } from '../../contexts/PolicyContext';
import { cropName } from '../../contexts/policyActivity';

export function FarmerPolicyDetail() {
  const { policyId } = useParams();
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { t } = useI18n();
  const windowName = useWindowName();
  const policy = policies.find((p) => p.id === Number(policyId) && p.farmerId === user?.id);

  if (!policy) return <NotFound message={t('policy.notFound')} />;

  return (
    <div>
      <PageHeader
        back={{ to: '/farmer/policies', label: t('nav.myPolicies') }}
        title={
        <span className="flex flex-wrap items-center gap-3">
            {policy.lga} · {cropName(policy.crop, t)}
            <StatusBadge status={policy.status} />
          </span>
        }
        description={
        <>
            {t('policy.number', { id: policy.id })} · {windowName(policy.windowId)}
          </>
        } />
      

      <PolicyTerms policy={policy} />

      <section aria-labelledby="settlement-heading" className="mt-6 rounded-lg border border-line bg-surface">
        <h2 id="settlement-heading" className="border-b border-line px-5 py-4 text-base font-semibold">
          {t('policy.settlement')}
        </h2>
        {policy.evaluation ?
        <EvaluationResultPanel result={policy.evaluation} payoutEth={policy.payoutEth} showValidation={false} /> :

        <div className="flex items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <ClockIcon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">{t('policy.awaiting')}</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{t('policy.awaitingBody')}</p>
            </div>
          </div>
        }
      </section>
    </div>);

}