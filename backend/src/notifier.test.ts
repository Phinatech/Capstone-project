import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityMessage, activitySms, windowDates } from "./notifier.js";
import { sendTelegram } from "./utils/telegram.js";

const explorer = "https://sepolia.etherscan.io";

describe("Telegram notifications", () => {
  it("names a window by the days it covers", () => {
    assert.equal(windowDates([2026092, 2026093, 2026101]), "11 Sep – 10 Oct 2026");
    assert.equal(windowDates([2027061, 2027062, 2027063]), "1 Jun – 30 Jun 2027");
    assert.equal(windowDates([2026123, 2027011]), "21 Dec 2026 – 10 Jan 2027");
  });

  it("describes a payout with its rainfall, threshold and transaction", () => {
    const text = activityMessage({ kind: "payout", policyId: 3, farmer: "0xF", rainfallMm: 67.18, thresholdMm: 80, payoutEth: "0.02", txHash: "0xabc" }, explorer);
    assert.match(text, /policy #3 paid out 0\.02 ETH/);
    assert.match(text, /67\.2 mm, below the 80 mm threshold/);
    assert.match(text, /https:\/\/sepolia\.etherscan\.io\/tx\/0xabc$/);
  });

  it("describes a settlement without payout and a purchase", () => {
    assert.match(
      activityMessage({ kind: "no_payout", policyId: 4, farmer: "0xF", rainfallMm: 67.18, thresholdMm: 50, txHash: "0x1" }, explorer),
      /policy #4 settled, no payout\nRainfall over its window was 67\.2 mm, at or above the 50 mm threshold/
    );
    assert.match(
      activityMessage({ kind: "purchase", policyId: 5, farmer: "0xF", windowPeriods: [2027071, 2027072, 2027073], thresholdMm: 85, payoutEth: "0.02", premiumEth: "0.002", txHash: "0x2" }, explorer),
      /new policy #5\nPays 0\.02 ETH if rainfall from 1 Jul – 31 Jul 2027 stays below 85 mm\. Premium paid: 0\.002 ETH\./
    );
  });

  it("writes plain one-part SMS texts, naming the farmer on a purchase", () => {
    const texts = [
      activitySms({ kind: "payout", policyId: 3, farmer: "0xF", rainfallMm: 67.18, thresholdMm: 80, payoutEth: "0.02", txHash: "0x" }),
      activitySms({ kind: "no_payout", policyId: 4, farmer: "0xF", rainfallMm: 67.18, thresholdMm: 50, txHash: "0x" }),
      activitySms({ kind: "purchase", policyId: 5, farmer: "0xF", windowPeriods: [2027071], thresholdMm: 85, payoutEth: "0.02", premiumEth: "0.002", txHash: "0x" }, "Amina Bello"),
    ];
    assert.equal(texts[0], "Sokoto Rainfall Cover: Policy #3 paid out 0.0200 ETH. Check your wallet for the funds.");
    assert.equal(texts[1], "Sokoto Rainfall Cover: Policy #4 settled. Seasonal rainfall was 67.2 mm. No payout due.");
    assert.equal(texts[2], "Sokoto Rainfall Cover: Policy #5 purchased for Amina Bello. Rainfall cover is now active.");
    for (const text of texts) {
      assert.ok(text.length <= 160, "fits in one SMS");
      assert.match(text, /^[\x20-\x7e]+$/, "plain characters only, so it isn't billed as several parts");
    }
  });

  it("posts the message to the bot's chat, keeping the token out of errors", async () => {
    let url = "";
    let body: { chat_id?: string; text?: string } = {};
    const ok = (async (u: string | URL | Request, init?: RequestInit) => {
      url = String(u);
      body = JSON.parse(String(init?.body));
      return new Response("{}");
    }) as typeof fetch;
    await sendTelegram("123:SECRET", "42", "hello", ok);
    assert.equal(url, "https://api.telegram.org/bot123:SECRET/sendMessage");
    assert.deepEqual([body.chat_id, body.text], ["42", "hello"]);

    const refused = (async () => new Response(JSON.stringify({ description: "Bad Request: chat not found" }), { status: 400 })) as typeof fetch;
    await assert.rejects(sendTelegram("123:SECRET", "42", "hi", refused), (e: Error) => /chat not found/.test(e.message) && !e.message.includes("SECRET"));
  });
});
