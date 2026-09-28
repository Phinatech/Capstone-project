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

export const config = {
  port: Number(process.env.PORT ?? 3001),
  rpcUrl: process.env.RPC_URL ?? "http://localhost:8545",
  aggregatorAddress: process.env.ORACLE_AGGREGATOR_ADDRESS ?? "",
  insuranceAddress: process.env.WEATHER_INDEX_INSURANCE_ADDRESS ?? "",
  relayerIntervalMinutes: Number(process.env.RELAYER_INTERVAL_MINUTES ?? 60),
  /** Parses ORACLE_SOURCES="CHIRPS:0xabc...,NASA_POWER:0xdef..." */
  oracleSources: parseSources(process.env.ORACLE_SOURCES ?? ""),
};

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
