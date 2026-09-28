import { motion } from 'framer-motion';
import { ArrowDownIcon, CpuIcon, FileCode2Icon, RadioTowerIcon } from 'lucide-react';
import { oracleSources } from '../../data/rainfall';
import { oracleMeta } from '../../data/oracleMeta';
import { reputation, SOURCE_IDS } from '../../utils/oracle';

const ease = [0.23, 1, 0.32, 1] as const;

export function TrustOverview() {
  const meanDeviation = SOURCE_IDS.reduce((s, id) => s + reputation[id].meanDeviation, 0) / SOURCE_IDS.length;
  const leader = [...oracleSources].sort((a, b) => reputation[b.id].weight - reputation[a.id].weight)[0];
  const slowest = Math.max(...SOURCE_IDS.map((id) => oracleMeta[id].responseSec));

  const pipeline = [
  { icon: RadioTowerIcon, title: 'Oracle relayer', text: 'Fetches the 3 rainfall APIs and submits each reading' },
  { icon: CpuIcon, title: 'Oracle aggregator', text: 'Combines the readings on-chain, weighted by reputation' },
  { icon: FileCode2Icon, title: 'Policy contract', text: 'Receives one value and compares it with the trigger' }];


  return (
    <section aria-labelledby="trust-heading" className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="min-w-0 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="trust-heading" className="text-sm font-medium text-muted">
              Trust distribution
            </h2>
            <p className="mt-1 text-lg font-semibold leading-snug sm:text-xl">
              Sources agree within <span className="font-mono text-accent-strong">{(meanDeviation * 100).toFixed(1)}%</span> of each other on average
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />3 of 3 feeds healthy
          </span>
        </div>

        <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-canvas" role="img" aria-label="Base weight of each source">
          {oracleSources.map((s, i) =>
          <motion.span
            key={s.id}
            initial={{ width: 0 }}
            animate={{ width: `${reputation[s.id].weight * 100}%` }}
            transition={{ duration: 0.3, delay: i * 0.05, ease }}
            className="h-full first:rounded-l-full last:rounded-r-full [&:not(:first-child)]:border-l-2 [&:not(:first-child)]:border-surface"
            style={{ background: s.color }} />

          )}
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {oracleSources.map((s) =>
          <li key={s.id} className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="truncate">{s.name}</span>
              </p>
              <p className="mt-0.5 font-mono text-base font-semibold sm:text-lg">{(reputation[s.id].weight * 100).toFixed(1)}%</p>
            </li>
          )}
        </ul>

        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-sm">
          <div className="min-w-0 bg-surface px-3 py-2.5">
            <dt className="truncate text-[11px] text-muted">Most trusted</dt>
            <dd className="mt-0.5 truncate font-medium">{leader.name}</dd>
          </div>
          <div className="min-w-0 bg-surface px-3 py-2.5">
            <dt className="truncate text-[11px] text-muted">Slowest API</dt>
            <dd className="mt-0.5 truncate font-mono">{slowest.toFixed(1)} s</dd>
          </div>
          <div className="min-w-0 bg-surface px-3 py-2.5">
            <dt className="truncate text-[11px] text-muted">Weighting</dt>
            <dd className="mt-0.5 truncate font-medium">Reputation × agreement</dd>
          </div>
        </dl>
      </div>

      <div className="min-w-0 border-t border-line bg-canvas p-4 sm:p-6 lg:border-l lg:border-t-0">
        <h2 className="text-sm font-medium text-muted">Oracle pipeline</h2>
        <ol className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-0">
          {pipeline.map((p, i) =>
          <li key={p.title} className="min-w-0">
              <div className="flex min-w-0 flex-col items-center gap-2 text-center lg:flex-row lg:items-start lg:gap-3 lg:text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-strong">
                  <p.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-xs font-semibold sm:text-sm">{p.title}</p>
                  <p className="mt-0.5 hidden text-xs leading-relaxed text-muted sm:line-clamp-2 lg:block">{p.text}</p>
                </div>
              </div>
              {i < pipeline.length - 1 &&
            <div className="hidden h-6 items-center pl-[11px] lg:flex" aria-hidden>
                  <ArrowDownIcon className="h-3.5 w-3.5 text-muted" />
                </div>
            }
            </li>
          )}
        </ol>
      </div>
    </section>);

}