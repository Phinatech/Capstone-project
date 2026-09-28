import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScript } from '../../hooks/useScript';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18n } from '../../contexts/I18nContext';
import { GOOGLE_CLIENT_ID, demoGoogleIdentities } from '../../data/authConfig';

export const GOOGLE_PENDING_KEY = 'sokoto-cover-google-pending';

interface GoogleButtonProps {
  mode: 'signin' | 'signup';
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>);

}

export function GoogleButton({ mode }: GoogleButtonProps) {
  const navigate = useNavigate();
  const { resolvedMode } = useTheme();
  const { language, t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const useGis = GOOGLE_CLIENT_ID.length > 0;
  const { status } = useScript(useGis ? 'https://accounts.google.com/gsi/client' : null);
  const label = mode === 'signup' ? t('auth.googleSignUp') : t('auth.googleSignIn');

  function goToCallback(payload: {credential?: string;identity?: object;}) {
    try {
      window.sessionStorage.setItem(GOOGLE_PENDING_KEY, JSON.stringify(payload));
    } catch {

      /* storage unavailable */}
    navigate(`/auth/callback?provider=google&mode=${mode}`);
  }

  useEffect(() => {
    if (!useGis || status !== 'ready' || !container.current || !window.google) return;
    const el = container.current;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: 'popup',
      callback: (response) => goToCallback({ credential: response.credential })
    });
    el.innerHTML = '';
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: resolvedMode === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: mode === 'signup' ? 'signup_with' : 'signin_with',
      shape: 'rectangular',
      width: Math.min(400, el.offsetWidth || 320),
      locale: language
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGis, status, resolvedMode, language, mode]);

  if (useGis) {
    return <div ref={container} className="flex min-h-[44px] w-full justify-center" aria-label={label} />;
  }

  return (
    <button
      type="button"
      onClick={() => goToCallback({ identity: demoGoogleIdentities[mode] })}
      className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 ease-out hover:border-muted hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.99]">
      
      <GoogleMark />
      <span className="truncate">{label}</span>
      <span className="sr-only">({t('auth.googleDemo')})</span>
    </button>);

}