/**
 * Groups item indices into batches that respect a provider's limits, preserving order.
 * An item longer than `maxChars` gets a batch of its own (the provider decides if it fits).
 */
export function makeBatches(lengths: readonly number[], indices: readonly number[], maxChars: number, maxItems: number): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  for (const index of indices) {
    const length = lengths[index] ?? 0;
    if (current.length > 0 && (current.length >= maxItems || chars + length > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(index);
    chars += length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
