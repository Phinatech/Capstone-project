import type { Policy } from '../types/insurance';

export type ActivityKind = 'purchase' | 'paid' | 'no_payout';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  policy: Policy;
  date: string;
  amountEth: number;
}

export function buildActivity(policies: Policy[], limit = 6): ActivityItem[] {
  const items: ActivityItem[] = [];
  policies.forEach((p) => {
    items.push({ id: `buy-${p.id}`, kind: 'purchase', policy: p, date: p.purchasedAt, amountEth: p.premiumEth });
    if (p.evaluation && p.status !== 'active') {
      items.push({
        id: `settle-${p.id}`,
        kind: p.status === 'paid' ? 'paid' : 'no_payout',
        policy: p,
        date: p.evaluation.evaluatedAt,
        amountEth: p.status === 'paid' ? p.payoutEth : 0
      });
    }
  });
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);
}