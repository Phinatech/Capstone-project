import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectedAccounts, isMobileBrowser, metaMaskAppLink, requestWallet, WalletError } from './wallet';

const ACCOUNT = '0x00000000000000000000000000000000000000a1';

/** A stand-in for MetaMask's window.ethereum that answers each method as told. */
function wallet(answers: Record<string, () => unknown>) {
  const request = vi.fn(async ({ method }: {method: string;}) => {
    const answer = answers[method];
    if (!answer) throw new Error(`unexpected ${method}`);
    return answer();
  });
  vi.stubGlobal('window', { ethereum: { request, on: vi.fn(), removeListener: vi.fn() } });
  return request;
}
const fails = (code: number) => () => {
  throw Object.assign(new Error('wallet error'), { code });
};

afterEach(() => vi.unstubAllGlobals());

describe('asking MetaMask to connect when the user pays', () => {
  it('opens the connect request and returns the chosen account', async () => {
    const request = wallet({ eth_requestAccounts: () => [ACCOUNT] });
    const { accounts, provider } = await requestWallet();
    expect(accounts).toEqual([ACCOUNT]);
    expect(provider).toBeDefined();
    expect(request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  it('says MetaMask is missing when the browser has no wallet', async () => {
    vi.stubGlobal('window', {});
    await expect(requestWallet()).rejects.toMatchObject({ problem: 'wallet.missing' });
  });

  it('tells a closed connect window apart from one already open', async () => {
    wallet({ eth_requestAccounts: fails(4001) });
    await expect(requestWallet()).rejects.toMatchObject({ problem: 'wallet.rejected' });
    wallet({ eth_requestAccounts: fails(-32002) });
    await expect(requestWallet()).rejects.toMatchObject({ problem: 'wallet.pending' });
  });

  it('passes other wallet errors through unchanged', async () => {
    wallet({ eth_requestAccounts: fails(-32603) });
    const error = await requestWallet().catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(WalletError);
  });
});

describe('checking for a connected wallet when a page loads', () => {
  it('never opens the wallet, only asks which accounts are already connected', async () => {
    const request = wallet({ eth_accounts: () => [] });
    expect(await connectedAccounts()).toEqual([]);
    expect(request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    expect(request).not.toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
  });

  it('reads no accounts when there is no wallet or it errors', async () => {
    vi.stubGlobal('window', {});
    expect(await connectedAccounts()).toEqual([]);
    wallet({ eth_accounts: fails(-32603) });
    expect(await connectedAccounts()).toEqual([]);
  });
});

describe('getting MetaMask on a phone', () => {
  it('recognises phones and opens this page in the MetaMask app', () => {
    expect(isMobileBrowser('Mozilla/5.0 (Linux; Android 14; SM-A146B) Mobile')).toBe(true);
    expect(isMobileBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe(true);
    expect(isMobileBrowser('Mozilla/5.0 (X11; Linux x86_64) Chrome/130')).toBe(false);
    expect(metaMaskAppLink({ host: 'sokoto-cover.pages.dev', pathname: '/farmer/policies/new' }))
      .toBe('https://metamask.app.link/dapp/sokoto-cover.pages.dev/farmer/policies/new');
  });
});
