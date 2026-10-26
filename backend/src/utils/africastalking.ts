/**
 * Sends one SMS through Africa's Talking. The username "sandbox" uses their
 * free sandbox, which delivers to the online phone simulator
 * (developers.africastalking.com/simulator) instead of real phones; a live
 * app username sends real SMS and is charged per message.
 */
import type { SmsResult } from "./sms.js";

export interface AfricasTalkingSms {
  username: string;
  apiKey: string;
  /** International format, e.g. +2348031234567. */
  to: string;
  message: string;
  /** An approved alphanumeric sender ID; empty uses Africa's Talking's default. */
  senderId?: string;
}

// Africa's Talking recipient status codes: 100 Processed, 101 Sent, 102 Queued count as accepted.
const ACCEPTED = new Set([100, 101, 102]);

export async function sendAfricasTalkingSms(sms: AfricasTalkingSms, fetchImpl: typeof fetch = fetch): Promise<SmsResult> {
  if (!sms.apiKey) return { success: false, error: "AFRICASTALKING_API_KEY is not configured" };
  const host = sms.username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const body = new URLSearchParams({ username: sms.username, to: sms.to, message: sms.message });
  if (sms.senderId) body.set("from", sms.senderId);

  try {
    const res = await fetchImpl(`https://${host}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: sms.apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await res.text();
    if (!res.ok) return { success: false, error: `Africa's Talking answered ${res.status}: ${text.slice(0, 200)}` };
    const data = JSON.parse(text) as {
      SMSMessageData?: { Message?: string; Recipients?: Array<{ statusCode?: number; status?: string; messageId?: string }> };
    };
    const recipient = data.SMSMessageData?.Recipients?.[0];
    if (recipient && ACCEPTED.has(Number(recipient.statusCode))) return { success: true, messageId: recipient.messageId };
    return { success: false, error: recipient?.status ?? data.SMSMessageData?.Message ?? "SMS send failed" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}
