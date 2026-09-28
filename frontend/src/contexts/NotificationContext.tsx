import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { usePreferences } from './PreferencesContext';
import type { NotificationPrefs } from './PreferencesContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { liveTemplates, seedNotifications } from '../data/notificationTemplates';
import type { AppNotification, NewNotification, NotificationKind } from '../types/notification';
import type { User } from '../types/user';

const LIVE_INTERVAL_MS = 45_000;

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (input: NewNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const prefFor: Record<NotificationKind, keyof NotificationPrefs> = {
  payout: 'payouts',
  evaluation: 'evaluations',
  policy: 'evaluations',
  oracle: 'oracle',
  system: 'updates'
};

function targets(n: AppNotification, user: User): boolean {
  if (n.userId) return n.userId === user.id;
  if (n.role) return n.role === user.role;
  return true;
}

const newId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function NotificationProvider({ children }: {children: React.ReactNode;}) {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const navigate = useNavigate();
  const [items, setItems] = usePersistentState<AppNotification[]>('sokoto-cover-notifications', []);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    if (!user) return;
    const key = `sokoto-cover-notif-seeded-${user.id}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {
      return;
    }
    const now = Date.now();
    const seeds: AppNotification[] = seedNotifications[user.role].map((s) => ({
      id: newId(),
      kind: s.kind,
      title: s.title,
      body: s.body,
      href: s.href,
      read: s.read,
      userId: user.id,
      createdAt: new Date(now - s.minutesAgo * 60_000).toISOString()
    }));
    setItems((prev) => [...seeds, ...prev]);
  }, [user, setItems]);

  const notify = useCallback(
    (input: NewNotification) => {
      const n: AppNotification = {
        id: newId(),
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        userId: input.userId,
        role: input.role,
        createdAt: new Date().toISOString(),
        read: false
      };
      setItems((prev) => [n, ...prev].slice(0, 150));
      if (input.toast !== false && user && targets(n, user) && prefsRef.current.notifications[prefFor[n.kind]]) {
        toast(n.title, {
          description: n.body,
          action: n.href ? { label: 'View', onClick: () => navigate(n.href!) } : undefined
        });
      }
    },
    [user, navigate, setItems]
  );

  useEffect(() => {
    if (!user || !prefs.realtime) return;
    const id = window.setInterval(() => {
      const pool = liveTemplates[user.role].filter((tpl) => prefsRef.current.notifications[prefFor[tpl.kind]]);
      if (pool.length === 0) return;
      const tpl = pool[Math.floor(Math.random() * pool.length)];
      notify({ ...tpl, userId: user.id });
    }, LIVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [user, prefs.realtime, notify]);

  const notifications = useMemo(
    () =>
    user ?
    items.
    filter((n) => targets(n, user)).
    sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) :
    [],
    [items, user]
  );

  const visibleIds = useMemo(() => new Set(notifications.map((n) => n.id)), [notifications]);

  const markRead = useCallback((id: string) => setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n)), [setItems]);
  const markAllRead = useCallback(
    () => setItems((prev) => prev.map((n) => visibleIds.has(n.id) ? { ...n, read: true } : n)),
    [setItems, visibleIds]
  );
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((n) => n.id !== id)), [setItems]);
  const clearRead = useCallback(
    () => setItems((prev) => prev.filter((n) => !(visibleIds.has(n.id) && n.read))),
    [setItems, visibleIds]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      notify,
      markRead,
      markAllRead,
      remove,
      clearRead
    }),
    [notifications, notify, markRead, markAllRead, remove, clearRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}