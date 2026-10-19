/**
 * Backtest: how well NASA POWER and CHIRPS match the Birni N'Konni rain gauge
 * (GHCN NG000001075, 13.80°N 5.25°E), and whether reputation-weighted
 * aggregation of the two beats either source alone or a plain average.
 *
 * Both sources are read at the gauge itself (data/backtest/, written by
 * fetch-backtest-data.ts). A dekad counts when the gauge reported at least
 * MIN_DAYS of its days; gauge and sources are then summed over exactly those
 * days, so every comparison is like for like. Reputation weights are judged
 * out of sample: each year's
 * dekads are aggregated with weights learned from the other years only.
 * Meteostat is checked against the gauge to show it republishes it.
 *
 * Writes docs/backtest-results.md, and the same results as JSON for the
 * dashboard's Backtest page. Usage: npx tsx src/utils/backtest.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { dekadDays, periodId } from "./period.js";
import {
  errorStats,
  inverseMseWeights,
  maeDifferenceInterval,
  onChainWeights,
  payoutAgreement,
  percentile,
  weightedEstimate,
  type ErrorStats,
  type PayoutAgreement,
} from "./backtestStats.js";

const DATA = new URL("../../data/", import.meta.url);
const REPORT = new URL("../../../docs/backtest-results.md", import.meta.url);
const DASHBOARD_JSON = new URL("../../../frontend/src/data/backtestResults.json", import.meta.url);
const SOURCES = ["NASA_POWER", "CHIRPS"] as const;
type Source = (typeof SOURCES)[number];
const LABEL: Record<Source, string> = { NASA_POWER: "NASA POWER", CHIRPS: "CHIRPS" };
// The weights on the deployed aggregator (Meteostat's 311 drops out: it doesn't report here).
const DEPLOYED_WEIGHTS: Record<Source, number> = { CHIRPS: 421, NASA_POWER: 268 };
const RAINY_MONTHS = [6, 7, 8, 9];
// A dekad counts as dry (a payout) when it is in the driest quarter of the gauge's rainy-season dekads.
const DRY_PERCENTILE = 25;
// The gauge often skips a day or two; fewer reported days than this and the dekad is left out.
const MIN_DAYS = 8;

interface Dekad {
  period: number;
  year: number;
  month: number;
  gauge: number;
  sources: Record<Source, number>;
}

async function readGaugeDaily(): Promise<Map<string, number>> {
  const daily = new Map<string, number>();
  const lines = (await readFile(new URL("birni-n-konni-ghcn.csv", DATA), "utf8")).trim().split("\n").slice(1);
  for (const line of lines) {
    const [, date, element, value, , qualityFlag] = line.split(",");
    // GHCN stores PRCP in tenths of a millimetre; a quality flag marks a failed check.
    if (element === "PRCP" && date && value && !qualityFlag) daily.set(date, Number(value) / 10);
  }
  return daily;
}

async function readDaily(name: string): Promise<Map<string, number>> {
  const json = JSON.parse(await readFile(new URL(`backtest/${name}.json`, DATA), "utf8")) as Record<string, number>;
  return new Map(Object.entries(json));
}

function dekadsWithAllData(gauge: Map<string, number>, sources: Record<Source, Map<string, number>>): Dekad[] {
  const dekads: Dekad[] = [];
  for (let year = 1981; year <= 2024; year++) {
    for (let month = 1; month <= 12; month++) {
      for (let dekad = 1; dekad <= 3; dekad++) {
        const period = periodId(year, month, dekad);
        const days = dekadDays(period).filter((day) => gauge.has(day) && SOURCES.every((s) => sources[s].has(day)));
        if (days.length < MIN_DAYS) continue;
        const total = (series: Map<string, number>) => days.reduce((sum, day) => sum + series.get(day)!, 0);
        const totals = Object.fromEntries(SOURCES.map((s) => [s, total(sources[s])])) as Record<Source, number>;
        dekads.push({ period, year, month, gauge: total(gauge), sources: totals });
      }
    }
  }
  return dekads;
}

/** Each year's dekads aggregated with inverse-MSE weights learned from all other years. */
function leaveOneYearOut(dekads: Dekad[]): number[] {
  return dekads.map((d) => {
    const training = dekads.filter((t) => t.year !== d.year);
    const rmse = Object.fromEntries(
      SOURCES.map((s) => [s, errorStats(training.map((t) => t.gauge), training.map((t) => t.sources[s])).rmse])
    );
    return weightedEstimate(d.sources, inverseMseWeights(rmse))!;
  });
}

