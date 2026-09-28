import { ChevronDownIcon } from 'lucide-react';

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: {value: T;label: string;}[];
}

export function FilterSelect<T extends string>({ label, value, onChange, options }: FilterSelectProps<T>) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-muted lg:sr-only">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          aria-label={label}
          className="h-10 w-full appearance-none truncate rounded-md border border-line bg-surface pl-3 pr-8 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft">
          
          {options.map((o) =>
          <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      </span>
    </label>);

}