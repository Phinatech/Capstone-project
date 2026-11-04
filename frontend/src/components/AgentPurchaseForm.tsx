import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InfoIcon, Loader2Icon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../contexts/PolicyContext';
import { useAuth } from '../contexts/AuthContext';
import { useFx } from '../contexts/FxContext';
import { useAgentSales } from '../contexts/AgentSalesContext';
import { useWindowRainfall } from '../hooks/useWindowRainfall';
import { hectaresText, percent, useCoverQuote, type FormError } from '../hooks/useCoverQuote';
import { crops, lgas, maxHectares, minHectares } from '../data/policies';
import { commissionNgn, newPaymentReference } from '../utils/agentSales';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../types/agent';
import type { PaymentMethod } from '../types/agent';
import type { Policy } from '../types/insurance';
import { formatEth } from '../utils/format';
import { formatNgn } from '../utils/currency';
import { getFarmers } from '../utils/users';
import { useI18n } from '../contexts/I18nContext';
import { cropName } from '../contexts/policyActivity';
import { FarmSizeField, PurchaseError, RainLevel, WalletHint, WindowSelect } from './CoverFields';

/** The windows a farmer already has a policy in. */
function windowsHeldBy(policies: Policy[], farmerId: string | undefined): Set<string> {
  return new Set(policies.filter((p) => farmerId && p.farmerId === farmerId).map((p) => p.windowId));
}

