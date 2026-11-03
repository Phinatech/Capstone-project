import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilterTabs } from './FilterTabs';
import { PolicyList } from './PolicyList';
import { FilterBar } from './ui/FilterBar';
import { FilterSelect } from './ui/FilterSelect';
import { ViewToggle } from './ui/ViewToggle';
import type { ViewMode } from './ui/ViewToggle';
import { usePersistentState } from '../hooks/usePersistentState';
import { crops, lgas } from '../data/policies';
import { usePolicies } from '../contexts/PolicyContext';
import { useI18n } from '../contexts/I18nContext';
import { cropName } from '../contexts/policyActivity';
import type { TranslationKey } from '../data/translations';
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

const sortOptions: {value: Sort;label: TranslationKey;}[] = [
{ value: 'newest', label: 'ui.newest' },
{ value: 'oldest', label: 'ui.oldest' },
{ value: 'payout', label: 'ui.highestPayout' },
{ value: 'threshold', label: 'ui.highestTrigger' }];


export function PolicyBrowser({ policies, basePath, showFarmer = false, storageKey }: PolicyBrowserProps) {
  const [params, setParams] = useSearchParams();
  // The contract's windows in chain mode, the seed list otherwise — never the
  // five simulated ones this filter used to offer.
  const { windows } = usePolicies();
  const { t } = useI18n();
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
      return String(p.id) === q || p.lga.toLowerCase().includes(q) || p.crop.toLowerCase().includes(q) || cropName(p.crop, t).toLowerCase().includes(q) || farmer.includes(q);
    });
    return [...list].sort((a, b) => {
      if (sort === 'oldest') return a.id - b.id;
      if (sort === 'payout') return b.payoutEth - a.payoutEth;
      if (sort === 'threshold') return b.thresholdMm - a.thresholdMm;
      return b.id - a.id;
    });
  }, [policies, query, crop, windowId, lga, sort, showFarmer, t]);

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
        searchPlaceholder={showFarmer ? t('ui.searchPoliciesFarmer') : t('ui.searchPolicies')}
        activeCount={activeCount}
        onReset={reset}
        resultCount={shown.length}
        trailing={<ViewToggle value={view} onChange={setView} />}>
        
        <FilterSelect
          label={t('purchase.crop')}
          value={crop}
          onChange={setCrop}
          options={[{ value: 'all', label: t('ui.allCrops') }, ...crops.map((c) => ({ value: c, label: cropName(c, t) }))]} />
        
        <FilterSelect
          label={t('policy.coverageWindow')}
          value={windowId}
          onChange={setWindowId}
          options={[{ value: 'all', label: t('ui.allWindows') }, ...windows.map((w) => ({ value: w.id, label: `#${w.id} · ${w.covers}` }))]} />
        
        {showFarmer &&
        <FilterSelect
          label={t('purchase.lga')}
          value={lga}
          onChange={setLga}
          options={[{ value: 'all', label: t('ui.allLgas') }, ...lgas.map((l) => ({ value: l, label: l }))]} />

        }
        <FilterSelect label={t('ui.sortBy')} value={sort} onChange={setSort} options={sortOptions.map((o) => ({ ...o, label: t(o.label) }))} />
      </FilterBar>

      <div className="scroll-area -mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full sm:min-w-0">
          <FilterTabs<StatusFilter>
            label={t('ui.filterByStatus')}
            value={status}
            onChange={setStatus}
            options={[
            { value: 'all', label: t('ui.all'), count: filtered.length },
            { value: 'active', label: t('status.active'), count: count('active') },
            { value: 'paid', label: t('status.paid'), count: count('paid') },
            { value: 'no_payout', label: t('status.noPayout'), count: count('no_payout') }]
            } />
          
        </div>
      </div>

      <PolicyList
        policies={shown}
        basePath={basePath}
        view={view}
        showFarmer={showFarmer}
        emptyMessage={t('team.noMatchBody')} />
      
    </div>);

}