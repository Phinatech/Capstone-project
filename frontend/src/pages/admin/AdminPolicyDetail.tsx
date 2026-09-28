import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { PolicyTerms } from '../../components/PolicyTerms';
import { EvaluationRunner } from '../../components/EvaluationRunner/EvaluationRunner';
import { NotFound } from '../NotFound';
import { usePolicies } from '../../contexts/PolicyContext';
import { getWindow } from '../../utils/oracle';
import { findUser } from '../../utils/users';
import { shortAddress } from '../../utils/format';

export function AdminPolicyDetail() {
  const { policyId } = useParams();
  const { policies } = usePolicies();
  const policy = policies.find((p) => p.id === Number(policyId));
  if (!policy) return <NotFound message="This policy doesn't exist on the contract." />;
  const farmer = findUser(policy.farmerId);

  return (
    <div>
      <PageHeader
        back={{ to: '/admin/policies', label: 'All policies' }}
        title={
        <span className="flex flex-wrap items-center gap-3">
            Policy #{policy.id}
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
            · {policy.lga} {policy.crop} · {getWindow(policy.windowId).label} ·{' '}
            <span className="font-mono">{farmer ? shortAddress(farmer.wallet) : ''}</span>
          </>
        } />
      
      <PolicyTerms policy={policy} />
      <div className="mt-6">
        <EvaluationRunner policy={policy} />
      </div>
    </div>);

}