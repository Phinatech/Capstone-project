import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRightIcon, CloudRainIcon, FileTextIcon } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Avatar } from './Avatar';
import { EmptyState } from './ui/EmptyState';
import { getWindow } from '../utils/oracle';
import { findUser } from '../utils/users';
import { formatEth } from '../utils/format';
import type { ViewMode } from './ui/ViewToggle';
import type { Policy } from '../types/insurance';

interface PolicyListProps {
  policies: Policy[];
  basePath: string;
  emptyMessage?: React.ReactNode;
  view?: ViewMode;
  showFarmer?: boolean;
}

const ease = [0.23, 1, 0.32, 1] as const;

export function PolicyList({ policies, basePath, emptyMessage, view = 'list', showFarmer = false }: PolicyListProps) {
  if (policies.length === 0) {
    return <EmptyState icon={FileTextIcon} title="No policies" body={emptyMessage ?? 'No policies to show.'} />;
  }

  if (view === 'grid') {
    return (
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {policies.map((p, i) => {
          const farmer = showFarmer ? findUser(p.farmerId) : undefined;
          return (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.035, ease }}
              className="min-w-0">
              
              <Link
                to={`${basePath}/${p.id}`}
                className="group flex h-full flex-col rounded-lg border border-line bg-surface p-3.5 sm:p-5 transition-[border-color,box-shadow] duration-150 ease-out hover:border-muted hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">#{p.id}</p>
                    <p className="mt-0.5 truncate text-[15px] font-semibold sm:mt-1 sm:text-base">
                      {p.lga} · {p.crop}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{getWindow(p.windowId).label}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 sm:mt-5 sm:pt-4">
                  <div className="min-w-0">
                    <dt className="flex items-center gap-1 text-xs text-muted">
                      <CloudRainIcon className="h-3 w-3" aria-hidden />
                      Trigger
                    </dt>
                    <dd className="mt-0.5 truncate font-mono text-sm">&lt; {p.thresholdMm} mm</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">Payout</dt>
                    <dd className="mt-0.5 truncate font-mono text-sm">{formatEth(p.payoutEth)}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex items-center justify-between gap-3 pt-3 sm:pt-4">
                  {farmer ?
                  <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={farmer.name} size="sm" />
                      <span className="truncate text-xs text-muted">{farmer.name}</span>
                    </span> :

                  <span className="truncate text-xs text-muted">Premium {formatEth(p.premiumEth)}</span>
                  }
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden />
                </div>
              </Link>
            </motion.li>);

        })}
      </ul>);

  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {policies.map((p, i) => {
        const coverage = getWindow(p.windowId);
        const farmer = showFarmer ? findUser(p.farmerId) : undefined;
        return (
          <motion.li
            key={p.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03, ease }}>
            
            <Link
              to={`${basePath}/${p.id}`}
              className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:gap-x-4 sm:py-4 transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:bg-canvas sm:px-5 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
              
              <div className="flex min-w-0 items-center gap-3">
                {farmer &&
                <span className="hidden sm:block">
                    <Avatar name={farmer.name} />
                  </span>
                }
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    <span className="mr-2 font-mono text-xs font-normal text-muted">#{p.id}</span>
                    {farmer ? farmer.name : `${p.lga} · ${p.crop}`}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {farmer ? `${p.lga} · ${p.crop} · ` : ''}
                    {coverage.label}
                    <span className="md:hidden">
                      {' '}
                      · &lt; {p.thresholdMm} mm · {formatEth(p.payoutEth)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-xs text-muted">Pays below</p>
                <p className="truncate font-mono text-sm">{p.thresholdMm} mm</p>
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-xs text-muted">Payout</p>
                <p className="truncate font-mono text-sm">{formatEth(p.payoutEth)}</p>
              </div>
              <div className="hidden md:block">
                <StatusBadge status={p.status} />
              </div>
              <div className="flex items-center gap-3">
                <span className="md:hidden">
                  <StatusBadge status={p.status} />
                </span>
                <ChevronRightIcon
                  className="h-4 w-4 text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                  aria-hidden />
                
              </div>
            </Link>
          </motion.li>);

      })}
    </ul>);

}