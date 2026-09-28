
interface FilterTabsProps<T extends string> {
  label: string;
  options: {value: T;label: string;count?: number;}[];
  value: T;
  onChange: (value: T) => void;
}

export function FilterTabs<T extends string>({ label, options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-md bg-surface p-1 ring-1 ring-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded px-2.5 py-1 text-[13px] font-medium sm:px-3 sm:py-1.5 sm:text-sm transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            active ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:text-ink'}`
            }>
            
            {o.label}
            {o.count !== undefined && <span className="font-mono text-xs opacity-70">{o.count}</span>}
          </button>);

      })}
    </div>);

}