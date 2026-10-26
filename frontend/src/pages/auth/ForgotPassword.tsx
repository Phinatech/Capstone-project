import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, KeyRoundIcon, Loader2Icon, MailCheckIcon } from 'lucide-react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { TextField } from '../../components/auth/TextField';
import { TurnstileWidget } from '../../components/auth/TurnstileWidget';
import { submitButtonClass } from '../../components/auth/AuthDivider';
import { btnSecondary } from '../../components/ui/buttons';
import { AuthError, useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useCaptcha } from '../../hooks/useCaptcha';
import { TURNSTILE_ENFORCED } from '../../data/authConfig';
import { isValidEmail } from '../../utils/users';
import type { TranslationKey } from '../../data/translations';

export function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  // A translation key, or the server's own wording where no key exists.
  const [error, setError] = useState<TranslationKey | string | null>(null);
  const [captchaError, setCaptchaError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{email: string;resetToken: string | null;} | null>(null);

  const captcha = useCaptcha(() => setCaptchaError(null));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('error.required');
    if (!isValidEmail(email)) return setError('error.invalidEmail');
    setError(null);
    // With no real site key there is no widget to complete, so demanding a
    // token would block a password reset for a check that is not running.
    if (TURNSTILE_ENFORCED && !captcha.token) return setCaptchaError('error.completeCheck');
    setSubmitting(true);
    const captchaCheck = await captcha.check();
    if (captchaCheck) {
      setCaptchaError(captchaCheck);
      setSubmitting(false);
      return;
    }
    try {
      // Null here just means the server is not disclosing tokens — the email
      // still "sent", and the account state was not revealed either way.
      const resetToken = await requestPasswordReset(email);
      setSent({ email: email.trim(), resetToken });
    } catch (err) {
      setError(err instanceof AuthError ? err.key : null);
    }
    setSubmitting(false);
  }

  const backLink =
  <Link to="/sign-in" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
      <ArrowLeftIcon className="h-4 w-4" aria-hidden />
      {t('callback.back')}
    </Link>;


  const iconBox = (Icon: typeof KeyRoundIcon) =>
  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
      <Icon className="h-6 w-6" aria-hidden />
    </span>;


  return (
    <AuthLayout
      icon={iconBox(sent ? MailCheckIcon : KeyRoundIcon)}
      title={sent ? t('forgot.sentTitle') : t('forgot.title')}
      subtitle={sent ? t('forgot.sentBody', { email: sent.email }) : t('forgot.subtitle')}
      footer={backLink}>
      
      <AnimatePresence mode="wait" initial={false}>
        {sent ?
        <motion.div
          key="sent"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-3">
          
            {sent.resetToken &&
          <Link
              to={`/reset-password?token=${encodeURIComponent(sent.resetToken)}&email=${encodeURIComponent(sent.email)}`}
              className={`${submitButtonClass}`}>

                {t('forgot.openDemo')}
              </Link>
          }
            <button type="button" onClick={() => setSent(null)} className={`${btnSecondary} w-full`}>
              {t('reset.requestNew')}
            </button>
            <p className="rounded-md bg-canvas px-3 py-2.5 text-xs leading-relaxed text-muted">
              Demo: no email is sent. If the address belongs to an account, use the button above to open the reset link.
            </p>
          </motion.div> :

        <motion.form
          key="form"
          noValidate
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-4">
          
            <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ? t(error) : undefined}
            placeholder="you@example.com" />
          
            {TURNSTILE_ENFORCED &&
            <TurnstileWidget {...captcha.widget} error={captchaError ? t(captchaError) : undefined} />}
            <button type="submit" disabled={submitting} className={submitButtonClass}>
              {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
              {submitting ? t('forgot.sending') : t('forgot.submit')}
            </button>
          </motion.form>
        }
      </AnimatePresence>
    </AuthLayout>);

}