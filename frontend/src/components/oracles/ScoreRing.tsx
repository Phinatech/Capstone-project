
interface ScoreRingProps {
  value: number;
  color: string;
  size?: number;
  label?: string;
}

/** Circular 0–100 score indicator. */
export function ScoreRing({ value, color, size = 56, label }: ScoreRingProps) {
  const stroke = size >= 56 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${pct.toFixed(0)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)} />
        
      </svg>
      <span className={`absolute font-mono font-semibold ${size >= 56 ? 'text-sm' : 'text-xs'}`}>{pct.toFixed(0)}</span>
    </span>);

}