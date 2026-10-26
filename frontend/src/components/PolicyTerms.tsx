import { usePolicies } from '../contexts/PolicyContext';
import { formatDate, formatEth } from '../utils/format';
import type { Policy } from '../types/insurance';

export function PolicyTerms({ policy }: {policy: Policy;}) {
  // Contract windows carry the dekads they insure; the simulated list does too.
  const { windows } = usePolicies();
  const window = windows.find((w) => w.id === policy.windowId);
  const terms = [
  { label: 'Pays if rainfall below', value: `${policy.thresholdMm} mm` },
  { label: 'Coverage window', value: window ? window.covers : '—' },
  { label: 'Premium paid', value: formatEth(policy.premiumEth) },
  { label: 'Payout', value: formatEth(policy.payoutEth) },
  { label: 'Purchased', value: formatDate(policy.purchasedAt) }];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-line bg-surface p-5 md:grid-cols-5">
      {terms.map((t) =>
      <div key={t.label}>
          <dt className="text-xs text-muted">{t.label}</dt>
          <dd className="mt-1 whitespace-nowrap font-mono text-sm md:text-base">{t.value}</dd>
        </div>
      )}
    </dl>);

}