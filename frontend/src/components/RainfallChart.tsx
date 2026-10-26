import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { oracleSources } from '../data/rainfall';
import { useRainfallSeries } from '../hooks/useRainfallSeries';

export function RainfallChart() {
  const { dekads, live } = useRainfallSeries();

  const data = dekads.map((d) => {
    const reported = [d.chirps, d.nasa, d.meteostat].filter((v): v is number => v !== null);
    return {
      label: d.label,
      chirps: d.chirps,
      nasa: d.nasa,
      meteostat: d.meteostat,
      // Against the contracts there is no gauge, so compare with what the sources agreed.
      reference: live ? (reported.length ? reported.reduce((a, b) => a + b, 0) / reported.length : null) : d.reference
    };
  });

  const range = dekads.length ? `${dekads[0].label} to ${dekads[dekads.length - 1].label}` : 'no dekads yet';
  const compareName = live ? 'Mean of the sources' : 'Gauge reference';

  return (
    <div className="h-72 w-full" role="img" aria-label={`Dekadal rainfall for Sokoto, ${range}, from ${live ? 'readings submitted on-chain by three sources' : 'three sources and the gauge reference'}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={Math.max(0, Math.floor(data.length / 8))} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} unit=" mm" width={64} />
          <Tooltip
            contentStyle={{ borderRadius: 6, border: '1px solid var(--line)', fontSize: 12 }}
            formatter={(v) => `${v} mm`} />

          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {oracleSources.map((s) =>
          <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          )}
          <Line
            type="monotone"
            dataKey="reference"
            name={compareName}
            stroke="var(--ink)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false} />

        </LineChart>
      </ResponsiveContainer>
    </div>);

}
