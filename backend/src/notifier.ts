/**
 * Telegram notifications: every policy bought and every policy settled,
 * sent within seconds of the transaction, whoever sent it (the keeper, the
 * admin's Settle button or a farmer). It watches only new blocks, starting
 * from the chain head when the backend starts, so restarts don't replay
 * history. It runs in the backend that runs the relayer (RELAYER_ENABLED=true),
 * so a local copy doesn't send the same messages twice.
 */
import { config } from "./config.js";
import { headBlock, readInsuranceActivity, type InsuranceActivity } from "./utils/chain.js";
import { dekadDays } from "./utils/period.js";
import { sendTelegram } from "./utils/telegram.js";

const POLL_MS = 15_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "11 Sep – 10 Oct 2026" for the days a window's dekads cover. */
export function windowDates(periods: number[]): string {
  const first = dekadDays(periods[0]!)[0]!;
  const last = dekadDays(periods.at(-1)!).at(-1)!;
  const date = (day: string, withYear: boolean) =>
    `${Number(day.slice(6, 8))} ${MONTHS[Number(day.slice(4, 6)) - 1]}${withYear ? ` ${day.slice(0, 4)}` : ""}`;
  return `${date(first, first.slice(0, 4) !== last.slice(0, 4))} – ${date(last, true)}`;
}

const mm = (x: number) => `${Number(x.toFixed(1))} mm`;

export function activityMessage(a: InsuranceActivity, explorerUrl: string): string {
  const link = `${explorerUrl}/tx/${a.txHash}`;
  switch (a.kind) {
    case "purchase":
      return [
        `🆕 Sokoto Rainfall Cover: new policy #${a.policyId}`,
        `Pays ${a.payoutEth} ETH if rainfall from ${windowDates(a.windowPeriods)} stays below ${mm(a.thresholdMm)}. Premium paid: ${a.premiumEth} ETH.`,
        link,
      ].join("\n");
    case "payout":
      return [
        `🌧️ Sokoto Rainfall Cover: policy #${a.policyId} paid out ${a.payoutEth} ETH`,
        `Rainfall over its window was ${mm(a.rainfallMm)}, below the ${mm(a.thresholdMm)} threshold, so the farmer was paid automatically.`,
        link,
      ].join("\n");
    case "no_payout":
      return [
        `✅ Sokoto Rainfall Cover: policy #${a.policyId} settled, no payout`,
        `Rainfall over its window was ${mm(a.rainfallMm)}, at or above the ${mm(a.thresholdMm)} threshold.`,
        link,
      ].join("\n");
  }
}

export function startNotifier(): void {
  const { telegramBotToken: token, telegramChatId: chatId } = config;
  if (!config.relayerEnabled) return; // only the backend that runs the relayer notifies
  if (!token || !chatId) {
    console.log("[notify] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set; Telegram notifications off");
    return;
  }

  let cursor: number | undefined;
  let running = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const head = await headBlock();
      if (cursor === undefined || head <= cursor) {
        cursor ??= head;
        return;
      }
      for (const activity of await readInsuranceActivity(cursor + 1, head)) {
        try {
          await sendTelegram(token, chatId, activityMessage(activity, config.explorerUrl));
          console.log(`[notify] sent ${activity.kind} for policy #${activity.policyId}`);
        } catch (e) {
          console.log(`[notify] could not send ${activity.kind} for policy #${activity.policyId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      cursor = head;
    } catch (e) {
      console.log(`[notify] check failed, retrying: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(poll, POLL_MS);
  console.log(`[notify] Telegram notifications on, checking every ${POLL_MS / 1000} s`);
}
