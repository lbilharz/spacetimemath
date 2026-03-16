import { describe, it, expect } from 'vitest';
import { canSeeExtendedToggle } from './extendedMode.js';

describe('canSeeExtendedToggle', () => {
  it('returns true when learningTier >= 7', () => {
    expect(canSeeExtendedToggle(7)).toBe(true);
    expect(canSeeExtendedToggle(8)).toBe(true);
  });

  it('returns false when learningTier < 7', () => {
    expect(canSeeExtendedToggle(6)).toBe(false);
    expect(canSeeExtendedToggle(0)).toBe(false);
  });
});
