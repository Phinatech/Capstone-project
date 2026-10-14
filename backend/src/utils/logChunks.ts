/**
 * Splits the inclusive block range [fromBlock, toBlock] into consecutive
 * inclusive chunks of at most `size` blocks. Hosted RPCs cap how many blocks
 * one eth_getLogs request may span, so event history is read chunk by chunk.
 */
export function blockChunks(fromBlock: number, toBlock: number, size: number): Array<[number, number]> {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new RangeError(`Chunk size must be a positive whole number, got ${size}`);
  }
  const chunks: Array<[number, number]> = [];
  for (let from = fromBlock; from <= toBlock; from += size) {
    chunks.push([from, Math.min(from + size - 1, toBlock)]);
  }
  return chunks;
}
