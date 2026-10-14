import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyTurnstileToken } from "./turnstile.js";

function fakeFetch(status: number, body: unknown, seen?: { body?: string }): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    if (seen) seen.body = String(init?.body);
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("verifyTurnstileToken", () => {
  it("accepts a token Cloudflare confirms", async () => {
    const seen: { body?: string } = {};
    const result = await verifyTurnstileToken("tok", "sec", "1.2.3.4", fakeFetch(200, { success: true }, seen));
    assert.deepEqual(result, { success: true, errorCodes: [] });
    const sent = new URLSearchParams(seen.body);
    assert.equal(sent.get("secret"), "sec");
    assert.equal(sent.get("response"), "tok");
    assert.equal(sent.get("remoteip"), "1.2.3.4");
  });

  it("rejects a token Cloudflare refuses, passing on its error codes", async () => {
    const result = await verifyTurnstileToken(
      "tok",
      "sec",
      undefined,
      fakeFetch(200, { success: false, "error-codes": ["timeout-or-duplicate"] })
    );
    assert.deepEqual(result, { success: false, errorCodes: ["timeout-or-duplicate"] });
  });

  it("rejects when siteverify itself fails", async () => {
    const result = await verifyTurnstileToken("tok", "sec", undefined, fakeFetch(500, {}));
    assert.deepEqual(result, { success: false, errorCodes: ["http-500"] });
  });
});
