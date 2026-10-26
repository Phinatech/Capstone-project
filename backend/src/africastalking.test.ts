import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sendAfricasTalkingSms } from "./utils/africastalking.js";

interface Seen { url?: string; headers?: Headers; body?: URLSearchParams }

function respond(status: number, body: unknown, seen?: Seen): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) {
      seen.url = String(url);
      seen.headers = new Headers(init?.headers);
      seen.body = new URLSearchParams(String(init?.body));
    }
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

const sent = (statusCode: number, status: string) => ({
  SMSMessageData: { Message: "Sent to 1/1", Recipients: [{ statusCode, status, number: "+2348031234567", messageId: "ATXid_1" }] },
});
const sms = { username: "sandbox", apiKey: "key", to: "+2348031234567", message: "hello" };

describe("Africa's Talking SMS", () => {
  it("sends to the sandbox for the sandbox username, with the key in the header", async () => {
    const seen: Seen = {};
    const result = await sendAfricasTalkingSms(sms, respond(201, sent(101, "Success"), seen));
    assert.deepEqual(result, { success: true, messageId: "ATXid_1" });
    assert.equal(seen.url, "https://api.sandbox.africastalking.com/version1/messaging");
    assert.equal(seen.headers!.get("apiKey"), "key");
    assert.deepEqual(Object.fromEntries(seen.body!), { username: "sandbox", to: "+2348031234567", message: "hello" });
  });

  it("sends live, from an approved sender ID, for a live username", async () => {
    const seen: Seen = {};
    await sendAfricasTalkingSms({ ...sms, username: "sokotocover", senderId: "SokotoCover" }, respond(201, sent(101, "Success"), seen));
    assert.equal(seen.url, "https://api.africastalking.com/version1/messaging");
    assert.equal(seen.body!.get("from"), "SokotoCover");
  });

  it("reports a recipient Africa's Talking refused, and a bad key", async () => {
    assert.deepEqual(await sendAfricasTalkingSms(sms, respond(201, sent(403, "InvalidPhoneNumber"))), { success: false, error: "InvalidPhoneNumber" });
    const badKey = await sendAfricasTalkingSms(sms, respond(401, "The supplied authentication is invalid"));
    assert.equal(badKey.success, false);
    assert.match(badKey.error!, /401/);
  });

  it("doesn't call out without a key", async () => {
    let called = false;
    const spy = (async () => ((called = true), new Response("{}"))) as typeof fetch;
    assert.deepEqual(await sendAfricasTalkingSms({ ...sms, apiKey: "" }, spy), { success: false, error: "AFRICASTALKING_API_KEY is not configured" });
    assert.equal(called, false);
  });
});
