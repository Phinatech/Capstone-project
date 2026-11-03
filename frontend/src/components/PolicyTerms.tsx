import { useI18n } from '../contexts/I18nContext';
import { usePolicies } from '../contexts/PolicyContext';
import { formatDate, formatEth } from '../utils/format';
import type { Policy } from '../types/insurance';

export function PolicyTerms({ policy }: {policy: Policy;}) {
  // Contract windows carry the dekads they insure; the simulated list does too.
  const { windows } = usePolicies();
  const { t } = useI18n();
  const window = windows.find((w) => w.id === policy.windowId);
  const terms = [
  { label: t('policy.paysIfBelow'), value: `${policy.thresholdMm} mm` },
  { label: t('policy.coverageWindow'), value: window ? window.covers : '—' },
  { label: t('policy.premiumPaid'), value: formatEth(policy.premiumEth) },
  { label: t('policy.payout'), value: formatEth(policy.payoutEth) },
  { label: t('policy.purchased'), value: formatDate(policy.purchasedAt) }];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-line bg-surface p-5 md:grid-cols-5">
      {terms.map((term) =>
      <div key={term.label}>
          <dt className="text-xs text-muted">{term.label}</dt>
          <dd className="mt-1 whitespace-nowrap font-mono text-sm md:text-base">{term.value}</dd>
        </div>
      )}
    </dl>);

}