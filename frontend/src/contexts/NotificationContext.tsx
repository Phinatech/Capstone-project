import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import { usePreferences } from './PreferencesContext';
import type { NotificationPrefs } from './PreferencesContext';
import { usePersistentState } from '../hooks/usePersistentState';
import type { AppNotification, NewNotification, NotificationKind } from '../types/notification';
import type { User } from '../types/user';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (input: NewNotification) => void;
  /**
   * Replaces the notifications derived from shared policy data (see
   * `policyActivity`). Called again on every chain refresh; only events this
   * viewer has not seen before pop up.
   */
  setActivity: (activity: AppNotification[]) => void;
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

/** Derived events already announced to a user on this device. */
const knownKey = (userId: string) => `sokoto-cover-notifications-known:${userId}`;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Read and dismissed derived events are remembered up to this many each. */
const MAX_REMEMBERED = 2000;

function readKnown(userId: string): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(knownKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeKnown(userId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(knownKey(userId), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable: events may announce again on the next visit */
  }
}

export function NotificationProvider({ children }: {children: React.ReactNode;}) {
  const { user } = useAuth();
  const { prefs } = usePreferences();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [items, setItems] = usePersistentState<AppNotification[]>('sokoto-cover-notifications-v2', []);
  // Derived events carry ids that are stable across reloads, so read and
  // dismissed state is kept by id rather than on the (rebuilt) items.
  const [readIds, setReadIds] = usePersistentState<string[]>('sokoto-cover-notifications-read-v1', []);
  const [hiddenIds, setHiddenIds] = usePersistentState<string[]>('sokoto-cover-notifications-hidden-v1', []);
  const [activity, setActivityState] = useState<AppNotification[] | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const announce = useCallback(
    (n: AppNotification) => {
      if (!prefsRef.current.notifications[prefFor[n.kind]]) return;
      toast(n.title, {
        description: n.body,
        action: n.href ? { label: t('notif.view'), onClick: () => navigate(n.href!) } : undefined
      });
    },
    [navigate, t]
  );

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
      if (input.toast !== false && user && targets(n, user)) announce(n);
    },
    [user, announce, setItems]
  );

  const setActivity = useCallback((next: AppNotification[]) => setActivityState(next), []);

  // Signing out or switching account drops the previous viewer's events.
  const userId = user?.id;
  useEffect(() => setActivityState(null), [userId]);

  // Pop up only what this viewer has not seen. The first time an account is
  // seen on this device its history arrives quietly, with anything older than
  // a week already marked read, so a returning farmer is not buried in toasts.
  useEffect(() => {
    if (!user || !activity) return;
    const mine = activity.filter((n) => targets(n, user));
    const stored = readKnown(user.id);
    const known = stored ?? new Set<string>();
    const fresh = mine.filter((n) => !known.has(n.id));
    if (stored && !fresh.length) return;
    if (!stored) {
      const old = fresh.filter((n) => Date.now() - Date.parse(n.createdAt) > WEEK_MS).map((n) => n.id);
      if (old.length) setReadIds((prev) => [...new Set([...prev, ...old])].slice(-MAX_REMEMBERED));
    } else {
      fresh.slice(0, 3).forEach(announce);
    }
    for (const n of fresh) known.add(n.id);
    writeKnown(user.id, known);
  }, [activity, user, announce, setReadIds]);

  const read = useMemo(() => new Set(readIds), [readIds]);
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const activityIds = useMemo(() => new Set((activity ?? []).map((n) => n.id)), [activity]);

  const notifications = useMemo(() => {
    if (!user) return [];
    const derived = (activity ?? []).filter((n) => !hidden.has(n.id)).map((n) => ({ ...n, read: read.has(n.id) }));
    return [...items, ...derived].
    filter((n) => targets(n, user)).
    sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [items, activity, read, hidden, user]);

  const visibleIds = useMemo(() => new Set(notifications.map((n) => n.id)), [notifications]);
  const remember = (prev: string[], ids: string[]) => [...new Set([...prev, ...ids])].slice(-MAX_REMEMBERED);

  const markRead = useCallback(
    (id: string) => {
      if (activityIds.has(id)) setReadIds((prev) => remember(prev, [id]));else
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    },
    [activityIds, setItems, setReadIds]
  );
  const markAllRead = useCallback(() => {
    setReadIds((prev) => remember(prev, [...visibleIds].filter((id) => activityIds.has(id))));
    setItems((prev) => prev.map((n) => visibleIds.has(n.id) ? { ...n, read: true } : n));
  }, [setItems, setReadIds, visibleIds, activityIds]);
  const remove = useCallback(
    (id: string) => {
      if (activityIds.has(id)) setHiddenIds((prev) => remember(prev, [id]));else
      setItems((prev) => prev.filter((n) => n.id !== id));
    },
    [activityIds, setItems, setHiddenIds]
  );
  const clearRead = useCallback(() => {
    const readVisible = notifications.filter((n) => n.read).map((n) => n.id);
    setHiddenIds((prev) => remember(prev, readVisible.filter((id) => activityIds.has(id))));
    setItems((prev) => prev.filter((n) => !(visibleIds.has(n.id) && n.read)));
  }, [notifications, setItems, setHiddenIds, visibleIds, activityIds]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      notify,
      setActivity,
      markRead,
      markAllRead,
      remove,
      clearRead
    }),
    [notifications, notify, setActivity, markRead, markAllRead, remove, clearRead]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
