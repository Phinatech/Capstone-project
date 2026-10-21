import { useCallback, useRef, useState } from 'react';
import { TURNSTILE_ENFORCED } from '../data/authConfig';
import type { TranslationKey } from '../data/translations';

const API_URL = import.meta.env.VITE_API_URL?.trim() || '';

async function verifyWithBackend(token: string): Promise<'ok' | 'failed' | 'unavailable'> {
  try {
    const res = await fetch(`${API_URL}/auth/turnstile/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (res.ok) return 'ok';
    return res.status === 400 ? 'failed' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Turnstile state for a form: the widget's token, plus `check()` to confirm
 * it before submitting. With the demo test key the token is trusted as is;
 * with a real key the backend verifies it with Cloudflare.
 */
export function useCaptcha(onVerified?: () => void) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;
  // A token from our own reset after check() must not clear the error check() just reported.
  const resetPending = useRef(false);

  const onVerify = useCallback((tk: string) => {
    setToken(tk);
    if (resetPending.current) resetPending.current = false;else
    onVerifiedRef.current?.();
  }, []);
  const onExpire = useCallback(() => setToken(null), []);

  /** Resolves to null when the check passed, or the error to show next to the widget. */
  const check = useCallback(async (): Promise<TranslationKey | null> => {
    if (!token) return 'error.completeCheck';
    if (!TURNSTILE_ENFORCED) return null;
    const result = await verifyWithBackend(token);
    // Cloudflare accepts a token only once, so any later attempt needs a fresh one.
    setToken(null);
    resetPending.current = true;
    setResetKey((k) => k + 1);
    if (result === 'ok') return null;
    return result === 'failed' ? 'error.checkFailed' : 'error.checkUnavailable';
  }, [token]);

  return { token, check, widget: { onVerify, onExpire, resetKey } };
}
