import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../contexts/PolicyContext';
import { useAuth } from '../contexts/AuthContext';
import { useWindowRainfall } from '../hooks/useWindowRainfall';
import { hectaresText, percent, useCoverQuote, type FormError } from '../hooks/useCoverQuote';
import { crops, lgas, maxHectares, minHectares } from '../data/policies';
import { formatEth } from '../utils/format';
import { formatNgn } from '../utils/currency';
import { useFx } from '../contexts/FxContext';
import { useI18n } from '../contexts/I18nContext';
import { cropName } from '../contexts/policyActivity';
import { FarmSizeField, RainLevel, WindowSelect } from './CoverFields';

const fieldClass =
'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function PurchaseForm() {
  const { balanceOf, purchasePolicy, windows, policies, walletConnected } = usePolicies();
  const { user } = useAuth();
  const { ethToNgn, approximate } = useFx();
  const { t } = useI18n();
  const balanceEth = user ? balanceOf(user.id) : 0;
  const navigate = useNavigate();
  // Only windows the contract would still accept a purchase for.
  const sellable = useMemo(() => windows.filter((w) => w.open), [windows]);
  // One policy per farm per window: the windows this farmer already holds.
  const covered = useMemo(
    () => new Set(policies.filter((p) => p.farmerId === user?.id).map((p) => p.windowId)),
    [policies, user]
  );
  const [lga, setLga] = useState(user?.lga ?? lgas[0]);
  const [crop, setCrop] = useState(crops[0]);
  const [windowId, setWindowId] = useState(() => (sellable.find((w) => !covered.has(w.id)) ?? sellable[0])?.id ?? '');
  const [hectares, setHectares] = useState(() => hectaresText(user?.farmSizeHa));
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const selected = windows.find((w) => w.id === windowId);
  const quote = useCoverQuote(selected, hectares);
  // Rainfall this window has actually recorded, aggregated the way the contract
  // will settle it. Only a window already under way has any.
  const rainfallOf = useWindowRainfall();
  const windowRainfall = useMemo(() => rainfallOf(selected?.periods ?? []), [rainfallOf, selected]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return setError({ key: 'purchase.errSignIn' });
    if (!windowId) return setError({ key: 'purchase.errNoWindow' });
    if (covered.has(windowId)) return setError({ key: 'purchase.errCovered' });
    if (!quote.level) return setError({ key: 'purchase.errNoLevel' });
    if (quote.hectares === null) return setError({ key: 'purchase.errHectares', vars: { min: minHectares, max: maxHectares } });
    if (!confirmed) return setError({ key: 'purchase.errConfirmSize' });
    // A missing wallet also reads as a zero balance, so say which it is rather
    // than telling a funded account that it is broke.
    if (walletConnected === false) return setError({ key: 'purchase.errNoWallet' });
    if (quote.premiumEth > balanceEth) return setError({ key: 'purchase.errFunds' });
    setError(null);
    setSubmitting(true);
    purchasePolicy(user.id, {
      lga,
      crop,
      windowId,
      thresholdMm: quote.level.thresholdMm,
      premiumEth: quote.premiumEth,
      payoutEth: quote.payoutEth
    }).
    then((policy) => {
      toast.success(t('purchase.confirmed', { id: policy.id }), { description: t('purchase.confirmedBody', { premium: formatEth(policy.premiumEth, 6) }) });
      navigate(`/farmer/policies/${policy.id}`);
    }).
    catch((err: unknown) => setError({ key: err instanceof Error ? err.message : 'purchase.failed' })).
    finally(() => setSubmitting(false));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-surface p-5" noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t('purchase.details')}</h2>
        <span className="whitespace-nowrap text-xs text-muted">
          {t('purchase.balance')} <span className="font-mono text-ink">{formatEth(balanceEth)}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{t('purchase.intro')}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          {t('purchase.lga')}
          <select className={fieldClass} value={lga} onChange={(e) => setLga(e.target.value)}>
            {lgas.map((l) =>
            <option key={l}>{l}</option>
            )}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('purchase.crop')}
          <select className={fieldClass} value={crop} onChange={(e) => setCrop(e.target.value)}>
            {crops.map((c) =>
            <option key={c} value={c}>{cropName(c, t)}</option>
            )}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium">
        {t('policy.coverageWindow')}
        <WindowSelect windows={sellable} value={windowId} onChange={setWindowId} covered={covered} />
      </label>

      <RainLevel level={quote.level} recordedMm={windowRainfall} />

      <FarmSizeField
        value={hectares}
        onChange={setHectares}
        confirmed={confirmed}
        onConfirm={setConfirmed}
        confirmLabel={t('purchase.confirmSize')}
        hectares={quote.hectares}
        payoutEth={quote.payoutEth} />

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
        <span className="text-sm text-muted">
          {t('purchase.premiumDue')}
          <span className="block text-xs">{t('purchase.premiumShare', { rate: percent(quote.premiumRate) })}</span>
        </span>
        <span className="text-right">
          {quote.hectares === null ?
          <span className="font-mono text-lg font-semibold">—</span> :

          <>
              <span className="font-mono text-lg font-semibold">{formatEth(quote.premiumEth, 6)}</span>
              <span className="ml-2 font-mono text-sm text-muted">≈ {formatNgn(ethToNgn(quote.premiumEth))}</span>
            </>
          }
        </span>
      </div>
      {approximate &&
      <p className="mt-1 text-xs text-muted">{t('purchase.approxNaira')}</p>
      }

      {error &&
      <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {t(error.key, error.vars)}
        </p>
      }

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">

        {submitting ?
        <>
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
            {t('purchase.confirming')}
          </> :

        t('purchase.submit')
        }
      </button>
    </form>);

}
