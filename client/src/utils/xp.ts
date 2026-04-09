import type { Answer, ProblemStat } from '../module_bindings/types.js';

export interface RankContext {
  id: number;
  nameKey: string;
  minXp: number;
  maxXp: number;
  color: string;
  icon: string;
  unlockKey: string;   // translation key for what this rank unlocks
}

// Difficulty-weighted XP: harder problems earn more.
// Base 10 XP × difficulty_weight (0.2–2.0 range from server ProblemStats).
const BASE_XP = 10;

export const RANKS: RankContext[] = [
  { id: 0, nameKey: 'ranks.bronze1', minXp: 0,     maxXp: 500,      color: 'text-amber-700 dark:text-amber-600', icon: '🥉', unlockKey: '' },
  { id: 1, nameKey: 'ranks.bronze2', minXp: 500,    maxXp: 1500,     color: 'text-amber-700 dark:text-amber-600', icon: '🥉', unlockKey: 'ranks.unlock.bronze2' },
  { id: 2, nameKey: 'ranks.bronze3', minXp: 1500,   maxXp: 3000,     color: 'text-amber-700 dark:text-amber-600', icon: '🥉', unlockKey: 'ranks.unlock.bronze3' },
  { id: 3, nameKey: 'ranks.silver1', minXp: 3000,   maxXp: 5000,     color: 'text-slate-400 dark:text-slate-300', icon: '🥈', unlockKey: 'ranks.unlock.silver1' },
  { id: 4, nameKey: 'ranks.silver2', minXp: 5000,   maxXp: 8000,     color: 'text-slate-400 dark:text-slate-300', icon: '🥈', unlockKey: 'ranks.unlock.silver2' },
  { id: 5, nameKey: 'ranks.silver3', minXp: 8000,   maxXp: 12000,    color: 'text-slate-400 dark:text-slate-300', icon: '🥈', unlockKey: 'ranks.unlock.silver3' },
  { id: 6, nameKey: 'ranks.gold1',   minXp: 12000,  maxXp: 18000,    color: 'text-yellow-500 dark:text-yellow-400', icon: '🥇', unlockKey: 'ranks.unlock.gold1' },
  { id: 7, nameKey: 'ranks.gold2',   minXp: 18000,  maxXp: 25000,    color: 'text-yellow-500 dark:text-yellow-400', icon: '🥇', unlockKey: 'ranks.unlock.gold2' },
  { id: 8, nameKey: 'ranks.gold3',   minXp: 25000,  maxXp: 35000,    color: 'text-yellow-500 dark:text-yellow-400', icon: '🥇', unlockKey: 'ranks.unlock.gold3' },
  { id: 9, nameKey: 'ranks.diamond', minXp: 35000,  maxXp: Infinity,  color: 'text-cyan-400 dark:text-cyan-300', icon: '💎', unlockKey: 'ranks.unlock.diamond' },
];

/**
 * Build a lookup from problemKey → difficultyWeight for fast XP computation.
 */
function buildWeightMap(problemStats: ProblemStat[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const ps of problemStats) {
    map.set(ps.problemKey, ps.difficultyWeight);
  }
  return map;
}

/**
 * Compute difficulty-weighted XP from answer history.
 * Each correct answer earns round(BASE_XP × difficulty_weight).
 * Falls back to flat 10 XP if no ProblemStat exists for a pair.
 */
export function calculateWeightedXp(answers: Answer[], problemStats: ProblemStat[]): number {
  const weights = buildWeightMap(problemStats);
  let total = 0;
  for (const ans of answers) {
    if (!ans.isCorrect) continue;
    const key = ans.a * 100 + ans.b;
    const w = weights.get(key) ?? 1.0;
    total += Math.round(BASE_XP * w);
  }
  return total;
}

/**
 * Legacy flat XP: 10 per correct answer.
 * Used as fallback when answer history isn't available.
 */
export function calculatePlayerXp(totalCorrect: number): number {
  return totalCorrect * 10;
}

export function getRankForXp(xp: number): RankContext {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (xp >= RANKS[i].minXp) {
      return RANKS[i];
    }
  }
  return RANKS[0];
}

export function getNextRank(currentRankId: number): RankContext | null {
  if (currentRankId >= RANKS.length - 1) return null;
  return RANKS[currentRankId + 1];
}
