import { randomToken } from './users';

const RESET_KEY = 'sokoto-cover-reset-tokens';
const CODES_KEY = 'sokoto-cover-verification-codes';
const RESET_TTL_MS = 30 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

interface ResetToken {
  token: string;
  email: string;
  expires: number;
}

interface VerificationCode {
  code: string;
  expires: number;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {

    /* storage unavailable */}
}

export function createResetToken(email: string): string {
  const tokens = load<ResetToken[]>(RESET_KEY, []).filter((t) => t.expires > Date.now());
  const token = randomToken(40);
  tokens.push({ token, email: email.toLowerCase(), expires: Date.now() + RESET_TTL_MS });
  save(RESET_KEY, tokens);
  return token;
}

export function readResetToken(token: string): {email: string;} | null {
  const found = load<ResetToken[]>(RESET_KEY, []).find((t) => t.token === token && t.expires > Date.now());
  return found ? { email: found.email } : null;
}

export function consumeResetToken(token: string) {
  save(
    RESET_KEY,
    load<ResetToken[]>(RESET_KEY, []).filter((t) => t.token !== token)
  );
}

export function createVerificationCode(userId: string): string {
  const codes = load<Record<string, VerificationCode>>(CODES_KEY, {});
  const code = String(Math.floor(100000 + Math.random() * 900000));
  codes[userId] = { code, expires: Date.now() + CODE_TTL_MS };
  save(CODES_KEY, codes);
  return code;
}

export function readVerificationCode(userId: string): string | null {
  const entry = load<Record<string, VerificationCode>>(CODES_KEY, {})[userId];
  return entry && entry.expires > Date.now() ? entry.code : null;
}

export function checkVerificationCode(userId: string, code: string): boolean {
  const codes = load<Record<string, VerificationCode>>(CODES_KEY, {});
  const entry = codes[userId];
  const ok = !!entry && entry.expires > Date.now() && entry.code === code;
  if (ok) {
    delete codes[userId];
    save(CODES_KEY, codes);
  }
  return ok;
}