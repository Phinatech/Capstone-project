import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { FilterTabs } from '../../components/FilterTabs';
import { ChartCard, tooltipStyle } from '../../components/analytics/ChartCard';
import { KpiStrip } from '../../components/analytics/KpiStrip';
import { usePolicies } from '../../contexts/PolicyContext';
import { contractPoolStartEth } from '../../data/policies';
import { configurationProfiles } from '../../data/configurations';
import { byCrop, byLga, byStatus, byWindow, portfolioStats, triggerMargins } from '../../utils/analytics';
import { runBacktest } from '../../utils/oracle';
import { formatEth } from '../../utils/format';

type Crop = 'all' | 'Millet' | 'Sorghum';
const axis = { fontSize: 10, fill: 'var(--muted)' };

export function Analytics() {
  const { policies } = usePolicies();
  const [crop, setCrop] = useState<Crop>('all');
  const scoped = crop === 'all' ? policies : policies.filter((p) => p.crop === crop);

  const stats = portfolioStats(scoped);
  const all = portfolioStats(policies);
  const pool = contractPoolStartEth + all.premiums - all.payouts;
  const windows = byWindow(scoped);
  const lgaRows = byLga(scoped);
  const status = byStatus(scoped);
  const crops = byCrop(policies);
  const margins = triggerMargins(scoped);
  const wouldPay = margins.filter((m) => m.ratio > 1).length;
  const backtest = useMemo(
    () =>
    runBacktest().map((r) => ({
      name: configurationProfiles.find((p) => p.mode === r.mode)!.shortName,
      clean: Math.round(r.cleanAccuracy * 1000) / 10,
      corrupted: Math.round(r.corruptedAccuracy * 1000) / 10
    })),
    []
  );
  const maxLga = Math.max(...lgaRows.map((r) => r.cover), 0.0001);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Portfolio health, where cover is concentrated, and how the oracle designs compare."
        actions={
        <FilterTabs<Crop>
          label="Crop"
          value={crop}
          onChange={setCrop}
          options={[
          { value: 'all', label: 'All crops' },
          ...crops.map((c) => ({ value: c.crop as Crop, label: c.crop, count: c.count }))]
          } />

        } />
      

      <div className="space-y-3 sm:space-y-6">
        <KpiStrip stats={stats} pool={pool} />

        <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
          <ChartCard title="Cover by coverage window" hint="Open exposure and paid-out cover, in ETH" className="lg:col-span-2">
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={windows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={0} tickFormatter={(v: string) => v.split(' ')[0]} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--canvas)' }} formatter={(v) => formatEth(Number(v))} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="active" name="Open exposure" stackId="a" fill="var(--accent)" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="paid" name="Paid out" stackId="a" fill="var(--clay)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Policy status" hint={`${stats.policies} policies`}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:grid-cols-1">
              <div className="relative h-36 sm:h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={status} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                      {status.map((s) =>
                      <Cell key={s.key} fill={s.color} />
                      )}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-xl font-semibold">{stats.policies}</span>
                  <span className="text-[10px] text-muted">policies</span>
                </div>
              </div>
              <ul className="space-y-1.5 lg:grid lg:grid-cols-3 lg:gap-2 lg:space-y-0">
                {status.map((s) =>
                <li key={s.key} className="flex min-w-0 items-center gap-2 text-xs lg:flex-col lg:items-start lg:gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="truncate text-muted">{s.label}</span>
                    </span>
                    <span className="font-mono font-medium">{s.value}</span>
                  </li>
                )}
              </ul>
            </div>
          </ChartCard>
        </div>

        <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
          <ChartCard title="Cover by LGA" hint="Total cover written per local government area">
            {lgaRows.length === 0 ?
            <p className="py-8 text-center text-sm text-muted">No policies for this crop.</p> :

            <ul className="space-y-2.5">
                {lgaRows.map((r) =>
              <li key={r.lga} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span className="truncate">{r.lga}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-canvas">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${r.cover / maxLga * 100}%` }} />
                    </span>
                    <span className="w-24 truncate text-right font-mono text-xs">
                      {formatEth(r.cover)} <span className="text-muted">· {r.count}</span>
                    </span>
                  </li>
              )}
              </ul>
            }
          </ChartCard>

          <ChartCard title="Oracle design accuracy" hint="Backtest accuracy, clean data vs one source corrupted (%)">
            <div className="h-52 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={backtest} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barGap={4}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                  <YAxis domain={[0, 100]} tick={axis} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--canvas)' }} formatter={(v) => `${v}%`} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="clean" name="Clean" fill="var(--muted)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="corrupted" name="Corrupted" fill="var(--accent)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Trigger vs 2023 rainfall"
          hint="Each policy's trigger as a share of the gauge total for its window. Above 100% means the 2023 season would have paid."
          action={
          <span className="shrink-0 rounded-full bg-clay-soft px-2 py-0.5 text-[11px] font-medium text-clay">
              {wouldPay}/{margins.length} would pay
            </span>
          }>
          
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {margins.map((m) => {
              const pct = Math.min(m.ratio, 1.5) / 1.5;
              return (
                <li key={m.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-xs">
                  <span className="font-mono text-muted">#{m.id}</span>
                  <span className="relative h-2 rounded-full bg-canvas">
                    <span className={`block h-full rounded-full ${m.ratio > 1 ? 'bg-clay' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} />
                    <span className="absolute -top-0.5 h-3 w-px bg-ink" style={{ left: `${1 / 1.5 * 100}%` }} aria-hidden />
                  </span>
                  <span className="text-right font-mono">{Math.round(m.ratio * 100)}%</span>
                </li>);

            })}
          </ul>
        </ChartCard>
      </div>
    </div>);

}