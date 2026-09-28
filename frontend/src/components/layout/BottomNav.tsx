import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { isNavActive, mobileNav } from './navigation';
import { useI18n } from '../../contexts/I18nContext';
import type { Role } from '../../types/user';

export function BottomNav({ role }: {role: Role;}) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const items = mobileNav[role];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      
      <ul className="mx-auto grid h-14 max-w-2xl grid-cols-5">
        {items.map((item) => {
          const active = isNavActive(item, pathname);
          const Icon = item.icon;
          return (
            <li key={item.to} className="min-w-0">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={t(item.labelKey)}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:bg-canvas active:scale-95 ${
                active ? 'text-accent-strong' : 'text-muted'}`
                }>
                
                {active && !item.primary &&
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-accent"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  aria-hidden />

                }
                {item.primary ?
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span> :

                <Icon className="h-5 w-5" aria-hidden />
                }
                <span className="max-w-full truncate">{t(item.shortKey)}</span>
              </Link>
            </li>);

        })}
      </ul>
    </nav>);

}