const fieldClass =
  'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function AgentPurchaseForm() {
  const { balanceOf, purchasePolicy, windows, policies, walletConnected } = usePolicies();
  const { user } = useAuth();
  const { ethToNgn, approximate, rate } = useFx();
  const { record } = useAgentSales();
  const { t } = useI18n();
  const balanceEth = user ? balanceOf(user.id) : 0;
  const navigate = useNavigate();
  const farmers = getFarmers();
  // Only windows the contract would still accept a purchase for.
  const sellable = useMemo(() => windows.filter((w) => w.open), [windows]);
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? '');
  // The farmer list can arrive after the form opens; until one is picked, the
  // first farmer is the one the dropdown shows, so it is the one to insure.
  const selectedFarmer = farmers.find((f) => f.id === farmerId) ?? farmers[0];
  // One policy per farm per window, whoever sold it: the windows this farmer
  // already holds, from every agent's sales and their own wallet.
  const covered = useMemo(() => windowsHeldBy(policies, selectedFarmer?.id), [policies, selectedFarmer?.id]);
  const [lga, setLga] = useState(farmers[0]?.lga ?? lgas[0]);
  const [crop, setCrop] = useState(crops[0]);
  const [windowId, setWindowId] = useState(() => (sellable.find((w) => !covered.has(w.id)) ?? sellable[0])?.id ?? '');
  const [hectares, setHectares] = useState(() => hectaresText(selectedFarmer?.farmSizeHa));
  const [confirmed, setConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState(newPaymentReference);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const selected = windows.find((w) => w.id === windowId);
  const quote = useCoverQuote(selected, hectares);
  // Rainfall this window has actually recorded, aggregated the way the contract
  // will settle it. Only a window already under way has any.
  const rainfallOf = useWindowRainfall();
  const windowRainfall = useMemo(() => rainfallOf(selected?.periods ?? []), [rainfallOf, selected]);

  // Naira figures the farmer is quoted, locked in at the rate on screen.
  const premiumNgn = ethToNgn(quote.premiumEth);
  const commissionNgnAmount = commissionNgn(premiumNgn);
  // Nothing to quote until the farm size is one cover is sold for.
  const quoted = quote.hectares !== null;

  function chooseFarmer(id: string) {
    setFarmerId(id);
    const f = farmers.find((x) => x.id === id);
    if (f?.lga) setLga(f.lga);
    // A different farm: start from its recorded size, and check it again.
    setHectares(hectaresText(f?.farmSizeHa));
    setConfirmed(false);
    const theirs = windowsHeldBy(policies, f?.id);
    if (theirs.has(windowId)) setWindowId(sellable.find((w) => !theirs.has(w.id))?.id ?? windowId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return setError({ key: 'agentForm.errSignIn' });
    if (!selectedFarmer) return setError({ key: 'agentForm.errFarmer' });
    if (!windowId) return setError({ key: 'purchase.errNoWindow' });
    if (covered.has(windowId)) return setError({ key: 'agentForm.errCovered' });
    if (!quote.level) return setError({ key: 'purchase.errNoLevel' });
    if (quote.hectares === null) return setError({ key: 'purchase.errHectares', vars: { min: minHectares, max: maxHectares } });
    if (!confirmed) return setError({ key: 'purchase.errConfirmSize' });
    if (!paymentReference.trim()) return setError({ key: 'agentForm.errReference' });
    // With no wallet connected yet, pressing Pay opens MetaMask (or explains
    // how to get it), and the purchase checks the real balance once it is
    // connected; an unconnected wallet only reads as a zero balance here.
    if (walletConnected !== false && quote.premiumEth > balanceEth) return setError({ key: 'agentForm.errFunds' });
    setError(null);
    setSubmitting(true);
    const thresholdMm = quote.level.thresholdMm;
    const ha = quote.hectares;
    purchasePolicy(selectedFarmer.id, { lga, crop, windowId, thresholdMm, premiumEth: quote.premiumEth, payoutEth: quote.payoutEth }).
    then(async (policy) => {
      // The receipt carries what the contract charged, so it always matches
      // the policy the backend checks it against.
      const saved = await record({
        policyId: policy.id,
        agentId: user.id,
        farmerId: selectedFarmer.id,
        farmerName: selectedFarmer.name,
        lga,
        crop,
        windowId,
        thresholdMm,
        hectares: ha,
        premiumEth: policy.premiumEth,
        payoutEth: policy.payoutEth,
        premiumNgn: policy.premiumEth * rate.ethNgn,
        payoutNgn: policy.payoutEth * rate.ethNgn,
        commissionNgn: commissionNgn(policy.premiumEth * rate.ethNgn),
        ethNgnRate: rate.ethNgn,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        soldAt: new Date().toISOString()
      });

      // The policy is on-chain either way, so only the receipt's fate differs.
      if (saved.synced) {
        toast.success(t('purchase.confirmed', { id: policy.id }), {
          description: t('agentForm.confirmedBody', { amount: formatNgn(policy.premiumEth * rate.ethNgn), farmer: selectedFarmer.name })
        });
      } else if (saved.retryable) {
        toast.warning(t('agentForm.pendingTitle', { id: policy.id }), {
          description: t('agentForm.pendingBody', { error: saved.error ? t(saved.error) : '' }),
          duration: 12_000
        });
      } else {
        // The backend checked the receipt against the contract and it did not
        // match. The cover is real, so do not pretend the sale failed — but the
        // agent must escalate rather than quietly move on.
        toast.error(t('agentForm.rejectedTitle', { id: policy.id }), {
          description: t('agentForm.rejectedBody', { error: saved.error ? t(saved.error) : t('agentForm.rejectedDefault') }),
          duration: 20_000
        });
      }
      navigate(`/agent/policies/${policy.id}`);
    }).
    catch((err: unknown) => setError({ key: err instanceof Error ? err.message : 'purchase.failed' })).
    finally(() => setSubmitting(false));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-surface p-5" noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t('agentBuy.title')}</h2>
        <span className="whitespace-nowrap text-xs text-muted">
          {t('agentForm.agentBalance')} <span className="font-mono text-ink">{formatEth(balanceEth)}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{t('agentForm.intro')}</p>

      <label className="mt-4 block text-sm font-medium">
        {t('agentForm.farmer')}
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <select
            className={`${fieldClass} pl-9`}
            value={selectedFarmer?.id ?? ''}
            onChange={(e) => chooseFarmer(e.target.value)}>
            {farmers.length === 0 && <option value="">{t('agentForm.noFarmers')}</option>}
            {farmers.map((f) =>
            <option key={f.id} value={f.id}>
                {f.name} — {f.lga}
              </option>
            )}
          </select>
        </div>
        {selectedFarmer &&
        <span className="mt-1.5 block text-xs font-normal text-muted">
            {selectedFarmer.village ? `${selectedFarmer.village}, ` : ''}{selectedFarmer.lga}{selectedFarmer.primaryCrop ? ` · ${cropName(selectedFarmer.primaryCrop, t)}` : ''}{selectedFarmer.farmSizeHa ? ` · ${selectedFarmer.farmSizeHa} ha` : ''}
          </span>
        }
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
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
        confirmLabel={t('agentForm.confirmSize')}
        hectares={quote.hectares}
        payoutEth={quote.payoutEth} />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{t('agentForm.howPaid')}</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) =>
          <button
            key={m}
            type="button"
            aria-pressed={paymentMethod === m}
            onClick={() => setPaymentMethod(m)}
            className={`whitespace-nowrap rounded-md border px-2 py-2 text-xs transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            paymentMethod === m ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-ink hover:border-muted'}`
            }>
              {t(PAYMENT_METHOD_LABELS[m])}
            </button>
          )}
        </div>
        <label className="mt-3 block text-sm font-medium">
          {t('agentForm.reference')}
          <input
            type="text"
            maxLength={24}
            className={`${fieldClass} font-mono`}
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder={t('ph.reference')}
            aria-describedby="reference-hint" />
          <span id="reference-hint" className="mt-1.5 block text-xs font-normal text-muted">
            {t('agentForm.referenceHint')}
          </span>
        </label>
      </fieldset>

      <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">
            {t('agentForm.farmerPays')}
            <span className="block text-xs">{t('purchase.premiumShare', { rate: percent(quote.premiumRate) })}</span>
          </span>
          <span className="font-mono text-lg font-semibold">{quoted ? formatNgn(premiumNgn) : '—'}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{t('agentForm.youPay')}</span>
          <span className="font-mono">{quoted ? formatEth(quote.premiumEth, 6) : '—'}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted">{t('agentPolicy.commission')}</span>
          <span className="font-mono text-clay">{quoted ? formatNgn(commissionNgnAmount) : '—'}</span>
        </div>
        <p className="flex items-start gap-1.5 pt-1 text-xs text-muted">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {approximate ?
          t('agentForm.approx') :
          t('agentForm.fixed')
          }
        </p>
      </div>

      <PurchaseError error={error} />

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
        {submitting ?
        <>
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
            {t('purchase.confirming')}
          </> :

        quoted ? t('agentForm.submit', { amount: formatNgn(premiumNgn) }) : t('purchase.submit')
        }
      </button>
      <WalletHint connected={walletConnected} />
    </form>);
}
