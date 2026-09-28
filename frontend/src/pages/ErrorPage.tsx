import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagonIcon, ChevronDownIcon, RotateCcwIcon } from 'lucide-react';
import { btnPrimary, btnSecondary } from '../components/ui/buttons';
import { useI18n } from '../contexts/I18nContext';

interface ErrorPageProps {
  error?: Error;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export function ErrorPage({ error, onRetry, fullScreen }: ErrorPageProps) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`flex w-full items-center justify-center px-5 py-16 ${fullScreen ? 'min-h-screen bg-canvas' : 'min-h-[60vh]'}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md text-center"
        role="alert">
        
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertOctagonIcon className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-5 font-mono text-xs text-muted">500</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{t('errorPage.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('errorPage.body')}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={() => onRetry ? onRetry() : window.location.reload()} className={btnPrimary}>
            <RotateCcwIcon className="h-4 w-4" aria-hidden />
            {t('errorPage.retry')}
          </button>
          <a href="/" className={btnSecondary}>
            {t('errorPage.home')}
          </a>
        </div>
        {error &&
        <div className="mt-6 text-left">
            <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            aria-expanded={showDetails}
            className="mx-auto flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
            
              {t('errorPage.details')}
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-150 ${showDetails ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {showDetails &&
          <pre className="scroll-area mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 font-mono text-xs text-muted">
                {error.message}
              </pre>
          }
          </div>
        }
      </motion.div>
    </div>);

}