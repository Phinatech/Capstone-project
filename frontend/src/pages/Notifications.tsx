import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BellOffIcon, CheckCheckIcon, CheckIcon, Settings2Icon, Trash2Icon } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { FilterTabs } from '../components/FilterTabs';
import { FilterSelect } from '../components/ui/FilterSelect';
import { EmptyState } from '../components/ui/EmptyState';
import { NotificationIcon } from '../components/layout/NotificationIcon';
import { btnSecondary } from '../components/ui/buttons';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { formatDateTime, formatRelative } from '../utils/format';
import type { AppNotification, NotificationKind } from '../types/notification';

type Tab = 'all' | 'unread';
type Kind = 'all' | NotificationKind;

const kindLabels: Record<NotificationKind, string> = {
  payout: 'Payouts',
  evaluation: 'Evaluations',
  policy: 'Policies',
  oracle: 'Oracle feeds',
  system: 'System'
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function Notifications() {
  const { user } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, remove, clearRead } = useNotifications();
  const { prefs, setPref } = usePreferences();
  const [tab, setTab] = useState<Tab>('all');
  const [kind, setKind] = useState<Kind>('all');

  const shown = notifications.filter((n) => (tab === 'all' || !n.read) && (kind === 'all' || n.kind === kind));
  const groups = useMemo(() => {
    const map = new Map<string, AppNotification[]>();
    shown.forEach((n) => {
      const key = dayLabel(n.createdAt);
      map.set(key, [...(map.get(key) ?? []), n]);
    });
    return [...map.entries()];
  }, [shown]);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unreadCount ? `${unreadCount} unread · events from policies, payouts and oracle feeds.` : 'Events from policies, payouts and oracle feeds.'}
        actions={
        <>
            <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className={btnSecondary}>
              <CheckCheckIcon className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
            <Link to={`/${user.role}/settings#notifications`} className={btnSecondary} aria-label="Notification settings">
              <Settings2Icon className="h-4 w-4" aria-hidden />
            </Link>
          </>
        } />
      

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterTabs<Tab>
              label="Filter notifications"
              value={tab}
              onChange={setTab}
              options={[
              { value: 'all', label: 'All', count: notifications.length },
              { value: 'unread', label: 'Unread', count: unreadCount }]
              } />
            
            <div className="sm:w-48">
              <FilterSelect<Kind>
                label="Type"
                value={kind}
                onChange={setKind}
                options={[{ value: 'all', label: 'All types' }, ...(Object.keys(kindLabels) as NotificationKind[]).map((k) => ({ value: k, label: kindLabels[k] }))]} />
              
            </div>
          </div>

          {groups.length === 0 ?
          <EmptyState icon={BellOffIcon} title="Nothing here" body={tab === 'unread' ? "You're all caught up." : 'No notifications match this filter.'} /> :

          groups.map(([label, items]) =>
          <section key={label} aria-label={label}>
                <h2 className="mb-2 text-xs font-medium text-muted">{label}</h2>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  <AnimatePresence initial={false}>
                    {items.map((n) =>
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className={`group grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 sm:px-5 ${n.read ? '' : 'bg-canvas'}`}>
                  
                        <NotificationIcon kind={n.kind} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                            {n.href ?
                      <Link to={n.href} onClick={() => markRead(n.id)} className="truncate text-sm font-semibold hover:underline">
                                {n.title}
                              </Link> :

                      <p className="truncate text-sm font-semibold">{n.title}</p>
                      }
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>
                          <p className="mt-1.5 text-xs text-muted" title={formatDateTime(n.createdAt)}>
                            {kindLabels[n.kind]} · {formatRelative(n.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {!n.read &&
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      aria-label="Mark as read"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink">
                      
                              <CheckIcon className="h-4 w-4" aria-hidden />
                            </button>
                    }
                          <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label="Delete notification"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger">
                      
                            <Trash2Icon className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </motion.li>
                )}
                  </AnimatePresence>
                </ul>
              </section>
          )
          }
        </div>

        <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm font-semibold">Live updates</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              New oracle and policy events arrive in real time while you're signed in.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.realtime}
              onClick={() => setPref('realtime', !prefs.realtime)}
              className={`mt-4 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-150 ease-out ${
              prefs.realtime ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted'}`
              }>
              
              {prefs.realtime ? 'Live · on' : 'Paused'}
              <span className={`h-2 w-2 rounded-full ${prefs.realtime ? 'animate-pulse bg-success' : 'bg-line'}`} aria-hidden />
            </button>
          </div>
          <div className="rounded-lg border border-line bg-surface p-5">
            <p className="text-sm font-semibold">Housekeeping</p>
            <p className="mt-1 text-xs text-muted">Remove notifications you've already read.</p>
            <button type="button" onClick={clearRead} className={`${btnSecondary} mt-4 w-full`}>
              <Trash2Icon className="h-4 w-4" aria-hidden />
              Clear read
            </button>
          </div>
        </aside>
      </div>
    </div>);

}