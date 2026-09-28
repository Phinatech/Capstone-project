import React from 'react';
import { dekadalRainfall, oracleSources } from '../../data/rainfall';
import { dekadDeviations } from '../../utils/oracle';

const CAP = 0.3;

function cellStyle(v: number | null): React.CSSProperties {
  if (v === null) return { background: 'var(--canvas)' };
  const pct = Math.round(Math.min(v / CAP, 1) * 70) + 6;
  return { background: `color-mix(in srgb, var(--danger) ${pct}%, var(--surface))` };
}

export function AgreementHeatmap() {
  const devs = dekadDeviations();
  const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

  return (
    <section aria-labelledby="heatmap-heading" className="min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="heatmap-heading" className="text-base font-semibold">
            Peer agreement by dekad
          </h2>
          <p className="text-xs text-muted sm:text-sm">How far each reading sat from the mean of the other two. Darker means more disagreement.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>0%</span>
          <span className="flex h-2 w-24 overflow-hidden rounded-full">
            {[0, 0.075, 0.15, 0.225, 0.3].map((v) =>
            <span key={v} className="h-full flex-1" style={cellStyle(v)} />
            )}
          </span>
          <span>30%+</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
        <span />
        <div className="grid grid-cols-5 text-[10px] text-muted sm:text-[11px]">
          {months.map((m) =>
          <span key={m} className="truncate">
              {m}
            </span>
          )}
        </div>
        {oracleSources.map((s) =>
        <React.Fragment key={s.id}>
            <span className="flex min-w-0 items-center gap-1.5 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="truncate">{s.name}</span>
            </span>
            <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5 sm:gap-1">
              {devs[s.id].map((v, i) =>
            <span
              key={i}
              className="flex h-7 min-w-0 items-center justify-center rounded-sm font-mono text-[9px] text-ink sm:h-8 md:text-[10px]"
              style={cellStyle(v)}
              title={`${s.name} · ${dekadalRainfall[i].label}: ${v === null ? 'dry, not scored' : `${(v * 100).toFixed(1)}% from peers`}`}>
              
                  <span className="hidden xl:inline">{v === null ? '–' : Math.round(v * 100)}</span>
                </span>
            )}
            </div>
          </React.Fragment>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted">Grey cells are dry dekads (peers under 5 mm), excluded from scoring.</p>
    </section>);

}