import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronDownIcon, Loader2Icon, PlayIcon, ScaleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { usePolicies } from '../../contexts/PolicyContext';
import { configurationProfiles } from '../../data/configurations';
import { oracleSources } from '../../data/rainfall';
import { EvaluationResultPanel } from '../EvaluationResultPanel';
import { evaluationStages, useEvaluationRunner } from './useEvaluationRunner';
import type { CorruptionType, Policy, SourceId } from '../../types/insurance';

const corruptionOptions: {value: CorruptionType;label: string;}[] = [
{ value: 'inflated', label: 'Inflated (×2.5)' },
{ value: 'understated', label: 'Understated (×0.3)' },
{ value: 'outage', label: 'Outage (reports 0 mm)' }];


const selectClass =
'mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';

export function EvaluationRunner({ policy }: {policy: Policy;}) {
  const r = useEvaluationRunner(policy);
  const { source, settleOnChain } = usePolicies();
  const onChain = source.kind === 'chain';
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const running = r.status === 'running';
  const settled = policy.status !== 'active';

  async function settle() {
    if (!settleOnChain) return;
    setSettling(true);
    setSettleError(null);
    try {
      await settleOnChain(policy.id);
      toast.success(`Policy #${policy.id} settled on-chain`);
    } catch (e) {
      setSettleError(e instanceof Error ? e.message : 'Settlement failed.');
    } finally {
      setSettling(false);
    }
  }
  const shownResult = r.result ?? (r.status === 'idle' ? policy.evaluation ?? null : null);

  return (
    <section aria-labelledby="evaluate-heading" className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line p-5">
        <h2 id="evaluate-heading" className="text-base font-semibold">
          Oracle evaluation
        </h2>
        <p className="mt-1 text-sm text-muted">
          {onChain ?
          settled ?
          'Settled on-chain. Re-runs are simulations on the illustrative 2023 rainfall and move no funds.' :
          'Settlement happens on-chain once the oracles have finalized every dekad in the window. Simulations use the illustrative 2023 rainfall and move no funds.' :
          settled ?
          'This policy is settled. Re-runs are simulations and move no funds.' :
          'Requests rainfall for the coverage window and settles the policy automatically.'}
        </p>

        <div role="radiogroup" aria-label="Aggregation configuration" className="mt-4 grid gap-2 md:grid-cols-3">
          {configurationProfiles.map((p) => {
            const active = r.mode === p.mode;
            return (
              <button
                key={p.mode}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={running}
                onClick={() => r.setMode(p.mode)}
                className={`flex flex-col rounded-md border p-3 text-left transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed ${
                active ? 'border-accent bg-accent-soft' : 'border-line hover:border-muted'}`
                }>
                
                <span className={`text-sm font-semibold ${active ? 'text-accent-strong' : ''}`}>{p.name}</span>
                <span className="mt-1 text-xs leading-relaxed text-muted">{p.description}</span>
              </button>);

          })}
        </div>

        <details className="group mt-4 rounded-md border border-line" open={r.corruptionEnabled}>
          <summary
            className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
            onClick={(e) => {
              e.preventDefault();
              if (!running) r.setCorruptionEnabled(!r.corruptionEnabled);
            }}>
            
            <span>
              Stress test: corrupt one source
              {r.corruptionEnabled && <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-xs text-danger">On</span>}
            </span>
            <ChevronDownIcon className="h-4 w-4 text-muted transition-transform duration-200 ease-out group-open:rotate-180" aria-hidden />
          </summary>
          <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Source
              <select
                className={selectClass}
                value={r.corruptSource}
                disabled={running}
                onChange={(e) => r.setCorruptSource(e.target.value as SourceId)}>
                
                {oracleSources.map((s) =>
                <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                )}
              </select>
            </label>
            <label className="text-sm font-medium">
              Fault
              <select
                className={selectClass}
                value={r.corruptType}
                disabled={running}
                onChange={(e) => r.setCorruptType(e.target.value as CorruptionType)}>
                
                {corruptionOptions.map((o) =>
                <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                )}
              </select>
            </label>
          </div>
        </details>

        <button
          type="button"
          onClick={r.run}
          disabled={running}
          className="mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70">
          
          {running ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : <PlayIcon className="h-4 w-4" aria-hidden />}
          {running ? 'Evaluating…' : settled || onChain ? 'Run simulation' : 'Request oracle evaluation'}
        </button>
        {onChain && !settled &&
        <button
          type="button"
          onClick={settle}
          disabled={settling}
          className="ml-2 mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-line px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-70">
            {settling ? <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden /> : <ScaleIcon className="h-4 w-4" aria-hidden />}
            {settling ? 'Settling…' : 'Settle on-chain'}
          </button>
        }
        {settleError &&
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {settleError}
          </p>
        }
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {running &&
        <motion.ol
          key="stages"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-2.5 p-5"
          aria-live="polite">
          
            {evaluationStages.map((label, i) => {
            const done = r.stage > i;
            const current = r.stage === i;
            return (
              <li key={label} className={`flex items-center gap-3 text-sm ${done || current ? 'text-ink' : 'text-muted'}`}>
                  <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                  done ? 'border-accent bg-accent text-white' : current ? 'border-accent' : 'border-line'}`
                  }>
                  
                    {done ?
                  <CheckIcon className="h-3 w-3" aria-hidden /> :
                  current ?
                  <Loader2Icon className="h-3 w-3 animate-spin text-accent" aria-hidden /> :
                  null}
                  </span>
                  {label}
                </li>);

          })}
          </motion.ol>
        }

        {r.status === 'error' &&
        <motion.p key="error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="m-5 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {r.error}
          </motion.p>
        }

        {!running && shownResult &&
        <motion.div
          key={shownResult.txHash}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
          
            <EvaluationResultPanel result={shownResult} payoutEth={policy.payoutEth} />
          </motion.div>
        }

        {!running && !shownResult && r.status === 'idle' &&
        <p key="empty" className="p-5 text-sm text-muted">
            No evaluation yet. Choose a configuration and request an evaluation.
          </p>
        }
      </AnimatePresence>
    </section>);

}