import type { PolicyStatus } from '../types/insurance';

const styles: Record<PolicyStatus, {label: string;className: string;}> = {
  active: { label: 'Active', className: 'bg-accent-soft text-accent-strong' },
  paid: { label: 'Paid out', className: 'bg-clay-soft text-clay' },
  no_payout: { label: 'No payout', className: 'bg-canvas text-muted border border-line' }
};

export function StatusBadge({ status }: {status: PolicyStatus;}) {
  const s = styles[status];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>);

}