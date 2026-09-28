import { LayoutGridIcon, ListIcon } from 'lucide-react';

export type ViewMode = 'list' | 'grid';

interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const options: {value: ViewMode;label: string;icon: typeof ListIcon;}[] = [
{ value: 'list', label: 'List view', icon: ListIcon },
{ value: 'grid', label: 'Card view', icon: LayoutGridIcon }];


export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div role="radiogroup" aria-label="View" className="flex h-9 shrink-0 items-center rounded-md border border-line bg-surface p-0.5 sm:h-10">
      {options.map((o) => {
        const active = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => onChange(o.value)}
            className={`flex h-full w-8 items-center sm:w-9 justify-center rounded transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            active ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:text-ink'}`
            }>
            
            <Icon className="h-4 w-4" aria-hidden />
          </button>);

      })}
    </div>);

}