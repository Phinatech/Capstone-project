import React, { useState } from 'react';
import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { btnGhost, btnPrimary, btnSecondary } from './buttons';

interface FilterBarProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  activeCount: number;
  onReset: () => void;
  resultCount: number;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}

const iconBtn =
'relative flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:border-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:h-10 sm:px-3';

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder,
  activeCount,
  onReset,
  resultCount,
  children,
  trailing
}: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const results = `${resultCount} ${resultCount === 1 ? 'result' : 'results'}`;

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {/* Phones: search opens in a modal so the toolbar stays one compact row */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-haspopup="dialog"
          className={`${iconBtn} min-w-0 flex-1 justify-start text-muted sm:hidden`}>
          
          <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className={`truncate text-left text-[13px] font-normal ${search ? 'text-ink' : ''}`}>{search || searchPlaceholder}</span>
        </button>
        {search &&
        <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className={`${iconBtn} w-9 px-0 sm:hidden`}>
            <XIcon className="h-4 w-4" aria-hidden />
          </button>
        }
        <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`${iconBtn} lg:hidden`}
          aria-label={`Filters${activeCount ? `, ${activeCount} active` : ''}`}>
          
          <SlidersHorizontalIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 &&
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          }
        </button>
        {trailing}
      </div>

      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-2">{children}</div>
        {activeCount > 0 &&
        <button type="button" onClick={onReset} className={btnGhost}>
            Clear filters
          </button>
        }
      </div>

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        placement="top"
        title="Search"
        description={results}
        size="sm">
        
        <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} autoFocus onEnter={() => setSearchOpen(false)} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onSearch('')} className={btnSecondary} disabled={!search}>
            Clear
          </button>
          <button type="button" onClick={() => setSearchOpen(false)} className={btnPrimary}>
            Show {results}
          </button>
        </div>
      </Modal>

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        description={`${results} match`}
        size="sm"
        placement="center"
        footer={
        <>
            <button type="button" onClick={onReset} className={btnSecondary} disabled={activeCount === 0}>
              Clear all
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className={btnPrimary}>
              Show {resultCount}
            </button>
          </>
        }>
        
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      </Modal>
    </div>);

}