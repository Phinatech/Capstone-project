import { BrowserProvider } from 'ethers';

/**
 * Why a wallet could not be had, as the translation key the forms show.
 * `missing` gets its own notice with a link to install MetaMask.
 */
export type WalletProblem = 'wallet.missing' | 'wallet.rejected' | 'wallet.pending';

export class WalletError extends Error {
  constructor(readonly problem: WalletProblem) {
    super(problem);
    this.name = 'WalletError';
  }
}

/** The EIP-1193 error code on a wallet error, however the wallet wraps it. */
function errorCode(e: unknown): unknown {
  const err = e as {code?: unknown;data?: {originalError?: {code?: unknown;};};};
  return err?.data?.originalError?.code ?? err?.code;
}

/**
 * Asks the browser's wallet to connect this site and returns a provider for
 * it. In MetaMask this opens its "Connect" window; once the site is
 * connected, it returns at once without asking again.
 *
 * Throws a WalletError when there is no wallet in this browser, when the user
 * closes the window (4001), or when MetaMask is already showing a request for
 * this site (-32002), so the form can say which.
 */
export async function requestWallet(): Promise<{provider: BrowserProvider;accounts: string[];}> {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth?.request) throw new WalletError('wallet.missing');
  let accounts: string[];
  try {
    accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  } catch (e) {
    const code = errorCode(e);
    if (code === 4001) throw new WalletError('wallet.rejected');
    if (code === -32002) throw new WalletError('wallet.pending');
    throw e;
  }
  if (!Array.isArray(accounts) || accounts.length === 0) throw new WalletError('wallet.rejected');
  return { provider: new BrowserProvider(eth), accounts };
}

/** Accounts this site may already use, without opening the wallet. */
export async function connectedAccounts(): Promise<string[]> {
  const eth = typeof window !== 'undefined' ? window.ethereum : undefined;
  if (!eth?.request) return [];
  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) ? (accounts as string[]) : [];
  } catch {
    return [];
  }
}

/** Phones and tablets, where MetaMask is an app rather than a browser extension. */
export function isMobileBrowser(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

/** Opens this page inside the MetaMask app's own browser. */
export function metaMaskAppLink(location: {host: string;pathname: string;}): string {
  return `https://metamask.app.link/dapp/${location.host}${location.pathname}`;
}

export const METAMASK_DOWNLOAD = 'https://metamask.io/download/';
