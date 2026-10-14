/**
 * Settlement keeper: finalizes each reported dekad as soon as the aggregator
 * allows it, then settles every policy whose window is fully finalized, so
 * payouts don't wait for someone to press a button (audit H-2). Both calls are
 * permissionless; the keeper account only pays the gas.
 *
 * Every call is dry-run first, so "not ready yet" costs nothing and the
 * contracts stay the only place the rules (quorum, reporting window) live.
 */
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "./config.js";
import { readPolicies, readReadings, readWindows } from "./utils/chain.js";

const aggregatorAbi = [
  "function finalizePeriod(uint256 period) returns (uint256)",
  "function isFinalized(uint256 period) view returns (bool)",
];
const insuranceAbi = ["function checkAndSettle(uint256 policyId)"];

// Finalized dekads never change back, so they aren't looked up again.
const finalized = new Set<number>();

const errorText = (e: unknown) => (e as { shortMessage?: string }).shortMessage ?? (e instanceof Error ? e.message : String(e));

/** Sends `method(arg)` if a dry run succeeds; otherwise returns the revert reason. */
async function sendIfReady(contract: Contract, method: string, arg: number, done: string): Promise<string | null> {
  const fn = contract.getFunction(method);
  try {
    await fn.staticCall(arg);
  } catch (e) {
    const err = e as { code?: string; reason?: string; shortMessage?: string };
    if (err.code !== "CALL_EXCEPTION") throw e;
    return err.reason ?? err.shortMessage ?? "reverted";
  }
  const receipt = await (await fn(arg)).wait();
  console.log(`[settlement] ${done} tx=${receipt.hash} gasUsed=${receipt.gasUsed}`);
  return null;
}

export async function settleDue(keeperKey: string): Promise<void> {
  // No response caching: ethers otherwise reuses the account's nonce for 250 ms,
  // which breaks back-to-back transactions on a fast chain.
  const keeper = new Wallet(keeperKey, new JsonRpcProvider(config.rpcUrl, undefined, { cacheTimeout: -1 }));
  const aggregator = new Contract(config.aggregatorAddress, aggregatorAbi, keeper);
  const insurance = new Contract(config.insuranceAddress, insuranceAbi, keeper);

  const reported = [...new Set((await readReadings()).map((r) => r.period))].sort((a, b) => a - b);
  const waiting: string[] = [];
  for (const period of reported) {
    if (finalized.has(period)) continue;
    try {
      if (await aggregator.getFunction("isFinalized")(period)) {
        finalized.add(period);
        continue;
      }
      const notReady = await sendIfReady(aggregator, "finalizePeriod", period, `finalized dekad ${period}`);
      if (notReady) waiting.push(`${period} (${notReady})`);
      else finalized.add(period);
    } catch (e) {
      console.log(`[settlement] could not finalize ${period}: ${errorText(e)}`);
    }
  }
  if (waiting.length > 0) console.log(`[settlement] not ready to finalize: ${waiting.join(", ")}`);

  const [policies, windows] = await Promise.all([readPolicies(), readWindows()]);
  for (const policy of policies) {
    const periods = windows[policy.windowId]?.periods ?? [];
    if (policy.settled || periods.length === 0 || !periods.every((p) => finalized.has(p))) continue;
    try {
      const notReady = await sendIfReady(insurance, "checkAndSettle", policy.id, `settled policy #${policy.id}`);
      if (notReady) console.log(`[settlement] policy #${policy.id} not settled: ${notReady}`);
    } catch (e) {
      console.log(`[settlement] could not settle policy #${policy.id}: ${errorText(e)}`);
    }
  }
}
