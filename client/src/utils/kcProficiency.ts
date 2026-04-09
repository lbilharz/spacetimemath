/**
 * EduGraph Knowledge Component proficiency analysis.
 *
 * Mirrors server/src/generator.rs KC tagging and computes per-KC
 * proficiency (accuracy, speed, consistency) from answer history.
 * Designed to scale to future competency domains (addition, division, …).
 */

import type { Answer, ProblemStat } from '../module_bindings/types.js';

// ---------------------------------------------------------------------------
// KC Definitions — 0-based indices matching translation keys dkt.0 … dkt.10
// ---------------------------------------------------------------------------

export const KC = {
  ZeroProperty: 0,
  Identity: 1,
  Fact2s: 2,
  Fact5s: 3,
  Fact9s: 4,
  Fact10s: 5,
  Square: 6,
  Commutative: 7,
  FactHard: 8,
  ExtendedBase10: 9,
  ExtendedCoreDigit: 10,
} as const;

export const KC_COUNT = 11;

/** KCs that are always implicitly known — never surface as a "focus area" even if untouched. */
export const KC_TRIVIAL = new Set([KC.ZeroProperty, KC.Identity]);

// ---------------------------------------------------------------------------
// KC Tagging — client-side mirror of calculate_kcs_for_multiplication
// ---------------------------------------------------------------------------

/** Returns 0-based KC indices for a multiplication pair. */
export function tagKCs(a: number, b: number): number[] {
  const kcs: number[] = [];
  const maxVal = Math.max(a, b);

  // Extended
  if (maxVal > 10) {
    kcs.push(KC.ExtendedBase10, KC.ExtendedCoreDigit);
    return kcs;
  }

  // Zero property
  if (a === 0 || b === 0) {
    kcs.push(KC.ZeroProperty);
    return kcs;
  }

  // Identity
  if (a === 1 || b === 1) {
    kcs.push(KC.Identity);
    return kcs;
  }

  // Squares
  if (a === b) kcs.push(KC.Square);

  // Fact families
  if (a === 2 || b === 2) kcs.push(KC.Fact2s);
  else if (a === 5 || b === 5) kcs.push(KC.Fact5s);
  else if (a === 9 || b === 9) kcs.push(KC.Fact9s);
  else if (a === 10 || b === 10) kcs.push(KC.Fact10s);

  // Hard facts
  const pair = a < b ? `${a},${b}` : `${b},${a}`;
  if (pair === '6,7' || pair === '6,8' || pair === '7,8') {
    kcs.push(KC.FactHard);
  }

  // Commutative — mid-range pairs (3,4,6,7,8) that don't match any specific family
  if (kcs.length === 0) {
    kcs.push(KC.Commutative);
  }

  return kcs;
}

// ---------------------------------------------------------------------------
// Proficiency Model
// ---------------------------------------------------------------------------

export type Classification = 'fluent' | 'developing' | 'struggling' | 'untouched';

export interface KcProficiency {
  kcIndex: number;
  nameKey: string;          // e.g. 'dkt.2'
  accuracy: number;         // 0–1
  avgSpeedMs: number;       // average response time on correct answers
  totalAttempts: number;
  classification: Classification;
}

interface KcBucket {
  correct: number;
  total: number;
  correctSpeedSum: number;
  correctSpeedCount: number;
}

/**
 * Compute per-KC proficiency from answer history.
 * Uses the last `window` answers per KC for recency weighting.
 */
