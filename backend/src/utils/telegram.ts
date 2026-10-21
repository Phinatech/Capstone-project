/**
 * Sends a message from a Telegram bot to one chat. The bot token comes from
 * @BotFather; the chat is the person (or group) that started the bot.
 */
export async function sendTelegram(token: string, chatId: string, text: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    // Telegram explains failures in `description`; the URL holds the token, so it never goes into the error.
    const body = (await res.json().catch(() => ({}))) as { description?: string };
    throw new Error(`Telegram answered ${res.status}${body.description ? `: ${body.description}` : ""}`);
  }
}
