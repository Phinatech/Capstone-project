/**
 * API routes for cached chain data.
 *
 * These endpoints read from the blockchain and cache the results,
 * so the frontend can fetch data with a single fast API call instead
 * of making dozens of RPC calls per page load.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { config } from "../config.js";
import { withCache } from "../utils/cache.js";
import {
  headBlock,
  readPolicies,
  readOracles,
  readWindows,
  readPool,
  readSettlements,
  readReadings,
  readPolicyEvaluations,
} from "../utils/chain.js";
import { nigerianMobile, payoutMessage, policyPurchasedMessage, sendSms, settlementMessage, smsName } from "../utils/sms.js";

const router = Router();

// Cache TTLs (milliseconds)
const POLICIES_TTL = 30_000;
const ORACLES_TTL = 60_000;
const WINDOWS_TTL = 60_000;
const POOL_TTL = 15_000;
const SETTLEMENTS_TTL = 30_000;
const READINGS_TTL = 30_000;
const EVALUATIONS_TTL = 30_000;

/**
 * GET handler for a cached chain read. `?minBlock=N` asks for data read at or
 * after block N, e.g. right after the caller's own transaction landed in it.
 */
function cachedRead<T>(name: string, ttlMs: number, read: () => Promise<T>, body: (data: T) => unknown) {
  return async (req: Request, res: Response) => {
    const minBlock = req.query.minBlock;
    if (minBlock !== undefined && (typeof minBlock !== "string" || !/^\d{1,15}$/.test(minBlock))) {
      res.status(400).json({ error: "minBlock must be a block number" });
      return;
    }
    try {
      const data = await withCache(name, ttlMs, read, { headBlock, minBlock: Number(minBlock ?? 0) });
      res.json(body(data));
    } catch (err) {
      console.error(`[api] failed to read ${name}:`, err);
      res.status(500).json({ error: `Failed to read ${name}` });
    }
  };
}

router.get("/policies", cachedRead("policies", POLICIES_TTL, readPolicies, (policies) => ({ policies })));
router.get("/oracles", cachedRead("oracles", ORACLES_TTL, readOracles, (oracles) => ({ oracles })));
router.get("/windows", cachedRead("windows", WINDOWS_TTL, readWindows, (windows) => ({ windows })));
router.get("/pool", cachedRead("pool", POOL_TTL, readPool, (pool) => pool));
router.get("/settlements", cachedRead("settlements", SETTLEMENTS_TTL, readSettlements, (settlements) => ({ settlements })));
router.get("/readings", cachedRead("readings", READINGS_TTL, readReadings, (readings) => ({ readings })));
router.get("/evaluations", cachedRead("evaluations", EVALUATIONS_TTL, readPolicyEvaluations, (evaluations) => ({ evaluations })));

// SMS notifications. Each one costs Termii credit and goes out under our sender
// ID, so the endpoint is off unless NOTIFY_API_KEY is set, callers must send
// that key, and even they are capped per hour.
const MAX_SMS_PER_HOUR = 30;
let smsHour = { start: 0, sent: 0 };

/** True when the request carries `Authorization: Bearer <NOTIFY_API_KEY>`. */
function hasNotifyKey(req: Request): boolean {
  const given = /^Bearer (.+)$/.exec(req.get("authorization") ?? "")?.[1] ?? "";
  const digest = (secret: string) => createHash("sha256").update(secret).digest();
  return given !== "" && timingSafeEqual(digest(given), digest(config.notifyApiKey));
}

/** An optional non-negative amount from the request body; null when malformed. */
const amount = (value: unknown) =>
  value === undefined ? 0 : typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

router.post("/notify/sms", async (req, res) => {
  if (!config.notifyApiKey) {
    res.status(503).json({ error: "SMS notifications are off: NOTIFY_API_KEY is not set" });
    return;
  }
  if (!hasNotifyKey(req)) {
    res.status(401).json({ error: "Missing or wrong API key" });
    return;
  }

  const { phone, type, policyId, payoutEth, rainfallMm, farmerName } = (req.body ?? {}) as Record<string, unknown>;
  const to = typeof phone === "string" ? nigerianMobile(phone) : null;
  if (!to) {
    res.status(400).json({ error: "phone must be a Nigerian mobile number" });
    return;
  }
  if (typeof policyId !== "number" || !Number.isSafeInteger(policyId) || policyId < 0) {
    res.status(400).json({ error: "policyId must be a policy number" });
    return;
  }
  const eth = amount(payoutEth);
  const mm = amount(rainfallMm);
  if (eth === null || mm === null) {
    res.status(400).json({ error: "payoutEth and rainfallMm must be non-negative numbers" });
    return;
  }

  let message: string;
  switch (type) {
    case "payout":
      message = payoutMessage(policyId, eth);
      break;
    case "purchased":
      message = policyPurchasedMessage(policyId, smsName(farmerName));
      break;
    case "settlement":
      message = settlementMessage(policyId, mm);
      break;
    default:
      res.status(400).json({ error: "type must be payout, purchased or settlement" });
      return;
  }

  const now = Date.now();
  if (now - smsHour.start >= 3_600_000) smsHour = { start: now, sent: 0 };
  if (smsHour.sent >= MAX_SMS_PER_HOUR) {
    res.status(429).json({ error: "SMS limit for this hour reached" });
    return;
  }
  smsHour.sent++;

  const result = await sendSms(to, message);
  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(502).json({ success: false, error: result.error });
  }
});

export default router;
