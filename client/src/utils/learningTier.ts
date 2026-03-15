/**
 * Returns the learning tier for a single factor value.
 * Returns 99 for ×0 and extended factors (excluded from pool).
 * Tier ladder: ×1/×2/×10 → ×3 → ×5 → ×4 → ×6 → ×7 → ×8 → ×9 (tiers 0–7).
 */
function factorTier(x: number): number {
  if (x === 0) return 99;         // excluded
  if ([1, 2, 10].includes(x)) return 0;
  if (x === 3) return 1;
  if (x === 5) return 2;
  if (x === 4) return 3;
  if (x === 6) return 4;
  if (x === 7) return 5;
  if (x === 8) return 6;
  if (x === 9) return 7;
  return 99; // 11, 12, 15, 20, 25 — excluded
}

/**
 * Learning tier of an ordered pair = min(tier(a), tier(b)).
 * A pair belongs to the tier of its easier factor: 2×7 and 7×2 are both tier 0
 * (part of the ×2 table), even though ×7 hasn't been unlocked yet.
 * Old design used Math.max; changed to Math.min so pools are [unlocked] × [1–10].
 */
export function learningTierOf(a: number, b: number): number {
  const ta = factorTier(a);
  const tb = factorTier(b);
  if (ta === 99 || tb === 99) return 99; // either factor excluded → pair excluded
  return Math.min(ta, tb);
}
