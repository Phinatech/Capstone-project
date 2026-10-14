import "dotenv/config";

export interface SourceConfig {
  label: string;
  privateKey: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const rpcUrl = process.env.RPC_URL ?? "http://localhost:8545";

export const config = {
  port: Number(process.env.PORT ?? 3001),
  rpcUrl,
  /**
   * RPC for event history (eth_getLogs). Defaults to RPC_URL; set it when that
   * provider caps the block range too tightly (Alchemy's free tier: 10 blocks).
   */
  logsRpcUrl: process.env.LOGS_RPC_URL?.trim() || rpcUrl,
  /** Most blocks one eth_getLogs request may span on LOGS_RPC_URL. */
  logsBlockRange: wholeNumber("LOGS_BLOCK_RANGE", 10_000, 1),
  /** Block the contracts were deployed in; event history is read from here. */
  deployBlock: wholeNumber("DEPLOY_BLOCK", 0, 0),
  aggregatorAddress: process.env.ORACLE_AGGREGATOR_ADDRESS ?? "",
  insuranceAddress: process.env.WEATHER_INDEX_INSURANCE_ADDRESS ?? "",
  relayerIntervalMinutes: Number(process.env.RELAYER_INTERVAL_MINUTES ?? 60),
  /** Parses ORACLE_SOURCES="CHIRPS:0xabc...,NASA_POWER:0xdef..." */
  oracleSources: parseSources(process.env.ORACLE_SOURCES ?? ""),
  /** Cloudflare Turnstile secret key; without it the verify endpoint answers 503. */
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY?.trim() ?? "",
  /** Browser origins allowed to call the API, comma-separated. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

function wholeNumber(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${name} must be a whole number of at least ${min}, got "${raw}"`);
  }
  return value;
}

function parseSources(raw: string): SourceConfig[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, privateKey] = entry.split(":");
      if (!label || !privateKey) {
        throw new Error(`ORACLE_SOURCES entry "${entry}" must be "label:private_key"`);
      }
      return { label: label.trim(), privateKey: privateKey.trim() };
    });
}

export { required };
