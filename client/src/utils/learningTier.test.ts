import { describe, it, expect } from 'vitest';
import { learningTierOf } from './learningTier.js';

// These tests define the NEW tier mapping specified in Phase 2 SCORE-03.
// Currently pending (todo) — will turn RED → GREEN when Plan 02-03 updates learningTier.ts.
// Current behavior: ×5 is tier 0, ×4 is tier 1, ×3/×6/×7/×8/×9 are tier 2.
// Target behavior: granular 8-tier ladder as specified below.

describe('learningTierOf — starter factors are tier 0', () => {
  it('×1 is tier 0', () => {
    expect(learningTierOf(1, 1)).toBe(0);
  });

  it('×2 is tier 0', () => {
    expect(learningTierOf(2, 2)).toBe(0);
  });

  it('×10 is tier 0', () => {
    expect(learningTierOf(10, 1)).toBe(0);
  });
});

describe('learningTierOf — tier progression per spec', () => {
  it('×3 is tier 1', () => { expect(learningTierOf(3, 1)).toBe(1); });
  it('×5 is tier 2', () => { expect(learningTierOf(5, 1)).toBe(2); });
  it('×4 is tier 3', () => { expect(learningTierOf(4, 1)).toBe(3); });
  it('×6 is tier 4', () => { expect(learningTierOf(6, 1)).toBe(4); });
  it('×7 is tier 5', () => { expect(learningTierOf(7, 1)).toBe(5); });
  it('×8 is tier 6', () => { expect(learningTierOf(8, 1)).toBe(6); });
  it('×9 is tier 7', () => { expect(learningTierOf(9, 1)).toBe(7); });
});

describe('learningTierOf — excluded factors return 99', () => {
  it('×0 returns 99 (excluded from pool)', () => {
    expect(learningTierOf(0, 5)).toBe(99);
  });

  it('×11 returns 99 (out of scope)', () => { expect(learningTierOf(11, 1)).toBe(99); });
});
