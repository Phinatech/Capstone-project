export interface ChainConfig {
  rpcUrl: string;
  aggregatorAddress: string;
  insuranceAddress: string;
}

/**
 * Contract settings from the VITE_* variables (written by `npm run seed:local`).
 * Returns null when any is missing, and the app runs on simulated data instead.
 */
export function readChainConfig(): ChainConfig | null {
  const env = import.meta.env;
  const rpcUrl = env.VITE_RPC_URL?.trim();
  const aggregatorAddress = env.VITE_ORACLE_AGGREGATOR_ADDRESS?.trim();
  const insuranceAddress = env.VITE_WEATHER_INDEX_INSURANCE_ADDRESS?.trim();
  if (!rpcUrl || !aggregatorAddress || !insuranceAddress) return null;
  return { rpcUrl, aggregatorAddress, insuranceAddress };
}

/** Hardhat's local chain id. Only there can the app sign with unlocked test accounts. */
export const LOCAL_CHAIN_ID = 31337n;

// Local test accounts per demo user. Accounts #2-#4 are the oracle sources
// (see blockchain/scripts/seed-local.ts), so farmers skip them.
const LOCAL_ACCOUNT_INDEX: Record<string, number> = {
  'admin-1': 0,
  'farmer-1': 1,
  'farmer-2': 5,
  'farmer-3': 6,
  'farmer-4': 7
};

/** Test account index for a user; accounts signed up in the app share #8-#19. */
export function localAccountIndex(userId: string): number {
  const known = LOCAL_ACCOUNT_INDEX[userId];
  if (known !== undefined) return known;
  let h = 0;
  for (const c of userId) h = h * 31 + c.charCodeAt(0) >>> 0;
  return 8 + h % 12;
}

/** On-chain oracle labels to the app's source ids. */
export const SOURCE_BY_LABEL: Record<string, 'chirps' | 'nasa' | 'meteostat'> = {
  CHIRPS: 'chirps',
  NASA_POWER: 'nasa',
  Meteostat: 'meteostat'
};
