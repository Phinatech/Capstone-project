/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_ORACLE_AGGREGATOR_ADDRESS?: string;
  readonly VITE_WEATHER_INDEX_INSURANCE_ADDRESS?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
