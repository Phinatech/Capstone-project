import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, CloudRainIcon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { GOOGLE_PENDING_KEY } from '../components/auth/GoogleButton';
import { decodeGoogleCredential } from '../utils/jwt';
import type { GoogleIdentity } from '../utils/jwt';
import { homePath } from '../utils/users';
import type { TranslationKey } from '../data/translations';

const steps: TranslationKey[] = ['callback.step1', 'callback.step2', 'callback.step3'];
const STEP_MS = 480;

function readPending(): GoogleIdentity | null {
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_PENDING_KEY);
    window.sessionStorage.removeItem(GOOGLE_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {credential?: string;identity?: GoogleIdentity;};
    if (data.credential) return decodeGoogleCredential(data.credential);
    return data.identity ?? null;
  } catch {
    return null;
  }
}

export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { completeGoogleSignIn } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<TranslationKey | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timers: number[] = [];

    if (params.get('error')) {
      setError('error.accessDenied');
      return;
    }
    const identity = params.get('provider') === 'google' ? readPending() : null;
    if (!identity) {
      setError('error.noCredential');
      return;
    }

    timers.push(window.setTimeout(() => setStep(1), STEP_MS));
    timers.push(
      window.setTimeout(async () => {
        try {
          const user = await completeGoogleSignIn(identity);
          setStep(2);
          timers.push(
            window.setTimeout(() => {
              toast.success(t('toast.welcome', { name: user.name.split(' ')[0] }));
              navigate(homePath(user), { replace: true });
            }, STEP_MS)
          );
        } catch {
          setError('error.googleFailed');
        }
      }, STEP_MS * 2)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas px-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-pop"
        role="status"
        aria-live="polite">
        
        <span
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${error ? 'bg-danger-soft text-danger' : 'bg-accent text-white'}`}>
          
          {error ? <XCircleIcon className="h-6 w-6" aria-hidden /> : <CloudRainIcon className="h-6 w-6" aria-hidden />}
        </span>
        <h1 className="mt-4 text-lg font-semibold">{error ? t('callback.failed') : t('callback.verifying')}</h1>

        {error ?
        <>
            <p className="mt-2 text-sm text-muted">{t(error)}</p>
            <Link
            to="/sign-in"
            replace
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors duration-150 ease-out hover:bg-accent-hover">
            
              {t('callback.back')}
            </Link>
          </> :

        <ol className="mt-6 space-y-3 text-left">
            {steps.map((key, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <motion.li
                key={key}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
                className={`flex items-center gap-3 text-sm ${done || active ? 'text-ink' : 'text-muted'}`}>
                
                  <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${
                  done ? 'border-accent bg-accent text-white' : active ? 'border-accent' : 'border-line'}`
                  }>
                  
                    {done ?
                  <CheckIcon className="h-3 w-3" aria-hidden /> :
                  active ?
                  <Loader2Icon className="h-3 w-3 animate-spin text-accent" aria-hidden /> :
                  null}
                  </span>
                  <span className="truncate">{t(key)}</span>
                </motion.li>);

          })}
          </ol>
        }
      </motion.div>
    </div>);

}