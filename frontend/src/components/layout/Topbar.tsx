import { Link, useLocation } from 'react-router-dom';
import { SearchIcon, WalletIcon } from 'lucide-react';
import { Brand } from './Brand';
import { ProfileMenu } from './ProfileMenu';
import { LiveClock } from './LiveClock';
import { ThemeMenu } from './ThemeMenu';
import { LanguageMenu } from './LanguageMenu';
import { PreferencesMenu } from './PreferencesMenu';
import { NotificationBell } from './NotificationBell';
import { currentNavItem } from './navigation';
import { iconButtonClass } from '../DropdownPanel';
import { usePolicies } from '../../contexts/PolicyContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUI } from '../../contexts/UIContext';
import { formatEth } from '../../utils/format';
import type { User } from '../../types/user';

export function Topbar({ user }: {user: User;}) {
  const { pathname } = useLocation();
  const { balanceOf } = usePolicies();
  const { t } = useI18n();
  const ui = useUI();
  const current = currentNavItem(user.role, pathname);
  const home = user.role === 'admin' ? '/admin' : '/farmer';

  return (
    <header className="relative z-30 h-14 shrink-0 border-b border-line bg-surface md:h-16">
      <div className="flex h-full min-w-0 items-center gap-1 px-2.5 sm:gap-2 sm:px-4 md:px-6">
        <div className="min-w-0 lg:hidden">
          <Brand to={home} compact />
        </div>

        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm lg:flex">
          <Link to={home} className="truncate text-muted hover:text-ink">
            {t(user.role === 'admin' ? 'top.adminConsole' : 'top.farmerPortal')}
          </Link>
          {current && current.to !== home &&
          <>
              <span className="text-line" aria-hidden>
                /
              </span>
              <span className="truncate font-medium text-ink">{t(current.labelKey)}</span>
            </>
          }
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1.5">
          <button type="button" onClick={() => ui.open('search')} aria-label={t('nav.search')} className={`${iconButtonClass} lg:hidden`}>
            <SearchIcon className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <LiveClock />
          {user.role === 'farmer' &&
          <Link
            to="/farmer/payouts"
            className="hidden items-center gap-2 whitespace-nowrap rounded-md border border-line px-2.5 py-1.5 text-xs transition-colors duration-150 ease-out hover:border-muted xl:flex">
            
              <WalletIcon className="h-3.5 w-3.5 text-muted" aria-hidden />
              <span className="font-mono font-medium">{formatEth(balanceOf(user.id))}</span>
            </Link>
          }
          <NotificationBell role={user.role} />
          <div className="hidden items-center gap-0.5 lg:flex">
            <LanguageMenu />
            <ThemeMenu />
          </div>
          <div className="lg:hidden">
            <PreferencesMenu />
          </div>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
          <ProfileMenu user={user} />
        </div>
      </div>
    </header>);

}