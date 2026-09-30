import { getWindow } from '../utils/oracle';
import { findUser } from '../utils/users';
import { formatEth, formatMm } from '../utils/format';
import type { useNotifications } from './NotificationContext';
import type { Policy } from '../types/insurance';

type Notify = ReturnType<typeof useNotifications>['notify'];

export function notifyPurchase(notify: Notify, policy: Policy) {
  const window = getWindow(policy.windowId).label;
  notify({
    kind: 'policy',
    userId: policy.farmerId,
    title: `Policy #${policy.id} is active`,
    body: `${policy.crop} cover in ${policy.lga} for ${window}. Pays ${formatEth(policy.payoutEth)} below ${formatMm(policy.thresholdMm)}.`,
    href: `/farmer/policies/${policy.id}`,
    toast: false
  });
  notify({
    kind: 'policy',
    role: 'admin',
    title: 'New policy purchased',
    body: `${findUser(policy.farmerId)?.name ?? 'A farmer'} bought policy #${policy.id} (${policy.crop}, ${policy.lga}) · premium ${formatEth(policy.premiumEth)}.`,
    href: `/admin/policies/${policy.id}`
  });
}

export function notifySettlement(notify: Notify, policy: Policy, aggregateMm: number, triggered: boolean) {
  notify({
    kind: triggered ? 'payout' : 'evaluation',
    userId: policy.farmerId,
    title: triggered ? `Payout sent: ${formatEth(policy.payoutEth)}` : `Policy #${policy.id} settled`,
    body: triggered ?
    `Rainfall of ${formatMm(aggregateMm)} fell below your ${formatMm(policy.thresholdMm)} trigger. Funds are in your wallet.` :
    `Rainfall of ${formatMm(aggregateMm)} met your ${formatMm(policy.thresholdMm)} trigger, so no payout was due.`,
    href: `/farmer/policies/${policy.id}`
  });
}
