import { useEffect, useState } from 'react';
import { ChevronRightIcon, KeyRoundIcon } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Modal } from '../ui/Modal';
import { FilterTabs } from '../FilterTabs';
import { useI18n } from '../../contexts/I18nContext';
import type { TranslationKey } from '../../data/translations';

/** A demo login the panel can fill the sign-in form with. */
export interface DemoCredential {
  email: string;
  password: string;
  role: 'farmer' | 'agent' | 'admin';
  name: string;
}

interface DemoCredentialsProps {
  onSelect: (credential: DemoCredential) => void;
  disabled?: boolean;
}

type RoleFilter = 'all' | 'farmer' | 'agent' | 'admin';

const ROLE_LABELS: Record<Exclude<RoleFilter, 'all'>, TranslationKey> = {
  farmer: 'role.farmer',
  agent: 'role.agent',
  admin: 'role.admin'
};

/**
 * The demo-accounts panel.
 *
 * The list now comes from `GET /api/demo-credentials` rather than a file
 * compiled into the production bundle, which is what shipped every demo
 * password — including the administrator's — to every visitor (F-1). The
 * endpoint answers only while `AUTH_DEMO_ACCOUNTS` is on, so a deployment
 * that turns it off renders nothing at all.
 */
export function DemoCredentials({ onSelect, disabled }: DemoCredentialsProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RoleFilter>('all');
  const [credentials, setCredentials] = useState<DemoCredential[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/demo-credentials', { credentials: 'include' });
        if (!res.ok) return;
        const body = (await res.json()) as { credentials?: unknown };
        if (!cancelled && Array.isArray(body.credentials)) {
          setCredentials(body.credentials as DemoCredential[]);
        }
      } catch {
        /* the panel simply stays closed and empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing to offer: the server has demo accounts switched off.
  if (credentials.length === 0) return null;

  const rows = role === 'all' ? credentials : credentials.filter((c) => c.role === role);
  const countFor = (r: RoleFilter) =>
    r === 'all' ? credentials.length : credentials.filter((c) => c.role === r).length;

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
            <span className="block truncate text-xs font-normal text-muted">
              {credentials.length} accounts · farmer, agent and admin
            </span>
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
            { value: 'all', label: 'All', count: countFor('all') },
            { value: 'farmer', label: t('role.farmer'), count: countFor('farmer') },
            { value: 'agent', label: t('role.agent'), count: countFor('agent') },
            { value: 'admin', label: t('role.admin'), count: countFor('admin') }]
            } />

        </div>
        <ul className="divide-y divide-line">
          {rows.map((credential) =>
          <li key={credential.email}>
              <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onSelect(credential);
              }}
              className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas focus:bg-canvas focus:outline-none disabled:opacity-60 sm:px-6">

                <Avatar name={credential.name} />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{credential.name}</span>
                    <span
                    className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium ${
                    credential.role === 'admin' ? 'bg-clay-soft text-clay' : 'bg-accent-soft text-accent-strong'}`}
                    >

                      {t(ROLE_LABELS[credential.role] ?? 'role.farmer')}
                    </span>
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted">{credential.email}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">{credential.password}</span>
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
