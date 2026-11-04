import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon } from 'lucide-react';
import { Brand } from '../layout/Brand';
import { LanguageMenu } from '../layout/LanguageMenu';
import { ThemeMenu } from '../layout/ThemeMenu';
import { PreferencesMenu } from '../layout/PreferencesMenu';
import { useI18n } from '../../contexts/I18nContext';
import { oracleSources } from '../../data/rainfall';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
}

const ease = [0.23, 1, 0.32, 1] as const;

export function AuthLayout({ title, subtitle, children, footer, icon }: AuthLayoutProps) {
  const { t } = useI18n();
  return (
    <div className="grid h-[100dvh] w-full overflow-hidden bg-canvas md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden h-full flex-col overflow-hidden bg-accent p-8 text-white md:flex lg:p-12">
        <Brand to="/" inverted />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease }}
          className="my-auto max-w-md">
          
          <p className="text-2xl font-semibold leading-tight tracking-tight lg:text-3xl">{t('brand.heroTitle')}</p>
          <p className="mt-4 text-sm leading-relaxed text-white/80 lg:text-[15px]">{t('brand.heroText')}</p>
          <ul className="mt-8 grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-3">
            {oracleSources.map((s, i) =>
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 + i * 0.05, ease }}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-white/20 px-3 py-2.5 lg:block">
              
                <p className="truncate text-sm font-semibold">{s.name}</p>
                <p className="truncate text-xs text-white/70">{t(`source.${s.id}.kind`)}</p>
              </motion.li>
            )}
          </ul>
          <p className="mt-6 flex items-center gap-2 text-xs text-white/75">
            <ShieldCheckIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t('shell.authTagline')}</span>
          </p>
        </motion.div>
      </aside>

      <div className="scroll-area flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden">
        <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-8 lg:px-10">
          <div className="md:invisible">
            <Brand to="/" compact />
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-1 lg:flex">
              <LanguageMenu bordered />
              <ThemeMenu />
            </div>
            <div className="lg:hidden">
              <PreferencesMenu />
            </div>
          </div>
        </header>
        <div className="flex flex-1 items-start justify-center px-4 pb-8 pt-2 sm:items-center sm:px-5 sm:pb-12 sm:pt-4 md:px-8 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease }}
            className="w-full min-w-0 max-w-md">
            
            {icon && <div className="mb-5">{icon}</div>}
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-1.5 text-sm text-muted">{subtitle}</div>
            <div className="mt-5 sm:mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
            <p className="mt-4 text-center text-xs text-muted">
              <Link to="/terms" className="hover:text-ink hover:underline">{t('legal.footerLink')}</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>);

}