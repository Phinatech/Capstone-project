import React from 'react';

interface ChartCardProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({ title, hint, children, className = '', action }: ChartCardProps) {
  return (
    <section className={`min-w-0 rounded-lg border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">{title}</h2>
          {hint && <p className="line-clamp-2 text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3 sm:mt-4">{children}</div>
    </section>);

}

export const tooltipStyle: React.CSSProperties = {
  borderRadius: 6,
  border: '1px solid var(--line)',
  background: 'var(--surface-raised)',
  color: 'var(--ink)',
  fontSize: 12
};