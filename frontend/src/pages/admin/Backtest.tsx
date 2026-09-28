import { useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { BacktestTable } from '../../components/BacktestTable';
import { runBacktest } from '../../utils/oracle';
import { formatPct } from '../../utils/format';

const methodSteps = [
{ title: 'Score history', text: 'Each source earns a reputation from how closely its past readings matched the mean of the other two.' },
{ title: 'Check current agreement', text: 'At evaluation, a reading that disagrees sharply with its peers loses influence, borrowing from truth discovery.' },
{ title: 'Write one value', text: 'The weighted total is computed off-chain and written once; the contract compares it with the threshold.' }];


export function Backtest() {
  const results = useMemo(() => runBacktest(), []);
  const rep = results.find((r) => r.mode === 'reputation')!;
  const equal = results.find((r) => r.mode === 'equal')!;
  const single = results.find((r) => r.mode === 'single')!;

  return (
    <div>
      <PageHeader
        title="Backtest: June – October 2023"
        description={`Each configuration decides ${rep.cleanCases} historical policies, then repeats every decision ${
        rep.corruptedCases / rep.cleanCases} times with one source deliberately corrupted. Decisions are scored against the gauge record.`
        } />
      

      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="mb-3 max-w-3xl text-base leading-snug sm:mb-4 sm:text-lg">
          With one source corrupted, reputation weighting settled{' '}
          <span className="font-semibold text-accent-strong">{formatPct(rep.corruptedAccuracy)}</span> of policies correctly,
          against {formatPct(equal.corruptedAccuracy)} for equal weighting and {formatPct(single.corruptedAccuracy)} for a
          single source.
        </h2>
        <BacktestTable results={results} />
        <p className="mt-2 text-xs text-muted">
          Latency and gas are modelled Sepolia estimates for the relayer’s readings and finalizing the period on-chain.
        </p>
      </section>

      <section aria-labelledby="method-heading" className="mt-6 rounded-lg border border-line bg-surface p-4 sm:mt-10 md:p-6">
        <h2 id="method-heading" className="text-base font-semibold">
          How the reputation-weighted decision works
        </h2>
        <ol className="mt-4 grid gap-4 md:mt-5 md:grid-cols-3 md:gap-6">
          {methodSteps.map((s, i) =>
          <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-medium text-accent-strong">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            </li>
          )}
        </ol>
      </section>
    </div>);

}