/**
 * Server-side check of Cloudflare Turnstile tokens.
 *
 * The widget in the browser only produces a token; it proves nothing until
 * Cloudflare's siteverify endpoint confirms it with the secret key. Each token
 * is single-use and expires after 300 seconds.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's documented upper bound on token length. */
export const MAX_TOKEN_LENGTH = 2048;

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
}

export async function verifyTurnstileToken(
  token: string,
  secret: string,
  remoteIp?: string,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileResult> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetchImpl(SITEVERIFY_URL, { method: "POST", body });
  if (!res.ok) return { success: false, errorCodes: [`http-${res.status}`] };

  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  return { success: data.success === true, errorCodes: data["error-codes"] ?? [] };
}
