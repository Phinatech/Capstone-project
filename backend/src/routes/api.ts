/**
 * API routes for cached chain data.
 *
 * These endpoints read from the blockchain and cache the results,
 * so the frontend can fetch data with a single fast API call instead
 * of making dozens of RPC calls per page load.
 */
import { Router, type Request, type Response } from "express";
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
import { sendSms, payoutMessage, policyPurchasedMessage, settlementMessage } from "../utils/sms.js";

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

// SMS notifications
router.post("/notify/sms", async (req, res) => {
  const { phone, type, policyId, payoutEth, rainfallMm, farmerName } = req.body as {
    phone?: string;
    type?: "payout" | "purchased" | "settlement";
    policyId?: number;
    payoutEth?: number;
    rainfallMm?: number;
    farmerName?: string;
  };

  if (!phone || !type || policyId === undefined) {
    res.status(400).json({ error: "Missing required fields: phone, type, policyId" });
    return;
  }

  let message: string;
  switch (type) {
    case "payout":
      message = payoutMessage(policyId, payoutEth ?? 0);
      break;
    case "purchased":
      message = policyPurchasedMessage(policyId, farmerName ?? "a farmer");
      break;
    case "settlement":
      message = settlementMessage(policyId, rainfallMm ?? 0);
      break;
    default:
      res.status(400).json({ error: "Invalid notification type" });
      return;
  }

  const result = await sendSms(phone, message);
  if (result.success) {
    res.json({ success: true, messageId: result.messageId });
  } else {
    res.status(502).json({ success: false, error: result.error });
  }
});

export default router;
