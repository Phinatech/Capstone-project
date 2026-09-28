import { useState } from 'react';
import { ChevronRightIcon, KeyRoundIcon } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Modal } from '../ui/Modal';
import { FilterTabs } from '../FilterTabs';
import { demoCredentials } from '../../data/demoCredentials';
import type { DemoCredential } from '../../data/demoCredentials';
import { findUser } from '../../utils/users';
import { useI18n } from '../../contexts/I18nContext';

interface DemoCredentialsProps {
  onSelect: (credential: DemoCredential) => void;
  disabled?: boolean;
}

type RoleFilter = 'all' | 'farmer' | 'admin';

export function DemoCredentials({ onSelect, disabled }: DemoCredentialsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RoleFilter>('all');

  const rows = demoCredentials.
  map((c) => ({ c, u: findUser(c.userId) })).
  filter((r): r is {c: DemoCredential;u: NonNullable<ReturnType<typeof findUser>>;} => !!r.u);
  const shown = role === 'all' ? rows : rows.filter((r) => r.u.role === role);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3 text-left text-sm font-medium transition-colors duration-150 ease-out hover:border-muted hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60">
        
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong">
            <KeyRoundIcon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{t('auth.demoCredentials')}</span>
            <span className="block truncate text-xs font-normal text-muted">{rows.length} accounts · farmer and admin</span>
          </span>
        </span>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        placement="center"
        size="md"
        bodyClassName="p-0"
        icon={
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent-strong">
            <KeyRoundIcon className="h-4 w-4" aria-hidden />
          </span>
        }
        title={t('auth.demoCredentials')}
        description={t('auth.demoHint')}>
        
        <div className="border-b border-line px-4 pb-3 pt-2 sm:px-6">
          <FilterTabs<RoleFilter>
            label="Filter by role"
            value={role}
            onChange={setRole}
            options={[
            { value: 'all', label: 'All', count: rows.length },
            { value: 'farmer', label: t('role.farmer'), count: rows.filter((r) => r.u.role === 'farmer').length },
            { value: 'admin', label: t('role.admin'), count: rows.filter((r) => r.u.role === 'admin').length }]
            } />
          
        </div>
        <ul className="divide-y divide-line">
          {shown.map(({ c, u }) =>
          <li key={c.userId}>
              <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onSelect(c);
              }}
              className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas focus:bg-canvas focus:outline-none disabled:opacity-60 sm:px-6">
              
                <Avatar name={u.name} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{u.name}</span>
                    <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                    u.role === 'admin' ? 'bg-clay-soft text-clay' : 'bg-accent-soft text-accent-strong'}`
                    }>
                    
                      {t(u.role === 'admin' ? 'role.admin' : 'role.farmer')}
                    </span>
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">{c.email}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">{c.password}</span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-accent">
                  <span className="hidden sm:inline">{t('auth.signIn')}</span>
                  <ChevronRightIcon className="h-4 w-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5" aria-hidden />
                </span>
              </button>
            </li>
          )}
        </ul>
      </Modal>
    </>);

}