import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BellIcon, BookOpenIcon, FlaskConicalIcon, PlusIcon, ScaleIcon, SearchIcon, UsersIcon, WalletIcon, XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDismiss } from "../../hooks/useDismiss";
import { useUI } from "../../contexts/UIContext";
import { useI18n } from "../../contexts/I18nContext";
import { usePolicies } from "../../contexts/PolicyContext";
import { Role } from "../../types/user";
interface Action {
  label: string;
  icon: LucideIcon;
  run: () => void;
}
export function FloatingActions({
  role


}: {role: Role;}) {
  const navigate = useNavigate();
  const {
    pathname
  } = useLocation();
  const ui = useUI();
  const {
    t
  } = useI18n();
  const {
    policies
  } = usePolicies();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(() => setOpen(false), [pathname]);
  const nextPending = policies.find((p) => p.status === 'active');
  const actions: Action[] = role === 'admin' ? [{
    label: nextPending ? `Evaluate policy #${nextPending.id}` : 'Evaluation queue',
    icon: ScaleIcon,
    run: () => navigate(nextPending ? `/admin/policies/${nextPending.id}` : '/admin')
  }, {
    label: 'Farmers',
    icon: UsersIcon,
    run: () => navigate('/admin/farmers')
  }, {
    label: 'Run backtest',
    icon: FlaskConicalIcon,
    run: () => navigate('/admin/backtest')
  }, {
    label: t('nav.search'),
    icon: SearchIcon,
    run: () => ui.open('search')
  }] : [{
    label: t('nav.buyCover'),
    icon: PlusIcon,
    run: () => navigate('/farmer/policies/new')
  }, {
    label: t('nav.payouts'),
    icon: WalletIcon,
    run: () => navigate('/farmer/payouts')
  }, {
    label: t('nav.notifications'),
    icon: BellIcon,
    run: () => navigate('/farmer/notifications')
  }, {
    label: t('nav.search'),
    icon: SearchIcon,
    run: () => ui.open('search')
  }];
  return <div ref={ref} className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col items-end gap-2 lg:bottom-8 lg:right-8">
      <AnimatePresence>
        {open && <motion.ul role="menu" aria-label={t('common.quickActions')} className="flex flex-col items-end gap-2" initial="hidden" animate="shown" exit="hidden" variants={{
        shown: {
          transition: {
            staggerChildren: 0.04,
            staggerDirection: -1
          }
        },
        hidden: {}
      }}>
            {actions.map((a) => {
          const Icon = a.icon;
          return <motion.li key={a.label} variants={{
            hidden: {
              opacity: 0,
              y: 8,
              scale: 0.96
            },
            shown: {
              opacity: 1,
              y: 0,
              scale: 1
            }
          }} transition={{
            duration: 0.18,
            ease: [0.23, 1, 0.32, 1]
          }}>
                  <button type="button" role="menuitem" onClick={() => {
              close();
              a.run();
            }} className="flex max-w-[70vw] items-center gap-3 rounded-full border border-line bg-raised py-2 pl-4 pr-2 text-sm font-medium shadow-pop transition-colors duration-150 ease-out hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <span className="truncate">{a.label}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                  </button>
                </motion.li>;
        })}
          </motion.ul>}
      </AnimatePresence>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t('common.quickActions')} className="flex h-12 w-12 items-center justify-center rounded-full bg-accent lg:h-14 lg:w-14 text-white shadow-pop transition-colors duration-150 ease-out hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-95">
        <motion.span animate={{
        rotate: open ? 90 : 0
      }} transition={{
        duration: 0.2,
        ease: [0.23, 1, 0.32, 1]
      }}>
          {open ? <XIcon className="h-5 w-5" aria-hidden /> : <BookOpenIcon className="h-5 w-5" aria-hidden />}
        </motion.span>
      </button>
    </div>;
}