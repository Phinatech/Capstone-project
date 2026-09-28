import { useParams } from 'react-router-dom';
import { ClockIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { PolicyTerms } from '../../components/PolicyTerms';
import { EvaluationResultPanel } from '../../components/EvaluationResultPanel';
import { NotFound } from '../NotFound';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { getWindow } from '../../utils/oracle';

export function FarmerPolicyDetail() {
  const { policyId } = useParams();
  const { user } = useAuth();
  const { policies } = usePolicies();
  const policy = policies.find((p) => p.id === Number(policyId) && p.farmerId === user?.id);

  if (!policy) return <NotFound message="This policy doesn't exist or belongs to another farmer." />;

  return (
    <div>
      <PageHeader
        back={{ to: '/farmer/policies', label: 'My policies' }}
        title={
        <span className="flex flex-wrap items-center gap-3">
            {policy.lga} · {policy.crop}
            <StatusBadge status={policy.status} />
          </span>
        }
        description={
        <>
            Policy <span className="font-mono">#{policy.id}</span> · {getWindow(policy.windowId).label}
          </>
        } />
      

      <PolicyTerms policy={policy} />

      <section aria-labelledby="settlement-heading" className="mt-6 rounded-lg border border-line bg-surface">
        <h2 id="settlement-heading" className="border-b border-line px-5 py-4 text-base font-semibold">
          Settlement
        </h2>
        {policy.evaluation ?
        <EvaluationResultPanel result={policy.evaluation} payoutEth={policy.payoutEth} showValidation={false} /> :

        <div className="flex items-start gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
              <ClockIcon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium">Awaiting oracle evaluation</p>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                When the coverage window closes, rainfall from CHIRPS, NASA POWER and Meteostat is compared and the
                contract settles automatically. You don't need to file a claim.
              </p>
            </div>
          </div>
        }
      </section>
    </div>);

}