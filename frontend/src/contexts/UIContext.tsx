import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ModalName = 'search' | 'whatsNew' | 'welcome' | 'signOut' | null;

interface UIContextValue {
  modal: ModalName;
  open: (name: Exclude<ModalName, null>) => void;
  close: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: {children: React.ReactNode;}) {
  const [modal, setModal] = useState<ModalName>(null);
  const open = useCallback((name: Exclude<ModalName, null>) => setModal(name), []);
  const close = useCallback(() => setModal(null), []);
  const value = useMemo(() => ({ modal, open, close }), [modal, open, close]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used inside UIProvider');
  return ctx;
}