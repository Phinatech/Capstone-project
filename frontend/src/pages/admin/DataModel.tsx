import { PageHeader } from '../../components/PageHeader';

const entities = [
{ name: 'Farmer', text: 'Identified by wallet address. One farmer can hold many policies.' },
{ name: 'Policy', text: 'Stores premium, rainfall threshold and status. The unit a payout decision is made on.' },
{ name: 'OracleSource', text: 'CHIRPS, NASA POWER or Meteostat, each carrying a reputation score.' },
{ name: 'WeatherReading', text: 'One rainfall value from one source for one policy, with a timestamp.' },
{ name: 'Payout', text: 'Created only when the threshold is crossed. At most one per policy.' }];


export function DataModel() {
  return (
    <div>
      <PageHeader
        title="Contract data model"
        description="The entities the smart contract stores to sell policies, record readings from each oracle source and settle payouts." />
      
      <figure className="rounded-lg border border-line bg-surface p-4 md:p-8">
        <img
          src="/pasted-image.png"
          alt="Entity relationship diagram: Farmer 1 to many Policy; Policy 1 to many WeatherReading; OracleSource 1 to many WeatherReading; Policy 1 to zero or one Payout."
          className="mx-auto w-full max-w-4xl" />
        
        <figcaption className="mt-4 text-center text-xs text-muted">Figure 2: Entity relationship diagram of the contract's data model.</figcaption>
      </figure>
      <dl className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
        {entities.map((e) =>
        <div key={e.name} className="border-t border-line pt-4">
            <dt className="font-mono text-sm font-medium">{e.name}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{e.text}</dd>
          </div>
        )}
      </dl>
    </div>);

}