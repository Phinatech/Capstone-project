import { PageHeader } from '../../components/PageHeader';
import { PolicyBrowser } from '../../components/PolicyBrowser';
import { usePolicies } from '../../contexts/PolicyContext';
import { formatEth } from '../../utils/format';

export function AdminPolicies() {
  const { policies } = usePolicies();
  const active = policies.filter((p) => p.status === 'active');
  const exposure = active.reduce((s, p) => s + p.payoutEth, 0);

  return (
    <div>
      <PageHeader
        title="Policies"
        description={
        <>
            {policies.length} policies on the contract · {active.length} awaiting evaluation · open exposure{' '}
            <span className="font-mono text-ink">{formatEth(exposure)}</span>
          </>
        } />
      
      <PolicyBrowser policies={policies} basePath="/admin/policies" showFarmer storageKey="admin-policies" />
    </div>);

}