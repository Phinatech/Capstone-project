import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellIcon, CheckCheckIcon } from 'lucide-react';
import { DropdownPanel, iconButtonClass } from '../DropdownPanel';
import { NotificationIcon } from './NotificationIcon';
import { useDismiss } from '../../hooks/useDismiss';
import { useNotifications } from '../../contexts/NotificationContext';
import { useI18n } from '../../contexts/I18nContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { formatRelative } from '../../utils/format';
import type { Role } from '../../types/user';

export function NotificationBell({ role }: {role: Role;}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { prefs } = usePreferences();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => setOpen(false), [pathname]);

  const shown = (tab === 'unread' ? notifications.filter((n) => !n.read) : notifications).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('notif.title')}${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className={`${iconButtonClass} relative`}>
        
        <BellIcon className="h-[18px] w-[18px]" aria-hidden />
        <AnimatePresence>
          {unreadCount > 0 &&
          <motion.span
            key={unreadCount}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 font-mono text-[10px] font-semibold leading-none text-white ring-2 ring-surface">
            
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          }
        </AnimatePresence>
      </button>

      <DropdownPanel open={open} className="w-[min(380px,calc(100vw-1.5rem))] !overflow-hidden" label={t('notif.title')}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold">{t('notif.title')}</p>
            {prefs.realtime &&
            <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden />
                {t('notif.live')}
              </span>
            }
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
            
            <CheckCheckIcon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('notif.markAll')}</span>
          </button>
        </div>
        <div role="tablist" className="flex gap-1 border-b border-line px-3 py-2">
          {(['all', 'unread'] as const).map((k) =>
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-out ${
            tab === k ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:text-ink'}`
            }>
            
              {t(k === 'all' ? 'notif.all' : 'notif.unread')}
              {k === 'unread' && unreadCount > 0 && <span className="ml-1 font-mono">{unreadCount}</span>}
            </button>
          )}
        </div>
        <ul className="scroll-area max-h-[min(55vh,420px)] divide-y divide-line overflow-y-auto">
          {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{t('notif.empty')}</li>}
          {shown.map((n) =>
          <li key={n.id}>
              <button
              type="button"
              onClick={() => {
                markRead(n.id);
                if (n.href) navigate(n.href);
                close();
              }}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-canvas focus:bg-canvas focus:outline-none">
              
                <NotificationIcon kind={n.kind} />
                <span className="min-w-0">
                  <span className={`block truncate text-sm ${n.read ? 'text-ink' : 'font-semibold text-ink'}`}>{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-muted">{formatRelative(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
              </button>
            </li>
          )}
        </ul>
        <Link
          to={`/${role}/notifications`}
          className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-accent hover:bg-canvas">
          
          {t('notif.viewAll')}
        </Link>
      </DropdownPanel>
    </div>);

}