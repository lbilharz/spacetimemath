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
    <div className="col gap-4">
      {TIER_EMOJIS.map((emoji, tier) => {
        const isCurrent  = tier === currentTier;
        const isSelected = selectedTier !== undefined ? tier === selectedTier : isCurrent;
        const newFactor  = TIER_NEW_FACTORS[tier];

        const row = (
          <div
            key={tier}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 10,
              border: isSelected
                ? '2px solid var(--accent)'
                : isCurrent && !interactive
                  ? '2px solid var(--accent)'
                  : '2px solid var(--border)',
              background: isSelected
                ? 'rgba(251,186,0,0.10)'
                : isCurrent && !interactive
                  ? 'rgba(251,186,0,0.06)'
                  : 'var(--card2)',
              cursor: interactive ? 'pointer' : 'default',
              transition: 'border-color 0.15s, background 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={interactive ? () => onSelect(tier) : undefined}
          >
            {/* Emoji */}
            <span style={{ fontSize: 20, lineHeight: 1, width: 24, textAlign: 'center' }}>
              {emoji}
            </span>

            {/* Tier name */}
            <span style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 700,
              color: isSelected ? 'var(--accent)' : 'var(--text)',
            }}>
              {t(`tiers.tier${tier}Name` as ParseKeys)}
            </span>

            {/* Description in interactive mode */}
            {interactive && (
              <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>
                {t(`tierPicker.tier${tier}Desc` as ParseKeys)}
              </span>
            )}

            {/* Factor badge */}
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: newFactor ? 'var(--text)' : 'var(--muted)',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '2px 7px',
              whiteSpace: 'nowrap',
            }}>
              {newFactor ? `+${newFactor}` : '×1 ×2 ×10'}
            </span>

            {/* Current indicator */}
            {isCurrent && !interactive && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--accent)',
                background: 'rgba(251,186,0,0.15)',
                borderRadius: 5,
                padding: '2px 6px',
              }}>
                YOU
              </span>
            )}
          </div>
        );

        return row;
      })}
    </div>
  );
}
