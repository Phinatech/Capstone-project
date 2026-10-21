/**
 * The user *directory*, as the UI sees it — names, LGAs, wallets.
 *
 * This used to be the whole auth system: users in `localStorage`, roles
 * overridable from DevTools, passwords "hashed" with FNV-1a (F-1, F-3). All
 * of that moved to the backend; what is left here is read-only display data
 * plus a few pure helpers.
 *
 * Nothing in this module can authenticate anyone, change a role, or hold a
 * credential. `findUser` answers from an in-memory list refreshed from
 * `GET /api/users/directory`, seeded with the pilot's built-in accounts so
 * names render before the first response lands.
 */
import { users as builtInUsers } from '../data/users';
import type { User } from '../types/user';

const API_URL = import.meta.env.VITE_API_URL ?? '';

let directory: User[] = [...builtInUsers];
const listeners = new Set<() => void>();

/** Replaces the list and tells anything rendering from it to re-read. */
export function setDirectory(users: User[] | ((prev: User[]) => User[])): void {
  directory = typeof users === 'function' ? users(directory) : users;
  for (const listener of listeners) listener();
}

/**
 * Fetches the directory. Called once at start-up; failures leave the built-in
 * accounts in place, because a name lookup is not worth failing the app over.
 */
export async function loadDirectory(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/users/directory`, { credentials: 'include' });
    if (!res.ok) return;
    const body = (await res.json()) as { users?: unknown };
    if (Array.isArray(body.users)) setDirectory(body.users as User[]);
  } catch {
    /* the seeded list still renders */
  }
}

/** Re-runs `render` when the directory changes. */
export function subscribeToDirectory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function findUser(id: string): User | undefined {
  return directory.find((u) => u.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  const wanted = email.trim().toLowerCase();
  return directory.find((u) => u.email.toLowerCase() === wanted);
}

export function getFarmers(): User[] {
  return directory.filter((u) => u.role === 'farmer');
}

export function initials(name: string): string {
  return name.
  split(' ').
  filter(Boolean).
  slice(0, 2).
  map((part) => part[0].toUpperCase()).
  join('');
}

/** Where a role's landing page is. Routing only — not authorization. */
export function homePath(user: User): string {
  if (user.role === 'admin') return '/admin';
  if (user.role === 'agent') return '/agent';
  return '/farmer';
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** A rough hint for the sign-up form. The server enforces the real minimum. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score) as 1 | 2 | 3;
}
