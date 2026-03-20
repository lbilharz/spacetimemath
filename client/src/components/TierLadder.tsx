import { useTranslation } from 'react-i18next';
import type { ParseKeys } from 'i18next';

const TIER_EMOJIS = ['🌱', '🔨', '⚡', '🎯', '🔥', '💫', '🌟', '🏆'] as const;

// What each tier adds (displayed as a badge)
const TIER_NEW_FACTORS: (string | null)[] = [
  null,   // tier 0: base set ×1 ×2 ×10
  '×3', '×5', '×4', '×6', '×7', '×8', '×9',
];

interface Props {
  /** The player's current (earned) tier — highlighted with accent ring. */
  currentTier: number;
  /** If provided, this tier shows as "selected" (interactive mode). */
  selectedTier?: number;
  /** If provided, rows become clickable buttons. */
  onSelect?: (tier: number) => void;
}

export default function TierLadder({ currentTier, selectedTier, onSelect }: Props) {
  const { t } = useTranslation();
  const interactive = !!onSelect;

  return (
    <div className="flex flex-col gap-2">
      {TIER_EMOJIS.map((emoji, tier) => {
        const isCurrent = tier === currentTier;
        const isSelected = selectedTier !== undefined ? tier === selectedTier : isCurrent;
        const newFactor = TIER_NEW_FACTORS[tier];

        return (
          <button
            key={tier}
            onClick={interactive ? () => onSelect(tier) : undefined}
            disabled={!interactive}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 transition-all active:scale-[0.98] ${
              isSelected
                ? 'border-brand-yellow bg-brand-yellow/5 dark:bg-brand-yellow/10'
                : 'border-slate-100 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900'
            }`}
          >
            {/* Emoji */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center text-lg leading-none">
              {emoji}
            </span>

            {/* Tier name */}
            <span
              className={`flex-1 text-left text-sm font-bold transition-colors ${
                isSelected ? 'text-brand-yellow' : 'text-slate-900 dark:text-white'
              }`}
            >
              {t(`tiers.tier${tier}Name` as ParseKeys)}
            </span>

            {/* Description in interactive mode */}
            {interactive && (
              <span className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:inline truncate max-w-[100px]">
                {t(`tierPicker.tier${tier}Desc` as ParseKeys)}
              </span>
            )}

            {/* Factor badge */}
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                newFactor
                  ? 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                  : 'border-transparent bg-slate-200/50 text-slate-500 dark:bg-slate-800/50'
              }`}
            >
              {newFactor ? `+${newFactor}` : '×1 ×2 ×10'}
            </span>

            {/* Current indicator */}
            {isCurrent && !interactive && (
              <span className="shrink-0 rounded-md bg-brand-yellow/20 px-1.5 py-0.5 text-[9px] font-black tracking-tighter text-brand-yellow">
                YOU
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
