import { useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../components/auth/AuthLayout';
import { TextField } from '../components/auth/TextField';
import { PasswordField } from '../components/auth/PasswordField';
import { TurnstileWidget } from '../components/auth/TurnstileWidget';
import { GoogleButton } from '../components/auth/GoogleButton';
import { DemoCredentials } from '../components/auth/DemoCredentials';
import { AuthDivider, submitButtonClass } from '../components/auth/AuthDivider';
import { AuthError, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { homePath, isValidEmail } from '../utils/users';
import type { DemoCredential } from '../data/demoCredentials';
import type { TranslationKey } from '../data/translations';

type FieldErrors = Partial<Record<'email' | 'password' | 'captcha', TranslationKey>>;

export function SignIn() {
  const { user, signInWithPassword } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as {from?: string;} | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);

  const onVerify = useCallback((tk: string) => {
    setToken(tk);
    setErrors((e) => ({ ...e, captcha: undefined }));
  }, []);
  const onExpire = useCallback(() => setToken(null), []);

  if (user && !submitting) return <Navigate to={homePath(user)} replace />;

  async function attempt(nextEmail: string, nextPassword: string) {
    const nextErrors: FieldErrors = {};
    if (!nextEmail.trim()) nextErrors.email = 'error.required';else
    if (!isValidEmail(nextEmail)) nextErrors.email = 'error.invalidEmail';
    if (!nextPassword) nextErrors.password = 'error.required';
    if (!token) nextErrors.captcha = 'error.completeCheck';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const signedIn = await signInWithPassword(nextEmail, nextPassword, remember);
      toast.success(t('toast.welcome', { name: signedIn.name.split(' ')[0] }));
      const target = from && from.startsWith(homePath(signedIn)) ? from : homePath(signedIn);
      navigate(target, { replace: true });
    } catch (err) {
      setFormError(err instanceof AuthError ? err.key : 'error.invalidCredentials');
      setSubmitting(false);
    }
  }

  function handleDemo(c: DemoCredential) {
    setEmail(c.email);
    setPassword(c.password);
    attempt(c.email, c.password);
  }

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
      <>
          {t('auth.noAccount')}{' '}
          <Link to="/sign-up" className="font-medium text-accent hover:underline">
            {t('auth.createOne')}
          </Link>
        </>
      }>
      
      <GoogleButton mode="signin" />
      <AuthDivider label={t('auth.or')} />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          attempt(email, password);
        }}
        className="space-y-4">
        
        <AnimatePresence>
          {formError &&
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
            
              <AlertCircleIcon className="h-4 w-4 shrink-0" aria-hidden />
              {t(formError)}
            </motion.p>
          }
        </AnimatePresence>

        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email && t(errors.email)}
          placeholder="you@example.com" />
        
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password && t(errors.password)} />
        

        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-[var(--accent)]" />
            
            {t('auth.remember')}
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-accent hover:underline">
            {t('auth.forgot')}
          </Link>
        </div>

        <TurnstileWidget onVerify={onVerify} onExpire={onExpire} error={errors.captcha && t(errors.captcha)} />

        <button type="submit" disabled={submitting} className={submitButtonClass}>
          {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      <div className="mt-4 sm:mt-6">
        <DemoCredentials onSelect={handleDemo} disabled={submitting} />
      </div>
    </AuthLayout>);

}