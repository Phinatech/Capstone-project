import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BellIcon, CheckIcon, ChevronDownIcon, CompassIcon, CopyIcon, LogOutIcon, SettingsIcon, SparklesIcon, UserIcon } from 'lucide-react';
import { Avatar } from '../Avatar';
import { DropdownPanel, menuItemClass } from '../DropdownPanel';
import { useDismiss } from '../../hooks/useDismiss';
import { useI18n } from '../../contexts/I18nContext';
import { usePolicies } from '../../contexts/PolicyContext';
import { useUI } from '../../contexts/UIContext';
import { shortAddress } from '../../utils/format';
import type { User } from '../../types/user';

export function ProfileMenu({ user }: {user: User;}) {
  const { t } = useI18n();
  const ui = useUI();
  const wallet = usePolicies().walletOf(user);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => setOpen(false), [pathname]);

  async function copyWallet() {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {

      /* clipboard unavailable */}
  }

  const openModal = (name: 'whatsNew' | 'welcome' | 'signOut') => {
    close();
    ui.open(name);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.name}
        className="flex min-w-0 items-center gap-2 rounded-md p-1 transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-accent xl:pr-2">
        
        <Avatar name={user.name} src={user.avatarUrl} />
        <span className="hidden min-w-0 max-w-[140px] text-left leading-tight xl:block">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted">{t(user.role === 'admin' ? 'role.admin' : 'role.farmer')}</span>
        </span>
        <ChevronDownIcon
          className={`hidden h-4 w-4 text-muted transition-transform duration-150 ease-out xl:block ${open ? 'rotate-180' : ''}`}
          aria-hidden />
        
      </button>

      <DropdownPanel open={open} className="w-[min(288px,calc(100vw-1.5rem))]">
        <div className="flex items-center gap-3 border-b border-line p-4">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs text-muted">{t('menu.wallet')}</p>
          <button
            type="button"
            onClick={copyWallet}
            className="mt-1 flex w-full items-center justify-between rounded-md bg-canvas px-2.5 py-1.5 font-mono text-xs transition-colors duration-150 ease-out hover:bg-line focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            
            {shortAddress(wallet)}
            {copied ?
            <CheckIcon className="h-3.5 w-3.5 text-accent" aria-label={t('menu.copied')} /> :

            <CopyIcon className="h-3.5 w-3.5 text-muted" aria-label={t('menu.copyWallet')} />
            }
          </button>
        </div>
        <ul className="py-1.5">
          <li>
            <Link to={`/${user.role}/profile`} role="menuitem" className={menuItemClass}>
              <UserIcon className="h-4 w-4 text-muted" aria-hidden />
              {t('menu.yourProfile')}
            </Link>
          </li>
          <li>
            <Link to={`/${user.role}/notifications`} role="menuitem" className={menuItemClass}>
              <BellIcon className="h-4 w-4 text-muted" aria-hidden />
              {t('nav.notifications')}
            </Link>
          </li>
          <li>
            <Link to={`/${user.role}/settings`} role="menuitem" className={menuItemClass}>
              <SettingsIcon className="h-4 w-4 text-muted" aria-hidden />
              {t('nav.settings')}
            </Link>
          </li>
        </ul>
        <ul className="border-t border-line py-1.5">
          <li>
            <button type="button" role="menuitem" onClick={() => openModal('whatsNew')} className={menuItemClass}>
              <SparklesIcon className="h-4 w-4 text-muted" aria-hidden />
              {t('menu.whatsNew')}
            </button>
          </li>
          <li>
            <button type="button" role="menuitem" onClick={() => openModal('welcome')} className={menuItemClass}>
              <CompassIcon className="h-4 w-4 text-muted" aria-hidden />
              {t('menu.tour')}
            </button>
          </li>
        </ul>
        <div className="border-t border-line py-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => openModal('signOut')}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-danger transition-colors duration-150 ease-out hover:bg-danger-soft focus:bg-danger-soft focus:outline-none">
            
            <LogOutIcon className="h-4 w-4" aria-hidden />
            {t('menu.signOut')}
          </button>
        </div>
      </DropdownPanel>
    </div>);

}