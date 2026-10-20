/**
 * Runs `work` over `items` keeping at most `limit` in flight.
 *
 * Chain reads are round-trip bound (~0.8 s each from here), so fetching a
 * contract's items one after another costs `items x 0.8 s`. They don't depend
 * on each other, so they are fetched a few at a time instead. The limit keeps
 * a large list from opening dozens of sockets at once.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]!, index);
    }
  });
  await Promise.all(workers);

  return results;
}
