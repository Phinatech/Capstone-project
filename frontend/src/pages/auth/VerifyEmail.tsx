import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2Icon, MailIcon } from 'lucide-react';
import { toast } from 'sonner';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { submitButtonClass } from '../../components/auth/AuthDivider';
import { AuthError, useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { homePath } from '../../utils/users';

const LENGTH = 6;
const RESEND_SECONDS = 30;

export function VerifyEmail() {
  const { user, verifyEmail, resendVerification, currentVerificationCode, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setDemoCode(currentVerificationCode() ?? resendVerification());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  if (!user) return <Navigate to="/sign-in" replace />;
  if (user.emailVerified !== false && !submitting) return <Navigate to={homePath(user)} replace />;

  async function submit(code: string) {
    if (code.length !== LENGTH) return setError(true);
    setSubmitting(true);
    setError(false);
    try {
      const verified = await verifyEmail(code);
      toast.success(t('verify.title'), { description: verified.email });
      navigate(homePath(verified), { replace: true });
    } catch (err) {
      setError(err instanceof AuthError);
      setSubmitting(false);
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    }
  }

  function setDigit(i: number, value: string) {
    const clean = value.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = clean.slice(0, LENGTH).split('');
      const filled = [...next, ...Array(LENGTH - next.length).fill('')];
      setDigits(filled);
      inputs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      if (next.length === LENGTH) submit(next.join(''));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError(false);
    if (clean && i < LENGTH - 1) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) submit(next.join(''));
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  }

  return (
    <AuthLayout
      icon={
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <MailIcon className="h-6 w-6" aria-hidden />
        </span>
      }
      title={t('verify.title')}
      subtitle={<span className="break-words">{t('verify.subtitle', { email: user.email })}</span>}
      footer={
      <button
        type="button"
        onClick={() => {
          signOut();
          navigate('/sign-in', { replace: true });
        }}
        className="font-medium text-accent hover:underline">
        
          {t('verify.wrongAccount')}
        </button>
      }>
      
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(digits.join(''));
        }}
        className="space-y-5">
        
        <motion.div
          animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-6 gap-2 sm:gap-3">
          
          {digits.map((d, i) =>
          <input
            key={i}
            ref={(el) => inputs.current[i] = el}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={error}
            disabled={submitting}
            className={`h-12 w-full min-w-0 rounded-md border bg-surface text-center font-mono text-lg font-semibold text-ink transition-colors duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-accent-soft sm:h-14 ${
            error ? 'border-danger' : 'border-line focus:border-accent'}`
            } />

          )}
        </motion.div>
        {error &&
        <p role="alert" className="text-sm text-danger">
            {t('verify.invalid')}
          </p>
        }
        {demoCode &&
        <p className="rounded-md bg-canvas px-3 py-2.5 text-xs text-muted">
            {t('verify.demoCode', { code: '' })}
            <span className="font-mono font-semibold tracking-widest text-ink">{demoCode}</span>
          </p>
        }
        <button type="submit" disabled={submitting} className={submitButtonClass}>
          {submitting && <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />}
          {submitting ? t('verify.verifying') : t('verify.submit')}
        </button>
        <div className="text-center">
          <button
            type="button"
            disabled={cooldown > 0}
            onClick={() => {
              setDemoCode(resendVerification());
              setCooldown(RESEND_SECONDS);
              toast(t('verify.sent'));
            }}
            className="text-sm font-medium text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
            
            {cooldown > 0 ? t('verify.resendIn', { s: String(cooldown) }) : t('verify.resend')}
          </button>
        </div>
      </form>
    </AuthLayout>);

}