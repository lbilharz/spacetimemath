import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';
import type { Answer } from '../module_bindings/types.js';

const TIER_EMOJIS = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'] as const;

// What each tier adds (displayed as a badge)
const TIER_NEW_FACTORS: (string | null)[] = [
  null,   // tier 0: base set ×1 ×2 ×10
  '×3', '×5', '×4', '×6', '×7', '×8', '×9',
];

// The factor(s) introduced at each tier — used to bucket answer stats
// Tier 0 covers ×1, ×2, ×10 (all sub-10 base problems)
// Higher tiers each introduce one new multiplier table
const TIER_FACTORS: number[][] = [
  [1, 2, 10],   // Starter
  [3],          // Builder
  [5],          // Climber
  [4],          // Achiever
  [6],          // Skilled
  [7],          // Advanced
  [8],          // Expert
  [9],          // Master
];

interface TierStats {
  accuracy: number;  // 0–1
  avgSpeedMs: number;
  attempts: number;
}

/** Compute per-tier stats directly from the factor tables each tier introduces. */
function computeTierStats(answers: Answer[]): Map<number, TierStats> {
  const result = new Map<number, TierStats>();

  for (let tier = 0; tier < TIER_FACTORS.length; tier++) {
    const factors = new Set(TIER_FACTORS[tier]);
    let correct = 0, total = 0, speedSum = 0, speedCount = 0;

    for (const ans of answers) {
      if (!factors.has(ans.a) && !factors.has(ans.b)) continue;
      // Exclude extended problems (>10) from base tier stats
      if (ans.a > 10 || ans.b > 10) continue;
      total++;
      if (ans.isCorrect) {
        correct++;
        speedSum += ans.responseMs;
        speedCount++;
      }
    }

    if (total >= 5) {
      result.set(tier, {
        accuracy: correct / total,
        avgSpeedMs: speedCount > 0 ? speedSum / speedCount : 0,
        attempts: total,
      });
    }
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
  /** Optional: player's answers for per-tier stats display. */
  answers?: Answer[];
}

export default function TierLadder({ currentTier, selectedTier, onSelect, answers }: Props) {
  const { t } = useTranslation();
  const interactive = !!onSelect;

  const tierStats = useMemo(
    () => answers && answers.length > 0 ? computeTierStats(answers) : new Map<number, TierStats>(),
    [answers],
  );

  const hasAnyStats = tierStats.size > 0;

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
      {TIER_EMOJIS.map((emoji, tier) => {
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

            {/* Accuracy column */}
            {showStats && (
              <span className={`text-right text-[11px] font-bold tabular-nums ${
                stats
                  ? stats.accuracy >= 0.9 ? 'text-green-600 dark:text-green-400'
                    : stats.accuracy >= 0.7 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400'
                  : 'text-slate-300 dark:text-slate-700'
              }`}>
                {stats ? `${Math.round(stats.accuracy * 100)}%` : '—'}
              </span>
            )}

            {/* Speed column */}
            {showStats && (
              <span className={`text-right text-[11px] font-bold tabular-nums ${
                stats ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-700'
              }`}>
                {stats ? `${(stats.avgSpeedMs / 1000).toFixed(1)}s` : '—'}
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