export function computeProficiency(
  answers: Answer[],
  relevantKCs?: number[],
  window = 30,
): KcProficiency[] {
  // Bucket answers by KC
  const buckets = new Map<number, KcBucket>();
  for (let i = 0; i < KC_COUNT; i++) {
    buckets.set(i, { correct: 0, total: 0, correctSpeedSum: 0, correctSpeedCount: 0 });
  }

  // Tag each answer and accumulate — walk backwards for recency, cap at window per KC
  const seen = new Map<number, number>();
  const sorted = [...answers].sort((x, y) => {
    // Sort by id descending (most recent first)
    if (x.id > y.id) return -1;
    if (x.id < y.id) return 1;
    return 0;
  });

  for (const ans of sorted) {
    const kcs = tagKCs(ans.a, ans.b);
    for (const kc of kcs) {
      const count = seen.get(kc) ?? 0;
      if (count >= window) continue;
      seen.set(kc, count + 1);

      const bucket = buckets.get(kc)!;
      bucket.total++;
      if (ans.isCorrect) {
        bucket.correct++;
        bucket.correctSpeedSum += ans.responseMs;
        bucket.correctSpeedCount++;
      }
    }
  }

  const filter = relevantKCs ? new Set(relevantKCs) : null;
  const result: KcProficiency[] = [];

  for (const [kcIndex, bucket] of buckets) {
    if (filter && !filter.has(kcIndex)) continue;

    const accuracy = bucket.total > 0 ? bucket.correct / bucket.total : 0;
    const avgSpeedMs = bucket.correctSpeedCount > 0
      ? bucket.correctSpeedSum / bucket.correctSpeedCount
      : 0;

    let classification: Classification;
    if (bucket.total < 5) {
      classification = 'untouched';
    } else if (accuracy >= 0.9 && avgSpeedMs < 3000) {
      classification = 'fluent';
    } else if (accuracy < 0.7) {
      classification = 'struggling';
    } else {
      classification = 'developing';
    }

    result.push({
      kcIndex,
      nameKey: `dkt.name${kcIndex}`,
      accuracy,
      avgSpeedMs,
      totalAttempts: bucket.total,
      classification,
    });
  }

  return result;
}

/**
 * Returns the KCs relevant to a player's current learning tier.
 * Tier 0 = Identity, Fact2s, Fact10s.  Higher tiers add more.
 */
export function relevantKCsForTier(tier: number): number[] {
  // Always include the base KCs that appear in every tier's problem pool
  const kcs: number[] = [KC.Identity, KC.Fact2s, KC.Fact10s];

  if (tier >= 1) kcs.push(KC.Commutative); // 3×anything pairs start appearing
  if (tier >= 2) kcs.push(KC.Fact5s);
  if (tier >= 4) kcs.push(KC.Fact9s);       // ×6 tier introduces 9-adjacent problems
  if (tier >= 5) kcs.push(KC.Square);        // more squares become relevant
  if (tier >= 6) kcs.push(KC.FactHard);      // 6×7, 6×8, 7×8
  if (tier >= 7) kcs.push(KC.ExtendedBase10, KC.ExtendedCoreDigit);

  return kcs;
}

// ---------------------------------------------------------------------------
// Lightweight focus hint from ProblemStats (no answer history needed)
// ---------------------------------------------------------------------------

interface KcStatBucket {
  attempts: number;
  correct: number;
}

/**
 * Find the weakest KC for a player's tier from aggregated ProblemStats.
 * Returns { kcIndex, nameKey, accuracy } or null if not enough data.
 * Much lighter than computeProficiency — works without answer history.
 */
export function focusKCFromStats(
  problemStats: ProblemStat[],
  tier: number,
): { kcIndex: number; nameKey: string; accuracy: number } | null {
  const relevant = new Set(relevantKCsForTier(tier));
  const buckets = new Map<number, KcStatBucket>();
  for (const kc of relevant) {
    buckets.set(kc, { attempts: 0, correct: 0 });
  }

  for (const ps of problemStats) {
    if (ps.attemptCount === 0) continue;
    const kcs = tagKCs(ps.a, ps.b);
    for (const kc of kcs) {
      const bucket = buckets.get(kc);
      if (!bucket) continue;
      bucket.attempts += ps.attemptCount;
      bucket.correct += ps.correctCount;
    }
  }

  // Find the weakest KC with enough data, or an untouched one
  let weakest: { kcIndex: number; accuracy: number } | null = null;
  let hasUntouched = false;

  for (const [kcIndex, bucket] of buckets) {
    if (bucket.attempts < 5) {
      hasUntouched = true;
      if (!weakest) {
        weakest = { kcIndex, accuracy: 0 };
      }
      continue;
    }
    const accuracy = bucket.correct / bucket.attempts;
    if (!weakest || accuracy < weakest.accuracy) {
      weakest = { kcIndex, accuracy };
    }
  }

  // Don't show a focus hint if everything is strong (>90%) and nothing untouched
  if (weakest && weakest.accuracy > 0.9 && !hasUntouched) return null;

  if (!weakest) return null;
  return {
    kcIndex: weakest.kcIndex,
    nameKey: `dkt.name${weakest.kcIndex}`,
    accuracy: weakest.accuracy,
  };
}
