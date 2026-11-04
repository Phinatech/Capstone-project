import { describe, expect, it } from 'vitest';
import { FeeData } from 'ethers';
import { MIN_TIP_WEI, networkFees } from './fees';

const gwei = (n: number) => BigInt(Math.round(n * 1e9));
const rpc = (fee: FeeData | Error) => ({ getFeeData: async () => {
  if (fee instanceof Error) throw fee;
  return fee;
} });

describe('network fees for the wallet', () => {
  it("passes the network's own fee through when its tip is above the floor", async () => {
    // Base fee 10 gwei, tip 2 gwei: ethers' maxFee is 2 x base + tip.
    const fees = await networkFees(rpc(new FeeData(null, gwei(22), gwei(2))) as never);
    expect(fees).toEqual({ maxFeePerGas: gwei(22), maxPriorityFeePerGas: gwei(2) });
  });

  it('raises a near-zero tip to 0.001 gwei, keeping the base-fee headroom', async () => {
    // What the public Sepolia node suggested: a 2 wei tip on a ~17 wei base fee.
    const fees = await networkFees(rpc(new FeeData(null, 36n, 2n)) as never);
    expect(fees).toEqual({ maxFeePerGas: 34n + MIN_TIP_WEI, maxPriorityFeePerGas: MIN_TIP_WEI });
    expect(fees.maxPriorityFeePerGas! * 1000n).toBeLessThan(gwei(1.5)); // vs MetaMask's 1.5 gwei default
  });

  it('leaves the fee to the wallet when the network cannot say', async () => {
    expect(await networkFees(rpc(new FeeData(gwei(1), null, null)) as never)).toEqual({});
    expect(await networkFees(rpc(new Error('rate limited')) as never)).toEqual({});
  });
});
