import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api/client';
import { loadDirectory, setDirectory } from '../utils/users';
import type { TranslationKey } from '../data/translations';
import type { ProfilePatch, SignUpInput, User } from '../types/user';

/**
 * Session state, sourced entirely from the backend.
 *
 * Before F-1 this context owned the whole auth system: users in
 * `localStorage`, passwords hashed with FNV-1a, reset tokens generated and
 * checked in the same browser. All of that moved to the server. What is left
 * here is a thin client — it asks `/auth/*` to do things and holds the user
 * the server says is signed in.
 *
 * The session itself is an httpOnly cookie the browser attaches on its own,
 * so nothing in this file can read it, write it, or lose it to XSS. There is
 * no token, no user id and no password anywhere in `localStorage`.
 */

const API = (path: string) => api<{ user: User | null; demoCode?: string; demoToken?: string }>(path);

/**
 * Server error codes mapped onto the app's own wording, so the English the
 * backend logs does not become the English a Hausa- or French-language user
 * is shown. Anything unlisted falls through to the server's message.
 */
const CODE_KEYS: Record<string, TranslationKey> = {
  invalid_credentials: 'error.invalidCredentials',
  email_taken: 'error.emailTaken',
  weak_password: 'error.passwordShort',
  invalid_email: 'error.invalidEmail',
  current_password: 'error.currentPassword',
  token_rejected: 'error.googleFailed',
  not_configured: 'error.googleFailed',
  captcha_required: 'error.completeCheck',
  captcha_failed: 'error.checkFailed',
  captcha_unavailable: 'error.checkUnavailable',
  code_invalid: 'verify.invalid',
  token_invalid: 'reset.invalidTitle'
};

export class AuthError extends Error {
  /** A translation key, or the server's own wording when there is no key. */
  readonly key: TranslationKey | string;
  constructor(key: TranslationKey | string) {
    super(key);
    this.key = key;
  }
}

function asAuthError(err: unknown): AuthError {
  if (err instanceof ApiError && err.code && CODE_KEYS[err.code]) {
    return new AuthError(CODE_KEYS[err.code]);
  }
  if (err instanceof ApiError) return new AuthError(err.message);
  return err instanceof AuthError ? err : new AuthError(String(err));
}

interface AuthContextValue {
  user: User | null;
  /** False until the session has been checked, so the app does not flash. */
  ready: boolean;
  signInWithPassword: (email: string, password: string, remember: boolean) => Promise<User>;
  signUp: (input: SignUpInput, turnstileToken?: string) => Promise<User>;
  completeGoogleSignIn: (credential: string) => Promise<User>;
  verifyEmail: (code: string) => Promise<User>;
  /** The freshly issued code, when the server is configured to disclose it. */
  resendVerification: () => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  resetPassword: (token: string, password: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<User>;
  changePassword: (current: string, next: string) => Promise<void>;
  /** Whether this account signs in with a password rather than Google. */
  userHasPassword: () => boolean;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Ask the server who is signed in. A missing, expired or revoked session
  // answers with `user: null`, which is the same as being signed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: sessionUser } = await api<{ user: User | null }>('/auth/session');
        if (!cancelled) setUser(sessionUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Names, LGAs and wallets come from the server too.
  useEffect(() => {
    void loadDirectory();
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string, remember: boolean) => {
      try {
        const { user: signedIn } = await api<{ user: User }>('/auth/login', {
          method: 'POST',
          body: { email, password, remember }
        });
        setUser(signedIn);
        return signedIn;
      } catch (err) {
        throw asAuthError(err);
      }
    },
    []
  );

  const signUp = useCallback(async (input: SignUpInput, turnstileToken?: string) => {
    try {
      const { user: created } = await api<{ user: User }>('/auth/register', {
        method: 'POST',
        body: { ...input, turnstileToken }
      });
      setUser(created);
      // The directory feeds every "choose a farmer" list, so a new account has
      // to appear there as well as in the session.
      await loadDirectory();
      return created;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const completeGoogleSignIn = useCallback(async (credential: string) => {
    try {
      const { user: signedIn } = await api<{ user: User }>('/auth/google', {
        method: 'POST',
        body: { credential }
      });
      setUser(signedIn);
      await loadDirectory();
      return signedIn;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const verifyEmail = useCallback(async (code: string) => {
    try {
      const { user: verified } = await api<{ user: User }>('/auth/verify-email', {
        method: 'POST',
        body: { code }
      });
      setUser(verified);
      return verified;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    try {
      const body = await API('/auth/resend-verification');
      return body.demoCode ?? null;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const body = await api<{ demoToken?: string }>('/auth/reset/request', {
        method: 'POST',
        body: { email }
      });
      return body.demoToken ?? null;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    try {
      await api('/auth/reset/confirm', { method: 'POST', body: { token, password } });
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    try {
      const { user: updated } = await api<{ user: User }>('/auth/profile', {
        method: 'PATCH',
        body: patch
      });
      setUser(updated);
      // The directory renders these fields elsewhere in the app.
      setDirectory((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      return updated;
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    try {
      await api('/auth/password', { method: 'POST', body: { current, next } });
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  // No password is ever held client-side, so this is a property of how the
  // account was created rather than something to look up.
  const userHasPassword = useCallback(() => user?.provider === 'password', [user]);

  const deleteAccount = useCallback(async () => {
    try {
      await api('/auth/account', { method: 'DELETE' });
      setUser(null);
      await loadDirectory();
    } catch (err) {
      throw asAuthError(err);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Revokes server-side as well as clearing the cookie: a stolen session
      // id must stop working, not merely go unread.
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* the cookie is gone either way; signing out locally still succeeds */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      signInWithPassword,
      signUp,
      completeGoogleSignIn,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      updateProfile,
      changePassword,
      userHasPassword,
      deleteAccount,
      signOut
    }),
    [
      user,
      ready,
      signInWithPassword,
      signUp,
      completeGoogleSignIn,
      verifyEmail,
      resendVerification,
      requestPasswordReset,
      resetPassword,
      updateProfile,
      changePassword,
      userHasPassword,
      deleteAccount,
      signOut
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
