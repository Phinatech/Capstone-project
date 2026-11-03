import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { PolicyBrowser } from '../../components/PolicyBrowser';
import { btnPrimary } from '../../components/ui/buttons';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { usePolicies } from '../../contexts/PolicyContext';

export function FarmerPolicies() {
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { t } = useI18n();
  const mine = useMemo(() => policies.filter((p) => p.farmerId === user?.id), [policies, user]);

  return (
    <div>
      <PageHeader
        title={t('nav.myPolicies')}
        description={t('farmerPolicies.description')}
        actions={
        <Link to="/farmer/policies/new" className={btnPrimary}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            {t('nav.buyCover')}
          </Link>
        } />
      
      <PolicyBrowser policies={mine} basePath="/farmer/policies" storageKey="farmer-policies" />
    </div>);

}