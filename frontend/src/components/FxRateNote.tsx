import { RefreshCwIcon } from 'lucide-react';
import { useFx } from '../contexts/FxContext';
import { formatNgn } from '../utils/currency';
import { useI18n } from '../contexts/I18nContext';
import { formatDateTime } from '../utils/format';

/**
 * The naira rate every quote on the page is based on.
 *
 * Shown wherever an agent reads a naira figure, so the farmer is told the
 * rate at the time of sale rather than being told a number with no basis.
 */
export function FxRateNote() {
  const { rate, approximate, loading, error, refresh } = useFx();
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">
          {t('fx.oneEth')} <span className="font-semibold">{formatNgn(rate.ethNgn)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {error ?
            t('fx.stale') :
            t('fx.quoted', { rate: rate.usdNgn.toFixed(2), when: formatDateTime(rate.quotedAt) })
          }
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {approximate &&
        <span className="whitespace-nowrap rounded-full bg-clay-soft px-2.5 py-0.5 text-xs font-medium text-clay">
            {t('fx.approximate')}
          </span>
        }
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label={t('fx.refresh')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted transition-colors duration-150 ease-out hover:border-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60">
          <RefreshCwIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
        </button>
      </div>
    </div>);
}
