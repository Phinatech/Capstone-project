import express from "express";
import { config } from "./config.js";
import { startRelayer } from "./relayer.js";
import { MAX_TOKEN_LENGTH, verifyTurnstileToken } from "./turnstile.js";
import apiRouter from "./routes/api.js";

const app = express();

app.use(express.json({ limit: "10kb" }));

// CORS: the dapp UI runs on its own origin (Vite on :5173 in development).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "weather-insurance-backend" });
});

app.post("/auth/turnstile/verify", async (req, res) => {
  if (!config.turnstileSecretKey) {
    res.status(503).json({ success: false, error: "TURNSTILE_SECRET_KEY is not set on the server" });
    return;
  }
  const token: unknown = req.body?.token;
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) {
    res.status(400).json({ success: false, error: "Missing or malformed token" });
    return;
  }
  try {
    const result = await verifyTurnstileToken(token, config.turnstileSecretKey, req.ip);
    res.status(result.success ? 200 : 400).json(result);
  } catch {
    res.status(502).json({ success: false, error: "Could not reach Cloudflare" });
  }
});

// Cached chain-data API for the frontend
app.use("/api", apiRouter);

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
  startRelayer(config.oracleSources, config.relayerIntervalMinutes);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
