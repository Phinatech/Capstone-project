import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CompassIcon } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../components/ui/buttons';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { homePath } from '../utils/users';

export function NotFound({ message, standalone = false }: {message?: string;standalone?: boolean;}) {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <div
      className={`flex w-full flex-col items-center justify-center px-6 py-16 text-center ${
      standalone ? 'min-h-screen bg-canvas' : 'min-h-[55vh]'}`
      }>
      
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="flex max-w-md flex-col items-center">
        
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
          <CompassIcon className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-5 font-mono text-xs text-muted">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{t('notFound.title')}</h1>
        <p className="mt-2 text-sm text-muted">{message ?? t('notFound.body')}</p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to={user ? homePath(user) : '/sign-in'} className={btnPrimary}>
            {user ? t('errorPage.home') : t('auth.signIn')}
          </Link>
          <button type="button" onClick={() => window.history.back()} className={btnSecondary}>
            {t('common.back')}
          </button>
        </div>
      </motion.div>
    </div>);

}