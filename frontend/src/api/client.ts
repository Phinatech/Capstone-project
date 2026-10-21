/**
 * The one place the frontend talks to the backend auth API.
 *
 * `credentials: 'include'` is what carries the session cookie: the browser
 * keeps it in an httpOnly jar and attaches it to every request, so the
 * frontend never holds, reads or stores a session id (F-1).
 */
const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  /** The server's machine-readable reason, when it sent one. */
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function api<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(payload.error ?? `The server answered ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
