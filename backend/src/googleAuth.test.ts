import assert from "node:assert/strict";
import { createSign, generateKeyPairSync, type JsonWebKey, type KeyObject } from "node:crypto";
import { describe, it } from "node:test";
import { createGoogleVerifier } from "./utils/googleAuth.js";

/**
 * These tests exercise the property F-1 was raised over: a token that merely
 * *looks* valid must not be accepted. Every case below has to fail for the
 * verification to be worth anything, so the fixtures are built the way an
 * attacker would build them — with a real key, a real signature, and one
 * thing changed.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const OTHER_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;

const KID = "sokoto-cover-test-key";
const AUDIENCE = "1234567890-abc.apps.googleusercontent.com";
const NOW = Date.parse("2026-10-21T09:00:00.000Z");

const jwks = {
  keys: [{ ...(publicKey.export({ format: "jwk" }) as JsonWebKey), kid: KID, use: "sig", alg: "RS256" }]
};

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function tokenWith(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  key: KeyObject = privateKey
): string {
  const data = `${b64url(header)}.${b64url(payload)}`;
  const signature = createSign("RSA-SHA256").update(data).sign(key).toString("base64url");
  return `${data}.${signature}`;
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const seconds = Math.floor(NOW / 1000);
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    sub: "118273645543210987654",
    email: "Amina.Bello@gmail.com",
    email_verified: true,
    name: "Amina Bello",
    iat: seconds,
    exp: seconds + 3600,
    ...overrides
  };
}

function validToken(overrides: Record<string, unknown> = {}, key: KeyObject = privateKey): string {
  return tokenWith({ alg: "RS256", kid: KID, typ: "JWT" }, validPayload(overrides), key);
}

function verifier() {
  return createGoogleVerifier({ fetchJwks: async () => jwks, now: () => NOW });
}

async function rejects(token: string, pattern: RegExp, audience = AUDIENCE): Promise<void> {
  await assert.rejects(() => verifier().verify(token, audience), pattern);
}

describe("Google ID token verification", () => {
  it("accepts a token Google could have issued", async () => {
    const identity = await verifier().verify(validToken(), AUDIENCE);
    assert.equal(identity.email, "amina.bello@gmail.com", "the address is normalised");
    assert.equal(identity.sub, "118273645543210987654");
    assert.equal(identity.name, "Amina Bello");
    assert.equal(identity.emailVerified, true);
  });

  it("rejects a payload that was edited after signing", async () => {
    const [, payload, signature] = validToken().split(".");
    const forged = { ...JSON.parse(Buffer.from(payload!, "base64url").toString()), email: "admin@sokotocover.ng" };
    await rejects(`${b64url({ alg: "RS256", kid: KID })}.${b64url(forged)}.${signature}`, /signature/);
  });

  it("rejects a token signed with a key that is not Google's", async () => {
    await rejects(validToken({}, OTHER_KEY), /signature/);
  });

  it("rejects `alg: none`, the classic unsigned-token bypass", async () => {
    const data = `${b64url({ alg: "none", kid: KID })}.${b64url(validPayload())}`;
    // Both forms are refused before any signature is considered: an empty
    // signature is not a signature, and a present one never gets as far as
    // being verified because the algorithm is already wrong.
    await rejects(`${data}.`, /malformed/);
    await rejects(`${data}.anything`, /algorithm/);
  });

  it("rejects a token whose key id is not in the key set", async () => {
    // Matters because a verifier that falls back to "any key" lets an attacker
    // publish their own and have it trusted.
    const data = `${b64url({ alg: "RS256", kid: "attacker-key" })}.${b64url(validPayload())}`;
    const signature = createSign("RSA-SHA256").update(data).sign(privateKey).toString("base64url");
    await rejects(`${data}.${signature}`, /key id|signature/);
  });

  it("rejects a token minted for a different Google application", async () => {
    // The token is genuine and correctly signed — it is simply not ours. This
    // is the check that stops a real Google token from another app being
    // replayed here.
    await rejects(validToken(), /application/, "9999-other-app.apps.googleusercontent.com");
  });

  it("rejects an expired token", async () => {
    await rejects(validToken({ exp: Math.floor(NOW / 1000) - 3600 }), /expired/);
  });

  it("rejects a token from the future", async () => {
    await rejects(validToken({ iat: Math.floor(NOW / 1000) + 3600 }), /future/);
  });

  it("rejects an unexpected issuer", async () => {
    await rejects(validToken({ iss: "https://evil.example.com" }), /issuer/);
  });

  it("rejects an unverified email address", async () => {
    await rejects(validToken({ email_verified: false }), /not verified/);
  });

  it("rejects a token with no identity in it", async () => {
    await rejects(validToken({ email: undefined, sub: undefined }), /identity/);
  });

  it("rejects a malformed token without throwing something unhelpful", async () => {
    for (const bad of ["", "not-a-jwt", "a.b", "a.b.c.d"]) {
      await assert.rejects(() => verifier().verify(bad, AUDIENCE));
    }
  });

  it("refetches the key set once, to survive key rotation", async () => {
    let calls = 0;
    const rotating = createGoogleVerifier({
      now: () => NOW,
      fetchJwks: async () => {
        calls += 1;
        // First answer is stale: the key this token names is not in it.
        return calls === 1 ? { keys: [] } : jwks;
      }
    });
    const identity = await rotating.verify(validToken(), AUDIENCE);
    assert.equal(identity.sub, "118273645543210987654");
    assert.equal(calls, 2, "a miss has to trigger exactly one refresh");
  });

  it("does not refetch when the key is already cached", async () => {
    let calls = 0;
    const cached = createGoogleVerifier({
      now: () => NOW,
      fetchJwks: async () => {
        calls += 1;
        return jwks;
      }
    });
    await cached.verify(validToken(), AUDIENCE);
    await cached.verify(validToken(), AUDIENCE);
    assert.equal(calls, 1);
  });

  it("falls back to the email's local part when Google sends no name", async () => {
    const identity = await verifier().verify(validToken({ name: undefined }), AUDIENCE);
    assert.equal(identity.name, "amina.bello");
  });
});
