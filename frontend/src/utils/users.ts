import { users } from '../data/users';
import { demoCredentials } from '../data/demoCredentials';
import type { StoredUser, User } from '../types/user';

const REGISTRY_KEY = 'sokoto-cover-registered-users';
const OVERRIDES_KEY = 'sokoto-cover-user-overrides';
const PASSWORDS_KEY = 'sokoto-cover-password-overrides';
const DELETED_KEY = 'sokoto-cover-deleted-users';

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

const registered: StoredUser[] = load(REGISTRY_KEY, []);
const overrides: Record<string, Partial<User>> = load(OVERRIDES_KEY, {});
const passwordOverrides: Record<string, string> = load(PASSWORDS_KEY, {});
const deleted: string[] = load(DELETED_KEY, []);

function allUsers(): StoredUser[] {
  return [...users, ...registered].filter((u) => !deleted.includes(u.id)).map((u) => ({ ...u, ...overrides[u.id] }));
}

export function findUser(id: string): User | undefined {
  return allUsers().find((u) => u.id === id);
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const e = email.trim().toLowerCase();
  return allUsers().find((u) => u.email.toLowerCase() === e);
}

export function getFarmers(): User[] {
  return allUsers().filter((u) => u.role === 'farmer');
}

export function registerUser(user: StoredUser): User {
  registered.push(user);
  save(REGISTRY_KEY, registered);
  return user;
}

export function updateUser(id: string, patch: Partial<User>): User | undefined {
  overrides[id] = { ...overrides[id], ...patch };
  save(OVERRIDES_KEY, overrides);
  return findUser(id);
}

export function deleteUser(id: string) {
  deleted.push(id);
  save(DELETED_KEY, deleted);
}

export function hashPassword(password: string): string {
  let h = 2166136261;
  for (let i = 0; i < password.length; i++) {
    h ^= password.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function setPassword(id: string, password: string) {
  passwordOverrides[id] = hashPassword(password);
  save(PASSWORDS_KEY, passwordOverrides);
}

export function hasPassword(user: StoredUser): boolean {
  return !!passwordOverrides[user.id] || !!user.passwordHash || demoCredentials.some((c) => c.userId === user.id);
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  if (passwordOverrides[user.id]) return passwordOverrides[user.id] === hashPassword(password);
  const demo = demoCredentials.find((c) => c.userId === user.id);
  if (demo) return demo.password === password;
  return !!user.passwordHash && user.passwordHash === hashPassword(password);
}

export function randomWallet(): string {
  let out = '0x';
  for (let i = 0; i < 40; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

export function randomToken(length = 32): string {
  let out = '';
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

export function initials(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((part) => part[0].toUpperCase()).
  join('');
}

export function homePath(user: User): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'agent') return '/agent';
  return '/farmer';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score) as 1 | 2 | 3;
}