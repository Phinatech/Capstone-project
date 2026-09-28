import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRightIcon, WalletIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { ViewToggle } from '../../components/ui/ViewToggle';
import type { ViewMode } from '../../components/ui/ViewToggle';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { getWindow } from '../../utils/oracle';
import { formatDate, formatEth, formatMm, shortAddress } from '../../utils/format';

type Outcome = 'all' | 'paid' | 'no_payout';
const ease = [0.23, 1, 0.32, 1] as const;

export function FarmerPayouts() {
  const { user } = useAuth();
  const { policies, balanceOf } = usePolicies();
  const [view, setView] = usePersistentState<ViewMode>('sokoto-cover-view-payouts-v2', 'grid');
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('all');

  const settled = useMemo(
    () =>
    policies.
    filter((p) => p.farmerId === user?.id && p.status !== 'active' && p.evaluation).
    sort((a, b) => new Date(b.evaluation!.evaluatedAt).getTime() - new Date(a.evaluation!.evaluatedAt).getTime()),
    [policies, user]
  );
  const shown = settled.filter((p) => {
    if (outcome !== 'all' && p.status !== outcome) return false;
    const q = query.trim().toLowerCase().replace('#', '');
    return !q || String(p.id) === q || `${p.lga} ${p.crop}`.toLowerCase().includes(q);
  });
  const total = settled.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0);
  const premiums = policies.filter((p) => p.farmerId === user?.id).reduce((s, p) => s + p.premiumEth, 0);

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Payouts" description="Settled policies, what they paid and the transaction that paid them." />

      <dl className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:mb-6 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 bg-surface p-4 sm:col-span-1 sm:p-5">
          <dt className="text-xs text-muted">Total received</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold text-clay sm:text-2xl">{formatEth(total)}</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Premiums paid</dt>
          <dd className="mt-1 truncate font-mono text-base sm:text-lg">{formatEth(premiums)}</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Wallet balance</dt>
          <dd className="mt-1 truncate font-mono text-base sm:text-lg">{formatEth(balanceOf(user.id))}</dd>
        </div>
      </dl>

      <div className="space-y-3 sm:space-y-4">
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search LGA, crop or #id"
          activeCount={outcome !== 'all' ? 1 : 0}
          onReset={() => setOutcome('all')}
          resultCount={shown.length}
          trailing={<ViewToggle value={view} onChange={setView} />}>
          
          <FilterSelect<Outcome>
            label="Outcome"
            value={outcome}
            onChange={setOutcome}
            options={[
            { value: 'all', label: 'All outcomes' },
            { value: 'paid', label: 'Paid out' },
            { value: 'no_payout', label: 'No payout' }]
            } />
          
        </FilterBar>

        {shown.length === 0 ?
        <EmptyState
          icon={WalletIcon}
          title={settled.length === 0 ? 'No settled policies yet' : 'No matches'}
          body={settled.length === 0 ? 'Payouts appear here once a coverage window closes and is evaluated.' : 'Try a different search or filter.'} /> :

        view === 'grid' ?
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {shown.map((p, i) =>
          <motion.li
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.035, ease }}
            className="flex min-w-0 flex-col rounded-lg border border-line bg-surface p-3.5 sm:p-5">
            
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">#{p.id}</p>
                    <p className="mt-1 truncate font-semibold">
                      {p.lga} · {p.crop}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className={`mt-4 truncate font-mono text-2xl font-semibold ${p.status === 'paid' ? 'text-clay' : 'text-muted'}`}>
                  {p.status === 'paid' ? `+${formatEth(p.payoutEth)}` : '—'}
                </p>
                <p className="mt-1 truncate text-xs text-muted">
                  {formatMm(p.evaluation!.aggregateMm)} vs trigger {p.thresholdMm} mm
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-xs">
                  <span className="truncate text-muted">{formatDate(p.evaluation!.evaluatedAt)}</span>
                  <Link to={`/farmer/policies/${p.id}`} className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline">
                    Details
                    <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </motion.li>
          )}
          </ul> :

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            <li className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_minmax(0,1fr)] gap-4 px-5 py-3 text-xs text-muted md:grid">
              <span>Policy</span>
              <span>Settled</span>
              <span>Transaction</span>
              <span>Outcome</span>
              <span className="text-right">Amount</span>
            </li>
            {shown.map((p, i) =>
          <motion.li
            key={p.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03, ease }}>
            
                <Link
              to={`/farmer/policies/${p.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors duration-150 ease-out hover:bg-canvas sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_7rem_minmax(0,1fr)]">
              
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="mr-2 font-mono text-xs font-normal text-muted">#{p.id}</span>
                      {p.lga} · {p.crop}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {getWindow(p.windowId).label}
                      <span className="md:hidden"> · {formatDate(p.evaluation!.evaluatedAt)}</span>
                    </p>
                  </div>
                  <span className="hidden truncate text-sm text-muted md:block">{formatDate(p.evaluation!.evaluatedAt)}</span>
                  <span className="hidden truncate font-mono text-xs text-muted md:block">{shortAddress(p.evaluation!.txHash)}</span>
                  <span className="hidden md:block">
                    <StatusBadge status={p.status} />
                  </span>
                  <span className={`truncate text-right font-mono text-sm ${p.status === 'paid' ? 'text-clay' : 'text-muted'}`}>
                    {p.status === 'paid' ? `+${formatEth(p.payoutEth)}` : '—'}
                  </span>
                </Link>
              </motion.li>
          )}
          </ul>
        }
      </div>
    </div>);

}