import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import type { Answer } from '../module_bindings/types.js';

import { TIER_EMOJI } from '../utils/learningTier.js';
import { KC } from '../utils/kcProficiency.js';

// What each tier adds (displayed as a badge)
const TIER_NEW_FACTORS: (string | null)[] = [
  null,   // tier 0: base set ×1 ×2 ×10
  '×3', '×5', '×4', '×6', '×7', '×8', '×9',
  '×11 & ×12', '×13', '×14', '×15', '×16', '×17', '×18', '×19', '×20',
];

// The factor(s) introduced at each tier — used to bucket answer speed stats.
const TIER_FACTORS: number[][] = [
  [1, 2, 10],   // 0
  [3],          // 1
  [5],          // 2
  [4],          // 3
  [6],          // 4
  [7],          // 5
  [8],          // 6
  [9],          // 7
  [11, 12],     // 8
  [13],         // 9
  [14],         // 10
  [15],         // 11
  [16],         // 12
  [17],         // 13
  [18],         // 14
  [19],         // 15
  [20],         // 16
];

// Primary KC indices per tier — mirrors server/src/lib.rs::tier_primary_kcs.
// These are 0-based kc_mastery vector indices (EduGraphKC value - 1).
const TIER_PRIMARY_KCS: number[][] = [
  [KC.Identity, KC.Fact2s, KC.Fact10s], // 0
  [KC.Fact3s],    // 1
  [KC.Fact5s],    // 2
  [KC.Fact4s],    // 3
  [KC.Fact6s],    // 4
  [KC.Fact7s],    // 5
  [KC.Fact8s],    // 6
  [KC.Fact9s],    // 7
  [KC.Fact11s, KC.Fact12s], // 8
  [KC.Fact13s],   // 9
  [KC.Fact14s],   // 10
  [KC.Fact15s],   // 11
  [KC.Fact16s],   // 12
  [KC.Fact17s],   // 13
  [KC.Fact18s],   // 14
  [KC.Fact19s],   // 15
  [KC.Fact20s],   // 16
];

interface TierStats {
  mastery: number | null;  // 0–1, min over primary KCs; null if no DKT row
  avgSpeedMs: number | null;
}

function computeSpeedByTier(answers: Answer[]): Map<number, number> {
  const result = new Map<number, number>();
  for (let tier = 0; tier < TIER_FACTORS.length; tier++) {
    const factors = new Set(TIER_FACTORS[tier]);
    let speedSum = 0, speedCount = 0;
    for (const ans of answers) {
      if (!factors.has(ans.a) && !factors.has(ans.b)) continue;
      if (ans.a > 10 || ans.b > 10) continue;
      if (!ans.isCorrect) continue;
      speedSum += ans.responseMs;
      speedCount++;
    }
    if (speedCount >= 5) result.set(tier, speedSum / speedCount);
  }
  return result;
}

/** Compute min-of-primary-KCs mastery per tier — mirrors the server's tier gate. */
function computeTierStats(
  kcMastery: number[] | null | undefined,
  answers: Answer[] | undefined,
): Map<number, TierStats> {
  const result = new Map<number, TierStats>();
  const speeds = answers ? computeSpeedByTier(answers) : new Map<number, number>();

  for (let tier = 0; tier < TIER_PRIMARY_KCS.length; tier++) {
    let mastery: number | null = null;
    if (kcMastery && kcMastery.length > 0) {
      const primary = TIER_PRIMARY_KCS[tier];
      let min = 1;
      for (const kc of primary) {
        const v = kcMastery[kc] ?? 0.5;
        if (v < min) min = v;
      }
      mastery = min;
    }
    result.set(tier, { mastery, avgSpeedMs: speeds.get(tier) ?? null });
  }
  return result;
}

interface Props {
  /** The player's current (earned) tier — highlighted with accent ring. */
  currentTier: number;
  /** If provided, this tier shows as "selected" (interactive mode). */
  selectedTier?: number;
  /** If provided, rows become clickable buttons. */
  onSelect?: (tier: number) => void;
  /** Optional: player's answers for per-tier speed display. */
  answers?: Answer[];
  /** Optional: authoritative per-KC mastery from server (my_player_dkt_weights). */
  kcMastery?: number[] | null;
  /** Whether to show the extended tiers 8-16. */
  extendedMode?: boolean;
}

