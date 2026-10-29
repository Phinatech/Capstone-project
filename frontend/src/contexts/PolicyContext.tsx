import React, { useMemo } from 'react';
import { readChainConfig } from '../chain/config';
import { ChainPolicyProvider } from './ChainPolicyProvider';
import { ErrorPage } from '../pages/ErrorPage';

export { usePolicies } from './policyContextCore';
export type { DataSource, PolicyContextValue, PurchaseInput } from './policyContextCore';

/**
 * Reads policies from the deployed contracts (the VITE_* contract settings).
 *
 * A deployment without those settings gets an honest error instead of the
 * simulated portfolio this used to serve: invented data once passed for real
 * state on the admin console, and real state is the only thing worth showing.
 * The seed portfolio that powered it now lives in the test fixtures.
 */
export function PolicyProvider({ children }: {children: React.ReactNode;}) {
  const config = useMemo(readChainConfig, []);
  if (!config) {
    return (
      <ErrorPage
        fullScreen
        error={
          new Error(
            'No contracts are configured for this deployment. Set VITE_RPC_URL, ' +
            'VITE_WEATHER_INDEX_INSURANCE_ADDRESS and VITE_ORACLE_AGGREGATOR_ADDRESS to connect to a chain.'
          )
        } />
    );
  }
  return <ChainPolicyProvider config={config}>{children}</ChainPolicyProvider>;
}
