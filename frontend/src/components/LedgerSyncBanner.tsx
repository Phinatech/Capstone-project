import { CloudOffIcon, RefreshCwIcon } from 'lucide-react';
import { useAgentSales } from '../contexts/AgentSalesContext';
import { useI18n } from '../contexts/I18nContext';

/**
 * Warns when part of the agent's book exists only in this browser.
 *
 * A sale can fail to save after the policy is already bought on-chain, so the
 * app says so plainly and offers a retry instead of implying the receipt was
 * never taken.
 */
export function LedgerSyncBanner() {
  const { unsynced, error, refresh, loading } = useAgentSales();
  const { t } = useI18n();
  if (unsynced === 0 && !error) return null;

  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger sm:mb-6">
      <span className="flex min-w-0 items-center gap-2">
        <CloudOffIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          {unsynced > 0 ?
            unsynced === 1 ? t('ledger.unsyncedOne') : t('ledger.unsyncedMany', { count: unsynced }) :
            t('ledger.unreachable')
          }
        </span>
      </span>
      <button
        type="button"
        onClick={() => void refresh()}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-danger px-3 py-1 text-xs font-semibold transition-colors duration-150 ease-out hover:bg-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-60">
        <RefreshCwIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        {t('ledger.retry')}
      </button>
    </div>);
}
