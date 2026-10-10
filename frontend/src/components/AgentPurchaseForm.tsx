import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2Icon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../contexts/PolicyContext';
import { useAuth } from '../contexts/AuthContext';
import { coverageWindows, crops, lgas, payoutOptionsEth, premiumRate } from '../data/policies';
import { SOURCE_IDS, windowTotal } from '../utils/oracle';
import { formatEth } from '../utils/format';
import { getFarmers } from '../utils/users';

const fieldClass =
  'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function AgentPurchaseForm() {
  const { balanceOf, purchasePolicy } = usePolicies();
  const { user } = useAuth();
  const balanceEth = user ? balanceOf(user.id) : 0;
  const navigate = useNavigate();
  const farmers = getFarmers();
  const [farmerId, setFarmerId] = useState(farmers[0]?.id ?? '');
  const [lga, setLga] = useState(lgas[0]);
  const [crop, setCrop] = useState(crops[0]);
  const [windowId, setWindowId] = useState(coverageWindows[1].id);
  const [threshold, setThreshold] = useState('85');
  const [payoutEth, setPayoutEth] = useState(payoutOptionsEth[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coverage = coverageWindows.find((w) => w.id === windowId) ?? coverageWindows[0];
  const typical = useMemo(
    () => SOURCE_IDS.reduce((s, id) => s + windowTotal(id, coverage.start, coverage.end), 0) / SOURCE_IDS.length,
    [coverage]
  );
  const premiumEth = payoutEth * premiumRate;
  const selectedFarmer = farmers.find((f) => f.id === farmerId);

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
    setError(null);
    setSubmitting(true);
    purchasePolicy(selectedFarmer.id, { lga, crop, windowId, thresholdMm, premiumEth, payoutEth }).
    then((policy) => {
      toast.success(`Policy #${policy.id} confirmed`, {
        description: `${formatEth(policy.premiumEth)} premium paid for ${selectedFarmer.name}.`
      });
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
        You pay the premium from your wallet. The farmer receives the payout automatically if rainfall falls short.
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
          {coverageWindows.map((w) =>
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
          2023 three-source average for this window: <span className="font-mono">{typical.toFixed(0)} mm</span>
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
              {formatEth(opt)}
            </button>
          )}
        </div>
      </fieldset>

      <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Premium due</span>
        <span className="font-mono text-lg font-semibold">{formatEth(premiumEth)}</span>
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

        'Pay premium & buy policy'
        }
      </button>
    </form>);
}
