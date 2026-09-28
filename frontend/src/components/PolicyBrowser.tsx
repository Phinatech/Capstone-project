import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterTabs } from './FilterTabs';
import { PolicyList } from './PolicyList';
import { FilterBar } from './ui/FilterBar';
import { FilterSelect } from './ui/FilterSelect';
import { ViewToggle } from './ui/ViewToggle';
import type { ViewMode } from './ui/ViewToggle';
import { usePersistentState } from '../hooks/usePersistentState';
import { coverageWindows, crops, lgas } from '../data/policies';
import { findUser } from '../utils/users';
import type { Policy, PolicyStatus } from '../types/insurance';

type StatusFilter = 'all' | PolicyStatus;
type Sort = 'newest' | 'oldest' | 'payout' | 'threshold';

interface PolicyBrowserProps {
  policies: Policy[];
  basePath: string;
  showFarmer?: boolean;
  storageKey: string;
}

const sortOptions: {value: Sort;label: string;}[] = [
{ value: 'newest', label: 'Newest first' },
{ value: 'oldest', label: 'Oldest first' },
{ value: 'payout', label: 'Highest payout' },
{ value: 'threshold', label: 'Highest trigger' }];


export function PolicyBrowser({ policies, basePath, showFarmer = false, storageKey }: PolicyBrowserProps) {
  const [params, setParams] = useSearchParams();
  const [view, setView] = usePersistentState<ViewMode>(`sokoto-cover-view-${storageKey}-v2`, 'grid');
  const [status, setStatus] = useState<StatusFilter>(params.get('status') as StatusFilter ?? 'all');
  const [crop, setCrop] = useState('all');
  const [windowId, setWindowId] = useState('all');
  const [lga, setLga] = useState('all');
  const [sort, setSort] = useState<Sort>('newest');
  const query = params.get('q') ?? '';

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params);
    if (q) next.set('q', q);else
    next.delete('q');
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace('#', '');
    const list = policies.filter((p) => {
      if (crop !== 'all' && p.crop !== crop) return false;
      if (windowId !== 'all' && p.windowId !== windowId) return false;
      if (lga !== 'all' && p.lga !== lga) return false;
      if (!q) return true;
      const farmer = showFarmer ? findUser(p.farmerId)?.name.toLowerCase() ?? '' : '';
      return String(p.id) === q || p.lga.toLowerCase().includes(q) || p.crop.toLowerCase().includes(q) || farmer.includes(q);
    });
    return [...list].sort((a, b) => {
      if (sort === 'oldest') return a.id - b.id;
      if (sort === 'payout') return b.payoutEth - a.payoutEth;
      if (sort === 'threshold') return b.thresholdMm - a.thresholdMm;
      return b.id - a.id;
    });
  }, [policies, query, crop, windowId, lga, sort, showFarmer]);

  const shown = status === 'all' ? filtered : filtered.filter((p) => p.status === status);
  const count = (s: PolicyStatus) => filtered.filter((p) => p.status === s).length;
  const activeCount = [crop, windowId, lga].filter((v) => v !== 'all').length + (sort !== 'newest' ? 1 : 0);
  const reset = () => {
    setCrop('all');
    setWindowId('all');
    setLga('all');
    setSort('newest');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <FilterBar
        search={query}
        onSearch={setQuery}
        searchPlaceholder={showFarmer ? 'Search farmer, LGA, crop or #id' : 'Search LGA, crop or #id'}
        activeCount={activeCount}
        onReset={reset}
        resultCount={shown.length}
        trailing={<ViewToggle value={view} onChange={setView} />}>
        
        <FilterSelect
          label="Crop"
          value={crop}
          onChange={setCrop}
          options={[{ value: 'all', label: 'All crops' }, ...crops.map((c) => ({ value: c, label: c }))]} />
        
        <FilterSelect
          label="Coverage window"
          value={windowId}
          onChange={setWindowId}
          options={[{ value: 'all', label: 'All windows' }, ...coverageWindows.map((w) => ({ value: w.id, label: w.label }))]} />
        
        {showFarmer &&
        <FilterSelect
          label="LGA"
          value={lga}
          onChange={setLga}
          options={[{ value: 'all', label: 'All LGAs' }, ...lgas.map((l) => ({ value: l, label: l }))]} />

        }
        <FilterSelect label="Sort by" value={sort} onChange={setSort} options={sortOptions} />
      </FilterBar>

      <div className="scroll-area -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full sm:min-w-0">
          <FilterTabs<StatusFilter>
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
            { value: 'all', label: 'All', count: filtered.length },
            { value: 'active', label: 'Active', count: count('active') },
            { value: 'paid', label: 'Paid out', count: count('paid') },
            { value: 'no_payout', label: 'No payout', count: count('no_payout') }]
            } />
          
        </div>
      </div>

      <PolicyList
        policies={shown}
        basePath={basePath}
        view={view}
        showFarmer={showFarmer}
        emptyMessage="Try a different search or clear your filters." />
      
    </div>);

}