import { describe, it, expect } from 'vitest';
import { getRechenweg } from './rechenwege.js';

// ---------------------------------------------------------------------------
// Helper: assert steps lead to the correct result and form a valid chain
// ---------------------------------------------------------------------------
function result(a: number, b: number) {
  return a * b;
}

// ---------------------------------------------------------------------------
// ×0 and ×1 — trivial identity rules
// ---------------------------------------------------------------------------
describe('×0', () => {
  it('returns 0 for any factor', () => {
    const r = getRechenweg(7, 0);
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0]).toContain('0');
    expect(r.strategyKey).toBe('rechenweg.zero');
  });
});

describe('×1', () => {
  it('returns the other factor unchanged', () => {
    const r = getRechenweg(1, 8);
    expect(r.steps[0]).toContain('8');
    expect(r.strategyKey).toBe('rechenweg.one');
  });
});

// ---------------------------------------------------------------------------
// ×2 — doubling
// ---------------------------------------------------------------------------
describe('×2', () => {
  it('shows big + big', () => {
    const r = getRechenweg(2, 7);
    expect(r.steps[0]).toBe('7 + 7 = 14');
    expect(r.strategyKey).toBe('rechenweg.double');
  });
});

// ---------------------------------------------------------------------------
// ×3 — double and add one more group
// ---------------------------------------------------------------------------
describe('×3', () => {
  it('shows ×2 then +big', () => {
    const r = getRechenweg(3, 6);
    expect(r.steps[0]).toBe('6 × 2 = 12');
    expect(r.steps[1]).toBe('12 + 6 = 18');
    expect(r.strategyKey).toBe('rechenweg.doubleAndOne');
  });
});

// ---------------------------------------------------------------------------
// ×4 — double-double
// ---------------------------------------------------------------------------
describe('×4', () => {
  it('shows ×2 then ×2 again', () => {
    const r = getRechenweg(4, 7);
    expect(r.steps[0]).toBe('7 × 2 = 14');
    expect(r.steps[1]).toBe('14 × 2 = 28');
    expect(r.strategyKey).toBe('rechenweg.doubleDouble');
  });
});

// ---------------------------------------------------------------------------
// ×5 — ×10 then halve
// ---------------------------------------------------------------------------
describe('×5', () => {
  it('shows ×10 ÷ 2', () => {
    const r = getRechenweg(5, 8);
    expect(r.steps[0]).toBe('8 × 10 = 80');
    expect(r.steps[1]).toBe('80 ÷ 2 = 40');
    expect(r.strategyKey).toBe('rechenweg.timesTenHalf');
  });
});

// ---------------------------------------------------------------------------
// ×6 — ×5 + one more group
// ---------------------------------------------------------------------------
describe('×6', () => {
  it('shows ×5 then +big', () => {
    const r = getRechenweg(6, 7);
    expect(r.steps[0]).toBe('7 × 5 = 35');
    expect(r.steps[1]).toBe('35 + 7 = 42');
    expect(r.strategyKey).toBe('rechenweg.timesFivePlusOne');
  });
});

// ---------------------------------------------------------------------------
// ×7 — ×5 + ×2
// ---------------------------------------------------------------------------
describe('×7', () => {
  it('shows ×5 + ×2 using distributive law', () => {
    const r = getRechenweg(7, 8);
    expect(r.steps[0]).toBe('8 × 5 = 40');
    expect(r.steps[1]).toBe('8 × 2 = 16');
    expect(r.steps[2]).toBe('40 + 16 = 56');
    expect(r.strategyKey).toBe('rechenweg.timesFivePlusTwo');
  });
});

// ---------------------------------------------------------------------------
// ×8 — triple double (current strategy, kept)
// ---------------------------------------------------------------------------
describe('×8', () => {
  it('shows three doublings', () => {
    const r = getRechenweg(8, 9);
    expect(r.steps[0]).toBe('9 × 2 = 18');
    expect(r.steps[1]).toBe('18 × 2 = 36');
    expect(r.steps[2]).toBe('36 × 2 = 72');
    expect(r.strategyKey).toBe('rechenweg.tripleDouble');
  });
});

// ---------------------------------------------------------------------------
// ×9 — ×10 minus one group
// small = min(a,b), so need both factors ≥ 9 to reach case 9
// ---------------------------------------------------------------------------
describe('×9', () => {
  it('shows ×10 − big', () => {
    // min(9,9)=9 → case 9; big=9
    const r = getRechenweg(9, 9);
    expect(r.steps[0]).toBe('9 × 10 = 90');
    expect(r.steps[1]).toBe('90 − 9 = 81');
    expect(r.strategyKey).toBe('rechenweg.timesTenMinusOne');
  });

  it('also works with extended-tier factor (9 × 13)', () => {
    // min(9,13)=9 → case 9; big=13 (13 not in the 2-digit special list)
    const r = getRechenweg(9, 13);
    expect(r.steps[0]).toBe('13 × 10 = 130');
    expect(r.steps[1]).toBe('130 − 13 = 117');
    expect(r.strategyKey).toBe('rechenweg.timesTenMinusOne');
  });
});

