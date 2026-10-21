import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRightIcon, FileTextIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { FxRateNote } from '../../components/FxRateNote';
import { LedgerSyncBanner } from '../../components/LedgerSyncBanner';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { ViewToggle } from '../../components/ui/ViewToggle';
import type { ViewMode } from '../../components/ui/ViewToggle';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { useAgentSales } from '../../contexts/AgentSalesContext';
import { agentBook, summariseBook } from '../../utils/agentSales';
import { PAYMENT_METHOD_LABELS } from '../../types/agent';
import type { PolicyStatus } from '../../types/insurance';
import { formatDate, formatEth } from '../../utils/format';
import { formatNgn, formatNgnCompact } from '../../utils/currency';

type Outcome = 'all' | PolicyStatus;
const ease = [0.23, 1, 0.32, 1] as const;

export function AgentPolicies() {
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { sales, loading } = useAgentSales();
  const [view, setView] = usePersistentState<ViewMode>('sokoto-cover-view-agent-policies', 'grid');
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('all');

  const book = useMemo(() => agentBook(sales, policies), [sales, policies]);
  const summary = useMemo(() => summariseBook(book), [book]);

  const shown = book.filter(({ sale, policy }) => {
    if (outcome !== 'all' && policy?.status !== outcome) return false;
    const q = query.trim().toLowerCase().replace('#', '');
    if (!q) return true;
    return (
      String(sale.policyId) === q ||
      sale.paymentReference.toLowerCase().includes(q) ||
      `${sale.farmerName} ${sale.lga} ${sale.crop}`.toLowerCase().includes(q)
    );
  });

  const activeCount = outcome !== 'all' ? 1 : 0;
  const reset = () => {
    setOutcome('all');
    setQuery('');
  };
  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Policies you sold"
        description="Every policy you issued, the naira the farmer paid and the commission you earned."
        back={{ to: '/agent', label: 'Dashboard' }} />
      

      <dl className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:mb-6 sm:grid-cols-3">
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Premium collected</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold sm:text-2xl">{formatNgnCompact(summary.premiumNgn)}</dd>
          <dd className="mt-0.5 truncate font-mono text-xs text-muted">{formatEth(summary.premiumEth)} paid on-chain</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Cover sold</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold sm:text-2xl">{formatNgnCompact(summary.coverSoldNgn)}</dd>
          <dd className="mt-0.5 truncate text-xs text-muted">total payout value</dd>
        </div>
        <div className="col-span-2 min-w-0 bg-surface p-4 sm:col-span-1 sm:p-5">
          <dt className="text-xs text-muted">Commission earned</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold text-clay sm:text-2xl">{formatNgnCompact(summary.commissionNgn)}</dd>
          <dd className="mt-0.5 truncate text-xs text-muted">10% of premium</dd>
        </div>
      </dl>

      <div className="mb-3 sm:mb-6">
        <FxRateNote />
      </div>

      <LedgerSyncBanner />

      <div className="space-y-3 sm:space-y-4">
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search farmer, LGA, crop or reference"
          activeCount={activeCount}
          onReset={reset}
          resultCount={shown.length}
          trailing={<ViewToggle value={view} onChange={setView} />}>
          
          <FilterSelect<Outcome>
            label="Outcome"
            value={outcome}
            onChange={setOutcome}
            options={[
            { value: 'all', label: 'All outcomes' },
            { value: 'active', label: 'Active' },
            { value: 'paid', label: 'Paid out' },
            { value: 'no_payout', label: 'No payout' }]
            } />
          
        </FilterBar>

        {shown.length === 0 ?
        <EmptyState
          icon={FileTextIcon}
          title={loading ? 'Loading your book…' : book.length === 0 ? 'No policies sold yet' : 'No matches'}
          body={loading ? undefined : book.length === 0 ? 'Policies you insure will appear here with the naira receipt the farmer was given.' : 'Try a different search or filter.'}
          action={!loading && book.length === 0 ?
          <Link to="/agent/policies/new" className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Insure a farmer
            </Link> : undefined}
          /> :

        view === 'grid' ?
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {shown.map(({ sale, policy }, i) =>
          <motion.li
            key={sale.policyId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.035, ease }}
            className="flex min-w-0 flex-col rounded-lg border border-line bg-surface p-3.5 sm:p-5">
            
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">#{sale.policyId}</p>
                    <p className="mt-1 truncate font-semibold">{sale.farmerName}</p>
                    <p className="truncate text-xs text-muted">{sale.lga} · {sale.crop}</p>
                  </div>
                  {policy ? <StatusBadge status={policy.status} /> :
                  <span className="whitespace-nowrap rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">Pending</span>
                  }
                </div>
                <p className="mt-4 truncate font-mono text-2xl font-semibold">{formatNgn(sale.payoutNgn)}</p>
                <p className="mt-1 truncate text-xs text-muted">
                  farmer paid <span className="font-mono">{formatNgn(sale.premiumNgn)}</span> · you earn {formatNgn(sale.commissionNgn)}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-xs">
                  <span className="truncate text-muted">
                    {PAYMENT_METHOD_LABELS[sale.paymentMethod]} · <span className="font-mono">{sale.paymentReference}</span>
                  </span>
                  <Link to={`/agent/policies/${sale.policyId}`} className="inline-flex shrink-0 items-center gap-1 font-medium text-accent hover:underline">
                    Details
                    <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </motion.li>
          )}
          </ul> :

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            <li className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 py-3 text-xs text-muted md:grid">
              <span>Policy</span>
              <span>Paid by farmer</span>
              <span>Payment</span>
              <span>Outcome</span>
              <span className="text-right">Commission</span>
            </li>
            {shown.map(({ sale, policy }, i) =>
          <motion.li
            key={sale.policyId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03, ease }}>
            
                <Link
              to={`/agent/policies/${sale.policyId}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 transition-colors duration-150 ease-out hover:bg-canvas sm:px-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="mr-2 font-mono text-xs font-normal text-muted">#{sale.policyId}</span>
                      {sale.farmerName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {sale.lga} · {sale.crop}
                      <span className="md:hidden"> · {formatDate(sale.soldAt)}</span>
                    </p>
                  </div>
                  <span className="hidden truncate font-mono text-sm md:block">{formatNgn(sale.premiumNgn)}</span>
                  <span className="hidden truncate text-xs text-muted md:block">
                    {PAYMENT_METHOD_LABELS[sale.paymentMethod]} · <span className="font-mono">{sale.paymentReference}</span>
                  </span>
                  <span className="hidden md:block">
                    {policy ? <StatusBadge status={policy.status} /> :
                    <span className="whitespace-nowrap rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">Pending</span>
                    }
                  </span>
                  <span className="truncate text-right font-mono text-sm text-clay">{formatNgn(sale.commissionNgn)}</span>
                </Link>
              </motion.li>
            )}
          </ul>
        }
      </div>
    </div>);

}
