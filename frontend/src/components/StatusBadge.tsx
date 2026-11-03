import { useI18n } from '../contexts/I18nContext';
import type { TranslationKey } from '../data/translations';
import type { PolicyStatus } from '../types/insurance';

const styles: Record<PolicyStatus, {label: TranslationKey;className: string;}> = {
  active: { label: 'status.active', className: 'bg-accent-soft text-accent-strong' },
  paid: { label: 'status.paid', className: 'bg-clay-soft text-clay' },
  no_payout: { label: 'status.noPayout', className: 'bg-canvas text-muted border border-line' }
};

export function StatusBadge({ status }: {status: PolicyStatus;}) {
  const { t } = useI18n();
  const s = styles[status];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {t(s.label)}
    </span>);

}