export default function TierLadder({ currentTier, selectedTier, onSelect, answers, kcMastery, extendedMode = false }: Props) {
  const { t } = useTranslation();
  const interactive = !!onSelect;

  const tierStats = useMemo(
    () => computeTierStats(kcMastery, answers),
    [kcMastery, answers],
  );

  const hasAnyStats = !!kcMastery && kcMastery.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Column headers — only when stats are available and non-interactive */}
      {hasAnyStats && (
        <div className="grid items-center px-3 pb-0.5 gap-x-2" style={{ gridTemplateColumns: '1.5rem 1fr 3.5rem 3.5rem 4.5rem' }}>
          <span />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t('tierLadder.level' as ParseKeys)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">
            {t('tierLadder.acc' as ParseKeys)}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">
            {t('tierLadder.spd' as ParseKeys)}
          </span>
          <span />
        </div>
      )}
      {TIER_EMOJI.map((emoji, tier) => {
        if (!extendedMode && tier > 7) return null;
        
        const isCurrent = tier === currentTier;
        const isSelected = selectedTier !== undefined ? tier === selectedTier : isCurrent;
        const newFactor = TIER_NEW_FACTORS[tier];
        const stats = tierStats.get(tier);
        const showStats = hasAnyStats;

        return (
          <button
            key={tier}
            onClick={interactive ? () => onSelect(tier) : undefined}
            disabled={!interactive}
            className={`grid w-full items-center gap-x-2 rounded-xl border-2 px-3 py-2 transition-all active:scale-[0.98] ${
              isSelected
                ? 'border-brand-yellow bg-brand-yellow/5 dark:bg-brand-yellow/10'
                : 'border-slate-100 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900'
            } ${interactive ? 'cursor-pointer' : ''}`}
            style={{ gridTemplateColumns: showStats ? '1.5rem 1fr 3.5rem 3.5rem 4.5rem' : '1.5rem 1fr auto' }}
          >
            {/* Emoji */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg leading-none">
              {emoji}
            </span>

            {/* Tier name + interactive desc */}
            <span className="flex items-center gap-2 min-w-0">
              <span
                className={`text-left text-sm font-bold transition-colors truncate ${
                  isSelected ? 'text-brand-yellow' : 'text-slate-900 dark:text-white'
                }`}
              >
                {t(`tiers.tier${tier}Name` as ParseKeys)}
              </span>
              {interactive && (
                <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline truncate">
                  {t(`tierPicker.tier${tier}Desc` as ParseKeys)}
                </span>
              )}
            </span>

            {/* Mastery column (from server DKT weights) */}
            {showStats && (
              <span className={`text-right text-[11px] font-bold tabular-nums ${
                stats?.mastery != null
                  ? stats.mastery >= 0.8 ? 'text-green-600 dark:text-green-400'
                    : stats.mastery >= 0.6 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400'
                  : 'text-slate-300 dark:text-slate-700'
              }`}>
                {stats?.mastery != null ? `${Math.round(stats.mastery * 100)}%` : '—'}
              </span>
            )}

            {/* Speed column */}
            {showStats && (
              <span className={`text-right text-[11px] font-bold tabular-nums ${
                stats?.avgSpeedMs != null ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-700'
              }`}>
                {stats?.avgSpeedMs != null ? `${(stats.avgSpeedMs / 1000).toFixed(1)}s` : '—'}
              </span>
            )}

            {/* Factor badge + YOU indicator */}
            <span className="flex items-center justify-end gap-1.5">
              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  newFactor
                    ? 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                    : 'border-transparent bg-slate-200/50 text-slate-500 dark:bg-slate-800/50'
                }`}
              >
                {newFactor ? `+${newFactor}` : '×1 ×2 ×10'}
              </span>
              {isCurrent && !interactive && (
                <span className="shrink-0 rounded-md bg-brand-yellow/20 px-1.5 py-0.5 text-[9px] font-black tracking-tighter text-brand-yellow">
                  YOU
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
