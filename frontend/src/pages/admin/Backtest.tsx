import { useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { BacktestTable } from '../../components/BacktestTable';
import results from '../../data/backtestResults.json';
import { runBacktest } from '../../utils/oracle';
import { formatPct } from '../../utils/format';

// Real results come from backend/src/utils/backtest.ts, which writes data/backtestResults.json.

const mm = (x: number) => `${x.toFixed(1)} mm`;
const signedMm = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} mm`;
const share = (part: number, whole: number) => (whole ? `${Math.round(100 * part / whole)}%` : '–');

const methodSteps = [
{
  title: 'Read every source at the gauge',
  text: `NASA POWER and CHIRPS daily rainfall at the ${results.gauge.name} gauge's own location, ${results.years[0]}–${results.years[1]}.`
},
{
  title: 'Compare like for like',
  text: `A dekad counts when the gauge reported at least ${results.minDays} of its days; the gauge and every source are summed over exactly those days.`
},
{
  title: 'Learn weights out of sample',
  text: 'Each year is combined with reputation weights learned from the other years only, using the contract’s weighted-average rule.'
}];


function versus(v: (typeof results.strategies)[number]['versusReputation']) {
  if (!v) return { text: 'proposed', detail: '' };
  const interval = `95% interval ${signedMm(v.low)} to ${signedMm(v.high)}`;
  if (v.verdict === "can't tell apart") return { text: 'no clear difference', detail: interval };
  const closer = v.difference < 0;
  return { text: `${Math.abs(v.difference).toFixed(1)} mm ${closer ? 'closer' : 'further'}`, detail: interval };
}

