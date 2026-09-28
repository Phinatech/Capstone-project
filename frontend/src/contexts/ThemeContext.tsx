import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { accentNames } from '../data/themes';
import type { AccentName, ThemeMode } from '../data/themes';

const MODE_KEY = 'sokoto-cover-mode';
const ACCENT_KEY = 'sokoto-cover-accent';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  accent: AccentName;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function read<T extends string>(key: string, fallback: T, allowed: readonly string[]): T {
  try {
    const v = window.localStorage.getItem(key);
    return v && allowed.includes(v) ? v as T : fallback;
  } catch {
    return fallback;
  }
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: {children: React.ReactNode;}) {
  const [mode, setMode] = useState<ThemeMode>(() => read(MODE_KEY, 'light', ['light', 'dark', 'system']));
  const [accent, setAccent] = useState<AccentName>(() => read(ACCENT_KEY, 'petrol', accentNames));
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedMode = mode === 'system' ? systemDark ? 'dark' : 'light' : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = resolvedMode;
    root.dataset.accent = accent;
    try {
      window.localStorage.setItem(MODE_KEY, mode);
      window.localStorage.setItem(ACCENT_KEY, accent);
    } catch {

      /* storage unavailable */}
  }, [mode, resolvedMode, accent]);

  const value = useMemo(() => ({ mode, resolvedMode, accent, setMode, setAccent }), [mode, resolvedMode, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}