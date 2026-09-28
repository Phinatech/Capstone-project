import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

export type TimeFormat = '24h' | '12h';

export interface NotificationPrefs {
  payouts: boolean;
  evaluations: boolean;
  oracle: boolean;
  updates: boolean;
  email: boolean;
  sms: boolean;
}

export interface Preferences {
  timeFormat: TimeFormat;
  showSeconds: boolean;
  realtime: boolean;
  reduceMotion: boolean;
  notifications: NotificationPrefs;
}

const defaults: Preferences = {
  timeFormat: '24h',
  showSeconds: true,
  realtime: true,
  reduceMotion: false,
  notifications: { payouts: true, evaluations: true, oracle: true, updates: true, email: true, sms: false }
};

interface PreferencesContextValue {
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  resetPrefs: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: {children: React.ReactNode;}) {
  const [stored, setStored] = usePersistentState<Preferences>('sokoto-cover-preferences', defaults);
  const prefs = useMemo(
    () => ({ ...defaults, ...stored, notifications: { ...defaults.notifications, ...stored.notifications } }),
    [stored]
  );

  const setPref = useCallback(
    <K extends keyof Preferences,>(key: K, value: Preferences[K]) => setStored((p) => ({ ...p, [key]: value })),
    [setStored]
  );
  const setNotificationPref = useCallback(
    (key: keyof NotificationPrefs, value: boolean) =>
    setStored((p) => ({ ...p, notifications: { ...defaults.notifications, ...p.notifications, [key]: value } })),
    [setStored]
  );
  const resetPrefs = useCallback(() => setStored(defaults), [setStored]);

  const value = useMemo(() => ({ prefs, setPref, setNotificationPref, resetPrefs }), [prefs, setPref, setNotificationPref, resetPrefs]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}