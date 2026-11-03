import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sendBrevoMail } from "./utils/brevo.js";

const mail = {
  apiKey: "test-key",
  sender: { name: "Sokoto Rainfall Cover", email: "sender@example.com" },
  to: "amina@example.com",
  subject: "Your verification code",
  text: "Your verification code is: 042137"
};

describe("Brevo email", () => {
  it("posts the message to Brevo's HTTPS API with the key in its header", async () => {
    let url = "";
    let init: RequestInit | undefined;
    const fetchImpl = (async (u: string | URL | Request, i?: RequestInit) => {
      url = String(u);
      init = i;
      return new Response(JSON.stringify({ messageId: "<abc@smtp-relay.mailin.fr>" }), { status: 201 });
    }) as typeof fetch;

    const result = await sendBrevoMail(mail, fetchImpl);
    assert.deepEqual(result, { success: true, messageId: "<abc@smtp-relay.mailin.fr>" });
    assert.equal(url, "https://api.brevo.com/v3/smtp/email");
    assert.equal((init?.headers as Record<string, string>)["api-key"], "test-key");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      sender: { name: "Sokoto Rainfall Cover", email: "sender@example.com" },
      to: [{ email: "amina@example.com" }],
      subject: "Your verification code",
      textContent: "Your verification code is: 042137"
    });
  });

  it("reports Brevo's refusal", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 })) as typeof fetch;
    const result = await sendBrevoMail(mail, fetchImpl);
    assert.equal(result.success, false);
    assert.match(result.error ?? "", /Brevo answered 401: .*Key not found/);
  });

  it("reports a network failure instead of throwing", async () => {
    const fetchImpl = (async () => {
      throw new Error("getaddrinfo ENOTFOUND api.brevo.com");
    }) as typeof fetch;
    assert.deepEqual(await sendBrevoMail(mail, fetchImpl), { success: false, error: "getaddrinfo ENOTFOUND api.brevo.com" });
  });

  it("sends nothing without a key or a sender", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    assert.match((await sendBrevoMail({ ...mail, apiKey: "" }, fetchImpl)).error ?? "", /BREVO_API_KEY/);
    assert.match((await sendBrevoMail({ ...mail, sender: { name: "x", email: "" } }, fetchImpl)).error ?? "", /sender/);
    assert.equal(called, false);
  });
});
