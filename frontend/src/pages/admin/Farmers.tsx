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
import { getTeam } from '../../utils/users';
import { useI18n } from '../../contexts/I18nContext';
import { useWindowName } from '../../contexts/PolicyContext';
import { cropName } from '../../contexts/policyActivity';
import type { Policy } from '../../types/insurance';
import { formatDate, formatEth, shortAddress } from '../../utils/format';
import type { User } from '../../types/user';

type Sort = 'name' | 'policies' | 'cover' | 'joined';
type Activity = 'all' | 'covered' | 'uncovered';
const ease = [0.23, 1, 0.32, 1] as const;

/** A farmer's own policies, or the ones an agent sold. */
const policiesOf = (u: User, policies: Policy[]) =>
policies.filter((p) => (u.role === 'agent' ? p.agentId : p.farmerId) === u.id);

export function Farmers() {
  const { policies, balanceOf, walletOf } = usePolicies();
  const [params, setParams] = useSearchParams();
  const { t } = useI18n();
  const windowName = useWindowName();
  const [view, setView] = usePersistentState<ViewMode>('sokoto-cover-view-farmers-v2', 'grid');
  const [lga, setLga] = useState('all');
  const [crop, setCrop] = useState('all');
  const [activity, setActivity] = useState<Activity>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [selected, setSelected] = useState<User | null>(null);
  const query = params.get('q') ?? '';

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return getTeam().
    map((f) => {
      const mine = policiesOf(f, policies);
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
  const selectedPolicies = selected ? policiesOf(selected, policies) : [];
  const isAgent = selected?.role === 'agent';

  return (
    <div>
      <PageHeader title={t('team.title')} description={t('team.description', { count: getTeam().length })} />

      <div className="space-y-3 sm:space-y-4">
        <FilterBar
          search={query}
          onSearch={setQuery}
          searchPlaceholder={t('team.search')}
          activeCount={activeCount}
          onReset={reset}
          resultCount={rows.length}
          trailing={<ViewToggle value={view} onChange={setView} />}>
          
          <FilterSelect label={t('purchase.lga')} value={lga} onChange={setLga} options={[{ value: 'all', label: t('ui.allLgas') }, ...lgas.map((l) => ({ value: l, label: l }))]} />
          <FilterSelect
            label={t('profile.primaryCrop')}
            value={crop}
            onChange={setCrop}
            options={[{ value: 'all', label: t('ui.allCrops') }, ...crops.map((c) => ({ value: c, label: cropName(c, t) }))]} />
          
          <FilterSelect<Activity>
            label={t('team.cover')}
            value={activity}
            onChange={setActivity}
            options={[
            { value: 'all', label: t('team.anyCover') },
            { value: 'covered', label: t('team.hasCover') },
            { value: 'uncovered', label: t('team.noCover') }]
            } />
          
          <FilterSelect<Sort>
            label={t('ui.sortBy')}
            value={sort}
            onChange={setSort}
            options={[
            { value: 'name', label: t('team.sortName') },
            { value: 'policies', label: t('team.sortPolicies') },
            { value: 'cover', label: t('team.sortCover') },
            { value: 'joined', label: t('team.sortJoined') }]
            } />
          
        </FilterBar>

        {rows.length === 0 ?
        <EmptyState icon={UsersIcon} title={t('team.noMatch')} body={t('team.noMatchBody')} /> :
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
                      <p className="flex items-center gap-2 truncate font-semibold">
                        {f.name}
                        {f.role === 'agent' &&
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-strong">
                            {t('team.agent')}
                          </span>
                        }
                      </p>
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
                      <dt className="truncate text-xs text-muted">{t(f.role === 'agent' ? 'team.policiesSold' : 'team.policies')}</dt>
                      <dd className="mt-0.5 font-mono text-sm">
                        {active.length}
                        <span className="text-muted">/{mine.length}</span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted">{t('team.cover')}</dt>
                      <dd className="mt-0.5 truncate font-mono text-sm">{Number(cover.toFixed(3))}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted">{t('team.balance')}</dt>
                      <dd className="mt-0.5 truncate font-mono text-sm">{Number(balanceOf(f.id).toFixed(3))}</dd>
                    </div>
                  </dl>
                  <p className="mt-auto truncate pt-3 text-xs text-muted sm:pt-4">
                    {f.role === 'agent' ? t('role.agent') : f.primaryCrop ? cropName(f.primaryCrop, t) : t('team.cropNotSet')} · {t('team.joined', { date: formatDate(f.joinedAt) })}
                  </p>
                </button>
              </motion.li>
          )}
          </ul> :

        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            <li className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-5 py-3 text-xs text-muted lg:grid">
              <span>{t('team.colPerson')}</span>
              <span>{t('team.colLga')}</span>
              <span>{t('team.colWallet')}</span>
              <span className="text-right">{t('team.policies')}</span>
              <span className="text-right">{t('team.colActiveCover')}</span>
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
                      <span className="flex items-center gap-2 truncate text-sm font-medium">
                        {f.name}
                        {f.role === 'agent' &&
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-strong">
                            {t('team.agent')}
                          </span>
                        }
                      </span>
                      <span className="block truncate text-xs text-muted">
                        <span className="lg:hidden">{f.lga} · {t('team.activeCount', { count: active.length })} · </span>
                        {f.email}
                      </span>
                    </span>
                  </span>
                  <span className="hidden truncate text-sm lg:block">{f.lga}</span>
                  <span className="hidden truncate font-mono text-xs text-muted lg:block">{shortAddress(walletOf(f))}</span>
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
        description={selected ? t(isAgent ? 'team.agentSince' : 'team.farmerSince', { date: formatDate(selected.joinedAt) }) : undefined}
        footer={
        selected &&
        <>
              <button type="button" onClick={() => setSelected(null)} className={btnSecondary}>
                {t('common.close')}
              </button>
              <Link to={`/admin/policies?q=${encodeURIComponent(selected.name)}`} className={btnPrimary}>
                {t('team.viewPolicies')}
              </Link>
            </>

        }>
        
        {selected &&
        <div className="space-y-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
            { icon: MailIcon, label: t('profile.email'), value: selected.email },
            { icon: PhoneIcon, label: t('profile.phone'), value: selected.phone ?? '—' },
            { icon: MapPinIcon, label: t('profile.location'), value: `${selected.village ? `${selected.village}, ` : ''}${selected.lga ?? '—'}` },
            {
              icon: SproutIcon,
              label: t('team.farm'),
              value: `${selected.primaryCrop ? cropName(selected.primaryCrop, t) : '—'}${selected.farmSizeHa ? ` · ${selected.farmSizeHa} ha` : ''}`
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
            { label: t('profile.walletBalance'), value: formatEth(balanceOf(selected.id)) },
            { label: t(isAgent ? 'team.premiumsCollected' : 'team.premiumsPaid'), value: formatEth(selectedPolicies.reduce((s, p) => s + p.premiumEth, 0)) },
            {
              label: t(isAgent ? 'team.paidOut' : 'team.payoutsReceived'),
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
              <p className="mb-2 text-sm font-semibold">{t('team.policies')}</p>
              {selectedPolicies.length === 0 ?
            <p className="text-sm text-muted">{t('team.noPolicies')}</p> :

            <ul className="divide-y divide-line rounded-lg border border-line">
                  {selectedPolicies.map((p) =>
              <li key={p.id}>
                      <Link
                  to={`/admin/policies/${p.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 hover:bg-canvas">
                  
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            #{p.id} · {cropName(p.crop, t)}, {windowName(p.windowId)}
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
            <p className="break-all font-mono text-xs text-muted">{walletOf(selected)}</p>
          </div>
        }
      </Modal>
    </div>);

}