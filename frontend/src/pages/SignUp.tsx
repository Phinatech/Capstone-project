import React, { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../components/auth/AuthLayout';
import { TextField, fieldInputClass } from '../components/auth/TextField';
import { PasswordField } from '../components/auth/PasswordField';
import { TurnstileWidget } from '../components/auth/TurnstileWidget';
import { GoogleButton } from '../components/auth/GoogleButton';
import { AuthDivider, submitButtonClass } from '../components/auth/AuthDivider';
import { AuthError, useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { lgas } from '../data/policies';
import { homePath, isValidEmail } from '../utils/users';
import type { TranslationKey } from '../data/translations';

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm' | 'terms' | 'captcha';
type FieldErrors = Partial<Record<Field, TranslationKey>>;

export function SignUp() {
  const { user, signUp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', lga: lgas[0], password: '', confirm: '' });
  const [agreed, setAgreed] = useState(false);
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

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
  setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'error.required';
    if (!form.email.trim()) next.email = 'error.required';else
    if (!isValidEmail(form.email)) next.email = 'error.invalidEmail';
    if (!form.phone.trim()) next.phone = 'error.required';
    if (form.password.length < 8) next.password = 'error.passwordShort';
    if (form.confirm !== form.password) next.confirm = 'error.passwordMismatch';
    if (!agreed) next.terms = 'error.mustAgree';
    if (!token) next.captcha = 'error.completeCheck';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const created = await signUp({ ...form });
      toast.success(t('toast.accountCreated'), { description: t('toast.welcome', { name: created.name.split(' ')[0] }) });
      navigate(homePath(created), { replace: true });
    } catch (err) {
      setFormError(err instanceof AuthError ? err.key : 'error.emailTaken');
      setSubmitting(false);
    }
  }

  const err = (f: Field) => errors[f] ? t(errors[f]!) : undefined;

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
      <>
          {t('auth.haveAccount')}{' '}
          <Link to="/sign-in" className="font-medium text-accent hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }>
      
      <GoogleButton mode="signup" />
      <AuthDivider label={t('auth.or')} />

      <form noValidate onSubmit={handleSubmit} className="space-y-4">
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

        <TextField label={t('auth.fullName')} autoComplete="name" value={form.name} onChange={update('name')} error={err('name')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={err('email')}
            className="min-w-0" />
          
          <TextField
            label={t('auth.phone')}
            type="tel"
            autoComplete="tel"
            placeholder="+234"
            value={form.phone}
            onChange={update('phone')}
            error={err('phone')}
            className="min-w-0" />
          
        </div>

        <div>
          <label htmlFor="signup-lga" className="block text-sm font-medium">
            {t('auth.lga')}
          </label>
          <select
            id="signup-lga"
            value={form.lga}
            onChange={update('lga')}
            className={`${fieldInputClass} mt-1.5 border-line focus:border-accent`}>
            
            {lgas.map((l) =>
            <option key={l}>{l}</option>
            )}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label={t('auth.password')}
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            error={err('password')}
            hint={t('auth.passwordHint')}
            className="min-w-0" />
          
          <PasswordField
            label={t('auth.confirmPassword')}
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
            error={err('confirm')}
            className="min-w-0" />
          
        </div>

        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-[var(--accent)]" />
            
            <span className="leading-snug">{t('auth.terms')}</span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs text-danger">{t(errors.terms)}</p>}
        </div>

        <TurnstileWidget onVerify={onVerify} onExpire={onExpire} error={err('captcha')} />

        <button type="submit" disabled={submitting} className={submitButtonClass}>
          {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? t('auth.creating') : t('auth.signUp')}
        </button>
      </form>
    </AuthLayout>);

}