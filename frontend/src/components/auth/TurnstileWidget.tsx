import { useEffect, useRef } from 'react';
import { AlertTriangleIcon, Loader2Icon } from 'lucide-react';
import { useScript } from '../../hooks/useScript';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { TURNSTILE_SITE_KEY } from '../../data/authConfig';

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  error?: string;
}

export function TurnstileWidget({ onVerify, onExpire, error }: TurnstileWidgetProps) {
  const { status, retry } = useScript(SRC);
  const { resolvedMode } = useTheme();
  const { language, t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onVerify, onExpire });
  callbacks.current = { onVerify, onExpire };

  useEffect(() => {
    if (status !== 'ready' || !container.current || !window.turnstile) return;
    const el = container.current;
    el.innerHTML = '';
    const id = window.turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: resolvedMode,
      size: 'flexible',
      language: language === 'ha' ? 'en' : language,
      callback: (token) => callbacks.current.onVerify(token),
      'expired-callback': () => callbacks.current.onExpire(),
      'error-callback': () => callbacks.current.onExpire()
    });
    return () => {
      callbacks.current.onExpire();
      try {
        window.turnstile?.remove(id);
      } catch {

        /* already removed */}
    };
  }, [status, resolvedMode, language]);

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{t('auth.securityCheck')}</p>
      {status === 'loading' &&
      <div className="flex h-[65px] items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm text-muted">
          <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
          {t('auth.securityLoading')}
        </div>
      }
      {status === 'error' &&
      <div className="flex h-[65px] items-center justify-between gap-3 rounded-md border border-danger bg-danger-soft px-4 text-sm text-danger">
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{t('auth.securityFailed')}</span>
          </span>
          <button type="button" onClick={retry} className="shrink-0 font-medium underline">
            {t('auth.retry')}
          </button>
        </div>
      }
      <div ref={container} className={`min-h-[65px] w-full ${status === 'ready' ? '' : 'hidden'}`} />
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>);

}