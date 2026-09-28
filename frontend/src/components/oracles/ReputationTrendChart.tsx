import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { oracleSources } from '../../data/rainfall';
import { reputationTrend } from '../../utils/oracle';

export function ReputationTrendChart() {
  const data = useMemo(() => reputationTrend(), []);
  return (
    <div className="h-56 w-full sm:h-64" role="img" aria-label="Cumulative reputation score of each source across the 2023 season">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={3} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={{ borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface-raised)', color: 'var(--ink)', fontSize: 12 }}
            formatter={(v) => Number(v).toFixed(1)} />
          
          {oracleSources.map((s) =>
          <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>);

}