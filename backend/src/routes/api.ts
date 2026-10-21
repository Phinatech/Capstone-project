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
import { getCached, setCached, withCache } from "../utils/cache.js";
import { readFxRate, type FxRate } from "../utils/fx.js";
import { createAgentStore, parseSale } from "../utils/agentStore.js";
import { verifySaleAgainstPolicy } from "../utils/saleVerification.js";
import type { PolicyData } from "../utils/chain.js";
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
const FX_TTL = 60_000 * config.fxTtlMinutes;
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

/**
 * Naira quote used by the agent flow, where the farmer pays in local currency
 * and the contract is paid in ETH. Not chain data, so it is cached on its own
 * timer; a provider outage still answers, with `ethUsdSource`/`usdNgnSource`
 * set to "fallback" so the UI can label the quote approximate.
 */
router.get("/fx", async (_req, res) => {
  const cached = getCached<FxRate>("fx");
  if (cached) {
    res.json(cached);
    return;
  }
  try {
    const rate = await readFxRate();
    setCached("fx", rate, FX_TTL);
    res.json(rate);
  } catch (err) {
    console.error("[api] failed to read fx rate:", err);
    res.status(502).json({ error: "Failed to read the exchange rate" });
  }
});

// Agent sales: the naira half of a purchase, recorded so an agent's book is
// readable from any device rather than only from the browser that sold it.
const agentStore = createAgentStore(config.agentSalesPath);

/** An optional bounded text query parameter. */
function boundedQuery(value: unknown, max: number): string | null {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max) return null;
  return value.trim();
}

router.get("/agent/sales", async (req, res) => {
  const agentId = boundedQuery(req.query.agentId, 64);
  if (agentId === null) {
    res.status(400).json({ error: "agentId must be text of at most 64 characters" });
    return;
  }
  try {
    res.json({ sales: await agentStore.list(agentId || undefined) });
  } catch (err) {
    console.error("[api] failed to read agent sales:", err);
    res.status(500).json({ error: "Failed to read agent sales" });
  }
});

router.get("/agent/sales/:policyId", async (req, res) => {
  const policyId = Number(req.params.policyId);
  if (!Number.isSafeInteger(policyId) || policyId < 0) {
    res.status(400).json({ error: "policyId must be a policy number" });
    return;
  }
  try {
    const sale = await agentStore.findByPolicy(policyId);
    if (!sale) {
      res.status(404).json({ error: "No sale recorded for that policy" });
      return;
    }
    res.json(sale);
  } catch (err) {
    console.error("[api] failed to read agent sale:", err);
    res.status(500).json({ error: "Failed to read agent sales" });
  }
});

// Capped like the SMS route: nothing stops a non-browser client from posting,
// so a runaway loop cannot grow the ledger without bound.
const MAX_SALE_WRITES_PER_HOUR = 120;
let saleWriteHour = { start: 0, written: 0 };

/**
 * The policy a sale claims to describe.
 *
 * Served from the shared cache first. A purchase can land after that cache was
 * filled, so a miss re-reads the chain once — reporting "no such policy" for a
 * policy the caller just bought would reject an honest receipt. The re-read is
 * published back to the cache so repeated misses stop costing a round trip.
 */
async function policyForSale(policyId: number): Promise<PolicyData | undefined> {
  const cached = await withCache("policies", POLICIES_TTL, readPolicies, { headBlock });
  const known = cached.find((p) => p.id === policyId);
  if (known) return known;

  // Capture the head before reading: a block recorded after the read would
  // claim coverage it does not have, which is the dangerous direction.
  const block = await headBlock();
  const fresh = await readPolicies();
  setCached("policies", fresh, POLICIES_TTL, block);
  return fresh.find((p) => p.id === policyId);
}

router.post("/agent/sales", async (req, res) => {
  const now = Date.now();
  if (now - saleWriteHour.start >= 3_600_000) saleWriteHour = { start: now, written: 0 };
  if (saleWriteHour.written >= MAX_SALE_WRITES_PER_HOUR) {
    res.status(429).json({ error: "Sale recording limit for this hour reached" });
    return;
  }

  const parsed = parseSale(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  // Charged against the cap before the chain read, so the expensive step is
  // the one the limit actually bounds.
  saleWriteHour.written++;

  let policy: PolicyData | undefined;
  try {
    policy = await policyForSale(parsed.sale.policyId);
  } catch (err) {
    // Nothing was written, so the caller can safely retry later.
    console.error("[api] could not verify a sale against the chain:", err);
    res.status(503).json({ error: "Could not verify this sale against the contract; try again shortly" });
    return;
  }

  // 422, not 400: the record is well-formed but not true of the chain. Retrying
  // unchanged will never make it accepted, so the client must not queue it.
  const verified = verifySaleAgainstPolicy(parsed.sale, policy);
  if (!verified.ok) {
    res.status(422).json({ error: verified.error });
    return;
  }

  try {
    // Upsert: re-submitting the same policy corrects it instead of duplicating.
    const sale = await agentStore.upsert(parsed.sale);
    res.status(201).json(sale);
  } catch (err) {
    console.error("[api] failed to record agent sale:", err);
    res.status(500).json({ error: "Failed to record the sale" });
  }
});

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