// ---------------------------------------------------------------------------
// ×10 — min(a,b) must equal 10 to reach case 10
// ---------------------------------------------------------------------------
describe('×10', () => {
  it('shows direct ×10 (10 × 10)', () => {
    const r = getRechenweg(10, 10);
    expect(r.steps[0]).toBe('10 × 10 = 100');
    expect(r.strategyKey).toBe('rechenweg.ten');
  });

  it('shows direct ×10 with extended-tier factor (10 × 11)', () => {
    // min(10,11)=10 → case 10; big=11
    const r = getRechenweg(10, 11);
    expect(r.steps[0]).toBe('11 × 10 = 110');
    expect(r.strategyKey).toBe('rechenweg.ten');
  });
});

// ---------------------------------------------------------------------------
// ×11 — ×10 + n  (single-digit n only)
// ---------------------------------------------------------------------------
describe('×11', () => {
  it('shows ×10 + n for single-digit factor', () => {
    const r = getRechenweg(11, 7);
    expect(r.steps[0]).toBe('7 × 10 = 70');
    expect(r.steps[1]).toBe('70 + 7 = 77');
    expect(r.strategyKey).toBe('rechenweg.eleven');
  });

  it('works both ways (commutative)', () => {
    const r1 = getRechenweg(11, 4);
    const r2 = getRechenweg(4, 11);
    expect(r1.strategyKey).toBe(r2.strategyKey);
    expect(r1.steps).toEqual(r2.steps);
  });
});

// ---------------------------------------------------------------------------
// ×12 — ×10 + ×2
// ---------------------------------------------------------------------------
describe('×12', () => {
  it('shows ×10 + ×2 using distributive law', () => {
    const r = getRechenweg(12, 6);
    expect(r.steps[0]).toBe('6 × 10 = 60');
    expect(r.steps[1]).toBe('6 × 2 = 12');
    expect(r.steps[2]).toBe('60 + 12 = 72');
    expect(r.strategyKey).toBe('rechenweg.twelve');
  });
});

// ---------------------------------------------------------------------------
// ×15 — distributive law: n×10 + n×5
// Tests both correct steps AND unambiguous hint
// ---------------------------------------------------------------------------
describe('×15', () => {
  it('uses distributive law: n×10 + n×5', () => {
    const r = getRechenweg(15, 6);
    expect(r.steps[0]).toBe('6 × 10 = 60');
    expect(r.steps[1]).toBe('6 × 5 = 30');   // ← step 2 should be n×5 directly
    expect(r.steps[2]).toBe('60 + 30 = 90');
    expect(r.strategyKey).toBe('rechenweg.fifteen');
  });

  it('hint is unambiguous — no operator-precedence confusion', () => {
    const r = getRechenweg(15, 7);
    // Must NOT contain the ambiguous "n×10÷2" form
    expect(r.hint).not.toContain('÷');
    // Should reference both sub-products clearly
    expect(r.hint).toBe('7×10 + 7×5');
  });

  it('gives the right answer for all single-digit factors', () => {
    for (let n = 2; n <= 9; n++) {
      const r = getRechenweg(15, n);
      const last = r.steps.at(-1)!;
      expect(last).toContain(`= ${result(15, n)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// ×20 — ×2 then ×10
// ---------------------------------------------------------------------------
describe('×20', () => {
  it('shows ×2 then ×10', () => {
    const r = getRechenweg(20, 7);
    expect(r.steps[0]).toBe('7 × 2 = 14');
    expect(r.steps[1]).toBe('14 × 10 = 140');
    expect(r.strategyKey).toBe('rechenweg.twenty');
  });
});

// ---------------------------------------------------------------------------
// ×25 — distributive law: n×20 + n×5  (replaces the confusing n×100÷4)
// ---------------------------------------------------------------------------
describe('×25', () => {
  it('uses distributive law: n×20 + n×5, NOT n×100÷4', () => {
    const r = getRechenweg(25, 4);
    // Must not use the ×100÷4 approach
    expect(r.steps.join(' ')).not.toContain('× 100');
    expect(r.steps.join(' ')).not.toContain('÷ 4');
    // Should decompose into ×20 and ×5
    expect(r.steps[0]).toBe('4 × 20 = 80');
    expect(r.steps[1]).toBe('4 × 5 = 20');
    expect(r.steps[2]).toBe('80 + 20 = 100');
    expect(r.strategyKey).toBe('rechenweg.twentyfive');
  });

  it('gives the right answer for all single-digit factors', () => {
    for (let n = 2; n <= 9; n++) {
      const r = getRechenweg(25, n);
      const last = r.steps.at(-1)!;
      expect(last).toContain(`= ${result(25, n)}`);
    }
  });

  it('works both ways (commutative)', () => {
    const r1 = getRechenweg(25, 6);
    const r2 = getRechenweg(6, 25);
    expect(r1.strategyKey).toBe(r2.strategyKey);
    expect(r1.steps).toEqual(r2.steps);
  });

  it('hint reflects the decomposition clearly', () => {
    const r = getRechenweg(25, 7);
    expect(r.hint).toBe('7×20 + 7×5');
  });
});

// ---------------------------------------------------------------------------
// default / fallback — must NOT mislabel as 'doubleAndOne'
// ---------------------------------------------------------------------------
describe('default fallback', () => {
  it('uses a dedicated strategyKey, not rechenweg.doubleAndOne', () => {
    // Force the default branch with an unhandled pair (e.g. 13×13)
    const r = getRechenweg(13, 13);
    expect(r.strategyKey).not.toBe('rechenweg.doubleAndOne');
    expect(r.strategyKey).toBe('rechenweg.direct');
  });
});
