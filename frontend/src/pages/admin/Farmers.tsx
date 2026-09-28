import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRightIcon, MailIcon, MapPinIcon, PhoneIcon, SproutIcon, UsersIcon } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Avatar } from '../../components/Avatar';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterBar } from '../../components/ui/FilterBar';
import { FilterSelect } from '../../components/ui/FilterSelect';
import { ViewToggle } from '../../components/ui/ViewToggle';
import type { ViewMode } from '../../components/ui/ViewToggle';
import { Modal } from '../../components/ui/Modal';
import { btnPrimary, btnSecondary } from '../../components/ui/buttons';
import { usePersistentState } from '../../hooks/usePersistentState';
import { usePolicies } from '../../contexts/PolicyContext';
import { crops, lgas } from '../../data/policies';
import { getFarmers } from '../../utils/users';
import { getWindow } from '../../utils/oracle';
import { formatDate, formatEth, shortAddress } from '../../utils/format';
import type { User } from '../../types/user';

type Sort = 'name' | 'policies' | 'cover' | 'joined';
type Activity = 'all' | 'covered' | 'uncovered';
const ease = [0.23, 1, 0.32, 1] as const;

export function Farmers() {
  const { policies, balanceOf } = usePolicies();
  const [params, setParams] = useSearchParams();
  const [view, setView] = usePersistentState<ViewMode>('sokoto-cover-view-farmers-v2', 'grid');
  const [lga, setLga] = useState('all');
  const [crop, setCrop] = useState('all');
  const [activity, setActivity] = useState<Activity>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [selected, setSelected] = useState<User | null>(null);
  const query = params.get('q') ?? '';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return getFarmers().
    map((f) => {
      const mine = policies.filter((p) => p.farmerId === f.id);
      const active = mine.filter((p) => p.status === 'active');
      return { farmer: f, mine, active, cover: active.reduce((s, p) => s + p.payoutEth, 0) };
    }).
    filter(({ farmer, active }) => {
      if (lga !== 'all' && farmer.lga !== lga) return false;
      if (crop !== 'all' && farmer.primaryCrop !== crop) return false;
      if (activity === 'covered' && active.length === 0) return false;
      if (activity === 'uncovered' && active.length > 0) return false;
      return !q || `${farmer.name} ${farmer.email} ${farmer.lga ?? ''} ${farmer.village ?? ''}`.toLowerCase().includes(q);
    }).
    sort((a, b) => {
      if (sort === 'policies') return b.mine.length - a.mine.length;
      if (sort === 'cover') return b.cover - a.cover;
      if (sort === 'joined') return b.farmer.joinedAt.localeCompare(a.farmer.joinedAt);
      return a.farmer.name.localeCompare(b.farmer.name);
    });
  }, [policies, query, lga, crop, activity, sort]);

  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });
  const activeCount = [lga, crop, activity].filter((v) => v !== 'all').length + (sort !== 'name' ? 1 : 0);
  const reset = () => {
    setLga('all');
    setCrop('all');
    setActivity('all');
    setSort('name');
  };
  const selectedPolicies = selected ? policies.filter((p) => p.farmerId === selected.id) : [];

  return (
    <div>
      <PageHeader title="Farmers" description={`${getFarmers().length} smallholders registered on the contract.`} />

      <div className="space-y-3 sm:space-y-4">
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder="Search name, email, LGA or village"
          activeCount={activeCount}
          onReset={reset}
          resultCount={rows.length}
          trailing={<ViewToggle value={view} onChange={setView} />}>
          
          <FilterSelect label="LGA" value={lga} onChange={setLga} options={[{ value: 'all', label: 'All LGAs' }, ...lgas.map((l) => ({ value: l, label: l }))]} />
          <FilterSelect
            label="Primary crop"
            value={crop}
            onChange={setCrop}
            options={[{ value: 'all', label: 'All crops' }, ...crops.map((c) => ({ value: c, label: c }))]} />
          
          <FilterSelect<Activity>
            label="Cover"
            value={activity}
            onChange={setActivity}
            options={[
            { value: 'all', label: 'Any cover' },
            { value: 'covered', label: 'Has active cover' },
            { value: 'uncovered', label: 'No active cover' }]
            } />
          
          <FilterSelect<Sort>
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
            { value: 'name', label: 'Name A–Z' },
            { value: 'policies', label: 'Most policies' },
            { value: 'cover', label: 'Most active cover' },
            { value: 'joined', label: 'Recently joined' }]
            } />
          
        </FilterBar>

        {rows.length === 0 ?
        <EmptyState icon={UsersIcon} title="No farmers match" body="Try a different search or clear your filters." /> :
        view === 'grid' ?
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {rows.map(({ farmer: f, mine, active, cover }, i) =>
          <motion.li
            key={f.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.035, ease }}
            className="min-w-0">
            
                <button
              type="button"
              onClick={() => setSelected(f)}
              className="flex h-full w-full flex-col rounded-lg border border-line bg-surface p-3.5 text-left sm:p-5 transition-[border-color,box-shadow] duration-150 ease-out hover:border-muted hover:shadow-pop focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              
                  <div className="flex items-center gap-3">
                    <Avatar name={f.name} src={f.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{f.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        <MapPinIcon className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {f.village ? `${f.village}, ` : ''}
                          {f.lga ?? '—'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 sm:mt-5 sm:pt-4">
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted">Policies</dt>
                      <dd className="mt-0.5 font-mono text-sm">
                        {active.length}
                        <span className="text-muted">/{mine.length}</span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted">Cover</dt>
                      <dd className="mt-0.5 truncate font-mono text-sm">{Number(cover.toFixed(3))}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted">Balance</dt>
                      <dd className="mt-0.5 truncate font-mono text-sm">{Number(balanceOf(f.id).toFixed(3))}</dd>
                    </div>
                  </dl>
                  <p className="mt-auto truncate pt-3 text-xs text-muted sm:pt-4">
                    {f.primaryCrop ?? 'Crop not set'} · joined {formatDate(f.joinedAt)}
                  </p>
                </button>
              </motion.li>
          )}
          </ul> :

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            <li className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-5 py-3 text-xs text-muted lg:grid">
              <span>Farmer</span>
              <span>LGA</span>
              <span>Wallet</span>
              <span className="text-right">Policies</span>
              <span className="text-right">Active cover</span>
              <span className="w-4" />
            </li>
            {rows.map(({ farmer: f, mine, active, cover }, i) =>
          <motion.li
            key={f.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03, ease }}>
            
                <button
              type="button"
              onClick={() => setSelected(f)}
              className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:bg-canvas sm:px-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={f.name} src={f.avatarUrl} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-muted">
                        <span className="lg:hidden">{f.lga} · {active.length} active · </span>
                        {f.email}
                      </span>
                    </span>
                  </span>
                  <span className="hidden truncate text-sm lg:block">{f.lga}</span>
                  <span className="hidden truncate font-mono text-xs text-muted lg:block">{shortAddress(f.wallet)}</span>
                  <span className="hidden text-right font-mono text-sm lg:block">
                    {active.length}
                    <span className="text-muted"> / {mine.length}</span>
                  </span>
                  <span className="hidden truncate text-right font-mono text-sm lg:block">{formatEth(cover)}</span>
                  <ChevronRightIcon className="h-4 w-4 text-muted transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden />
                </button>
              </motion.li>
          )}
          </ul>
        }
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="lg"
        icon={selected ? <Avatar name={selected.name} src={selected.avatarUrl} size="md" /> : undefined}
        title={selected?.name}
        description={selected ? `Farmer since ${formatDate(selected.joinedAt)}` : undefined}
        footer={
        selected &&
        <>
              <button type="button" onClick={() => setSelected(null)} className={btnSecondary}>
                Close
              </button>
              <Link to={`/admin/policies?q=${encodeURIComponent(selected.name)}`} className={btnPrimary}>
                View all policies
              </Link>
            </>

        }>
        
        {selected &&
        <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
            { icon: MailIcon, label: 'Email', value: selected.email },
            { icon: PhoneIcon, label: 'Phone', value: selected.phone ?? '—' },
            { icon: MapPinIcon, label: 'Location', value: `${selected.village ? `${selected.village}, ` : ''}${selected.lga ?? '—'}` },
            {
              icon: SproutIcon,
              label: 'Farm',
              value: `${selected.primaryCrop ?? '—'}${selected.farmSizeHa ? ` · ${selected.farmSizeHa} ha` : ''}`
            }].
            map((d) =>
            <div key={d.label} className="flex min-w-0 items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-muted">
                    <d.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{d.label}</dt>
                    <dd className="truncate text-sm">{d.value}</dd>
                  </div>
                </div>
            )}
            </dl>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
            { label: 'Wallet balance', value: formatEth(balanceOf(selected.id)) },
            { label: 'Premiums paid', value: formatEth(selectedPolicies.reduce((s, p) => s + p.premiumEth, 0)) },
            {
              label: 'Payouts received',
              value: formatEth(selectedPolicies.filter((p) => p.status === 'paid').reduce((s, p) => s + p.payoutEth, 0))
            }].
            map((s) =>
            <div key={s.label} className="min-w-0 bg-surface p-3">
                  <p className="truncate text-xs text-muted">{s.label}</p>
                  <p className="mt-0.5 truncate font-mono text-sm">{s.value}</p>
                </div>
            )}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Policies</p>
              {selectedPolicies.length === 0 ?
            <p className="text-sm text-muted">No policies yet.</p> :

            <ul className="divide-y divide-line rounded-lg border border-line">
                  {selectedPolicies.map((p) =>
              <li key={p.id}>
                      <Link
                  to={`/admin/policies/${p.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-canvas">
                  
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            #{p.id} · {p.crop}, {getWindow(p.windowId).label}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            &lt; {p.thresholdMm} mm · {formatEth(p.payoutEth)}
                          </span>
                        </span>
                        <StatusBadge status={p.status} />
                      </Link>
                    </li>
              )}
                </ul>
            }
            </div>
            <p className="break-all font-mono text-xs text-muted">{selected.wallet}</p>
          </div>
        }
      </Modal>
    </div>);

}