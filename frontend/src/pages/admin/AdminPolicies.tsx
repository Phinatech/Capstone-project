import { PageHeader } from '../../components/PageHeader';
import { PolicyBrowser } from '../../components/PolicyBrowser';
import { usePolicies } from '../../contexts/PolicyContext';
import { formatEth } from '../../utils/format';
import { useI18n } from '../../contexts/I18nContext';

export function AdminPolicies() {
  const { policies } = usePolicies();
  const { t } = useI18n();
  const active = policies.filter((p) => p.status === 'active');
  const exposure = active.reduce((s, p) => s + p.payoutEth, 0);

  return (
    <div>
      <PageHeader
        title={t('nav.policies')}
        description={t('adminPolicies.description', { count: policies.length, active: active.length, exposure: formatEth(exposure) })} />
      
      <PolicyBrowser policies={policies} basePath="/admin/policies" showFarmer storageKey="admin-policies" />
    </div>);

}