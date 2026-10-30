import "dotenv/config";
import { fileURLToPath } from "node:url";

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
  /** The relayer spends the oracle accounts' gas, so it only runs when this is "true". */
  relayerEnabled: process.env.RELAYER_ENABLED?.trim().toLowerCase() === "true",
  relayerIntervalMinutes: wholeNumber("RELAYER_INTERVAL_MINUTES", 60, 1),
  /** How many finished dekads back the relayer looks for ones it still has to report. */
  relayerLookbackDekads: wholeNumber("RELAYER_LOOKBACK_DEKADS", 3, 1),
  /** Parses ORACLE_SOURCES="CHIRPS:0xabc...,NASA_POWER:0xdef..." */
  oracleSources: parseSources(process.env.ORACLE_SOURCES ?? ""),
  /** Account that pays the gas to finalize dekads and settle policies; empty turns that off. */
  keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY?.trim() ?? "",
  /** Location the rainfall feeds are read for (default: Sokoto). */
  rainfallLatitude: coordinate("RAINFALL_LATITUDE", 13.05, 90),
  rainfallLongitude: coordinate("RAINFALL_LONGITUDE", 5.23, 180),
  nasaPowerApiUrl: process.env.NASA_POWER_API_URL?.trim() || "https://power.larc.nasa.gov/api/temporal/daily/point",
  /** CHIRPS v2.0 daily GeoTIFF archive; the real source behind the CHIRPS oracle. */
  chirpsBaseUrl:
    process.env.CHIRPS_BASE_URL?.trim() ||
    "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/tifs/p05",
  /** Remembers extracted CHIRPS day values so each raster is downloaded once. */
  chirpsCachePath:
    process.env.CHIRPS_CACHE_PATH?.trim() ||
    fileURLToPath(new URL("../data/chirps-daily-cache.json", import.meta.url)),
  /** How many CHIRPS rasters to fetch at once; each inflates to about 57 MB. */
  chirpsConcurrency: wholeNumber("CHIRPS_CONCURRENCY", 3, 1),
  /** Where agent sales (the naira half of each purchase) are recorded. */
  agentSalesPath:
    process.env.AGENT_SALES_PATH?.trim() ||
    fileURLToPath(new URL("../data/agent-sales.json", import.meta.url)),
  /** How long a naira exchange rate is served from cache before re-quoting. */
  fxTtlMinutes: wholeNumber("FX_TTL_MINUTES", 15, 1),
  /** Used when the live rate cannot be fetched, so quotes never fail outright. */
  fxEthUsdFallback: decimalNumber("FX_ETH_USD_FALLBACK", 2_500, 1),
  fxUsdNgnFallback: decimalNumber("FX_USD_NGN_FALLBACK", 1_400, 1),
  /** How long each rate provider is given before the fallback is used. */
  fxTimeoutMs: wholeNumber("FX_TIMEOUT_MS", 8_000, 500),
  /** RapidAPI key for Meteostat; without it the Meteostat source replays historical data. */
  meteostatApiKey: process.env.METEOSTAT_API_KEY?.trim() ?? "",
  /** Cloudflare Turnstile secret key; without it the verify endpoint answers 503. */
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY?.trim() ?? "",
  /**
   * Server-side auth (F-1).
   *
   * Users, sessions and password hashes live here rather than in the
   * browser's localStorage. The two `demo*` flags default to **off** so a
   * fresh clone is safe by default; they are switched on in `backend/.env`
   * for the demo, and must be off for anything a real user touches.
   */
  usersPath:
    process.env.USERS_PATH?.trim() ||
    fileURLToPath(new URL("../data/users.json", import.meta.url)),
  sessionsPath:
    process.env.SESSIONS_PATH?.trim() ||
    fileURLToPath(new URL("../data/sessions.json", import.meta.url)),
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || "sokoto_cover_session",
  /**
   * Session cookies carry the id, so over HTTPS they must be Secure. In
   * development the UI is served from Vite's dev server over plain http and
   * the cookie is same-origin through the proxy, where Lax alone is enough.
   */
  secureCookies: process.env.SECURE_COOKIES?.trim().toLowerCase() === "true",
  /** Google Client ID; without it Google sign-in answers 503. */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
  /** Returns verification codes and reset tokens in the response (no mail service). */
  demoAuthCodes: process.env.AUTH_DEMO_CODES?.trim().toLowerCase() === "true",
  /** Serves GET /api/demo-credentials so the sign-in page can list demo logins. */
  demoAccounts: process.env.AUTH_DEMO_ACCOUNTS?.trim().toLowerCase() === "true",
  /**
   * The operator (administrator) account, seeded from the environment so a
   * real administrator's credentials never live in the repository.
   */
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  adminName: process.env.ADMIN_NAME?.trim() || "Administrator",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /**
   * Operator-provisioned accounts (a JSON array), recreated at every boot —
   * see `utils/envAccounts.ts`. This is how the real agent and farmers of a
   * deployment survive Render's ephemeral disk.
   */
  seedUsers: process.env.SEED_USERS?.trim() ?? "",
  /**
   * PostgreSQL connection string (any Postgres; Neon and Supabase have free
   * tiers). When set, accounts, sessions and agent receipts live in the
   * database and survive every deploy; when not, they live in local JSON
   * files. See docs/deployment.md.
   */
  databaseUrl: process.env.DATABASE_URL?.trim() ?? "",
  /**
   * Outbound mail (verification codes, password resets). Defaults to Gmail's
   * SMTP endpoint: MAIL_USER is a Gmail address and MAIL_PASSWORD a Google App
   * Password. Unset, no mail is sent and codes go to the server log instead.
   */
  mailUser: process.env.MAIL_USER?.trim() ?? "",
  mailPassword: process.env.MAIL_PASSWORD ?? "",
  mailHost: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
  mailPort: Number(process.env.SMTP_PORT?.trim()) || 465,
  mailFrom: process.env.MAIL_FROM?.trim() || process.env.MAIL_USER?.trim() || "Sokoto Rainfall Cover",
  /** Minimum length accepted at sign-up and on password change. */
  minPasswordLength: wholeNumber("MIN_PASSWORD_LENGTH", 8, 6),
  /** SMS provider for notifications and POST /api/notify/sms: "africastalking" (default) or "termii". */
  smsProvider: smsProvider(process.env.SMS_PROVIDER),
  /** Africa's Talking app username; "sandbox" delivers free to their online simulator, not real phones. */
  africasTalkingUsername: process.env.AFRICASTALKING_USERNAME?.trim() || "sandbox",
  africasTalkingApiKey: process.env.AFRICASTALKING_API_KEY?.trim() ?? "",
  /** An approved alphanumeric sender ID; empty uses Africa's Talking's default. */
  africasTalkingSenderId: process.env.AFRICASTALKING_SENDER_ID?.trim() ?? "",
  /** Numbers that get an SMS for every policy bought or settled (e.g. the demo phone), comma-separated. */
  notifySmsTo: (process.env.NOTIFY_SMS_TO ?? "")
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean),
  /** Secret callers of POST /api/notify/sms must send; empty keeps SMS off. */
  notifyApiKey: process.env.NOTIFY_API_KEY?.trim() ?? "",
  /** Telegram bot (from @BotFather) and chat that get a message for every policy bought or settled. */
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? "",
  /** Block explorer the notifications link transactions to. */
  explorerUrl: (process.env.EXPLORER_URL?.trim() || "https://sepolia.etherscan.io").replace(/\/+$/, ""),
  /** Browser origins allowed to call the API, comma-separated. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    // Browsers send origins without a trailing slash, so drop one pasted with the address.
    .map((origin) => origin.trim().replace(/\/+$/, ""))
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

function decimalNumber(name: string, fallback: number, min: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${name} must be a number of at least ${min}, got "${raw}"`);
  }
  return value;
}

function coordinate(name: string, fallback: number, limit: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new Error(`${name} must be a number between -${limit} and ${limit}, got "${raw}"`);
  }
  return value;
}

function smsProvider(raw: string | undefined): "africastalking" | "termii" {
  const value = raw?.trim().toLowerCase() || "africastalking";
  if (value !== "africastalking" && value !== "termii") {
    throw new Error(`SMS_PROVIDER must be "africastalking" or "termii", got "${raw}"`);
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
