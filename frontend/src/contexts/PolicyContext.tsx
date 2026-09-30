import React, { useMemo } from 'react';
import { readChainConfig } from '../chain/config';
import { ChainPolicyProvider } from './ChainPolicyProvider';
import { SimulatedPolicyProvider } from './SimulatedPolicyProvider';

export { usePolicies } from './policyContextCore';
export type { DataSource, PolicyContextValue, PurchaseInput } from './policyContextCore';

/**
 * Reads policies from the deployed contracts when the VITE_* contract
 * settings are present (see `npm run seed:local`), otherwise from the
 * simulated seed data. Either way, pages use the same `usePolicies()`.
 */
export function PolicyProvider({ children }: {children: React.ReactNode;}) {
  const config = useMemo(readChainConfig, []);
  return config ?
  <ChainPolicyProvider config={config}>{children}</ChainPolicyProvider> :
  <SimulatedPolicyProvider>{children}</SimulatedPolicyProvider>;
}
