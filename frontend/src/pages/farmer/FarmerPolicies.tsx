import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { PolicyBrowser } from '../../components/PolicyBrowser';
import { btnPrimary } from '../../components/ui/buttons';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';

export function FarmerPolicies() {
  const { user } = useAuth();
  const { policies } = usePolicies();
  const mine = useMemo(() => policies.filter((p) => p.farmerId === user?.id), [policies, user]);

  return (
    <div>
      <PageHeader
        title="My policies"
        description="Every policy you hold, with its trigger and settlement status."
        actions={
        <Link to="/farmer/policies/new" className={btnPrimary}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Buy cover
          </Link>
        } />
      
      <PolicyBrowser policies={mine} basePath="/farmer/policies" storageKey="farmer-policies" />
    </div>);

}