import { PageHeader } from '../../components/PageHeader';
import { PurchaseForm } from '../../components/PurchaseForm';
import { WindowCoverageTable } from '../../components/WindowCoverageTable';

export function BuyCover() {
  return (
    <div>
      <PageHeader
        back={{ to: '/farmer/policies', label: 'My policies' }}
        title="Buy rainfall cover"
        description="Set the rainfall level that would damage your crop. If the season falls short, you are paid without filing a claim." />
      
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PurchaseForm />
        </div>
        <aside className="lg:col-span-2">
          <section aria-labelledby="guide-heading" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="guide-heading" className="text-sm font-semibold">
              Choosing a threshold
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Set the threshold a little below the rainfall you expect. Each window insures a fixed run of dekads,
              and the contract compares your threshold against the total recorded across them — so a total below it
              pays out.
            </p>
            <WindowCoverageTable />
          </section>
        </aside>
      </div>
    </div>);

}