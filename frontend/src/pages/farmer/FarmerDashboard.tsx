import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { PageHeader, primaryButtonClass } from '../../components/PageHeader';
import { PolicyList } from '../../components/PolicyList';
import { ActivityList } from '../../components/ActivityList';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { buildActivity } from '../../utils/activity';
import { formatEth, shortAddress } from '../../utils/format';

const steps = [
{ title: 'Buy cover', text: 'Choose a window and the rainfall level that would hurt your harvest.' },
{ title: 'Rainfall is checked', text: 'Three independent sources are compared when the window closes.' },
{ title: 'Paid automatically', text: 'If rain falls short, the payout goes straight to your wallet.' }];


export function FarmerDashboard() {
  const { user } = useAuth();
  const { policies, balanceOf } = usePolicies();
  const { t } = useI18n();
  const mine = useMemo(() => policies.filter((p) => p.farmerId === user?.id), [policies, user]);
  if (!user) return null;

  const active = mine.filter((p) => p.status === 'active');
  const received = mine.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0);
  const protectedEth = active.reduce((s, p) => s + p.payoutEth, 0);
  const firstName = user.name.split(' ')[0];

  return (
    <div>
      <PageHeader
        title={`${t('greeting.hello')}, ${firstName}`}
        description={t('dash.coverFor', { place: user.lga ?? 'Sokoto State' })}
        actions={
        <Link to="/farmer/policies/new" className={primaryButtonClass}>
            <PlusIcon className="h-4 w-4" aria-hidden />
            Buy cover
          </Link>
        } />
      

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
        <section aria-labelledby="cover-heading" className="min-w-0 rounded-lg border border-line bg-surface lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4 md:p-6">
            <div>
              <h2 id="cover-heading" className="text-sm font-medium text-muted">
                Active cover
              </h2>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">{formatEth(protectedEth)}</p>
              <p className="mt-1 text-sm text-muted">
                protected across {active.length} active {active.length === 1 ? 'policy' : 'policies'}
              </p>
            </div>
            <Link to="/farmer/policies" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              All policies
              <ArrowRightIcon className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="p-2 sm:p-3 md:p-4">
            <PolicyList
              policies={active}
              basePath="/farmer/policies"
              emptyMessage={
              <>
                  No active cover.{' '}
                  <Link to="/farmer/policies/new" className="font-medium text-accent hover:underline">
                    Buy a policy
                  </Link>
                </>
              } />
            
          </div>
        </section>

        <aside className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-1 lg:content-start">
          <section aria-labelledby="wallet-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 id="wallet-heading" className="text-sm font-medium text-muted">
              Wallet balance
            </h2>
            <p className="mt-1 font-mono text-2xl font-semibold">{formatEth(balanceOf(user.id))}</p>
            <p className="mt-1 font-mono text-xs text-muted">{shortAddress(user.wallet)} · Sepolia</p>
            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4 text-sm">
              <span className="text-muted">Payouts received</span>
              <span className="font-mono text-clay">{formatEth(received)}</span>
            </div>
            <Link to="/farmer/payouts" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              Payout history
              <ArrowRightIcon className="h-4 w-4" aria-hidden />
            </Link>
          </section>

          <section aria-labelledby="how-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5">
            <h2 id="how-heading" className="text-sm font-semibold">
              How payouts work
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

        <section aria-labelledby="activity-heading" className="min-w-0 rounded-lg border border-line bg-surface px-4 pt-4 sm:px-5 sm:pt-5 lg:col-span-2">
          <h2 id="activity-heading" className="text-base font-semibold">
            Recent activity
          </h2>
          <div className="pb-2">
            <ActivityList items={buildActivity(mine, 5)} basePath="/farmer/policies" />
          </div>
        </section>
      </div>
    </div>);

}