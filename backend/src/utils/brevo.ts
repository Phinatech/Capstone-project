/**
 * Brevo's transactional email API (free plan: 300 emails a day). It sends
 * over HTTPS, so it works on hosts that block outbound SMTP — Render's free
 * plan blocks ports 25, 465 and 587, so Gmail's SMTP never connects there.
 * The sender must be an address verified in Brevo (Senders & IP → Senders).
 */
export interface BrevoMail {
  apiKey: string;
  sender: { name: string; email: string };
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendBrevoMail(mail: BrevoMail, fetchImpl: typeof fetch = fetch): Promise<MailResult> {
  if (!mail.apiKey) return { success: false, error: "BREVO_API_KEY is not configured" };
  if (!mail.sender.email) return { success: false, error: "no sender address: set BREVO_SENDER_EMAIL or MAIL_USER" };
  try {
    const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": mail.apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: mail.sender,
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text
      }),
      signal: AbortSignal.timeout(15_000)
    });
    const text = await res.text();
    if (!res.ok) return { success: false, error: `Brevo answered ${res.status}: ${text.slice(0, 200)}` };
    const data = JSON.parse(text) as { messageId?: string };
    return { success: true, messageId: data.messageId };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "email send failed" };
  }
}
