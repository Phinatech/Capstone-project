/**
 * SMS notifications via Termii (Nigerian SMS provider).
 *
 * Sends transactional SMS to farmers when their policy pays out.
 * Configure with TERMINII_API_KEY in .env (get a free key at termii.com).
 */

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(
  phoneNumber: string,
  message: string,
  apiKey: string = process.env.TERMINII_API_KEY ?? ""
): Promise<SmsResult> {
  if (!apiKey) {
    return { success: false, error: "TERMINII_API_KEY is not configured" };
  }

  const senderId = process.env.TERMINII_SENDER_ID ?? "N-Alert";

  // Format phone number: ensure it starts with 234 (Nigeria country code)
  const formattedPhone = formatPhoneNumber(phoneNumber);

  try {
    const res = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: formattedPhone,
        from: senderId,
        sms: message,
        type: "plain",
        channel: "dnd",
        api_key: apiKey,
      }),
    });

    const data = await res.json() as { message_id?: string; message?: string };
    if (res.ok && data.message_id) {
      return { success: true, messageId: data.message_id };
    }
    return { success: false, error: data.message ?? "SMS send failed" };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  // If it starts with 0, replace with 234
  if (digits.startsWith("0")) {
    digits = "234" + digits.slice(1);
  }
  // If it doesn't start with 234, add it
  if (!digits.startsWith("234")) {
    digits = "234" + digits;
  }
  return digits;
}

export function payoutMessage(policyId: number, payoutEth: number): string {
  return `Sokoto Rainfall Cover: Policy #${policyId} paid out ${payoutEth.toFixed(4)} ETH. Check your wallet for the funds.`;
}

export function policyPurchasedMessage(policyId: number, farmerName: string): string {
  return `Sokoto Rainfall Cover: Policy #${policyId} purchased for ${farmerName}. Rainfall cover is now active.`;
}

export function settlementMessage(policyId: number, rainfallMm: number): string {
  return `Sokoto Rainfall Cover: Policy #${policyId} settled. Seasonal rainfall was ${(rainfallMm / 100).toFixed(1)} mm. No payout due.`;
}
