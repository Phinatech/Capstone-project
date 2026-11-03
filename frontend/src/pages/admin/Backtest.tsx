import { useMemo } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { BacktestTable } from '../../components/BacktestTable';
import results from '../../data/backtestResults.json';
import { runBacktest } from '../../utils/oracle';
import { formatDate, formatPct } from '../../utils/format';
import { useI18n } from '../../contexts/I18nContext';

// Real results come from backend/src/utils/backtest.ts, which writes data/backtestResults.json.

const mm = (x: number) => `${x.toFixed(1)} mm`;
const signedMm = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} mm`;
const share = (part: number, whole: number) => (whole ? `${Math.round(100 * part / whole)}%` : '–');

type Translate = ReturnType<typeof useI18n>['t'];

const methodSteps = [
{ title: 'bt.step1.title', text: 'bt.step1.text' },
{ title: 'bt.step2.title', text: 'bt.step2.text' },
{ title: 'bt.step3.title', text: 'bt.step3.text' }] as const;

/** A strategy's name, as the backtest writes it, in the reader's language. */
function strategyName(name: string, t: Translate): string {
  if (name.endsWith(' only')) return t('bt.strategy.only', { name: name.slice(0, -' only'.length) });
  if (name === 'Equal weights') return t('bt.strategy.equal');
  const deployed = /^Deployed weights \((.*)\)$/.exec(name);
  if (deployed) return t('bt.strategy.deployed', { detail: deployed[1] });
  if (name.startsWith('Reputation weights')) return t('bt.strategy.reputation');
  return name;
}


function versus(v: (typeof results.strategies)[number]['versusReputation'], t: Translate) {
  if (!v) return { text: '–', detail: '' };
  const interval = t('bt.interval', { low: signedMm(v.low), high: signedMm(v.high) });
  if (v.verdict === "can't tell apart") return { text: t('bt.noDifference'), detail: interval };
  const mmText = `${Math.abs(v.difference).toFixed(1)} mm`;
  return { text: t(v.difference < 0 ? 'bt.closer' : 'bt.further', { mm: mmText }), detail: interval };
}

export function Backtest() {
  const { t } = useI18n();
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
        title={t('bt.title', { from: results.years[0], to: results.years[1] })}
        description={t('bt.description', { gauge: results.gauge.name, id: results.gauge.id, count: results.dekads.rainySeason, date: formatDate(results.generatedAt) })} />


      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="mb-3 max-w-3xl text-base leading-snug sm:mb-4 sm:text-lg">
          {t('bt.headline', {
            best: best.name,
            bestMae: mm(best.rainySeason.mae),
            worst: worst.name,
            worstMae: mm(worst.rainySeason.mae),
            closer: `${Math.abs(vsSource(worst.name).difference).toFixed(1)} mm`,
            further: `${Math.abs(vsSource(best.name).difference).toFixed(1)} mm`
          })}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">{t('bt.caption')}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pl-5 pr-4 text-left font-medium">{t('bt.estimate')}</th>
                <th className={th}>{t('bt.typicalError')}</th>
                <th className={th}>{t('bt.rmse')}</th>
                <th className={th}>{t('bt.bias')}</th>
                <th className={th}>{t('bt.correlation')}</th>
                <th className="py-3 pr-5 text-right font-medium">{t('bt.versus')}</th>
              </tr>
            </thead>
            <tbody>
              {results.strategies.map((s) => {
                const v = versus(s.versusReputation, t);
                return (
                  <tr key={s.name} className={`border-b border-line last:border-0 ${s.proposed ? 'bg-accent-soft' : ''}`}>
                    <th scope="row" className="py-3.5 pl-5 pr-4 text-left font-medium">
                      {strategyName(s.name, t)}
                      {s.proposed && <span className="ml-2 text-xs font-normal text-muted">{t('bt.proposed')}</span>}
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
          {t('bt.note')}
        </p>
      </section>

      <section aria-labelledby="payout-heading" className="mt-6 sm:mt-10">
        <h2 id="payout-heading" className="text-base font-semibold">
          {t('bt.payoutTitle')}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          {t('bt.payoutHint', { mm: mm(results.dryThresholdMm) })}
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">{t('bt.payoutCaption')}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-3 pl-5 pr-4 text-left font-medium">{t('bt.estimate')}</th>
                <th className={th}>{t('bt.missed')}</th>
                <th className={th}>{t('bt.falseAlarms')}</th>
                <th className="py-3 pr-5 text-right font-medium">{t('bt.agree')}</th>
              </tr>
            </thead>
            <tbody>
              {results.strategies.map(({ name, proposed: isProposed, payout: p }) =>
              <tr key={name} className={`border-b border-line last:border-0 ${isProposed ? 'bg-accent-soft' : ''}`}>
                  <th scope="row" className="py-3.5 pl-5 pr-4 text-left font-medium">{strategyName(name, t)}</th>
                  <td className={td}>
                    {t('bt.ofTotal', { count: p.misses, total: p.hits + p.misses, pct: share(p.misses, p.hits + p.misses) })}
                  </td>
                  <td className={td}>
                    {t('bt.ofTotal', { count: p.falseAlarms, total: p.falseAlarms + p.correctNegatives, pct: share(p.falseAlarms, p.falseAlarms + p.correctNegatives) })}
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
            {t('bt.weightsTitle')}
          </h2>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">{t('bt.weightsCaption')}</caption>
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-2 pr-4 text-left font-medium">{t('bt.source')}</th>
                <th className="py-2 pr-4 text-right font-medium">{t('bt.deployed')}</th>
                <th className="py-2 text-right font-medium">{t('bt.supports')}</th>
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
            {t('bt.weightsNote', { count: results.dekads.rainySeason })}
          </p>
        </section>

        <section aria-labelledby="meteostat-heading" className="rounded-lg border border-line bg-surface p-5">
          <h2 id="meteostat-heading" className="text-base font-semibold">
            {t('bt.meteostatTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {results.meteostat ?
            t('bt.meteostatBody', { same: results.meteostat.identicalDays.toLocaleString(), shared: results.meteostat.sharedDays.toLocaleString() }) :
            t('bt.meteostatMissing')}
          </p>
        </section>
      </div>

      <section aria-labelledby="limits-heading" className="mt-6 rounded-lg border border-line bg-surface p-5 sm:mt-10">
        <h2 id="limits-heading" className="text-base font-semibold">
          {t('bt.limitsTitle')}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
          <li>{t('bt.limit1', { km: results.gauge.kmFromSokoto })}</li>
          <li>{t('bt.limit2')}</li>
          <li>{t('bt.limit3', { months: results.completeRainyMonths })}</li>
          <li>{t('bt.limit4')}</li>
        </ul>
      </section>

      <section aria-labelledby="method-heading" className="mt-6 rounded-lg border border-line bg-surface p-4 sm:mt-10 md:p-6">
        <h2 id="method-heading" className="text-base font-semibold">
          {t('bt.methodTitle')}
        </h2>
        <ol className="mt-4 grid gap-4 md:mt-5 md:grid-cols-3 md:gap-6">
          {methodSteps.map((s, i) =>
          <li key={s.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-medium text-accent-strong">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{t(s.title)}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(s.text, { gauge: results.gauge.name, from: results.years[0], to: results.years[1], days: results.minDays })}</p>
              </div>
            </li>
          )}
        </ol>
      </section>

      <section aria-labelledby="simulation-heading" className="mt-6 sm:mt-10">
        <h2 id="simulation-heading" className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {t('bt.stressTitle')}
          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">{t('bt.simulation')}</span>
        </h2>
        <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">
          {t('bt.stressBody', { rep: formatPct(rep.corruptedAccuracy), equal: formatPct(equal.corruptedAccuracy), single: formatPct(single.corruptedAccuracy) })}
        </p>
        <BacktestTable results={simulated} />
        <p className="mt-2 text-xs text-muted">
          {t('bt.stressNote')}
        </p>
      </section>
    </div>);

}
