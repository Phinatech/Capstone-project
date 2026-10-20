import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ClockIcon, ReceiptTextIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { FxRateNote } from '../../components/FxRateNote';
import { LedgerSyncBanner } from '../../components/LedgerSyncBanner';
import { StatusBadge } from '../../components/StatusBadge';
import { PageSkeleton } from '../../components/PageSkeleton';
import { PolicyTerms } from '../../components/PolicyTerms';
import { EvaluationResultPanel } from '../../components/EvaluationResultPanel';
import { NotFound } from '../NotFound';
import { useAuth } from '../../contexts/AuthContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { useAgentSales } from '../../contexts/AgentSalesContext';
import { PAYMENT_METHOD_LABELS } from '../../types/agent';
import { getWindow } from '../../utils/oracle';
import { formatEth, formatDateTime } from '../../utils/format';
import { formatNgn } from '../../utils/currency';

/**
 * An agent's copy of a policy: the naira receipt handed to the farmer, beside
 * the on-chain terms and how the window settled. Only the agent who sold the
 * policy sees it, so another agent cannot read a competing agent's terms.
 */
export function AgentPolicyDetail() {
  const { policyId } = useParams();
  const { user } = useAuth();
  const { policies } = usePolicies();
  const { salesFor, loading } = useAgentSales();
  const id = Number(policyId);

  const sale = salesFor(id);
  const policy = useMemo(() => policies.find((p) => p.id === id), [policies, id]);

  // The book is read from the backend, so a not-found while it is still
  // loading must not be reported as "you have no record of this policy".
  if (loading && !sale) return <PageSkeleton />;

  if (!sale || !user || sale.agentId !== user.id) {
    return <NotFound message="You have no record of this policy." />;
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/agent/policies', label: 'Policies you sold' }}
        title={
        <span className="flex flex-wrap items-center gap-3">
            {sale.farmerName}
            {policy ? <StatusBadge status={policy.status} /> :
            <span className="whitespace-nowrap rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted">Pending</span>
            }
          </span>
        }
        description={
        <>
            Policy <span className="font-mono">#{sale.policyId}</span> · {sale.lga} · {sale.crop} · {getWindow(sale.windowId).label}
          </>
        } />
      

      <section aria-labelledby="receipt-heading" className="rounded-lg border border-line bg-surface">
        <h2 id="receipt-heading" className="flex items-center gap-2 border-b border-line px-5 py-4 text-base font-semibold">
          <ReceiptTextIcon className="h-4 w-4 text-muted" aria-hidden />
          Naira receipt
        </h2>
        <dl className="space-y-3 px-5 py-4 text-sm">
          <Row label="Premium collected">
            <span className="font-mono text-base font-semibold">{formatNgn(sale.premiumNgn)}</span>
            <span className="ml-2 font-mono text-xs text-muted">({formatEth(sale.premiumEth)} paid on-chain)</span>
          </Row>
          <Row label="Payout if rainfall falls short">
            <span className="font-mono text-base font-semibold text-clay">{formatNgn(sale.payoutNgn)}</span>
            <span className="ml-2 font-mono text-xs text-muted">({formatEth(sale.payoutEth)} from the pool)</span>
          </Row>
          <Row label="Your commission (10%)">
            <span className="font-mono text-clay">{formatNgn(sale.commissionNgn)}</span>
          </Row>
          <Row label="Paid by the farmer">
            {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
            <span className="ml-2 font-mono text-xs text-muted">{sale.paymentReference}</span>
          </Row>
          <Row label="Rate at the time of sale">
            <span className="font-mono">1 ETH ≈ {formatNgn(sale.ethNgnRate)}</span>
          </Row>
          <Row label="Sold">{formatDateTime(sale.soldAt)}</Row>
        </dl>
      </section>

      <div className="mt-3 sm:mt-6">
        <FxRateNote />
      </div>

      <div className="mt-3 sm:mt-6">
        <LedgerSyncBanner />
      </div>

      {policy &&
      <>
          <div className="mt-3 sm:mt-6">
            <PolicyTerms policy={policy} />
          </div>

          <section aria-labelledby="settlement-heading" className="mt-6 rounded-lg border border-line bg-surface">
            <h2 id="settlement-heading" className="border-b border-line px-5 py-4 text-base font-semibold">
              Settlement
            </h2>
            {policy.evaluation ?
          <EvaluationResultPanel result={policy.evaluation} payoutEth={policy.payoutEth} showValidation={false} /> :

          <div className="flex items-start gap-3 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <ClockIcon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Awaiting oracle evaluation</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                  When the coverage window closes, rainfall from CHIRPS, NASA POWER and Meteostat is compared and the
                  contract pays the farmer automatically. No claim has to be filed.
                </p>
              </div>
            </div>
          }
          </section>
        </>
      }
    </div>);

}

function Row({ label, children }: {label: string;children: React.ReactNode;}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>);
}
