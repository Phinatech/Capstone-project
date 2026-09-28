import { Link } from 'react-router-dom';
import { BanknoteIcon, CircleSlashIcon, FileCheckIcon } from 'lucide-react';
import { formatDate, formatEth } from '../utils/format';
import { findUser } from '../utils/users';
import type { ActivityItem } from '../utils/activity';

interface ActivityListProps {
  items: ActivityItem[];
  basePath: string;
  showFarmer?: boolean;
}

const meta = {
  purchase: { icon: FileCheckIcon, tone: 'bg-canvas text-muted', verb: 'Policy purchased' },
  paid: { icon: BanknoteIcon, tone: 'bg-clay-soft text-clay', verb: 'Payout sent' },
  no_payout: { icon: CircleSlashIcon, tone: 'bg-canvas text-muted', verb: 'Settled, no payout' }
};

export function ActivityList({ items, basePath, showFarmer }: ActivityListProps) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted">No activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const m = meta[item.kind];
        const Icon = m.icon;
        const farmer = showFarmer ? findUser(item.policy.farmerId) : undefined;
        return (
          <li key={item.id}>
            <Link
              to={`${basePath}/${item.policy.id}`}
              className="flex items-center gap-3 py-3 transition-colors duration-150 ease-out hover:text-accent-strong focus:outline-none focus-visible:underline">
              
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.tone}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {m.verb}
                  {farmer && <span className="font-normal text-muted"> · {farmer.name}</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  #{item.policy.id} · {item.policy.lga} {item.policy.crop} · {formatDate(item.date)}
                </span>
              </span>
              {item.kind !== 'no_payout' &&
              <span className={`shrink-0 font-mono text-sm ${item.kind === 'paid' ? 'text-clay' : 'text-muted'}`}>
                  {item.kind === 'paid' ? '+' : '−'}
                  {formatEth(item.amountEth)}
                </span>
              }
            </Link>
          </li>);

      })}
    </ul>);

}