/**
 * API routes for cached chain data.
 *
 * These endpoints read from the blockchain and cache the results,
 * so the frontend can fetch data with a single fast API call instead
 * of making dozens of RPC calls per page load.
 */
import { Router } from "express";
import { withCache } from "../utils/cache.js";
import {
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

router.get("/policies", async (_req, res) => {
  try {
    const policies = await withCache("policies", POLICIES_TTL, readPolicies);
    res.json({ policies });
  } catch {
    res.status(500).json({ error: "Failed to read policies" });
  }
});

router.get("/oracles", async (_req, res) => {
  try {
    const oracles = await withCache("oracles", ORACLES_TTL, readOracles);
    res.json({ oracles });
  } catch {
    res.status(500).json({ error: "Failed to read oracles" });
  }
});

router.get("/windows", async (_req, res) => {
  try {
    const windows = await withCache("windows", WINDOWS_TTL, readWindows);
    res.json({ windows });
  } catch {
    res.status(500).json({ error: "Failed to read windows" });
  }
});

router.get("/pool", async (_req, res) => {
  try {
    const pool = await withCache("pool", POOL_TTL, readPool);
    res.json(pool);
  } catch {
    res.status(500).json({ error: "Failed to read pool" });
  }
});

router.get("/settlements", async (_req, res) => {
  try {
    const settlements = await withCache("settlements", SETTLEMENTS_TTL, readSettlements);
    res.json({ settlements });
  } catch {
    res.status(500).json({ error: "Failed to read settlements" });
  }
});

router.get("/readings", async (_req, res) => {
  try {
    const readings = await withCache("readings", READINGS_TTL, readReadings);
    res.json({ readings });
  } catch {
    res.status(500).json({ error: "Failed to read readings" });
  }
});

router.get("/evaluations", async (_req, res) => {
  try {
    const evaluations = await withCache("evaluations", EVALUATIONS_TTL, readPolicyEvaluations);
    res.json({ evaluations });
  } catch {
    res.status(500).json({ error: "Failed to read evaluations" });
  }
});

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