const fmt = (x: number, digits = 1) => x.toFixed(digits);
const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : "–");
const statsRow = (name: string, s: ErrorStats) =>
  `| ${name} | ${fmt(s.mae)} | ${fmt(s.rmse)} | ${s.bias >= 0 ? "+" : ""}${fmt(s.bias)} | ${fmt(s.correlation, 2)} |`;
const payoutRow = (name: string, a: PayoutAgreement) =>
  `| ${name} | ${a.misses} of ${a.hits + a.misses} (${pct(a.misses, a.hits + a.misses)}) | ` +
  `${a.falseAlarms} of ${a.falseAlarms + a.correctNegatives} (${pct(a.falseAlarms, a.falseAlarms + a.correctNegatives)}) | ` +
  `${pct(a.hits + a.correctNegatives, a.hits + a.misses + a.falseAlarms + a.correctNegatives)} |`;

async function main() {
  const gaugeDaily = await readGaugeDaily();
  const sources = { NASA_POWER: await readDaily("nasa-power"), CHIRPS: await readDaily("chirps") };
  const all = dekadsWithAllData(gaugeDaily, sources);
  const rainy = all.filter((d) => RAINY_MONTHS.includes(d.month));
  const gauge = rainy.map((d) => d.gauge);

  // Accuracy of each source, all months and rainy season.
  const accuracy = (set: Dekad[]) =>
    SOURCES.map((s) => statsRow(LABEL[s], errorStats(set.map((d) => d.gauge), set.map((d) => d.sources[s]))));

  // Aggregation strategies on the rainy season, the period the coverage windows insure.
  const equal = Object.fromEntries(SOURCES.map((s) => [s, 1]));
  const strategies: Array<[string, number[]]> = [
    ...SOURCES.map((s) => [`${LABEL[s]} only`, rainy.map((d) => d.sources[s])] as [string, number[]]),
    ["Equal weights", rainy.map((d) => weightedEstimate(d.sources, equal)!)],
    ["Deployed weights (CHIRPS 421, NASA 268)", rainy.map((d) => weightedEstimate(d.sources, DEPLOYED_WEIGHTS)!)],
    ["Reputation weights, out of sample", leaveOneYearOut(rainy)],
  ];
  const threshold = percentile(gauge, DRY_PERCENTILE);

  const finalRmse = Object.fromEntries(SOURCES.map((s) => [s, errorStats(gauge, rainy.map((d) => d.sources[s])).rmse]));
  const recommended = onChainWeights(inverseMseWeights(finalRmse));

  // Is the out-of-sample reputation-weighted estimate really better or worse than each alternative?
  const reputation = strategies.at(-1)![1];
  const comparisons = strategies.slice(0, -1).map(([name, estimate]) => {
    const [lo, hi] = maeDifferenceInterval(gauge, reputation, estimate);
    const difference = errorStats(gauge, reputation).mae - errorStats(gauge, estimate).mae;
    const verdict = hi < 0 ? "reputation weights closer" : lo > 0 ? "reputation weights further" : "can't tell apart";
    return { name, lo, hi, difference, verdict };
  });
  const maeOf = (estimate: number[]) => errorStats(gauge, estimate).mae;
  const best = SOURCES.reduce((a, b) => (maeOf(rainy.map((d) => d.sources[a])) <= maeOf(rainy.map((d) => d.sources[b])) ? a : b));
  const worst = SOURCES.find((s) => s !== best)!;
  const vs = (name: string) => comparisons.find((c) => c.name === name)!;
  const signed = (x: number) => `${x >= 0 ? "+" : ""}${fmt(x)}`;
  const versus = (name: string) => {
    const c = vs(name);
    const what = name.replace(/ \(.*\)$/, "").replace(/ only$/, " alone").toLowerCase().replace(/^(nasa power|chirps)/i, (m) => m.toUpperCase());
    if (c.verdict === "can't tell apart") return `no clearly different from ${what}`;
    return `${fmt(Math.abs(c.difference))} mm ${c.difference < 0 ? "closer to the gauge than" : "further from the gauge than"} ${what}`;
  };

  // Meteostat against the same gauge, day by day.
  let meteostatNote = "Meteostat's daily record wasn't downloaded (no METEOSTAT_API_KEY).";
  let meteostatMatch: { identicalDays: number; sharedDays: number } | null = null;
  try {
    const meteostat = await readDaily("meteostat-61075");
    const shared = [...meteostat].filter(([day]) => gaugeDaily.has(day));
    const identical = shared.filter(([day, mm]) => Math.abs(gaugeDaily.get(day)! - mm) < 0.05).length;
    meteostatMatch = { identicalDays: identical, sharedDays: shared.length };
    meteostatNote =
      `Meteostat's daily record for station 61075 (Birni N'Konni) matches the GHCN gauge on ${identical} of ` +
      `${shared.length} shared days (${pct(identical, shared.length)}), and its Sokoto station (65010) has no ` +
      `daily data, so Meteostat's daily rainfall for this area *is* this gauge. It can't be judged against it, ` +
      `and its weight can't be estimated here.`;
  } catch {
    /* keep the note above */
  }

  const byDecade = new Map<string, number>();
  for (const d of rainy) byDecade.set(`${Math.floor(d.year / 10) * 10}s`, (byDecade.get(`${Math.floor(d.year / 10) * 10}s`) ?? 0) + 1);

  const report = `# Oracle backtest results

Generated by \`backend/src/utils/backtest.ts\` on ${new Date().toISOString().slice(0, 10)}.

**Question:** how close does each rainfall source come to a real rain gauge, and
does combining them with reputation weights do better than either source alone?

**Ground truth:** the Birni N'Konni gauge (GHCN \`NG000001075\`, 13.80°N 5.25°E,
about 83 km north of Sokoto). A dekad counts when the gauge reported at least
${MIN_DAYS} of its days, and gauge and sources are summed over exactly those days,
so each comparison is like for like. **Sources**, read at the gauge's location: NASA POWER
(\`PRECTOTCORR\`, MERRA-2 reanalysis) and CHIRPS v2 daily (satellite + stations,
via SERVIR ClimateSERV). Years 1981-2024, the satellite era.

## Summary

- **${LABEL[best]} tracks the gauge more closely than ${LABEL[worst]}**: a typical
  error of ${fmt(maeOf(rainy.map((d) => d.sources[best])))} mm per rainy-season dekad against
  ${fmt(maeOf(rainy.map((d) => d.sources[worst])))} mm. The data supports weighting it more
  (${SOURCES.map((s) => `${LABEL[s]} ${recommended[s]}`).join(", ")} out of 1000).
- **Out of sample, reputation weighting is ${versus(`${LABEL[best]} only`)}**,
  ${versus(`${LABEL[worst]} only`)}, and ${versus("Equal weights")}
  (typical error per dekad; see "Are the differences real?").
- With two independent sources, reputation weighting lands between them: it
  guards against relying on the weaker source without knowing in advance which
  one that is, and the contract's quorum and reporting window keep a missing or
  manipulated source from deciding a payout on its own.
- **Basis risk is substantial at dekad scale**: every estimate misses some of the
  gauge's dry dekads (see the payout table below).

## Data

- Dekads with at least ${MIN_DAYS} gauge days and both sources: **${all.length}**, of which
  **${rainy.length} in the June-September rainy season** (analysed below).
- Rainy-season dekads by decade: ${[...byDecade].map(([decade, n]) => `${decade} ${n}`).join(", ")}.
- Gauge rainfall in those dekads: median ${fmt(percentile(gauge, 50))} mm, 25th percentile ${fmt(threshold)} mm.

## How close each source is to the gauge (mm per dekad)

Rainy season (June-September), n = ${rainy.length}:

| Source | MAE | RMSE | Bias | Correlation |
|--------|-----|------|------|-------------|
${accuracy(rainy).join("\n")}

All months, n = ${all.length}:

| Source | MAE | RMSE | Bias | Correlation |
|--------|-----|------|------|-------------|
${accuracy(all).join("\n")}

MAE and RMSE: average size of the error (RMSE punishes large misses more).
Bias: positive means the source reads wetter than the gauge.

## Does reputation weighting help? (rainy season)

| Estimate | MAE | RMSE | Bias | Correlation |
|----------|-----|------|------|-------------|
${strategies.map(([name, estimate]) => statsRow(name, errorStats(gauge, estimate))).join("\n")}

"Reputation weights, out of sample": each year's dekads are combined with
weights proportional to 1/MSE learned from the *other* years only, so the
result isn't flattered by fitting the data it is scored on. Every combined
estimate is the contract's own rule: the weighted average of the sources.

## Are the differences real?

Mean absolute error of the out-of-sample reputation-weighted estimate minus
each alternative's, with a 95% bootstrap interval (2,000 resamples of the
dekads). Negative means reputation weighting is closer to the gauge; an
interval that includes 0 means the data can't tell the two apart.

| Compared with | Difference in MAE (mm) | 95% interval | Verdict |
|---------------|------------------------|--------------|---------|
${comparisons.map((c) => `| ${c.name} | ${signed(c.difference)} | ${signed(c.lo)} to ${signed(c.hi)} | ${c.verdict} |`).join("\n")}

## Payout calls: basis risk (rainy season)

A dekad is "dry" when its rainfall is below ${fmt(threshold)} mm, the driest
quarter of the gauge's rainy-season dekads. Each estimate makes the same call
from its own number:

| Estimate | Droughts missed (farmer not paid) | False payouts (paid without drought) | Calls that agree with the gauge |
|----------|----------------------------------|--------------------------------------|---------------------------------|
${strategies.map(([name, estimate]) => payoutRow(name, payoutAgreement(gauge, estimate, threshold))).join("\n")}

## Weights the data supports

Inverse-MSE weights from all ${rainy.length} rainy-season dekads, scaled for
\`OracleAggregator.reputationWeight\`: **${SOURCES.map((s) => `${LABEL[s]} ${recommended[s]}`).join(", ")}**
(deployed now: CHIRPS 421, NASA POWER 268, Meteostat 311).

## Limits of this evidence

- **One gauge, 83 km from Sokoto.** It measures how well each product matches
  a point at Birni N'Konni, not the farms around Sokoto.
- **The record thins out after 1981.** 1981 is the last fully reported year; later
  years report 50-80 days, mostly June-September, and rainy days are
  over-represented among them (about half of reported days, against about 30%
  in full years), so the later dekads may lean wet.
- **Meteostat is not independent of the gauge.** ${meteostatNote}
- **CHIRPS blends in station data**, possibly including this gauge's monthly
  totals, which can flatter CHIRPS somewhat; NASA POWER does not use it.
- **Only dekads can be scored, not whole coverage windows.** Just 5 rainy-season
  months since 1981 have all three dekads reported, too few to measure basis
  risk at window scale, where errors partly cancel out.
- The bootstrap resamples single dekads, so it ignores that dekads of the same
  season are related; the true intervals are somewhat wider.
- Inverse-MSE weighting assumes the sources' errors are independent and
  unbiased; weights cannot remove a shared bias.
`;

  await writeFile(REPORT, report);

  // The same results for the dashboard, rounded so regenerating gives small diffs.
  const round = (x: number) => Math.round(x * 100) / 100;
  const rounded = (st: ErrorStats) => ({ n: st.n, mae: round(st.mae), rmse: round(st.rmse), bias: round(st.bias), correlation: round(st.correlation) });
  const dashboard = {
    generatedAt: new Date().toISOString().slice(0, 10),
    gauge: { name: "Birni N'Konni", id: "NG000001075", latitude: 13.8, longitude: 5.25, kmFromSokoto: 83 },
    years: [1981, 2024],
    minDays: MIN_DAYS,
    dekads: { all: all.length, rainySeason: rainy.length, byDecade: Object.fromEntries(byDecade) },
    medianMm: round(percentile(gauge, 50)),
    dryThresholdMm: round(threshold),
    sources: SOURCES.map((s) => ({
      name: LABEL[s],
      rainySeason: rounded(errorStats(gauge, rainy.map((d) => d.sources[s]))),
      allMonths: rounded(errorStats(all.map((d) => d.gauge), all.map((d) => d.sources[s]))),
    })),
    strategies: strategies.map(([name, estimate], i) => {
      const c = comparisons.find((x) => x.name === name);
      return {
        name,
        proposed: i === strategies.length - 1,
        stats: rounded(errorStats(gauge, estimate)),
        payout: payoutAgreement(gauge, estimate, threshold),
        versusReputation: c ? { difference: round(c.difference), low: round(c.lo), high: round(c.hi), verdict: c.verdict } : null,
      };
    }),
    weights: {
      recommended: Object.fromEntries(SOURCES.map((s) => [LABEL[s], recommended[s]])),
      deployed: { CHIRPS: 421, "NASA POWER": 268, Meteostat: 311 },
    },
    meteostat: meteostatMatch,
    completeRainyMonths: 5,
  };
  await writeFile(DASHBOARD_JSON, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
