import { describe, it, expect } from 'vitest';
import { learningTierOf } from './learningTier.js';

// Tier model: pair tier = min(factor_tier(a), factor_tier(b))
// A pair belongs to the tier of its *easier* factor.
// So 2×7 and 7×2 are BOTH tier 0 — part of the ×2 table.
// Tier ladder: ×1/×2/×10 (0) → ×3 (1) → ×5 (2) → ×4 (3) → ×6 (4) → ×7 (5) → ×8 (6) → ×9 (7)

describe('learningTierOf — tier-0 pairs (involve at least one of ×1/×2/×10)', () => {
  it('1×1 is tier 0', () => { expect(learningTierOf(1, 1)).toBe(0); });
  it('2×2 is tier 0', () => { expect(learningTierOf(2, 2)).toBe(0); });
  it('10×1 is tier 0', () => { expect(learningTierOf(10, 1)).toBe(0); });
  it('2×9 is tier 0 (part of the ×2 table, even though ×9 is hard)', () => {
    expect(learningTierOf(2, 9)).toBe(0);
  });
  it('7×2 is tier 0 (symmetric — 2×7 and 7×2 have the same tier)', () => {
    expect(learningTierOf(7, 2)).toBe(0);
    expect(learningTierOf(2, 7)).toBe(0);
  });
  it('10×9 is tier 0 (part of the ×10 table)', () => {
    expect(learningTierOf(10, 9)).toBe(0);
  });
});

describe('learningTierOf — pair tier = min of both factor tiers', () => {
  // Pairs that define each tier: both factors at that tier (so min = that tier)
  it('3×3 is tier 1 (both ×3)', () => { expect(learningTierOf(3, 3)).toBe(1); });
  it('5×5 is tier 2 (both ×5)', () => { expect(learningTierOf(5, 5)).toBe(2); });
  it('4×4 is tier 3 (both ×4)', () => { expect(learningTierOf(4, 4)).toBe(3); });
  it('6×6 is tier 4 (both ×6)', () => { expect(learningTierOf(6, 6)).toBe(4); });
  it('7×7 is tier 5 (both ×7)', () => { expect(learningTierOf(7, 7)).toBe(5); });
  it('8×8 is tier 6 (both ×8)', () => { expect(learningTierOf(8, 8)).toBe(6); });
  it('9×9 is tier 7 (both ×9)', () => { expect(learningTierOf(9, 9)).toBe(7); });

  // Cross-tier pairs: dominated by the easier factor
  it('3×9 is tier 1, not 7 (×3 is easier than ×9)', () => {
    expect(learningTierOf(3, 9)).toBe(1);
  });
  it('5×8 is tier 2, not 6 (×5 is easier than ×8)', () => {
    expect(learningTierOf(5, 8)).toBe(2);
  });
});

describe('learningTierOf — excluded factors return 99', () => {
  it('×0 returns 99 (excluded from pool)', () => {
    expect(learningTierOf(0, 5)).toBe(99);
  });
  it('×11 returns 99 (out of scope)', () => {
    expect(learningTierOf(11, 1)).toBe(99);
  });
});
