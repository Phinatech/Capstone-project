import { PageHeader } from '../../components/PageHeader';
import { AgentPurchaseForm } from '../../components/AgentPurchaseForm';
import { FxRateNote } from '../../components/FxRateNote';
import { WindowCoverageTable } from '../../components/WindowCoverageTable';

export function AgentBuyCover() {
  return (
    <div>
      <PageHeader
        back={{ to: '/agent/policies', label: 'Policies you sold' }}
        title="Buy cover for a farmer"
        description="Collect the premium in naira, pay it on-chain in ETH, and the farmer is paid automatically if the season falls short." />

      <div className="mb-3 sm:mb-6">
        <FxRateNote />
      </div>

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
              A threshold just below the rainfall you expect pays out in a dry spell. The farmer is paid on the
              contract's own reading, so it helps to know which dekads a window covers before setting it.
            </p>
            <WindowCoverageTable />
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
