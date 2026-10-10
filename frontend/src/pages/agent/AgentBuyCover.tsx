import { PageHeader } from '../../components/PageHeader';
import { AgentPurchaseForm } from '../../components/AgentPurchaseForm';
import { coverageWindows } from '../../data/policies';
import { dekadalRainfall } from '../../data/rainfall';
import { SOURCE_IDS, windowTotal } from '../../utils/oracle';

export function AgentBuyCover() {
  return (
    <div>
      <PageHeader
        back={{ to: '/agent/policies', label: 'Farmers' }}
        title="Buy cover for a farmer"
        description="Select a farmer, set the rainfall threshold, and pay the premium from your agent wallet. The farmer is paid automatically if the season falls short." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AgentPurchaseForm />
        </div>
        <aside className="lg:col-span-2">
          <section aria-labelledby="guide-heading" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="guide-heading" className="text-sm font-semibold">
              Choosing a threshold
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              A threshold just below typical rainfall pays out in a dry spell. The 2023 three-source averages are a
              useful guide.
            </p>
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">2023 average rainfall by coverage window</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">Window</th>
                  <th className="py-2 text-right font-medium">2023 average</th>
                </tr>
              </thead>
              <tbody>
                {coverageWindows.map((w) => {
                  const avg = SOURCE_IDS.reduce((s, id) => s + windowTotal(id, w.start, w.end), 0) / SOURCE_IDS.length;
                  return (
                    <tr key={w.id} className="border-b border-line last:border-0">
                      <td className="py-2.5">
                        <span className="block">{w.label}</span>
                        <span className="text-xs text-muted">
                          {dekadalRainfall[w.start].label} – {dekadalRainfall[w.end].label}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono">{avg.toFixed(0)} mm</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="agent-guide-heading" className="mt-4 rounded-lg border border-line bg-surface p-5">
            <h2 id="agent-guide-heading" className="text-sm font-semibold">
              How agent purchase works
            </h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-muted">
              <li>Select the farmer you are insuring from the list.</li>
              <li>Set the rainfall threshold — the level below which the crop is considered damaged.</li>
              <li>Pay the premium from your own wallet (10% of the payout amount).</li>
              <li>The farmer is paid automatically if seasonal rainfall falls below the threshold.</li>
              <li>The farmer does not need a wallet or any crypto knowledge.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>);

}
