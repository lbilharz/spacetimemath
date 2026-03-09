/**
 * Returns the learning tier for a single factor value.
 * Returns 99 for ×0 (excluded from pool).
 */
function factorTier(x: number): number {
  if (x === 0) return 99; // excluded
  if ([1, 2, 5, 10].includes(x)) return 0;
  if ([3, 4].includes(x)) return 1;
  if ([6, 7, 8, 9].includes(x)) return 2;
  return 3; // 11, 12, 15, 20, 25
}

/**
 * Learning tier of an ordered pair = max(tier(a), tier(b)).
 * Returns 99 for excluded pairs (those involving ×0).
 */
export function learningTierOf(a: number, b: number): number {
  return Math.max(factorTier(a), factorTier(b));
}
