import type { JsonRpcProvider } from 'ethers';

/**
 * Smallest tip the app suggests: what the relayer pays on Sepolia, where its
 * transactions are mined at once. A node can suggest far less (2 wei).
 */
export const MIN_TIP_WEI = 1_000_000n; // 0.001 gwei

/**
 * The network's going fee, read from the RPC this app trusts, for the wallet
 * to send with. Left to itself MetaMask adds its default 1.5 gwei tip, about
 * 1,000 times Sepolia's going rate: buyers paid ~0.0009 ETH in gas for a 0.001
 * ETH premium while the relayer's own transactions cost almost nothing.
 * MetaMask shows these as the site's suggestion and the user can still raise
 * them; if the RPC can't say, the wallet decides as before.
 */
export async function networkFees(rpc: Pick<JsonRpcProvider, 'getFeeData'>): Promise<{maxFeePerGas?: bigint;maxPriorityFeePerGas?: bigint;}> {
  try {
    const { maxFeePerGas, maxPriorityFeePerGas } = await rpc.getFeeData();
    if (maxFeePerGas === null || maxPriorityFeePerGas === null) return {};
    const tip = maxPriorityFeePerGas > MIN_TIP_WEI ? maxPriorityFeePerGas : MIN_TIP_WEI;
    // ethers sets maxFee to twice the base fee plus the tip; keep that headroom.
    return { maxFeePerGas: maxFeePerGas - maxPriorityFeePerGas + tip, maxPriorityFeePerGas: tip };
  } catch {
    return {};
  }
}
