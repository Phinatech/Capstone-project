import { SearchIcon, XIcon } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}

export function SearchInput({ value, onChange, placeholder, className = '', autoFocus, onEnter }: SearchInputProps) {
  return (
    <label className={`relative block min-w-0 ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        data-autofocus={autoFocus ? true : undefined}
        enterKeyHint="search"
        className="h-10 w-full rounded-md border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft [&::-webkit-search-cancel-button]:hidden" />
      
      {value &&
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted hover:text-ink">
        
          <XIcon className="h-3.5 w-3.5" aria-hidden />
        </button>
      }
    </label>);

}