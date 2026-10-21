/**
 * Reading the `Cookie` request header.
 *
 * Express can *write* cookies (`res.cookie`), but reading them needs
 * `cookie-parser` or this. Hand-rolling keeps the dependency tree where the
 * rest of this backend is — the parsing rule is small enough to state exactly,
 * and small enough to test exhaustively.
 *
 * This only ever *reads*; the session id it returns is then looked up in the
 * session store, so an attacker-supplied value can select at most a record
 * that does not exist.
 */

/** RFC 6265 cookie-name token characters. Anything else ends the name. */
const NAME_END = /[=;\s]/;

/**
 * Extracts one cookie value from a `Cookie` header.
 *
 * Returns undefined — rather than throwing — for a malformed header, an
 * unknown name, or an absent header, because none of those are exceptional
 * enough to fail a request over.
 */
export function readCookie(header: string | string[] | undefined, name: string): string | undefined {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw || !name) return undefined;

  // A header is "a=1; b=2; c=3"; empty segments come from stray separators.
  for (const segment of raw.split(";")) {
    const eq = segment.indexOf("=");
    if (eq < 0) continue;
    const key = segment.slice(0, eq).trim();
    if (key !== name) continue;
    const value = segment.slice(eq + 1).trim();
    if (!value) return undefined;
    // Strip the RFC 6265 quoted-string form some clients still send.
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      return value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

/** True when `value` is safe to place unquoted in a `Set-Cookie` header. */
function isCookieValue(value: string): boolean {
  return /^[\w.-]+$/.test(value);
}

export interface SessionCookieOptions {
  /** Seconds until the cookie expires. Absent makes it a session cookie. */
  maxAgeSeconds?: number;
  /** Production over HTTPS sets this; plain-HTTP development does not. */
  secure: boolean;
}

/**
 * Builds the `Set-Cookie` header for a session.
 *
 * `httpOnly` keeps the id out of JavaScript, which is the whole point of
 * moving off `localStorage`: an XSS bug can no longer read the session and
 * replay it. `SameSite=Lax` blocks the cross-site POSTs that CSRF relies on
 * while still letting a user follow a link into the app.
 *
 * Returns undefined for a value that could break out of the header — a cheap
 * guard, since everything we mint is hex, but it turns a mistake into a
 * failed sign-in instead of a header-injection bug.
 */
export function sessionSetCookie(
  name: string,
  value: string,
  { maxAgeSeconds, secure }: SessionCookieOptions
): string | undefined {
  if (!isCookieValue(value)) return undefined;

  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAgeSeconds !== undefined) {
    if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) return undefined;
    parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`);
  }
  return parts.join("; ");
}

/** The `Set-Cookie` header that clears a session cookie. */
export function sessionClearCookie(name: string, secure: boolean): string {
  const parts = [`${name}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