export function Backtest() {
  const simulated = useMemo(() => runBacktest(), []);
  const rep = simulated.find((r) => r.mode === 'reputation')!;
  const equal = simulated.find((r) => r.mode === 'equal')!;
  const single = simulated.find((r) => r.mode === 'single')!;

  const [best, worst] = [...results.sources].sort((a, b) => a.rainySeason.mae - b.rainySeason.mae);
  const vsSource = (name: string) => results.strategies.find((s) => s.name === `${name} only`)!.versusReputation!;
  const recommended = results.weights.recommended as Record<string, number>;
  const deployed = results.weights.deployed as Record<string, number>;
  const th = 'py-3 pr-4 text-right font-medium';
  const td = 'py-3 pr-4 text-right font-mono';

  return (
    <div>
      <PageHeader
        title={`Backtest: rain gauge, ${results.years[0]}–${results.years[1]}`}
        description={`NASA POWER and CHIRPS against the ${results.gauge.name} rain gauge (GHCN ${results.gauge.id}): ${results.dekads.rainySeason} rainy-season dekads. Generated ${results.generatedAt}.`} />


      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="mb-3 max-w-3xl text-base leading-snug sm:mb-4 sm:text-lg">
          {best.name} tracked the gauge most closely, with a typical error of{' '}
          <span className="font-semibold text-accent-strong">{mm(best.rainySeason.mae)}</span> per dekad against{' '}
          {mm(worst.rainySeason.mae)} for {worst.name}. Reputation weighting landed between them:{' '}
          {Math.abs(vsSource(worst.name).difference).toFixed(1)} mm closer than {worst.name} alone,{' '}
          {Math.abs(vsSource(best.name).difference).toFixed(1)} mm further than {best.name} alone.
        </h2>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Each estimate against the gauge, rainy season</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pl-5 pr-4 text-left font-medium">Estimate</th>
                <th className={th}>Typical error</th>
                <th className={th}>RMSE</th>
                <th className={th}>Bias</th>
                <th className={th}>Correlation</th>
                <th className="py-3 pr-5 text-right font-medium">Reputation weights vs this</th>
              </tr>
            </thead>
            <tbody>
              {results.strategies.map((s) => {
                const v = versus(s.versusReputation);
                return (
                  <tr key={s.name} className={`border-b border-line last:border-0 ${s.proposed ? 'bg-accent-soft' : ''}`}>
                    <th scope="row" className="py-3.5 pl-5 pr-4 text-left font-medium">
                      {s.name}
                      {s.proposed && <span className="ml-2 text-xs font-normal text-muted">proposed</span>}
                    </th>
                    <td className={td}>{mm(s.stats.mae)}</td>
                    <td className={td}>{mm(s.stats.rmse)}</td>
                    <td className={td}>{signedMm(s.stats.bias)}</td>
                    <td className={td}>{s.stats.correlation.toFixed(2)}</td>
                    <td className="py-3.5 pr-5 text-right" title={v.detail}>
                      {v.text}
                      {v.detail && <span className="block text-xs text-muted">{v.detail}</span>}
                    </td>
                  </tr>);

              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Errors per rainy-season dekad (June–September). Bias below zero means the estimate reads drier than the gauge.
          Proposed: weights learned from other years only, scored on the year left out.
        </p>
      </section>

      <section aria-labelledby="payout-heading" className="mt-6 sm:mt-10">
        <h2 id="payout-heading" className="text-base font-semibold">
          Payout calls against the gauge
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          A dekad counts as dry below {mm(results.dryThresholdMm)}, the driest quarter of the gauge’s rainy-season dekads.
          Every estimate makes the same call from its own number.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Payout calls compared with the gauge</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pl-5 pr-4 text-left font-medium">Estimate</th>
                <th className={th}>Droughts missed</th>
                <th className={th}>Payouts without drought</th>
                <th className="py-3 pr-5 text-right font-medium">Calls that agree</th>
              </tr>
            </thead>
            <tbody>
              {results.strategies.map(({ name, proposed: isProposed, payout: p }) =>
              <tr key={name} className={`border-b border-line last:border-0 ${isProposed ? 'bg-accent-soft' : ''}`}>
                  <th scope="row" className="py-3.5 pl-5 pr-4 text-left font-medium">{name}</th>
                  <td className={td}>
                    {p.misses} of {p.hits + p.misses} ({share(p.misses, p.hits + p.misses)})
                  </td>
                  <td className={td}>
                    {p.falseAlarms} of {p.falseAlarms + p.correctNegatives} ({share(p.falseAlarms, p.falseAlarms + p.correctNegatives)})
                  </td>
                  <td className={`${td} pr-5`}>
                    {share(p.hits + p.correctNegatives, p.hits + p.misses + p.falseAlarms + p.correctNegatives)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:mt-10 lg:grid-cols-2">
        <section aria-labelledby="weights-heading" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="weights-heading" className="text-base font-semibold">
            Reputation weights
          </h2>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Deployed weights and the weights the data supports</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-2 pr-4 text-left font-medium">Source</th>
                <th className="py-2 pr-4 text-right font-medium">Deployed</th>
                <th className="py-2 text-right font-medium">Data supports</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(deployed).map((name) =>
              <tr key={name} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 pr-4 text-left font-medium">{name}</th>
                  <td className="py-2.5 pr-4 text-right font-mono">{deployed[name]}</td>
                  <td className="py-2.5 text-right font-mono">{recommended[name] ?? '–'}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Data-supported weights are proportional to 1 / MSE over all {results.dekads.rainySeason} rainy-season dekads.
            Meteostat’s can’t be estimated here: see below.
          </p>
        </section>

        <section aria-labelledby="meteostat-heading" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="meteostat-heading" className="text-base font-semibold">
            Meteostat is the gauge
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {results.meteostat ?
            <>
                Meteostat’s daily record for station 61075 matches the GHCN gauge on{' '}
                <span className="font-mono text-ink">
                  {results.meteostat.identicalDays.toLocaleString()} of {results.meteostat.sharedDays.toLocaleString()}
                </span>{' '}
                shared days, and Sokoto’s station (65010) has no daily data. So Meteostat’s daily rainfall here is this
                gauge, republished: it can’t be scored against it, and its weight needs another reference.
              </> :
            'Meteostat’s record wasn’t downloaded for this run.'}
          </p>
        </section>
      </div>

      <section aria-labelledby="limits-heading" className="mt-6 rounded-lg border border-line bg-surface p-5 sm:mt-10">
        <h2 id="limits-heading" className="text-base font-semibold">
          Limits of this evidence
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          <li>One gauge, {results.gauge.kmFromSokoto} km from Sokoto: it scores each product at Birni N’Konni, not on the farms around Sokoto.</li>
          <li>
            The gauge’s record thins out after 1981, and rainy days are over-represented among the days it reported, so
            later dekads may lean wet.
          </li>
          <li>
            Only dekads can be scored: just {results.completeRainyMonths} rainy-season months have all three dekads
            reported, too few to measure whole coverage windows, where errors partly cancel.
          </li>
          <li>CHIRPS blends in station data, possibly this gauge’s, which can flatter it; NASA POWER doesn’t.</li>
        </ul>
      </section>

      <section aria-labelledby="method-heading" className="mt-6 rounded-lg border border-line bg-surface p-4 sm:mt-10 md:p-6">
        <h2 id="method-heading" className="text-base font-semibold">
          How the backtest works
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

      <section aria-labelledby="simulation-heading" className="mt-6 sm:mt-10">
        <h2 id="simulation-heading" className="flex flex-wrap items-center gap-2 text-base font-semibold">
          Stress test: one source corrupted
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">Simulation</span>
        </h2>
        <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">
          Real records can’t show what happens when a source is wrong or manipulated, so this replays illustrative 2023
          readings with one source deliberately corrupted. With it, reputation weighting settled{' '}
          {formatPct(rep.corruptedAccuracy)} of policies correctly, against {formatPct(equal.corruptedAccuracy)} for equal
          weighting and {formatPct(single.corruptedAccuracy)} for a single source.
        </p>
        <BacktestTable results={simulated} />
        <p className="mt-2 text-xs text-muted">
          Illustrative data, not measurements. Latency and gas are modelled Sepolia estimates.
        </p>
      </section>
    </div>);

}
