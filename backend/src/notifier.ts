/**
 * Notifications for every policy bought and every policy settled, by SMS
 * (Africa's Talking or Termii) and/or Telegram, sent within seconds of the
 * transaction, whoever sent it (the keeper, the admin's Settle button or a
 * farmer). An SMS goes to the farmer whose profile wallet owns the policy,
 * if they have a phone number, and to every NOTIFY_SMS_TO number. It watches only new blocks, starting
 * from the chain head when the backend starts, so restarts don't replay
 * history. It runs in the backend that runs the relayer (RELAYER_ENABLED=true),
 * so a local copy doesn't send the same messages twice.
 */
import { userStore } from "./authServices.js";
import { config } from "./config.js";
import { headBlock, readInsuranceActivity, type InsuranceActivity } from "./utils/chain.js";
import { dekadDays } from "./utils/period.js";
import { nigerianMobile, payoutMessage, policyPurchasedMessage, sendSms, settlementMessage, smsConfigured, smsName } from "./utils/sms.js";
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

/** The SMS for a policy event: plain text with no emoji, so it fits in one 160-character SMS. */
export function activitySms(a: InsuranceActivity, farmerName?: string): string {
  switch (a.kind) {
    case "purchase":
      return policyPurchasedMessage(a.policyId, smsName(farmerName));
    case "payout":
      return payoutMessage(a.policyId, Number(a.payoutEth));
    case "no_payout":
      return settlementMessage(a.policyId, Math.round(a.rainfallMm * 100)); // takes mm x 100, as the contract stores it
  }
}

/** The policy owner's phone (matched by profile wallet) and the NOTIFY_SMS_TO numbers, deduplicated. */
async function smsRecipients(farmer: string): Promise<{ phones: string[]; farmerName?: string }> {
  const owner = (await userStore.list()).find((u) => u.wallet.toLowerCase() === farmer.toLowerCase());
  const phones = new Set<string>();
  for (const raw of [owner?.phone, ...config.notifySmsTo]) {
    const phone = raw ? nigerianMobile(raw) : null;
    if (phone) phones.add(phone);
  }
  return { phones: [...phones], farmerName: owner?.name };
}

async function notify(activity: InsuranceActivity, channels: { telegram: boolean; sms: boolean }): Promise<void> {
  const what = `${activity.kind} for policy #${activity.policyId}`;
  const report = (channel: string, e: unknown) =>
    console.log(`[notify] could not send ${what} by ${channel}: ${e instanceof Error ? e.message : String(e)}`);
  if (channels.telegram) {
    await sendTelegram(config.telegramBotToken, config.telegramChatId, activityMessage(activity, config.explorerUrl)).then(
      () => console.log(`[notify] sent ${what} by Telegram`),
      (e) => report("Telegram", e)
    );
  }
  if (channels.sms) {
    const { phones, farmerName } = await smsRecipients(activity.farmer);
    const text = activitySms(activity, farmerName);
    for (const phone of phones) {
      const result = await sendSms(phone, text);
      if (result.success) console.log(`[notify] sent ${what} by SMS to ${phone.slice(0, 6)}…`);
      else report(`SMS to ${phone.slice(0, 6)}…`, result.error);
    }
  }
}

export function startNotifier(): void {
  if (!config.relayerEnabled) return; // only the backend that runs the relayer notifies
  const channels = { telegram: Boolean(config.telegramBotToken && config.telegramChatId), sms: smsConfigured() };
  if (!channels.telegram && !channels.sms) {
    console.log("[notify] no SMS provider key and no Telegram bot configured; notifications off");
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
      for (const activity of await readInsuranceActivity(cursor + 1, head)) await notify(activity, channels);
      cursor = head;
    } catch (e) {
      console.log(`[notify] check failed, retrying: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(poll, POLL_MS);
  const on = [channels.sms && `SMS (${config.smsProvider})`, channels.telegram && "Telegram"].filter(Boolean).join(" and ");
  console.log(`[notify] notifications by ${on} on, checking every ${POLL_MS / 1000} s`);
}
