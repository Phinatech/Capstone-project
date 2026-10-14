import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, describe, it } from "node:test";
import express from "express";

// Set before the config loads. No Termii key, so nothing can really be sent:
// a request that gets past every check ends in Termii's "not configured" 502.
process.env.NOTIFY_API_KEY = "test-secret";
process.env.TERMINII_API_KEY = "";
const { config } = await import("./config.js");
const { default: router } = await import("./routes/api.js");

const app = express();
app.use(express.json());
app.use("/api", router);
const server = app.listen(0);
after(() => server.close());
const { port } = server.address() as AddressInfo;

async function post(body: unknown, authorization?: string) {
  const res = await fetch(`http://127.0.0.1:${port}/api/notify/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: string } };
}

const valid = { phone: "08031234567", type: "payout", policyId: 3, payoutEth: 0.02 };

describe("POST /api/notify/sms", () => {
  it("is off while NOTIFY_API_KEY is unset", async () => {
    const key = config.notifyApiKey;
    config.notifyApiKey = "";
    try {
      assert.equal((await post(valid, "Bearer test-secret")).status, 503);
    } finally {
      config.notifyApiKey = key;
    }
  });

  it("refuses callers without the right key", async () => {
    assert.equal((await post(valid)).status, 401);
    assert.equal((await post(valid, "Bearer wrong")).status, 401);
    assert.equal((await post(valid, "test-secret")).status, 401);
  });

  it("rejects numbers and fields it shouldn't send", async () => {
    const auth = "Bearer test-secret";
    assert.equal((await post({ ...valid, phone: "+15551234567" }, auth)).status, 400);
    assert.equal((await post({ ...valid, policyId: "3" }, auth)).status, 400);
    assert.equal((await post({ ...valid, payoutEth: -1 }, auth)).status, 400);
    assert.equal((await post({ ...valid, type: "promo" }, auth)).status, 400);
  });

  it("hands a valid request to the SMS provider", async () => {
    const res = await post(valid, "Bearer test-secret");
    assert.equal(res.status, 502);
    assert.match(res.body.error ?? "", /TERMINII_API_KEY is not configured/);
  });
});
