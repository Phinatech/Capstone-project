import express from "express";
import { config } from "./config.js";
import { startRelayer } from "./relayer.js";

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "weather-insurance-backend" });
});

// TODO: mount routers here as the API grows (policies, pool, aggregates).

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
