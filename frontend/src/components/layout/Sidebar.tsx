import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudRainIcon, LogOutIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon } from 'lucide-react';
import { Brand } from './Brand';
import { Avatar } from '../Avatar';
import { isNavActive, navSections } from './navigation';
import { useI18n } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { User } from '../../types/user';

interface SidebarProps {
  user: User;
  collapsed: boolean;
  onToggle: () => void;
}

interface Tip {
  label: string;
  top: number;
}

const ease = [0.23, 1, 0.32, 1] as const;

export function Sidebar({ user, collapsed, onToggle }: SidebarProps) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const ui = useUI();
  const { unreadCount } = useNotifications();
  const [tip, setTip] = useState<Tip | null>(null);
  const sections = navSections[user.role];
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  const tipProps = (label: string) =>
  collapsed ?
  {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, top: r.top + r.height / 2 });
    },
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, top: r.top + r.height / 2 });
    },
    onBlur: () => setTip(null)
  } :
  {};

  const itemBase =
  'relative flex h-9 items-center rounded-md text-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <aside
      className={`relative hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex ${
      collapsed ? 'w-[72px]' : 'w-64'}`
      }>
      
      <div className={`flex h-16 shrink-0 items-center border-b border-line ${collapsed ? 'justify-center px-2' : 'justify-between gap-2 pl-5 pr-3'}`}>
        {collapsed ?
        <Link
          to={`/${user.role}`}
          aria-label={t('brand.name')}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          
            <CloudRainIcon className="h-4 w-4" aria-hidden />
          </Link> :

        <>
            <Brand to={`/${user.role}`} />
            <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-canvas hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            
              <PanelLeftCloseIcon className="h-4 w-4" aria-hidden />
            </button>
          </>
        }
      </div>

      <div className={`pt-3 ${collapsed ? 'px-3' : 'px-3'}`}>
        <button
          type="button"
          onClick={() => ui.open('search')}
          aria-label={t('nav.search')}
          {...tipProps(t('nav.search'))}
          className={`flex h-9 w-full items-center rounded-md border border-line bg-canvas text-sm text-muted transition-colors duration-150 ease-out hover:border-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          collapsed ? 'justify-center' : 'gap-2.5 px-3'}`
          }>
          
          <SearchIcon className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed &&
          <>
              <span className="flex-1 truncate text-left">{t('nav.search')}…</span>
              <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </>
          }
        </button>
      </div>

      <nav aria-label="Sidebar" className="scroll-area flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" onScroll={() => setTip(null)}>
        {sections.map((section, si) =>
        <div key={section.titleKey} className={si > 0 ? 'mt-4' : ''}>
            {collapsed ?
          si > 0 && <div className="mx-2 mb-4 h-px bg-line" aria-hidden /> :

          <p className="mb-1 truncate px-3 text-[11px] font-medium text-muted">{t(section.titleKey)}</p>
          }
            <ul className="space-y-0.5">
              {section.items.map((item) => {
              const active = isNavActive(item, pathname);
              const Icon = item.icon;
              const count = item.badge === 'notifications' ? unreadCount : 0;
              const label = t(item.labelKey);
              return (
                <li key={item.to}>
                    <Link
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? label : undefined}
                    {...tipProps(label)}
                    className={`${itemBase} ${collapsed ? 'justify-center' : 'gap-3 px-3'} ${
                    active ? 'text-accent-strong' : 'text-muted hover:bg-canvas hover:text-ink'}`
                    }>
                    
                      {active &&
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-md bg-accent-soft"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      aria-hidden />

                    }
                      {active && !collapsed && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" aria-hidden />}
                      <Icon className="relative h-4 w-4 shrink-0" aria-hidden />
                      {!collapsed && <span className="relative min-w-0 flex-1 truncate">{label}</span>}
                      {count > 0 && (
                    collapsed ?
                    <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" aria-label={`${count} unread`} /> :

                    <span className="relative rounded-full bg-accent px-1.5 py-px font-mono text-[10px] font-semibold text-white">
                            {count > 99 ? '99+' : count}
                          </span>)
                    }
                    </Link>
                  </li>);

            })}
            </ul>
          </div>
        )}
      </nav>

      {!collapsed &&
      <div className="mx-3 mb-3 rounded-md border border-line bg-canvas px-3 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" aria-hidden />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="truncate">{t('top.testnet')}</span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted">{t('top.sidebarNote')}</p>
        </div>
      }

      <div className={`border-t border-line ${collapsed ? 'space-y-1 px-3 py-3' : 'p-3'}`}>
        {collapsed ?
        <>
            <Link
            to={`/${user.role}/profile`}
            aria-label={user.name}
            {...tipProps(user.name)}
            className="flex justify-center rounded-md py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            
              <Avatar name={user.name} src={user.avatarUrl} />
            </Link>
            <button
            type="button"
            onClick={() => ui.open('signOut')}
            aria-label={t('menu.signOut')}
            {...tipProps(t('menu.signOut'))}
            className={`${itemBase} w-full justify-center text-muted hover:bg-danger-soft hover:text-danger`}>
            
              <LogOutIcon className="h-4 w-4" aria-hidden />
            </button>
            <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            {...tipProps('Expand sidebar')}
            className={`${itemBase} w-full justify-center text-muted hover:bg-canvas hover:text-ink`}>
            
              <PanelLeftOpenIcon className="h-4 w-4" aria-hidden />
            </button>
          </> :

        <div className="flex items-center gap-2">
            <Link
            to={`/${user.role}/profile`}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1.5 py-1.5 transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            
              <Avatar name={user.name} src={user.avatarUrl} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted">{t(user.role === 'admin' ? 'role.admin' : 'role.farmer')}</span>
              </span>
            </Link>
            <button
            type="button"
            onClick={() => ui.open('signOut')}
            aria-label={t('menu.signOut')}
            title={t('menu.signOut')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 ease-out hover:bg-danger-soft hover:text-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            
              <LogOutIcon className="h-4 w-4" aria-hidden />
            </button>
          </div>
        }
      </div>

      <AnimatePresence>
        {collapsed && tip &&
        <motion.div
          key={tip.label}
          role="tooltip"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease }}
          className="pointer-events-none fixed left-[80px] z-[70] -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-canvas shadow-pop"
          style={{ top: tip.top }}>
          
            {tip.label}
          </motion.div>
        }
      </AnimatePresence>
    </aside>);

}