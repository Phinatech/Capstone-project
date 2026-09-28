import { Suspense, useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { FloatingActions } from './FloatingActions';
import { CommandPalette } from './CommandPalette';
import { PageSkeleton } from '../PageSkeleton';
import { ErrorBoundary } from '../ErrorBoundary';
import { WelcomeModal } from '../modals/WelcomeModal';
import { WhatsNewModal } from '../modals/WhatsNewModal';
import { SignOutDialog } from '../modals/SignOutDialog';
import { useAuth } from '../../contexts/AuthContext';
import { UIProvider, useUI } from '../../contexts/UIContext';
import { usePersistentState } from '../../hooks/usePersistentState';
import { RELEASE_VERSION } from '../../data/onboarding';
import type { User } from '../../types/user';

function seen(key: string): boolean {
  try {
    return !!window.localStorage.getItem(key);
  } catch {
    return true;
  }
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, '1');
  } catch {

    /* storage unavailable */}
}

function Shell({ user }: {user: User;}) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const ui = useUI();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = usePersistentState('sokoto-cover-sidebar-collapsed', false);
  const welcomeKey = `sokoto-cover-welcome-${user.id}`;
  const releaseKey = `sokoto-cover-release-${RELEASE_VERSION}-${user.id}`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!seen(welcomeKey)) ui.open('welcome');else
      if (!seen(releaseKey)) ui.open('whatsNew');
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.open('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const closeWelcome = () => {
    markSeen(welcomeKey);
    markSeen(releaseKey);
    ui.close();
  };
  const closeWhatsNew = () => {
    markSeen(releaseKey);
    ui.close();
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-canvas text-ink">
      <Sidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <div ref={scrollRef} id="app-scroll" className="scroll-area min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <main className="mx-auto w-full min-w-0 max-w-6xl px-3 pb-28 pt-4 sm:px-5 sm:pt-5 md:px-8 md:pt-8 lg:pb-10">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="min-w-0">
                
                <ErrorBoundary key={pathname}>
                  <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
          <footer className="hidden border-t border-line px-8 py-4 text-xs text-muted lg:block">
            <p className="truncate">
              BSc Software Engineering prototype · Chinemerem Judith Ugbo · Supervisor: Dr Aaron Izang · Testnet only, illustrative rainfall data.
            </p>
          </footer>
        </div>
      </div>
      <FloatingActions role={user.role} />
      <BottomNav role={user.role} />

      <CommandPalette open={ui.modal === 'search'} onClose={ui.close} user={user} />
      <WelcomeModal open={ui.modal === 'welcome'} onClose={closeWelcome} user={user} />
      <WhatsNewModal open={ui.modal === 'whatsNew'} onClose={closeWhatsNew} />
      <SignOutDialog open={ui.modal === 'signOut'} onClose={ui.close} />
    </div>);

}

export function DashboardLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <UIProvider>
      <Shell user={user} />
    </UIProvider>);

}