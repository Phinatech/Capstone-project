/**
 * Server-side verification of Google ID tokens.
 *
 * The frontend's `decodeGoogleCredential` base64-decoded the JWT payload and
 * trusted it — signature never checked, issuer never checked, audience never
 * checked (F-1). Anyone could mint `{email: 'admin@sokotocover.ng', sub: ...}`
 * from DevTools and be handed the admin account.
 *
 * This verifies the signature against Google's published keys and then the
 * claims that make the token mean anything: the algorithm, the key id, the
 * issuer, the audience, the expiry, and that Google considers the email
 * verified.
 *
 * Implemented on `node:crypto` rather than `google-auth-library` to keep the
 * dependency tree as the rest of this backend is; the tests cover the failure
 * modes that matter — a forged payload, a wrong key, `alg: none`, an expired
 * token and a wrong audience all have to fail.
 */
import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const JWKS_CACHE_MS = 60 * 60_000;

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

export interface GoogleVerifier {
  /** Rejects with a message safe to log; callers should not surface it raw. */
  verify: (idToken: string, audience: string) => Promise<GoogleIdentity>;
}

interface JwksKey {
  kid: string;
  use?: string;
  kty?: string;
  alg?: string;
  key: JsonWebKey;
}

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

export interface GoogleVerifierOptions {
  /** Injected so tests can serve a fixture instead of Google's live endpoint. */
  fetchJwks?: () => Promise<{ keys: JsonWebKey[] }>;
  url?: string;
  /** How long to trust a fetched key set before re-fetching. */
  cacheMs?: number;
  clockSkewSeconds?: number;
  /** Injectable clock, so expiry tests do not have to wait or fake Date. */
  now?: () => number;
}

export function createGoogleVerifier(options: GoogleVerifierOptions = {}): GoogleVerifier {
  const url = options.url ?? JWKS_URL;
  const cacheMs = options.cacheMs ?? JWKS_CACHE_MS;
  const skewSeconds = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  const now = options.now ?? Date.now;
  const fetchJwks =
    options.fetchJwks ??
    (async () => {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Google JWKS responded ${res.status}`);
      return (await res.json()) as { keys: JsonWebKey[] };
    });

  let cached: { keys: JwksKey[]; fetchedAt: number } | null = null;

  async function keys(forceRefresh: boolean): Promise<JwksKey[]> {
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < cacheMs) return cached.keys;
    const raw = await fetchJwks();
    cached = {
      keys: (raw.keys ?? []).flatMap((jwk) => {
        const kid = typeof jwk.kid === "string" ? jwk.kid : undefined;
        return kid ? [{ kid, key: jwk }] : [];
      }),
      fetchedAt: Date.now()
    };
    return cached.keys;
  }

  return {
    async verify(idToken, audience) {
      if (typeof idToken !== "string" || !idToken) throw new Error("missing ID token");
      // Reject before parsing: `alg: none` tokens are unsigned by definition,
      // and accepting a header we cannot verify is the classic JWT mistake.
      // Destructuring the three segments proves the shape and gives
      // non-optional bindings rather than `string | undefined`.
      const [rawHeader, rawPayload, rawSignature] = idToken.split(".");
      if (!rawHeader || !rawPayload || !rawSignature) throw new Error("malformed ID token");

      let header: { alg?: unknown; kid?: unknown };
      let payload: Record<string, unknown>;
      try {
        header = decodeSegment(rawHeader) as { alg?: unknown; kid?: unknown };
        payload = decodeSegment(rawPayload) as Record<string, unknown>;
      } catch {
        throw new Error("malformed ID token");
      }
      if (header.alg !== "RS256") throw new Error("unsupported signature algorithm");
      if (typeof header.kid !== "string" || !header.kid) throw new Error("token has no key id");

      const signature = Buffer.from(rawSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const signed = `${rawHeader}.${rawPayload}`;

      // Look the key up by id. Falling back to "some key that works" would let
      // an attacker present their own key and have us verify against it.
      const signatureValid = async (refresh: boolean): Promise<boolean> => {
        const match = (await keys(refresh)).find((k) => k.kid === header.kid);
        if (!match) return false;
        const verifier = createVerify("RSA-SHA256");
        verifier.update(signed);
        verifier.end();
        return verifier.verify(createPublicKey({ key: match.key, format: "jwk" }), signature);
      };

      if (!(await signatureValid(false)) && !(await signatureValid(true))) {
        // The second pass handles key rotation, where the cached set simply no
        // longer contains this kid.
        throw new Error("signature does not verify against Google's keys");
      }

      const issuer = typeof payload.iss === "string" ? payload.iss : "";
      if (!ISSUERS.has(issuer)) throw new Error("unexpected token issuer");

      // Audience is the check that stops a token minted for some *other* Google
      // app from being replayed here.
      const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audiences.includes(audience)) throw new Error("token was not issued for this application");

      const expiry = Number(payload.exp);
      if (!Number.isFinite(expiry) || expiry * 1000 <= now() - skewSeconds * 1000) {
        throw new Error("token has expired");
      }
      const issuedAt = Number(payload.iat);
      if (Number.isFinite(issuedAt) && issuedAt * 1000 > now() + skewSeconds * 1000) {
        throw new Error("token is from the future");
      }

      const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
      const sub = typeof payload.sub === "string" ? payload.sub : "";
      if (!email || !sub) throw new Error("token carries no identity");

      // `email_verified: false` means Google saw the address unconfirmed; a
      // federated login must not treat that as proof of ownership.
      if (payload.email_verified === false) throw new Error("email address is not verified");

      return {
        sub,
        email,
        // `split` indexes, and `noUncheckedIndexedAccess` is right to flag it:
        // an address with no `@` would otherwise produce undefined.
        name: typeof payload.name === "string" && payload.name ? payload.name : (email.split("@")[0] ?? email),
        picture: typeof payload.picture === "string" ? payload.picture : undefined,
        emailVerified: payload.email_verified !== false
      };
    }
  };
}
