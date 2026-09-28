export interface GoogleIdentity {
  email: string;
  name: string;
  sub: string;
  picture?: string;
}

/** Decodes the payload of a Google ID token (JWT). Signature is verified server-side in production. */
export function decodeGoogleCredential(token: string): GoogleIdentity | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const json = decodeURIComponent(
      atob(padded).
      split('').
      map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).
      join('')
    );
    const data = JSON.parse(json) as Partial<GoogleIdentity>;
    if (!data.email || !data.sub) return null;
    return { email: data.email, name: data.name ?? data.email.split('@')[0], sub: data.sub, picture: data.picture };
  } catch {
    return null;
  }
}