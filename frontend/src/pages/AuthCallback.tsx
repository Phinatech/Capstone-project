import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, CloudRainIcon, Loader2Icon, SproutIcon, UsersIcon, XCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AuthError, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { GOOGLE_PENDING_KEY } from '../components/auth/GoogleButton';
import { homePath } from '../utils/users';
import type { TranslationKey } from '../data/translations';

const steps: TranslationKey[] = ['callback.step1', 'callback.step2', 'callback.step3'];
const STEP_MS = 480;

/**
 * Reads the ID token Google handed us, clearing it on the way out.
 *
 * Deliberately returns the *token*, not a decoded payload: decoding happened
 * here before F-1, which meant whatever the page trusted was whatever the
 * page wrote. The server verifies the signature and claims, so only the
 * opaque token has to make this round trip.
 */
type Role = 'farmer' | 'agent';

function readPendingCredential(): { credential: string; role?: Role } | null {
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_PENDING_KEY);
    window.sessionStorage.removeItem(GOOGLE_PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { credential?: unknown; role?: unknown };
    if (typeof data.credential !== 'string' || !data.credential) return null;
    const role = data.role === 'farmer' || data.role === 'agent' ? data.role : undefined;
    return { credential: data.credential, role };
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
  // A key when we have one, the server's own wording when we do not.
  const [error, setError] = useState<TranslationKey | string | null>(null);
  // A new Google account from the sign-in page: the server wants a role
  // before it creates anything, so the token is kept to send again.
  const [choosingRole, setChoosingRole] = useState(false);
  const credentialRef = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const started = useRef(false);

  async function finish(credential: string, role?: Role) {
    try {
      const user = await completeGoogleSignIn(credential, role);
      setStep(2);
      timers.current.push(
        window.setTimeout(() => {
          toast.success(t('toast.welcome', { name: user.name.split(' ')[0] }));
          navigate(homePath(user), { replace: true });
        }, STEP_MS)
      );
    } catch (err) {
      if (err instanceof AuthError && err.code === 'role_required') {
        setChoosingRole(true);
        return;
      }
      // Say why: "not set up on the server" and "too many attempts" need
      // different responses from the person reading this.
      setError(err instanceof AuthError ? err.key : 'error.googleFailed');
    }
  }

  function chooseRole(role: Role) {
    if (!credentialRef.current) return;
    setChoosingRole(false);
    setStep(1);
    void finish(credentialRef.current, role);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = timers.current;

    if (params.get('error')) {
      setError('error.accessDenied');
      return;
    }
    const pendingSignIn = params.get('provider') === 'google' ? readPendingCredential() : null;
    if (!pendingSignIn) {
      setError('error.noCredential');
      return;
    }
    credentialRef.current = pendingSignIn.credential;

    pending.push(window.setTimeout(() => setStep(1), STEP_MS));
    pending.push(window.setTimeout(() => void finish(pendingSignIn.credential, pendingSignIn.role), STEP_MS * 2));
    return () => pending.forEach((id) => window.clearTimeout(id));
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
        <h1 className="mt-4 text-lg font-semibold">{error ? t('callback.failed') : choosingRole ? t('callback.roleTitle') : t('callback.verifying')}</h1>

        {choosingRole ?
        <>
            <p className="mt-2 text-sm text-muted">{t('callback.roleBody')}</p>
            <div className="mt-5 grid gap-2 text-left">
              {([['farmer', SproutIcon], ['agent', UsersIcon]] as const).map(([role, Icon]) =>
            <button
              key={role}
              type="button"
              onClick={() => chooseRole(role)}
              className="flex items-start gap-3 rounded-lg border border-line p-3 text-left transition-colors duration-150 ease-out hover:border-accent hover:bg-accent-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(`role.${role}`)}</span>
                    <span className="block text-xs text-muted">{t(`role.${role}Hint`)}</span>
                  </span>
                </button>
            )}
            </div>
            <p className="mt-3 text-xs text-muted">{t('auth.roleNote')}</p>
          </> :
        error ?
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