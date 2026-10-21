import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, Loader2Icon, LockKeyholeIcon, TimerOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { PasswordField } from '../../components/auth/PasswordField';
import { PasswordStrength } from '../../components/auth/PasswordStrength';
import { submitButtonClass } from '../../components/auth/AuthDivider';
import { btnSecondary } from '../../components/ui/buttons';
import { AuthError, useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import type { TranslationKey } from '../../data/translations';

const iconBox = (Icon: typeof LockKeyholeIcon, tone = 'bg-accent-soft text-accent-strong') =>
<span className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone}`}>
    <Icon className="h-6 w-6" aria-hidden />
  </span>;


export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { t } = useI18n();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  // Reset tokens are checked by the server now rather than read out of
  // localStorage, so this page cannot know a link is bad before trying it.
  // Only a link with no token at all can be rejected up front; an expired or
  // spent one is caught when it is submitted.
  const [rejected, setRejected] = useState(!token);
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{password?: TranslationKey;confirm?: TranslationKey;}>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (rejected && !done) {
    return (
      <AuthLayout
        icon={iconBox(TimerOffIcon, 'bg-danger-soft text-danger')}
        title={t('reset.invalidTitle')}
        subtitle={t('reset.invalidBody')}>
        
        <div className="space-y-3">
          <Link to="/forgot-password" className={submitButtonClass}>
            {t('reset.requestNew')}
          </Link>
          <Link to="/sign-in" className={`${btnSecondary} w-full`}>
            {t('callback.back')}
          </Link>
        </div>
      </AuthLayout>);

  }

  if (done) {
    return (
      <AuthLayout
        icon={iconBox(CheckCircle2Icon, 'bg-success-soft text-success')}
        title={t('reset.successTitle')}
        subtitle={t('reset.successBody')}>
        
        <button type="button" onClick={() => navigate('/sign-in', { replace: true })} className={submitButtonClass}>
          {t('auth.signIn')}
        </button>
      </AuthLayout>);

  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < 8) next.password = 'error.passwordShort';
    if (confirm !== password) next.confirm = 'error.passwordMismatch';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast.success(t('reset.successTitle'));
    } catch (err) {
      // The server refused the token: expired, spent, or never issued. Swap
      // to the expired-link screen, which is a more useful answer than a
      // toast over a form that will keep failing.
      if (err instanceof ApiError && err.code === 'token_invalid') {
        setRejected(true);
        return;
      }
      toast.error(err instanceof AuthError ? t(err.key) : t('reset.invalidTitle'));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      icon={iconBox(LockKeyholeIcon)}
      title={t('reset.title')}
      subtitle={
      email ?
        <span className="break-words">{t('reset.subtitle', { email })}</span> :
        undefined}
      footer={
      <Link to="/sign-in" className="font-medium text-accent hover:underline">
          {t('callback.back')}
        </Link>
      }>
      
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
        <div>
          <PasswordField
            label={t('auth.password')}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            error={errors.password && t(errors.password)}
            hint={t('auth.passwordHint')} />
          
          <PasswordStrength password={password} />
        </div>
        <PasswordField
          label={t('auth.confirmPassword')}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm && t(errors.confirm)} />
        
        <button type="submit" disabled={submitting} className={submitButtonClass}>
          {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? t('reset.updating') : t('reset.submit')}
        </button>
      </form>
    </AuthLayout>);

}