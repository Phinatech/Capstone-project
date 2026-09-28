import { configurationProfiles } from '../data/configurations';
import { formatGas, formatPct } from '../utils/format';
import type { BacktestSummary } from '../utils/oracle';

export function BacktestTable({ results }: {results: BacktestSummary[];}) {
  const rows = results.map((r) => {
    const profile = configurationProfiles.find((p) => p.mode === r.mode)!;
    return { ...r, profile, gas: profile.requestGas + profile.fulfillGas };
  });
  const best = {
    clean: Math.max(...rows.map((r) => r.cleanAccuracy)),
    corrupted: Math.max(...rows.map((r) => r.corruptedAccuracy)),
    error: Math.min(...rows.map((r) => r.corruptedMeanError)),
    latency: Math.min(...rows.map((r) => r.profile.latencySec)),
    gas: Math.min(...rows.map((r) => r.gas))
  };
  const cell = (isBest: boolean) => `py-3.5 pr-4 text-right font-mono ${isBest ? 'font-semibold text-accent-strong' : ''}`;

  const metrics = (r: (typeof rows)[number]) => [
  { label: 'Payout accuracy', value: formatPct(r.cleanAccuracy), best: r.cleanAccuracy === best.clean },
  { label: 'With one source corrupted', value: formatPct(r.corruptedAccuracy), best: r.corruptedAccuracy === best.corrupted },
  { label: 'Error vs gauge', value: formatPct(r.corruptedMeanError), best: r.corruptedMeanError === best.error },
  { label: 'Latency', value: `${r.profile.latencySec.toFixed(1)} s`, best: r.profile.latencySec === best.latency },
  { label: 'Gas / decision', value: formatGas(r.gas), best: r.gas === best.gas }];


  return (
    <>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:hidden">
        {rows.map((r) =>
        <li
          key={r.mode}
          className={`min-w-0 rounded-lg border bg-surface p-5 ${r.mode === 'reputation' ? 'border-accent' : 'border-line'}`}>
          
            <p className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{r.profile.name}</span>
              {r.mode === 'reputation' &&
            <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong">Proposed</span>
            }
            </p>
            <dl className="mt-4 divide-y divide-line">
              {metrics(r).map((m) =>
            <div key={m.label} className="flex items-center justify-between gap-3 py-2">
                  <dt className="truncate text-xs text-muted">{m.label}</dt>
                  <dd className={`shrink-0 font-mono text-sm ${m.best ? 'font-semibold text-accent-strong' : ''}`}>{m.value}</dd>
                </div>
            )}
            </dl>
          </li>
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-lg border border-line bg-surface lg:block">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Backtest results by oracle configuration</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-[26%] py-3 pl-5 pr-4 text-left font-medium">Configuration</th>
              <th className="py-3 pr-4 text-right font-medium">Payout accuracy</th>
              <th className="py-3 pr-4 text-right font-medium">One source corrupted</th>
              <th className="py-3 pr-4 text-right font-medium">Error vs gauge</th>
              <th className="py-3 pr-4 text-right font-medium">Latency</th>
              <th className="py-3 pr-5 text-right font-medium">Gas / decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
            <tr key={r.mode} className={`border-b border-line last:border-0 ${r.mode === 'reputation' ? 'bg-accent-soft' : ''}`}>
                <th scope="row" className="truncate py-3.5 pl-5 pr-4 text-left font-medium">
                  {r.profile.name}
                  {r.mode === 'reputation' && <span className="ml-2 text-xs font-normal text-muted">proposed</span>}
                </th>
                <td className={cell(r.cleanAccuracy === best.clean)}>{formatPct(r.cleanAccuracy)}</td>
                <td className={cell(r.corruptedAccuracy === best.corrupted)}>{formatPct(r.corruptedAccuracy)}</td>
                <td className={cell(r.corruptedMeanError === best.error)}>{formatPct(r.corruptedMeanError)}</td>
                <td className={cell(r.profile.latencySec === best.latency)}>{r.profile.latencySec.toFixed(1)} s</td>
                <td className={`${cell(r.gas === best.gas)} pr-5`}>{formatGas(r.gas)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>);

}