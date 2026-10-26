import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InfoIcon, Loader2Icon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../contexts/PolicyContext';
import { useAuth } from '../contexts/AuthContext';
import { useFx } from '../contexts/FxContext';
import { useAgentSales } from '../contexts/AgentSalesContext';
import { useWindowRainfall } from '../hooks/useWindowRainfall';
import { crops, lgas, payoutOptionsEth, premiumRate } from '../data/policies';
import { commissionNgn, newPaymentReference } from '../utils/agentSales';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '../types/agent';
import type { PaymentMethod } from '../types/agent';
import { formatEth } from '../utils/format';
import { formatNgn } from '../utils/currency';
import { getFarmers } from '../utils/users';

const fieldClass =
  'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function AgentPurchaseForm() {
  const { balanceOf, purchasePolicy, windows } = usePolicies();
  const { user } = useAuth();
  const { ethToNgn, approximate, rate } = useFx();
  const { record } = useAgentSales();
  const balanceEth = user ? balanceOf(user.id) : 0;
  const navigate = useNavigate();
  const farmers = getFarmers();
  // Only windows the contract would still accept a purchase for.
  const sellable = useMemo(() => windows.filter((w) => w.open), [windows]);
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? '');
  const [lga, setLga] = useState(lgas[0]);
  const [crop, setCrop] = useState(crops[0]);
  const [windowId, setWindowId] = useState(sellable[0]?.id ?? '');
  const [threshold, setThreshold] = useState('85');
  const [payoutEth, setPayoutEth] = useState(payoutOptionsEth[1]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState(newPaymentReference);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rainfall this window has actually recorded, aggregated the way the contract
  // will settle it, so the trigger can be set against something real.
  const rainfallOf = useWindowRainfall();
  const windowRainfall = useMemo(
    () => rainfallOf(windows.find((w) => w.id === windowId)?.periods ?? []),
    [rainfallOf, windows, windowId]
  );
  const premiumEth = payoutEth * premiumRate;
  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  // Naira figures the farmer is quoted, locked in at the rate on screen.
  const payoutNgn = ethToNgn(payoutEth);
  const premiumNgn = ethToNgn(premiumEth);
  const commissionNgnAmount = commissionNgn(premiumNgn);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const thresholdMm = Number(threshold);
    if (!Number.isFinite(thresholdMm) || thresholdMm <= 0) {
      setError('Enter a rainfall threshold above 0 mm.');
      return;
    }
    if (premiumEth > balanceEth) {
      setError('Not enough ETH in your agent wallet to pay this premium.');
      return;
    }
    if (!user) {
      setError('Sign in as an agent to buy cover.');
      return;
    }
    if (!selectedFarmer) {
      setError('Select a farmer to insure.');
      return;
    }
    if (!paymentReference.trim()) {
      setError('Enter the payment reference the farmer settled with.');
      return;
    }
    if (!windowId) {
      setError('There is no coverage window open for sale right now.');
      return;
    }
    setError(null);
    setSubmitting(true);
    purchasePolicy(selectedFarmer.id, { lga, crop, windowId, thresholdMm, premiumEth, payoutEth }).
    then(async (policy) => {
      const saved = await record({
        policyId: policy.id,
        agentId: user.id,
        farmerId: selectedFarmer.id,
        farmerName: selectedFarmer.name,
        lga,
        crop,
        windowId,
        thresholdMm,
        premiumEth,
        payoutEth,
        premiumNgn,
        payoutNgn,
        commissionNgn: commissionNgnAmount,
        ethNgnRate: rate.ethNgn,
        paymentMethod,
        paymentReference: paymentReference.trim(),
        soldAt: new Date().toISOString()
      });

      // The policy is on-chain either way, so only the receipt's fate differs.
      if (saved.synced) {
        toast.success(`Policy #${policy.id} confirmed`, {
          description: `${formatNgn(premiumNgn)} collected from ${selectedFarmer.name}.`
        });
      } else if (saved.retryable) {
        toast.warning(`Policy #${policy.id} bought — receipt pending sync`, {
          description: `Saved on this device and retried automatically. ${saved.error ?? ''}`,
          duration: 12_000
        });
      } else {
        // The backend checked the receipt against the contract and it did not
        // match. The cover is real, so do not pretend the sale failed — but the
        // agent must escalate rather than quietly move on.
        toast.error(`Policy #${policy.id} bought — receipt rejected`, {
          description: `${saved.error ?? 'The receipt did not match the contract.'} The cover exists on-chain; tell your supervisor.`,
          duration: 20_000
        });
      }
      navigate(`/agent/policies/${policy.id}`);
    }).
    catch((err: unknown) => setError(err instanceof Error ? err.message : 'The purchase failed. Try again.')).
    finally(() => setSubmitting(false));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-surface p-5" noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Buy cover for a farmer</h2>
        <span className="whitespace-nowrap text-xs text-muted">
          Agent balance <span className="font-mono text-ink">{formatEth(balanceEth)}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        Collect naira from the farmer, then pay the premium from your wallet. The farmer is paid automatically if rainfall falls short.
      </p>

      <label className="mt-4 block text-sm font-medium">
        Farmer
        <div className="relative">
          <UserIcon className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <select
            className={`${fieldClass} pl-9`}
            value={farmerId}
            onChange={(e) => {
              setFarmerId(e.target.value);
              const f = farmers.find((x) => x.id === e.target.value);
              if (f?.lga) setLga(f.lga);
            }}>
            {farmers.map((f) =>
            <option key={f.id} value={f.id}>
                {f.name} — {f.lga}
              </option>
            )}
          </select>
        </div>
        {selectedFarmer &&
        <span className="mt-1.5 block text-xs font-normal text-muted">
            {selectedFarmer.village ? `${selectedFarmer.village}, ` : ''}{selectedFarmer.lga} · {selectedFarmer.primaryCrop} · {selectedFarmer.farmSizeHa} ha
          </span>
        }
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          LGA
          <select className={fieldClass} value={lga} onChange={(e) => setLga(e.target.value)}>
            {lgas.map((l) =>
            <option key={l}>{l}</option>
            )}
          </select>
        </label>
        <label className="text-sm font-medium">
          Crop
          <select className={fieldClass} value={crop} onChange={(e) => setCrop(e.target.value)}>
            {crops.map((c) =>
            <option key={c}>{c}</option>
            )}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-medium">
        Coverage window
        <select className={fieldClass} value={windowId} onChange={(e) => setWindowId(e.target.value)}>
          {sellable.map((w) =>
          <option key={w.id} value={w.id}>
              {w.label}
            </option>
          )}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium">
        Rainfall threshold
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={1}
            className={`${fieldClass} pr-12 font-mono`}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            aria-describedby="threshold-hint" />
          <span className="pointer-events-none absolute right-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-muted">mm</span>
        </div>
        <span id="threshold-hint" className="mt-1.5 block text-xs font-normal text-muted">
          Rainfall recorded for this window:{' '}
          <span className="font-mono">
            {windowRainfall === null ? 'not finalised yet' : `${windowRainfall.toFixed(1)} mm`}
          </span>
        </span>
      </label>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Payout amount</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {payoutOptionsEth.map((opt) =>
          <button
            key={opt}
            type="button"
            aria-pressed={payoutEth === opt}
            onClick={() => setPayoutEth(opt)}
            className={`whitespace-nowrap rounded-md border px-2 py-2 font-mono text-xs transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            payoutEth === opt ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-ink hover:border-muted'}`
            }>
              <span className="block">{formatEth(opt)}</span>
              <span className="mt-0.5 block text-[10px] font-normal opacity-70">{formatNgn(ethToNgn(opt))}</span>
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">How the farmer paid you</legend>
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
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          )}
        </div>
        <label className="mt-3 block text-sm font-medium">
          Payment reference
          <input
            type="text"
            maxLength={24}
            className={`${fieldClass} font-mono`}
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="SKT-0000"
            aria-describedby="reference-hint" />
          <span id="reference-hint" className="mt-1.5 block text-xs font-normal text-muted">
            Read this back to the farmer; it ties their naira payment to the policy.
          </span>
        </label>
      </fieldset>

      <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">Farmer pays you</span>
          <span className="font-mono text-lg font-semibold">{formatNgn(premiumNgn)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted">You pay on-chain</span>
          <span className="font-mono">{formatEth(premiumEth)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-muted">Your commission (10%)</span>
          <span className="font-mono text-clay">{formatNgn(commissionNgnAmount)}</span>
        </div>
        <p className="flex items-start gap-1.5 pt-1 text-xs text-muted">
          <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {approximate ?
          'The exchange rate could not be refreshed, so these naira figures are approximate.' :
          'The naira figure is fixed at the rate shown above. The contract always settles in ETH.'
          }
        </p>
      </div>

      {error &&
      <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      }

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
        {submitting ?
        <>
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
            Confirming transaction…
          </> :

        `Collect ${formatNgn(premiumNgn)} & buy policy`
        }
      </button>
    </form>);
}
