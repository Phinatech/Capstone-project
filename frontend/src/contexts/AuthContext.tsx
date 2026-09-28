import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  deleteUser,
  findUser,
  findUserByEmail,
  hasPassword,
  hashPassword,
  randomWallet,
  registerUser,
  setPassword,
  updateUser,
  verifyPassword } from
'../utils/users';
import {
  checkVerificationCode,
  consumeResetToken,
  createResetToken,
  createVerificationCode,
  readResetToken,
  readVerificationCode } from
'../utils/authTokens';
import type { TranslationKey } from '../data/translations';
import type { GoogleIdentity } from '../utils/jwt';
import type { ProfilePatch, SignUpInput, User } from '../types/user';

const STORAGE_KEY = 'sokoto-cover-user';
const BOOT_MS = 650;
const AUTH_LATENCY_MS = 850;

export class AuthError extends Error {
  constructor(public key: TranslationKey) {
    super(key);
  }
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  signInWithPassword: (email: string, password: string, remember: boolean) => Promise<User>;
  signUp: (input: SignUpInput) => Promise<User>;
  completeGoogleSignIn: (identity: GoogleIdentity) => Promise<User>;
  verifyEmail: (code: string) => Promise<User>;
  resendVerification: () => string | null;
  currentVerificationCode: () => string | null;
  requestPasswordReset: (email: string) => Promise<string | null>;
  resetPassword: (token: string, password: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<User>;
  changePassword: (current: string, next: string) => Promise<void>;
  userHasPassword: () => boolean;
  deleteAccount: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readStoredUser(): User | null {
  try {
    const id = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    return id ? findUser(id) ?? null : null;
  } catch {
    return null;
  }
}

function persist(user: User, remember: boolean) {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
    (remember ? window.localStorage : window.sessionStorage).setItem(STORAGE_KEY, user.id);
  } catch {

    /* storage unavailable */}
}

function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {

    /* storage unavailable */}
}

export function AuthProvider({ children }: {children: React.ReactNode;}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setUser(readStoredUser());
      setReady(true);
    }, BOOT_MS);
    return () => clearTimeout(t);
  }, []);

  const stamp = (u: User) => updateUser(u.id, { lastSignInAt: new Date().toISOString() }) ?? u;

  const signInWithPassword = useCallback(async (email: string, password: string, remember: boolean) => {
    await wait(AUTH_LATENCY_MS);
    const found = findUserByEmail(email);
    if (!found || !verifyPassword(found, password)) throw new AuthError('error.invalidCredentials');
    const signedIn = stamp(found);
    persist(signedIn, remember);
    setUser(signedIn);
    return signedIn;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    await wait(AUTH_LATENCY_MS);
    if (findUserByEmail(input.email)) throw new AuthError('error.emailTaken');
    const created = registerUser({
      id: `farmer-${Date.now().toString(36)}`,
      role: 'farmer',
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      lga: input.lga,
      wallet: randomWallet(),
      joinedAt: new Date().toISOString().slice(0, 10),
      provider: 'password',
      emailVerified: false,
      lastSignInAt: new Date().toISOString(),
      passwordHash: hashPassword(input.password)
    });
    createVerificationCode(created.id);
    persist(created, true);
    setUser(created);
    return created;
  }, []);

  const completeGoogleSignIn = useCallback(async (identity: GoogleIdentity) => {
    await wait(300);
    const existing = findUserByEmail(identity.email);
    const signedIn = stamp(
      existing ??
      registerUser({
        id: `farmer-${identity.sub.slice(-10)}`,
        role: 'farmer',
        name: identity.name,
        email: identity.email.toLowerCase(),
        wallet: randomWallet(),
        joinedAt: new Date().toISOString().slice(0, 10),
        provider: 'google',
        emailVerified: true,
        avatarUrl: identity.picture
      })
    );
    persist(signedIn, true);
    setUser(signedIn);
    return signedIn;
  }, []);

  const verifyEmail = useCallback(
    async (code: string) => {
      await wait(700);
      if (!user || !checkVerificationCode(user.id, code)) throw new AuthError('verify.invalid');
      const updated = updateUser(user.id, { emailVerified: true }) ?? user;
      setUser(updated);
      return updated;
    },
    [user]
  );

  const resendVerification = useCallback(() => user ? createVerificationCode(user.id) : null, [user]);
  const currentVerificationCode = useCallback(() => user ? readVerificationCode(user.id) : null, [user]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await wait(AUTH_LATENCY_MS);
    return findUserByEmail(email) ? createResetToken(email) : null;
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await wait(AUTH_LATENCY_MS);
    const entry = readResetToken(token);
    const target = entry ? findUserByEmail(entry.email) : undefined;
    if (!entry || !target) throw new AuthError('reset.invalidTitle');
    setPassword(target.id, password);
    consumeResetToken(token);
  }, []);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      await wait(600);
      if (!user) throw new AuthError('error.required');
      const updated = updateUser(user.id, patch) ?? user;
      setUser(updated);
      return updated;
    },
    [user]
  );

  const userHasPassword = useCallback(() => {
    const stored = user ? findUserByEmail(user.email) : undefined;
    return !!stored && hasPassword(stored);
  }, [user]);

  const changePassword = useCallback(
    async (current: string, next: string) => {
      await wait(AUTH_LATENCY_MS);
      const stored = user ? findUserByEmail(user.email) : undefined;
      if (!user || !stored) throw new AuthError('error.required');
      if (hasPassword(stored) && !verifyPassword(stored, current)) throw new AuthError('error.currentPassword');
      setPassword(user.id, next);
    },
    [user]
  );

  const signOut = useCallback(() => {
    setUser(null);
    clearSession();
  }, []);

  const deleteAccount = useCallback(() => {
    if (user) deleteUser(user.id);
    setUser(null);
    clearSession();
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      ready,
      signInWithPassword,
      signUp,
      completeGoogleSignIn,
      verifyEmail,
      resendVerification,
      currentVerificationCode,
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
    currentVerificationCode,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    changePassword,
    userHasPassword,
    deleteAccount,
    signOut]

  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}