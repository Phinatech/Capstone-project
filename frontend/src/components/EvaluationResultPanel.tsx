import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { configurationProfiles } from '../data/configurations';
import { oracleSources } from '../data/rainfall';
import { formatEth, formatGas, formatMm } from '../utils/format';
import type { EvaluationResult } from '../types/insurance';

interface Props {
  result: EvaluationResult;
  payoutEth: number;
  showValidation?: boolean;
}

export function EvaluationResultPanel({ result, payoutEth, showValidation = true }: Props) {
  const profile = configurationProfiles.find((p) => p.mode === result.mode);
  const scaleMax = Math.max(result.thresholdMm, result.aggregateMm, ...result.readings.map((r) => r.value)) * 1.12 || 1;
  const pos = (v: number) => `${Math.min(100, v / scaleMax * 100)}%`;
  const correct = result.triggered === result.referenceTriggered;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">
            {profile?.name}
            {result.simulated && ' · simulation, no funds moved'}
          </p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${result.triggered ? 'text-clay' : 'text-ink'}`}>
            {result.triggered ?
            result.simulated ?
            `Would pay ${formatEth(payoutEth)}` :
            `Payout of ${formatEth(payoutEth)} sent` :
            'No payout'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Aggregated rainfall <span className="font-mono text-ink">{formatMm(result.aggregateMm)}</span> against a{' '}
            <span className="font-mono text-ink">{result.thresholdMm} mm</span> threshold
          </p>
        </div>
        {showValidation && Number.isFinite(result.referenceMm) &&
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${correct ? 'bg-accent-soft text-accent-strong' : 'bg-danger-soft text-danger'}`}>
          
            {correct ? <CheckCircle2Icon className="h-4 w-4" aria-hidden /> : <XCircleIcon className="h-4 w-4" aria-hidden />}
            <span>
              {correct ? 'Matches' : 'Contradicts'} gauge record ({formatMm(result.referenceMm)})
            </span>
          </div>
        }
      </div>

      {/* Rainfall scale */}
      <div className="mt-8" aria-hidden>
        <div className="relative h-10">
          <div className="absolute inset-x-0 top-4 h-2 rounded-full bg-canvas" />
          <div className="absolute top-4 h-2 rounded-l-full bg-clay-soft" style={{ left: 0, width: pos(result.thresholdMm) }} />
          <div className="absolute top-0 h-10 w-px bg-clay" style={{ left: pos(result.thresholdMm) }}>
            <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-clay">threshold</span>
          </div>
          {result.readings.map((r) => {
            const src = oracleSources.find((s) => s.id === r.sourceId);
            return (
              <span
                key={r.sourceId}
                className={`absolute top-[13px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-surface ${r.corrupted ? 'ring-2 ring-danger' : ''}`}
                style={{ left: pos(r.value), background: src?.color }} />);


          })}
          <span className="absolute top-[9px] h-[22px] w-[3px] -translate-x-1/2 rounded bg-ink" style={{ left: pos(result.aggregateMm) }} />
        </div>
        <div className="flex justify-between font-mono text-[11px] text-muted">
          <span>0 mm</span>
          <span>{scaleMax.toFixed(0)} mm</span>
        </div>
      </div>

      <div className="scroll-area mt-6 overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <caption className="sr-only">Source readings and weights</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 font-medium">Source</th>
            <th className="py-2 text-right font-medium">Window total</th>
            <th className="py-2 pl-6 font-medium">Weight in decision</th>
          </tr>
        </thead>
        <tbody>
          {result.readings.map((r) => {
              const src = oracleSources.find((s) => s.id === r.sourceId);
              return (
                <tr key={r.sourceId} className="border-b border-line last:border-0">
                <td className="py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: src?.color }} aria-hidden />
                    {src?.name}
                    {r.corrupted &&
                      <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 py-0.5 text-xs text-danger">
                        <AlertTriangleIcon className="h-3 w-3" aria-hidden />
                        Corrupted
                      </span>
                      }
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono">{formatMm(r.value)}</td>
                <td className="py-2.5 pl-6">
                  <span className="flex items-center gap-3">
                    <span className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-canvas">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${r.weight * 100}%` }} />
                    </span>
                    <span className="w-12 text-right font-mono text-xs">{(r.weight * 100).toFixed(0)}%</span>
                  </span>
                </td>
              </tr>);

            })}
        </tbody>
      </table>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm md:grid-cols-[auto_auto_1fr]">
        <div>
          <dt className="text-xs text-muted">Gas used</dt>
          <dd className="mt-0.5 font-mono">{formatGas(result.gasUsed)}</dd>
        </div>
        {Number.isFinite(result.latencySec) &&
        <div className="md:pl-6">
            <dt className="text-xs text-muted">Resolution latency (modelled)</dt>
            <dd className="mt-0.5 font-mono">{result.latencySec.toFixed(1)} s</dd>
          </div>
        }
        <div className="col-span-2 min-w-0 md:col-span-1 md:pl-6">
          <dt className="text-xs text-muted">Transaction</dt>
          <dd className="mt-0.5 truncate font-mono text-xs leading-5" title={result.txHash}>
            {result.txHash}
          </dd>
        </div>
      </dl>
    </div>);

}