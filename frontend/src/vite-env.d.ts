/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_ORACLE_AGGREGATOR_ADDRESS?: string;
  readonly VITE_WEATHER_INDEX_INSURANCE_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
