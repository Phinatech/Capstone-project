import express from "express";
import { config } from "./config.js";
import { startNotifier } from "./notifier.js";
import { attachSession } from "./middleware/auth.js";
import { startRelayer } from "./relayer.js";
import { authCodeStore, sessionStore, userStore } from "./authServices.js";
import { demoRosterAccounts, legacyDemoIds, operatorAccounts } from "./utils/demoAccounts.js";
import { MAX_TOKEN_LENGTH, verifyTurnstileToken } from "./turnstile.js";
import apiRouter from "./routes/api.js";
import { createAuthRouter } from "./routes/auth.js";

const app = express();

// Hosted (e.g. on Render) the app sits behind one proxy; trust it so req.ip is
// the visitor's address, which the Turnstile check passes on to Cloudflare.
app.set("trust proxy", 1);

app.use(express.json({ limit: "10kb" }));

// CORS: the dapp UI runs on its own origin (Vite on :5173 in development).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    // Without this the browser drops the session cookie from cross-origin
    // responses, which would silently sign everyone out.
    res.setHeader("Access-Control-Allow-Credentials", "true");
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

// Server-side auth (F-1). The stores live on disk so a restart does not sign
// everyone out mid-demo, and every request that carries a session cookie gets
// a `principal` resolved before any route sees it.
app.use(attachSession({ sessions: sessionStore, users: userStore, cookieName: config.sessionCookieName }));

app.use("/auth", createAuthRouter({ users: userStore, sessions: sessionStore, authCodes: authCodeStore }));

// Cached chain-data API for the frontend
app.use("/api", apiRouter);

// Replace the shipped demo accounts (including the old demo administrator)
// with the operator from the environment — real credentials live on the
// service, never in this repository. The two steps pair deliberately: the
// demo admin is deleted only when the real one is configured to take its
// place. Seeding hashes the password, so it happens once at boot rather than
// blocking the first sign-in.
if (operatorAccounts.length > 0) {
  void userStore
    .removeByIds(legacyDemoIds)
    .then(() => userStore.ensureSeeded(operatorAccounts))
    .then(() => console.log("[auth] operator account ready"))
    .catch((err) => console.error("[auth] could not prepare the operator account:", err));
} else {
  console.warn(
    "[auth] ADMIN_EMAIL/ADMIN_PASSWORD are not set: no administrator is seeded and the demo accounts are left untouched"
  );
}
if (config.demoAccounts) {
  void userStore.ensureSeeded(demoRosterAccounts).then(
    () => console.log(`[auth] ${demoRosterAccounts.length} demo accounts available`),
    (err) => console.error("[auth] could not seed demo accounts:", err)
  );
}

void sessionStore.sweep().then(
  (dropped) => {
    if (dropped > 0) console.log(`[auth] dropped ${dropped} expired session(s)`);
  },
  (err) => console.error("[auth] could not sweep sessions:", err)
);

const server = app.listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
  if (!config.demoAuthCodes) {
    console.log("[auth] AUTH_DEMO_CODES is off: verification codes go to this log, not to the client");
  }
  if (!config.demoAccounts) {
    console.log("[auth] AUTH_DEMO_ACCOUNTS is off: no demo accounts are seeded");
  }
  if (!config.secureCookies) {
    console.log("[auth] SECURE_COOKIES is off: set it for any HTTPS deployment");
  }
  startRelayer(config.oracleSources, config.relayerIntervalMinutes);
  startNotifier();
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
