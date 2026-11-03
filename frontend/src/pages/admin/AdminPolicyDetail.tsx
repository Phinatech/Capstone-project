import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { PolicyTerms } from '../../components/PolicyTerms';
import { EvaluationRunner } from '../../components/EvaluationRunner/EvaluationRunner';
import { NotFound } from '../NotFound';
import { usePolicies } from '../../contexts/PolicyContext';
import { useI18n } from '../../contexts/I18nContext';
import { useWindowName } from '../../contexts/PolicyContext';
import { cropName } from '../../contexts/policyActivity';
import { findUser } from '../../utils/users';
import { shortAddress } from '../../utils/format';

export function AdminPolicyDetail() {
  const { policyId } = useParams();
  const { policies } = usePolicies();
  const { t } = useI18n();
  const windowName = useWindowName();
  const policy = policies.find((p) => p.id === Number(policyId));
  if (!policy) return <NotFound message={t('adminPolicy.notFound')} />;
  const farmer = findUser(policy.farmerId);

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/policies', label: t('farmerDash.allPolicies') }}
        title={
        <span className="flex flex-wrap items-center gap-3">
            {t('policy.number', { id: policy.id })}
            <StatusBadge status={policy.status} />
          </span>
        }
        description={
        <>
            {farmer &&
          <Link to={`/admin/policies?q=${encodeURIComponent(farmer.name)}`} className="font-medium text-ink hover:underline">
                {farmer.name}
              </Link>
          }{' '}
            · {policy.lga} {cropName(policy.crop, t)} · {windowName(policy.windowId)}
            {policy.holder && <>{' · '}<span className="font-mono" title={policy.holder}>{shortAddress(policy.holder)}</span></>}
          </>
        } />
      
      <PolicyTerms policy={policy} />
      <div className="mt-6">
        <EvaluationRunner policy={policy} />
      </div>
    </div>);

}