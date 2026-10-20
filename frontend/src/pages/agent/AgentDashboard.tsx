import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { PageHeader, primaryButtonClass } from '../../components/PageHeader';
import { FxRateNote } from '../../components/FxRateNote';
import { LedgerSyncBanner } from '../../components/LedgerSyncBanner';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { useAgentSales } from '../../contexts/AgentSalesContext';
import { agentBook, summariseBook } from '../../utils/agentSales';
import { formatEth, formatDate } from '../../utils/format';
import { formatNgn, formatNgnCompact } from '../../utils/currency';

const steps = [
{ title: 'The farmer pays you in naira', text: 'Cash, bank transfer or mobile money, at the rate shown when you sold the cover.' },
{ title: 'You pay the premium on-chain', text: 'The contract takes the policy in ETH and issues cover in the farmer\'s name.' },
{ title: 'The farmer is paid automatically', text: 'Three rainfall sources are compared when the window closes; a shortfall pays out to the farmer\'s wallet.' }];



export function AgentDashboard() {
  const { user } = useAuth();
  const { policies, balanceOf } = usePolicies();
  const { sales } = useAgentSales();
  const book = useMemo(() => agentBook(sales, policies), [sales, policies]);
  const summary = useMemo(() => summariseBook(book), [book]);
  const recent = book.slice(0, 5);
  if (!user) return null;

  const firstName = user.name.split(' ')[0];

  return (
    <div>
      <PageHeader
        title={`${firstName}'s desk`}
        description="Insure farmers across your LGAs. You collect naira in the field; the contract pays in ETH."
        actions={
        <Link to="/agent/policies/new" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Buy cover
          </Link>
        } />
      

      <div className="mb-3 sm:mb-6">
        <FxRateNote />
      </div>

      <LedgerSyncBanner />

      <dl className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:mb-6 sm:grid-cols-4">
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Farmers insured</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold sm:text-2xl">{summary.farmersInsured}</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Policies sold</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold sm:text-2xl">{summary.policiesSold}</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Premium collected</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold sm:text-2xl">{formatNgnCompact(summary.premiumNgn)}</dd>
          <dd className="mt-0.5 truncate font-mono text-xs text-muted">{formatEth(summary.premiumEth)} paid on-chain</dd>
        </div>
        <div className="min-w-0 bg-surface p-4 sm:p-5">
          <dt className="text-xs text-muted">Commission earned</dt>
          <dd className="mt-1 truncate font-mono text-xl font-semibold text-clay sm:text-2xl">{formatNgnCompact(summary.commissionNgn)}</dd>
          <dd className="mt-0.5 truncate font-mono text-xs text-muted">10% of premium</dd>
        </div>
      </dl>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
        <section aria-labelledby="book-heading" className="min-w-0 rounded-lg border border-line bg-surface lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4 md:p-6">
            <div>
              <h2 id="book-heading" className="text-sm font-medium text-muted">
                Cover sold
              </h2>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{formatNgn(summary.coverSoldNgn)}</p>
              <p className="mt-1 text-sm text-muted">
                across {summary.policiesSold} {summary.policiesSold === 1 ? 'policy' : 'policies'} · {formatNgn(summary.paidOutNgn)} paid out so far
              </p>
            </div>
            <Link to="/agent/policies" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              All policies
              <ArrowRightIcon className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          {recent.length === 0 ?
          <div className="p-4 md:p-6">
              <EmptyState
                icon={UsersIcon}
                title="No cover sold yet"
                body={
                <>
                    Your sales appear here with the naira the farmer paid and your commission.{' '}
                    <Link to="/agent/policies/new" className="font-medium text-accent hover:underline">
                      Insure a farmer
                    </Link>
                  </>
                } />
              
            </div> :

          <ul className="divide-y divide-line">
              {recent.map(({ sale, policy }) =>
            <li key={sale.policyId}>
                <Link
                  to={`/agent/policies/${sale.policyId}`}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-150 ease-out hover:bg-canvas md:px-6">
                
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      <span className="mr-2 font-mono text-xs font-normal text-muted">#{sale.policyId}</span>
                      {sale.farmerName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {sale.lga} · {sale.crop} · paid {formatNgn(sale.premiumNgn)}
                      <span className="md:hidden"> · {formatDate(sale.soldAt)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden font-mono text-sm text-clay sm:block">{formatNgn(sale.commissionNgn)}</span>
                    {policy ? <StatusBadge status={policy.status} /> :
                    <span className="whitespace-nowrap rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">Pending</span>
                    }
                  </div>
                </Link>
              </li>
            )}
            </ul>
          }
        </section>

        <aside className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-1 lg:content-start">
          <section aria-labelledby="wallet-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 id="wallet-heading" className="text-sm font-medium text-muted">
              Agent wallet
            </h2>
            <p className="mt-1 font-mono text-2xl font-semibold">{formatEth(balanceOf(user.id))}</p>
            <p className="mt-1 text-xs text-muted">
              Held as ETH so premiums can be paid on-chain. Top up before a field visit.
            </p>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4 text-sm">
              <span className="text-muted">Commission due</span>
              <span className="font-mono text-clay">{formatNgn(summary.commissionNgn)}</span>
            </div>
          </section>

          <section aria-labelledby="how-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 id="how-heading" className="text-sm font-semibold">
              How agent cover works
            </h2>
            <ol className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              {steps.map((s, i) =>
              <li key={s.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-medium text-accent-strong">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.text}</p>
                  </div>
                </li>
              )}
            </ol>
          </section>
        </aside>
      </div>
    </div>);

}
