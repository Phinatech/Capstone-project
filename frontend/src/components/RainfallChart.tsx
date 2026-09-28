import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dekadalRainfall, oracleSources } from '../data/rainfall';

export function RainfallChart() {
  return (
    <div className="h-72 w-full" role="img" aria-label="Dekadal rainfall for Sokoto, June to October 2023, from three sources and the gauge reference">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dekadalRainfall} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={2} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} unit=" mm" width={64} />
          <Tooltip
            contentStyle={{ borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
            formatter={(v) => `${v} mm`} />
          
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {oracleSources.map((s) =>
          <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          )}
          <Line
            type="monotone"
            dataKey="reference"
            name="Gauge reference"
            stroke="var(--ink)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false} />
          
        </LineChart>
      </ResponsiveContainer>
    </div>);

}