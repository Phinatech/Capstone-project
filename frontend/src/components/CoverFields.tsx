import { useFx } from '../contexts/FxContext';
import { useI18n } from '../contexts/I18nContext';
import { coverPerHectareEth, maxHectares, minHectares } from '../data/policies';
import type { CoverLevel } from '../utils/coverLevels';
import { formatEth } from '../utils/format';
import { formatNgn } from '../utils/currency';
import type { WindowOption } from '../contexts/policyContextCore';
import { isMobileBrowser, METAMASK_DOWNLOAD, metaMaskAppLink } from '../chain/wallet';
import { btnPrimary, btnSecondary } from './ui/buttons';
import type { FormError } from '../hooks/useCoverQuote';

const fieldClass =
'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

/** Windows on sale, the ones this farmer already holds marked and disabled. */
export function WindowSelect({ windows, value, onChange, covered }: {windows: WindowOption[];value: string;onChange: (id: string) => void;covered: Set<string>;}) {
  const { t } = useI18n();
  return (
    <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {windows.map((w) =>
      <option key={w.id} value={w.id} disabled={covered.has(w.id)}>
          {covered.has(w.id) ? t('purchase.covered', { label: w.label }) : w.label}
        </option>
      )}
    </select>);

}

/**
 * The rainfall level a window pays at. It is set by the insurer from 44 years
 * of rainfall, not typed by the buyer, so it is shown with what it means: a
 * normal year's rainfall and the dry years it would have paid in.
 */
export function RainLevel({ level, recordedMm }: {level: CoverLevel | null;recordedMm: number | null;}) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">{t('purchase.threshold')}</p>
      {level ?
      <div className="mt-1.5 rounded-md border border-line bg-canvas px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted">{t('purchase.levelPays')}</span>
            <span className="font-mono text-lg font-semibold">{level.thresholdMm} mm</span>
          </div>
          <p className="mt-1 text-xs text-muted">{t('purchase.levelTypical', { mm: level.typicalMm })}</p>
          <p className="mt-2 text-xs text-muted">
            {t('purchase.levelHistory', { first: level.firstYear, count: level.paidYears.length, years: level.years })}
            <span className="mt-0.5 block font-mono text-ink">{level.paidYears.join(' · ')}</span>
          </p>
        </div> :

      <p className="mt-1.5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t('purchase.errNoLevel')}</p>
      }
      <p className="mt-1.5 text-xs text-muted">{t('purchase.levelSet', { years: level?.years ?? 44 })}</p>
      {recordedMm !== null &&
      <p className="mt-1 text-xs text-muted">
          {t('purchase.recorded')} <span className="font-mono">{recordedMm.toFixed(1)} mm</span>
        </p>
      }
    </div>);

}

/**
 * Farm size, the payout it is worth, and the buyer's (or agent's) word that
 * the size is true: the payout follows the hectares, so the number matters.
 */
export function FarmSizeField({
  value,
  onChange,
  confirmed,
  onConfirm,
  confirmLabel,
  hectares,
  payoutEth
}: {value: string;onChange: (text: string) => void;confirmed: boolean;onConfirm: (checked: boolean) => void;confirmLabel: string;hectares: number | null;payoutEth: number;}) {
  const { t } = useI18n();
  const { ethToNgn } = useFx();
  return (
    <div className="mt-4">
      <label className="block text-sm font-medium">
        {t('purchase.farmSize')}
        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            className={`${fieldClass} pr-10 font-mono`}
            value={value}
            placeholder={t('ph.farmSize')}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby="farm-size-hint" />
          <span className="pointer-events-none absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-muted">ha</span>
        </div>
        <span id="farm-size-hint" className="mt-1.5 block text-xs font-normal text-muted">
          {t('purchase.farmSizeHint', { min: minHectares, max: maxHectares, rate: formatEth(coverPerHectareEth) })}
        </span>
      </label>

      <div className="mt-3 flex items-baseline justify-between gap-3 rounded-md border border-line px-3 py-2.5">
        <span className="text-sm text-muted">
          {t('purchase.payoutAmount')}
          {hectares !== null &&
          <span className="mt-0.5 block font-mono text-xs">{t('purchase.payoutPerHa', { ha: hectares, rate: formatEth(coverPerHectareEth) })}</span>
          }
        </span>
        <span className="text-right">
          <span className="block font-mono font-semibold">{hectares === null ? '—' : formatEth(payoutEth, 6)}</span>
          {hectares !== null && <span className="block font-mono text-xs text-muted">≈ {formatNgn(ethToNgn(payoutEth))}</span>}
        </span>
      </div>

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[var(--accent)]" />
        <span className="leading-snug">{confirmLabel}</span>
      </label>
    </div>);

}

/**
 * Pressing Pay with no MetaMask in this browser: say what to do instead of
 * failing. On a phone MetaMask is an app, so offer to open this page in it.
 */
function WalletMissingNotice() {
  const { t } = useI18n();
  const mobile = typeof navigator !== 'undefined' && isMobileBrowser(navigator.userAgent);
  return (
    <div role="alert" className="mt-3 rounded-md border border-line bg-canvas px-3 py-3 text-sm">
      <p className="font-semibold text-ink">{t('wallet.missingTitle')}</p>
      <p className="mt-1 text-muted">{t(mobile ? 'wallet.missingBodyMobile' : 'wallet.missingBody')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {mobile &&
        <a href={metaMaskAppLink(window.location)} className={btnPrimary}>{t('wallet.openInApp')}</a>
        }
        <a href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer" className={mobile ? btnSecondary : btnPrimary}>
          {t('wallet.getMetaMask')}
        </a>
      </div>
    </div>);

}

/** A purchase form's error, or the MetaMask notice when there is no wallet to pay from. */
export function PurchaseError({ error }: {error: FormError | null;}) {
  const { t } = useI18n();
  if (!error) return null;
  if (error.key === 'wallet.missing') return <WalletMissingNotice />;
  return (
    <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {t(error.key, error.vars)}
    </p>);

}

/** Under the Pay button while no wallet is connected: MetaMask opens on paying. */
export function WalletHint({ connected }: {connected?: boolean;}) {
  const { t } = useI18n();
  if (connected !== false || typeof window === 'undefined' || !window.ethereum) return null;
  return <p className="mt-2 text-center text-xs text-muted">{t('wallet.willConnect')}</p>;
}
